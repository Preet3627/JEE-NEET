
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient } from 'webdav';
import { knowledgeBase } from './data/knowledgeBase.js';

// --- SERVER SETUP ---
const app = express();

// Fix for Cross-Origin-Opener-Policy blocking Google Sign-In popup
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure dotenv to load .env from the project root
dotenv.config({ path: path.resolve(__dirname, '.env') });


// --- ENV & SETUP CHECK ---
const isConfigured = process.env.DB_HOST && process.env.JWT_SECRET && process.env.DB_USER && process.env.DB_NAME && process.env.ENCRYPTION_KEY && process.env.GOOGLE_CLIENT_ID;
const isNextcloudConfigured = !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN);

let pool = null;
let mailer = null;
const JWT_SECRET = process.env.JWT_SECRET;
let googleClient = null;
let webdavClient = null;
let musicWebdavClient = null;
let genAI = null;

// --- ENCRYPTION SETUP ---
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = isConfigured ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32) : null;
const IV_LENGTH = 16;

const encrypt = (text) => {
    if (!ENCRYPTION_KEY || !text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(typeof text === 'string' ? text : JSON.stringify(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (e) {
        console.error("Encryption error:", e);
        return text;
    }
};

const decrypt = (text) => {
    if (!ENCRYPTION_KEY || !text || !text.includes(':')) return text;
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        try {
            return JSON.parse(decrypted);
        } catch {
            return decrypted;
        }
    } catch (error) {
        return text; 
    }
};

// --- DATABASE INITIALIZATION ---
const initDB = async () => {
    if (!pool) return;
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sid VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255),
                password_hash VARCHAR(255),
                profile_photo LONGTEXT,
                is_verified BOOLEAN DEFAULT FALSE,
                role VARCHAR(50) DEFAULT 'student',
                api_token VARCHAR(255),
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_configs (
                user_id INT PRIMARY KEY,
                config LONGTEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        const dataTables = ['schedule_items', 'results', 'exams', 'study_sessions'];
        for (const table of dataTables) {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS ${table} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    data LONGTEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
        }
        await connection.query(`
            CREATE TABLE IF NOT EXISTS doubts (
                id VARCHAR(255) PRIMARY KEY,
                user_sid VARCHAR(255),
                question TEXT,
                question_image LONGTEXT,
                created_at DATETIME,
                author_name VARCHAR(255),
                author_photo LONGTEXT,
                status VARCHAR(50) DEFAULT 'active'
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS doubt_solutions (
                id VARCHAR(255) PRIMARY KEY,
                doubt_id VARCHAR(255),
                user_sid VARCHAR(255),
                solution TEXT,
                solution_image LONGTEXT,
                created_at DATETIME,
                solver_name VARCHAR(255),
                solver_photo LONGTEXT,
                FOREIGN KEY (doubt_id) REFERENCES doubts(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_sid VARCHAR(255),
                recipient_sid VARCHAR(255),
                content TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Database tables initialized successfully.");
        connection.release();
    } catch (error) {
        console.error("Failed to initialize database tables:", error);
    }
};


if (isConfigured) {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4'
        });
        
        initDB();
        
        googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        if(process.env.API_KEY) {
            genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
        }
        
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            mailer = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587', 10),
              secure: process.env.SMTP_SECURE === 'true',
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
        }

        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN) {
            webdavClient = createClient(
                `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                { username: process.env.NEXTCLOUD_SHARE_TOKEN, password: process.env.NEXTCLOUD_SHARE_PASSWORD }
            );
        }

        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN) {
            musicWebdavClient = createClient(
                `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                { username: process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, password: process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD }
            );
        }

    } catch (error) {
        console.error("FATAL ERROR: Could not create database pool or initialize services.", error);
    }
}

// --- MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Null token' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.userId = user.id;
        req.userRole = user.role;
        req.userSid = user.sid; 
        next();
    });
};

const adminMiddleware = (req, res, next) => {
    authMiddleware(req, res, () => {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: "Admin access required" });
        }
        next();
    });
};

// --- HELPER: Get Full User Data ---
const getUserData = async (userId) => {
    if (!pool) return null;
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
    let config = { settings: { accentColor: '#0891b2', theme: 'default' } };
    
    if (configRows.length > 0) {
        const rawConfig = configRows[0].config;
        const decrypted = decrypt(rawConfig);
        if (typeof decrypted === 'string') {
            try {
                const parsed = JSON.parse(decrypted);
                config = { ...config, ...parsed, settings: { ...config.settings, ...parsed.settings } };
            } catch (e) { console.warn("Config parse error", e); }
        } else if (typeof decrypted === 'object' && decrypted !== null) {
            config = { ...config, ...decrypted, settings: { ...config.settings, ...decrypted.settings } };
        }
    }

    if (!config.settings) config.settings = {};
    if (!config.settings.accentColor) config.settings.accentColor = '#0891b2';
    if (!config.settings.theme) config.settings.theme = 'default';

    const tables = ['schedule_items', 'results', 'exams', 'study_sessions'];
    const data = {};
    
    for (const table of tables) {
        try {
            const [rows] = await pool.query(`SELECT data FROM ${table} WHERE user_id = ?`, [userId]);
            data[table.toUpperCase()] = rows.map(r => decrypt(r.data));
        } catch (e) { data[table.toUpperCase()] = []; }
    }

    return {
        id: user.id,
        sid: user.sid,
        email: user.email,
        fullName: user.full_name,
        profilePhoto: user.profile_photo,
        isVerified: !!user.is_verified,
        role: user.role,
        last_seen: user.last_seen,
        apiToken: user.api_token,
        CONFIG: config,
        SCHEDULE_ITEMS: data.SCHEDULE_ITEMS || [],
        RESULTS: data.RESULTS || [],
        EXAMS: data.EXAMS || [],
        STUDY_SESSIONS: data.STUDY_SESSIONS || [],
        DOUBTS: []
    };
};


// --- API ENDPOINTS ---

const apiRouter = express.Router();
app.use('/api', apiRouter);

// 1. Status & Config
apiRouter.get('/status', async (req, res) => {
    try {
        if (!pool) return res.status(200).json({ status: 'misconfigured' });
        await pool.query('SELECT 1');
        res.json({ status: 'online' });
    } catch (error) {
        res.status(503).json({ status: 'offline', error: error.message });
    }
});

apiRouter.get('/dj-drop', async (req, res) => {
    const djDropUrl = 'https://nc.ponsrischool.in/index.php/s/em85Zdf2EYEkz3j/download';
    try {
        const response = await fetch(djDropUrl);
        if (!response.ok) throw new Error('Failed to fetch');
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        res.status(500).send("Error");
    }
});

apiRouter.get('/config/public', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        isNextcloudConfigured: isNextcloudConfigured
    });
});

// --- AUTH ROUTES ---
apiRouter.post('/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential || !googleClient || !pool) return res.status(400).json({ error: "Service unavailable" });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        
        if (!email) return res.status(400).json({ error: "No email provided" });

        let [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        let user = users[0];

        if (!user) {
            const sid = `S${Date.now().toString().slice(-6)}`;
            const [result] = await pool.query(
                "INSERT INTO users (sid, email, full_name, profile_photo, is_verified, role) VALUES (?, ?, ?, ?, 1, 'student')",
                [sid, email, payload.name, payload.picture]
            );
            const userId = result.insertId;
            const initialConfig = {
                WAKE: '06:00', SCORE: '0/300', WEAK: [], UNACADEMY_SUB: false,
                settings: { accentColor: '#0891b2', blurEnabled: true, mobileLayout: 'standard', forceOfflineMode: false, perQuestionTime: 180, examType: 'JEE' }
            };
            await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [userId, encrypt(initialConfig)]);
            [users] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
            user = users[0];
        }

        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        const userData = await getUserData(user.id);
        res.json({ token, user: userData });

    } catch (error) {
        res.status(401).json({ error: "Authentication failed" });
    }
});

apiRouter.post('/login', async (req, res) => {
    const { sid, password } = req.body;
    if (!pool) return res.status(500).json({ error: "Database error" });

    try {
        const [users] = await pool.query("SELECT * FROM users WHERE sid = ? OR email = ?", [sid, sid]);
        const user = users[0];

        if (!user) return res.status(404).json({ error: "User not found" });
        
        if (user.password_hash && !bcrypt.compareSync(password, user.password_hash)) {
             return res.status(401).json({ error: "Invalid password" });
        }
        
        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        const userData = await getUserData(user.id);
        res.json({ token, user: userData });

    } catch (error) {
        res.status(500).json({ error: "Login failed" });
    }
});

apiRouter.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await getUserData(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

apiRouter.post('/heartbeat', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503);
    try {
        await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/register', async (req, res) => {
    const { fullName, sid, email, password } = req.body;
    if (!pool) return res.status(503);
    
    try {
        const hash = bcrypt.hashSync(password, 10);
        const [existing] = await pool.query("SELECT id FROM users WHERE email = ? OR sid = ?", [email, sid]);
        if(existing.length > 0) return res.status(400).json({ error: "User already exists" });

        const [result] = await pool.query(
            "INSERT INTO users (sid, email, full_name, password_hash, is_verified, role) VALUES (?, ?, ?, ?, 1, 'student')",
            [sid, email, fullName, hash]
        );
        const userId = result.insertId;
        const initialConfig = { WAKE: '06:00', SCORE: '0/300', WEAK: [], settings: { accentColor: '#0891b2' } };
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [userId, encrypt(initialConfig)]);

        const token = jwt.sign({ id: userId, sid, role: 'student' }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ADMIN ROUTES ---
apiRouter.get('/admin/students', adminMiddleware, async (req, res) => {
    if (!pool) return res.status(503);
    try {
        const [students] = await pool.query("SELECT id, sid, email, full_name as fullName, profile_photo as profilePhoto, role, last_seen, is_verified FROM users");
        for (let s of students) {
            const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [s.id]);
            if (configRows.length > 0) {
                const raw = configRows[0].config;
                const decrypted = decrypt(raw);
                if (typeof decrypted === 'string') {
                    try { s.CONFIG = JSON.parse(decrypted); } catch { s.CONFIG = {}; }
                } else {
                    s.CONFIG = decrypted;
                }
            }
            if (!s.CONFIG) s.CONFIG = { settings: {} };
        }
        res.json(students);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/impersonate/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [users] = await pool.query("SELECT * FROM users WHERE sid = ?", [sid]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        const user = users[0];
        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/broadcast-task', adminMiddleware, async (req, res) => {
    const { task, examType } = req.body;
    if (!task) return res.status(400).json({ error: "No task provided" });

    try {
        let query = "SELECT id FROM users WHERE role = 'student'";
        const params = [];
        
        // Since examType is stored in JSON config, we have to filter in JS or efficient query
        // For simplicity/robustness with encrypted configs, we will fetch all, filter in JS
        // This assumes user base is manageable.
        
        const [users] = await pool.query(query);
        const targetUserIds = [];

        for (const user of users) {
            const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [user.id]);
            if (configRows.length > 0) {
                const config = decrypt(configRows[0].config);
                const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
                const studentExamType = parsedConfig.settings?.examType || 'JEE';
                
                if (examType === 'ALL' || studentExamType === examType) {
                    targetUserIds.push(user.id);
                }
            }
        }

        for (const userId of targetUserIds) {
            const taskForUser = { ...task, ID: `BCAST_${Date.now()}_${userId}` };
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [userId, encrypt(taskForUser)]);
        }

        res.json({ success: true, count: targetUserIds.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/admin/students/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        await pool.query("DELETE FROM users WHERE sid = ?", [sid]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/students/:sid/clear-data', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [users] = await pool.query("SELECT id FROM users WHERE sid = ?", [sid]);
        if(users.length === 0) return res.status(404).json({error: 'User not found'});
        const userId = users[0].id;
        
        await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [userId]);
        await pool.query("DELETE FROM results WHERE user_id = ?", [userId]);
        await pool.query("DELETE FROM exams WHERE user_id = ?", [userId]);
        await pool.query("DELETE FROM study_sessions WHERE user_id = ?", [userId]);
        
        // Reset config but keep settings
        const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
        if (configRows.length > 0) {
            let config = decrypt(configRows[0].config);
            config = typeof config === 'string' ? JSON.parse(config) : config;
            config.SCORE = "0/300";
            config.WEAK = [];
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(config), userId]);
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AI ROUTES (GENAI) ---

apiRouter.post('/ai/parse-text', authMiddleware, async (req, res) => {
    const { text, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
        Analyze the following text and extract study schedule items, exams, metrics, or flashcards.
        Return strictly valid JSON format.
        
        Text to parse: "${text}"
        
        Output Schema:
        {
          "schedules": [
            {
              "title": "Topic or Task Title",
              "day": "MONDAY",
              "time": "HH:MM",
              "type": "ACTION" (for study) or "HOMEWORK",
              "subject": "PHYSICS" | "CHEMISTRY" | "MATHS" | "BIOLOGY",
              "detail": "Detailed description",
              "q_ranges": "1-10; 20-25" (only for homework),
              "answers": "{\"1\":\"A\"}" (optional for homework),
              "gradient": "from-blue-500 to-cyan-500" (optional, use valid tailwind gradient classes if a color/mood is implied),
              "externalLink": "https://..." (optional, if a URL is present)
            }
          ],
          "exams": [
             { "title": "Exam Name", "subject": "FULL" | "PHYSICS"..., "date": "YYYY-MM-DD", "time": "HH:MM", "syllabus": "Topics..." }
          ],
          "metrics": [],
          "flashcard_deck": { "name": "Deck Name", "cards": [{"front": "Q", "back": "A"}] } (optional),
          "custom_widget": { "title": "Widget Title", "content": "Markdown content" } (optional)
        }
        
        If no valid data is found, return empty arrays.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResponse = response.text();
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.json(JSON.parse(textResponse));
    } catch (e) {
        console.error("AI Parse Error", e);
        res.status(500).json({ error: "Failed to parse text with AI" });
    }
});

apiRouter.post('/ai/chat', authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Convert history to Gemini format
        const chatHistory = history.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        let result;
        if (imageBase64) {
             // For multimodal chat, we can't use history easily with the current SDK in one go if history has images
             // Simplified: Just send prompt + image as a new generation if image exists
             const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            // Instruct AI to generate Deep Links for actions
            const systemPrompt = `
            You are an academic assistant for JEE/NEET. 
            Use the internal knowledge base.
            If the user asks to create a schedule or add a task, respond with a Deep Link URL in this format:
            ${domain}/?action=new_schedule&data={"title":"...","day":"...","subject":"...","gradient":"from-purple-500 to-indigo-500"}
            If the user asks for a search, use:
            ${domain}/?action=search&data={"query":"..."}
            If the user asks to import an exam:
            ${domain}/?action=import_exam&data={"exams":[{"title":"...","date":"..."}]}
            `;
            
            // Prepend system prompt to the last user message for context (workaround for simple chat)
            const msgWithSystem = `${systemPrompt}\nUser: ${prompt}`;
            result = await chat.sendMessage(msgWithSystem);
        }

        const response = await result.response;
        res.json({ role: 'model', parts: [{ text: response.text() }] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ... (Other AI routes implemented similarly using genAI)
// For brevity, implementing a generic handler for simple text-based AI tasks
const simpleAiTask = async (req, res, promptSuffix) => {
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    try {
        const { prompt, imageBase64 } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        let parts = [prompt + (promptSuffix || "")];
        if (imageBase64) {
            parts.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        
        const result = await model.generateContent(parts);
        const response = await result.response;
        res.json({ response: response.text() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

apiRouter.post('/ai/analyze-mistake', authMiddleware, (req, res) => simpleAiTask(req, res, "\n\nAnalyze this mistake. Return JSON: { \"mistake_topic\": \"Short Topic Name\", \"explanation\": \"Detailed markdown explanation\" }"));
apiRouter.post('/ai/solve-doubt', authMiddleware, (req, res) => simpleAiTask(req, res, "\n\nSolve this doubt with step-by-step markdown explanation."));
apiRouter.post('/ai/correct-json', authMiddleware, (req, res) => {
    const { brokenJson } = req.body;
    simpleAiTask({ body: { prompt: `Fix this broken JSON and return ONLY the valid JSON string: ${brokenJson}` } }, res, "");
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
