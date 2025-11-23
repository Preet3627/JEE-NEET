
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
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
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
        
        // 1. Users Table
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

        // 2. User Configs
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_configs (
                user_id INT PRIMARY KEY,
                config LONGTEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Data Tables (Encrypted Blobs)
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

        // 4. Doubts (Community)
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

        // 5. Solutions
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
        
        // Run DB Init
        initDB();
        
        googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
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

    // Fetch Config
    const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
    let config = { settings: { accentColor: '#0891b2', theme: 'default' } };
    if (configRows.length > 0) {
        config = decrypt(configRows[0].config);
    }

    // Fetch Related Data
    const tables = ['schedule_items', 'results', 'exams', 'study_sessions'];
    const data = {};
    
    for (const table of tables) {
        try {
            const [rows] = await pool.query(`SELECT data FROM ${table} WHERE user_id = ?`, [userId]);
            data[table.toUpperCase()] = rows.map(r => decrypt(r.data));
        } catch (e) {
            data[table.toUpperCase()] = [];
        }
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
        DOUBTS: [] // Loaded separately
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
    try {
        res.json({
            googleClientId: process.env.GOOGLE_CLIENT_ID || '',
            isNextcloudConfigured: isNextcloudConfigured
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load config" });
    }
});

// --- AUTH ROUTES ---

// Google Login
apiRouter.post('/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential || !googleClient || !pool) {
        return res.status(400).json({ error: "Service unavailable" });
    }

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
            // Auto-register
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
        console.error("Google Auth Error:", error);
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

// Auto-Verify Register
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

        // Generate Token Immediately
        const token = jwt.sign({ id: userId, sid, role: 'student' }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token });
    } catch(e) {
        console.error("Register Error", e);
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
                const conf = decrypt(configRows[0].config);
                s.CONFIG = conf;
            } else {
                s.CONFIG = { settings: {} };
            }
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
    try {
        let query = "SELECT id FROM users WHERE role = 'student'";
        const [users] = await pool.query(query);
        
        for (const u of users) {
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [u.id, encrypt(task)]);
        }
        res.json({ success: true, count: users.length });
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
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        const uid = users[0].id;
        await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [uid]);
        await pool.query("DELETE FROM results WHERE user_id = ?", [uid]);
        await pool.query("DELETE FROM study_sessions WHERE user_id = ?", [uid]);
        await pool.query("DELETE FROM exams WHERE user_id = ?", [uid]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- USER DATA ROUTES ---

apiRouter.post('/schedule-items', authMiddleware, async (req, res) => {
    const { task } = req.body;
    try {
        await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
        res.json({ success: true, id: task.ID });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/batch', authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    try {
        for (const t of tasks) {
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(t)]);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/schedule-items/:id', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, data FROM schedule_items WHERE user_id = ?", [req.userId]);
        for (const row of rows) {
            const data = decrypt(row.data);
            if (data.ID === req.params.id) {
                await pool.query("DELETE FROM schedule_items WHERE id = ?", [row.id]);
                break;
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/config', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
        let currentConfig = rows.length > 0 ? decrypt(rows[0].config) : {};
        const newConfig = { ...currentConfig, ...req.body, settings: { ...currentConfig.settings, ...req.body.settings } };
        
        if (rows.length > 0) {
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(newConfig), req.userId]);
        } else {
            await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(newConfig)]);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Full Sync
apiRouter.post('/user-data/full-sync', authMiddleware, async (req, res) => {
    const { userData } = req.body;
    const uid = req.userId;
    
    try {
        await pool.query("DELETE FROM user_configs WHERE user_id = ?", [uid]);
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [uid, encrypt(userData.CONFIG)]);

        await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [uid]);
        if (userData.SCHEDULE_ITEMS.length > 0) {
            const values = userData.SCHEDULE_ITEMS.map(i => [uid, encrypt(i)]);
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES ?", [values]);
        }

        await pool.query("DELETE FROM results WHERE user_id = ?", [uid]);
        if (userData.RESULTS.length > 0) {
            const values = userData.RESULTS.map(i => [uid, encrypt(i)]);
            await pool.query("INSERT INTO results (user_id, data) VALUES ?", [values]);
        }

        await pool.query("DELETE FROM exams WHERE user_id = ?", [uid]);
        if (userData.EXAMS.length > 0) {
            const values = userData.EXAMS.map(i => [uid, encrypt(i)]);
            await pool.query("INSERT INTO exams (user_id, data) VALUES ?", [values]);
        }
        
        await pool.query("DELETE FROM study_sessions WHERE user_id = ?", [uid]);
        if (userData.STUDY_SESSIONS.length > 0) {
            const values = userData.STUDY_SESSIONS.map(i => [uid, encrypt(i)]);
            await pool.query("INSERT INTO study_sessions (user_id, data) VALUES ?", [values]);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DOUBTS ---
const DOUBTS_CACHE = []; 

apiRouter.get('/doubts/all', async (req, res) => {
    try {
        if (pool) {
             // Return all doubts that are not deleted
             const [doubts] = await pool.query("SELECT * FROM doubts WHERE status != 'deleted' ORDER BY created_at DESC");
             // Fetch solutions for each doubt
             for (let doubt of doubts) {
                 const [solutions] = await pool.query("SELECT * FROM doubt_solutions WHERE doubt_id = ? ORDER BY created_at ASC", [doubt.id]);
                 doubt.solutions = solutions;
             }
             res.json(doubts);
        } else {
            res.json(DOUBTS_CACHE);
        }
    } catch (e) {
        console.error("Error fetching doubts:", e);
        res.json(DOUBTS_CACHE);
    }
});

apiRouter.post('/doubts', authMiddleware, async (req, res) => {
    const { question, question_image } = req.body;
    const newDoubt = {
        id: `D${Date.now()}`,
        user_sid: req.userSid,
        question,
        question_image,
        created_at: new Date(),
    };
    
    try {
        const [userRows] = await pool.query("SELECT full_name, profile_photo FROM users WHERE sid = ?", [req.userSid]);
        if (userRows.length > 0) {
            const user = userRows[0];
            await pool.query(
                "INSERT INTO doubts (id, user_sid, question, question_image, created_at, author_name, author_photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
                [newDoubt.id, newDoubt.user_sid, newDoubt.question, newDoubt.question_image, newDoubt.created_at, user.full_name, user.profile_photo]
            );
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/doubts/:id/solutions', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { solution, solution_image } = req.body;
    
    try {
        const [userRows] = await pool.query("SELECT full_name, profile_photo FROM users WHERE sid = ?", [req.userSid]);
        if (userRows.length > 0) {
            const user = userRows[0];
            const solId = `S${Date.now()}`;
            await pool.query(
                "INSERT INTO doubt_solutions (id, doubt_id, user_sid, solution, solution_image, created_at, solver_name, solver_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [solId, id, req.userSid, solution, solution_image, new Date(), user.full_name, user.profile_photo]
            );
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.put('/admin/doubts/:id/status', adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query("UPDATE doubts SET status = ? WHERE id = ?", [status, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AI ENDPOINTS ---
const getKnowledgeBaseForUser = (userConfig) => {
    const examType = userConfig.settings?.examType || 'JEE';
    const base = `### INTERNAL KNOWLEDGE BASE\n**PHYSICS:** ${knowledgeBase.PHYSICS}\n**CHEMISTRY:** ${knowledgeBase.CHEMISTRY}\n`;
    if (examType === 'NEET') return base + `**BIOLOGY:** ${knowledgeBase.BIOLOGY}`;
    return base + `**MATHS:** ${knowledgeBase.MATHS}`;
};

const getApiKeyAndConfigForUser = async (userId) => {
    if (!pool) return { apiKey: process.env.API_KEY, config: {} };
    const [rows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
    let config = {};
    let apiKey = process.env.API_KEY;
    if (rows[0]) {
        config = decrypt(rows[0].config);
        if (config.geminiApiKey) apiKey = config.geminiApiKey;
    }
    return { apiKey, config };
};

const commonAIHandler = async (req, res, promptBuilder) => {
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI not configured" });
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash';
        const kb = getKnowledgeBaseForUser(config);
        
        const { systemInstruction, userPrompt, imageBase64, jsonResponse } = promptBuilder(req.body, kb);
        
        const chatConfig = { systemInstruction };
        if (jsonResponse) chatConfig.responseMimeType = 'application/json';

        const contents = [{
            role: 'user',
            parts: [
                { text: userPrompt },
                ...(imageBase64 ? [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] : [])
            ]
        }];

        const response = await ai.models.generateContent({
            model,
            contents,
            config: chatConfig
        });

        let text = response.text;
        if (jsonResponse) {
            // Sanitize JSON if needed
            text = text.replace(/```json\n?|\n?```/g, '').trim();
            res.json(JSON.parse(text));
        } else {
            res.json({ response: text });
        }
    } catch (e) {
        console.error("AI Handler Error:", e);
        res.status(500).json({ error: e.message });
    }
};

apiRouter.post('/ai/parse-text', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ text, domain }, kb) => ({
        systemInstruction: `You are a helpful AI study assistant. Base URL: ${domain || 'https://jee.ponsrischool.in'}.
        Parse the text into JSON. You can generate:
        1. 'schedules': Array of tasks.
        2. 'custom_widget': Object { "title": "Widget Title", "content": "Markdown content..." }.
        3. 'practice_test': Object with questions/answers.
        ${kb}`,
        userPrompt: text,
        jsonResponse: true
    }));
});

apiRouter.post('/ai/daily-insight', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ weaknesses, syllabus }, kb) => ({
        systemInstruction: `Generate a motivational quote and a specific study tip based on weaknesses: ${weaknesses.join(', ')} and syllabus: ${syllabus}. ${kb}`,
        userPrompt: "Give me today's insight.",
        jsonResponse: true
    }));
});

apiRouter.post('/ai/chat', authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64, domain } = req.body;
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash';
        const systemInstruction = `You are a helpful AI assistant. ${getKnowledgeBaseForUser(config)}`;
        
        // Construct history compatible with SDK
        const chatHistory = history.map(h => ({
            role: h.role,
            parts: h.parts
        }));

        const chat = ai.chats.create({
            model,
            config: { systemInstruction },
            history: chatHistory
        });

        const parts = [{ text: prompt }];
        if (imageBase64) {
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        }

        const result = await chat.sendMessage({ message: parts });
        // Use .text getter
        res.json({ role: 'model', parts: [{ text: result.response.text }] });
    } catch (error) {
        console.error("AI Chat Error:", error);
        res.status(500).json({ error: error.message });
    }
});

apiRouter.post('/ai/analyze-mistake', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ prompt, imageBase64 }, kb) => ({
        systemInstruction: `Analyze the student's mistake. Return JSON: { "mistake_topic": "Topic Name", "explanation": "Detailed explanation in markdown" }. ${kb}`,
        userPrompt: prompt,
        imageBase64,
        jsonResponse: true
    }));
});

apiRouter.post('/ai/solve-doubt', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ prompt, imageBase64 }, kb) => ({
        systemInstruction: `Solve the student's doubt using the internal knowledge base. Return markdown. ${kb}`,
        userPrompt: prompt,
        imageBase64,
        jsonResponse: false
    }));
});

apiRouter.post('/ai/analyze-test-results', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ userAnswers, timings, syllabus, imageBase64 }, kb) => ({
        systemInstruction: `Grade the test. User answers: ${JSON.stringify(userAnswers)}. Syllabus: ${syllabus}. Return JSON with score, totalMarks, incorrectQuestionNumbers, subjectTimings, chapterScores, aiSuggestions. ${kb}`,
        userPrompt: "Analyze my test.",
        imageBase64, 
        jsonResponse: true
    }));
});

apiRouter.post('/ai/generate-flashcards', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ topic }, kb) => ({
        systemInstruction: `Generate flashcards for '${topic}'. Return JSON: { "flashcards": [{ "front": "...", "back": "..." }] }. ${kb}`,
        userPrompt: "Generate cards.",
        jsonResponse: true
    }));
});

apiRouter.post('/ai/generate-practice-test', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ topic, numQuestions, difficulty }, kb) => ({
        systemInstruction: `Generate a practice test on '${topic}' with ${numQuestions} questions, difficulty ${difficulty}. Return JSON: { "questions": [...], "answers": {...} }. ${kb}`,
        userPrompt: "Generate test.",
        jsonResponse: true
    }));
});

apiRouter.post('/ai/generate-answer-key', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ prompt }, kb) => ({
        systemInstruction: `Generate an answer key JSON object { "1": "A", "2": "B"... } based on the description.`,
        userPrompt: prompt,
        jsonResponse: true
    }));
});

apiRouter.post('/ai/correct-json', authMiddleware, async (req, res) => {
    commonAIHandler(req, res, ({ brokenJson }, kb) => ({
        systemInstruction: "Fix the malformed JSON string and return valid JSON.",
        userPrompt: brokenJson,
        jsonResponse: true
    }));
});

// --- Study Material & Music (WebDAV) ---

apiRouter.get('/music/browse', authMiddleware, async (req, res) => {
    if (!musicWebdavClient) return res.json([]);
    const path = req.query.path || '/';
    try {
        const contents = await musicWebdavClient.getDirectoryContents(path);
        const files = contents.map(item => ({
            name: item.basename,
            type: item.type === 'directory' ? 'folder' : 'file',
            path: item.filename,
            size: item.size
        }));
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.get('/music/content', async (req, res) => {
    // Direct streaming with robust error handling
    const token = req.query.token;
    
    if (!token) return res.status(401).send('Unauthorized');
    try {
        jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).send('Invalid Token');
    }

    const path = req.query.path;
    if (!musicWebdavClient || !path) return res.status(404).send('Not found');
    
    try {
        // Create read stream from WebDAV
        const stream = musicWebdavClient.createReadStream(path);
        
        // Enable CORS for Web Audio API access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // stream.pipe(res) handles backpressure automatically
        stream.pipe(res);
        
        stream.on('error', (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
                res.status(500).send("Stream Error");
            }
        });
    } catch (e) {
        console.error("Music Content Error:", e);
        if (!res.headersSent) {
            res.status(500).send("Internal Server Error");
        }
    }
});

apiRouter.get('/study-material/browse', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.json([]);
    const path = req.query.path || '/';
    try {
        const contents = await webdavClient.getDirectoryContents(path);
        const files = contents.map(item => ({
            name: item.basename,
            type: item.type === 'directory' ? 'folder' : 'file',
            path: item.filename,
            size: item.size,
            modified: item.lastmod
        }));
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.get('/study-material/content', authMiddleware, async (req, res) => {
    const path = req.query.path;
    if (!webdavClient || !path) return res.status(404).send('Not found');
    try {
        const stream = webdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) {
        res.status(500).send();
    }
});

apiRouter.post('/study-material/details', authMiddleware, async (req, res) => {
    // Fetch details for multiple paths (used for pinned items)
    if (!webdavClient) return res.json([]);
    const { paths } = req.body;
    const results = [];
    for (const path of paths) {
        try {
            const stat = await webdavClient.stat(path);
            results.push({
                name: stat.basename,
                type: stat.type === 'directory' ? 'folder' : 'file',
                path: stat.filename,
                size: stat.size,
                modified: stat.lastmod
            });
        } catch (e) { /* ignore errors for missing files */ }
    }
    res.json(results);
});


if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
