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

// --- HELPER: Robust AI JSON Parser ---
const parseAIResponse = (text) => {
    // 1. Remove Markdown code blocks
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        // 2. Try parsing standard JSON
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("Initial JSON parse failed, attempting auto-fix for backslashes...", e.message);
        
        // 3. Fix common LaTeX/Path backslash issues
        // Look for backslashes that are NOT followed by valid JSON escape characters (", \, /, b, f, n, r, t, u)
        // and double them (e.g., \Delta -> \\Delta)
        try {
            const fixed = cleaned.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
            return JSON.parse(fixed);
        } catch (e2) {
            console.error("Auto-fix failed. Trying to extract object/array.");
            
            // 4. Try to extract the first JSON object or array if there's surrounding text
            const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match) {
                try {
                    const extracted = match[0];
                    // Apply the backslash fix to the extracted part as well
                    const fixedExtracted = extracted.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
                    return JSON.parse(fixedExtracted);
                } catch (e3) {
                    throw new Error(`Failed to parse AI response after all attempts: ${e.message}`);
                }
            }
            throw new Error(`Failed to parse AI response: ${e.message}`);
        }
    }
};

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

// --- HELPER: Find Row ID by Inner JSON ID ---
const findRowIdByInnerId = async (tableName, userId, innerId) => {
    const [rows] = await pool.query(`SELECT id, data FROM ${tableName} WHERE user_id = ?`, [userId]);
    for (const row of rows) {
        const item = decrypt(row.data);
        if (item && item.ID === innerId) {
            return row.id;
        }
    }
    return null;
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

// --- USER DATA CRUD ---

apiRouter.post('/schedule-items', authMiddleware, async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "No task data" });
    try {
        const existingRowId = await findRowIdByInnerId('schedule_items', req.userId, task.ID);
        
        if (existingRowId) {
            await pool.query("UPDATE schedule_items SET data = ? WHERE id = ?", [encrypt(task), existingRowId]);
        } else {
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/schedule-items/batch', authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: "Invalid tasks array" });
    
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const task of tasks) {
             await connection.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/schedule-items/:taskId', authMiddleware, async (req, res) => {
    const { taskId } = req.params;
    try {
        const rowId = await findRowIdByInnerId('schedule_items', req.userId, taskId);
        if (rowId) {
            await pool.query("DELETE FROM schedule_items WHERE id = ?", [rowId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Task not found" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Config
apiRouter.post('/config', authMiddleware, async (req, res) => {
    const updates = req.body;
    try {
        const [rows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
        let currentConfig = {};
        if (rows.length > 0) {
            const raw = rows[0].config;
            const decrypted = decrypt(raw);
            currentConfig = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        }
        
        const newConfig = {
            ...currentConfig,
            ...updates,
            settings: { ...currentConfig.settings, ...(updates.settings || {}) }
        };
        
        if (rows.length > 0) {
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(newConfig), req.userId]);
        } else {
            await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(newConfig)]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Full Sync
apiRouter.post('/user-data/full-sync', authMiddleware, async (req, res) => {
    const { userData } = req.body;
    if (!userData) return res.status(400).json({ error: "No data" });
    
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        if (userData.CONFIG) {
             await connection.query("DELETE FROM user_configs WHERE user_id = ?", [req.userId]);
             await connection.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(userData.CONFIG)]);
        }

        const syncTable = async (tableName, items) => {
            await connection.query(`DELETE FROM ${tableName} WHERE user_id = ?`, [req.userId]);
            for (const item of items) {
                await connection.query(`INSERT INTO ${tableName} (user_id, data) VALUES (?, ?)`, [req.userId, encrypt(item)]);
            }
        };

        if (userData.SCHEDULE_ITEMS) await syncTable('schedule_items', userData.SCHEDULE_ITEMS);
        if (userData.RESULTS) await syncTable('results', userData.RESULTS);
        if (userData.EXAMS) await syncTable('exams', userData.EXAMS);
        if (userData.STUDY_SESSIONS) await syncTable('study_sessions', userData.STUDY_SESSIONS);

        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Results CRUD
apiRouter.put('/results', authMiddleware, async (req, res) => {
    const { result } = req.body;
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, result.ID);
        if (rowId) {
            await pool.query("UPDATE results SET data = ? WHERE id = ?", [encrypt(result), rowId]);
        } else {
            await pool.query("INSERT INTO results (user_id, data) VALUES (?, ?)", [req.userId, encrypt(result)]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/results', authMiddleware, async (req, res) => {
    const { resultId } = req.body;
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, resultId);
        if (rowId) {
            await pool.query("DELETE FROM results WHERE id = ?", [rowId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Result not found" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profile
apiRouter.put('/profile', authMiddleware, async (req, res) => {
    const { fullName, profilePhoto } = req.body;
    try {
        const updates = [];
        const params = [];
        if (fullName) { updates.push("full_name = ?"); params.push(fullName); }
        if (profilePhoto) { updates.push("profile_photo = ?"); params.push(profilePhoto); }
        
        if (updates.length > 0) {
            params.push(req.userId);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/me/api-token', authMiddleware, async (req, res) => {
    try {
        const token = crypto.randomBytes(24).toString('hex');
        await pool.query("UPDATE users SET api_token = ? WHERE id = ?", [token, req.userId]);
        res.json({ token });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/me/api-token', authMiddleware, async (req, res) => {
    try {
        await pool.query("UPDATE users SET api_token = NULL WHERE id = ?", [req.userId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- DOUBTS ROUTES ---
apiRouter.get('/doubts/all', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "DB offline" });
    try {
        const [doubts] = await pool.query("SELECT * FROM doubts WHERE status != 'deleted' ORDER BY created_at DESC");
        const [solutions] = await pool.query("SELECT * FROM doubt_solutions ORDER BY created_at ASC");
        
        const result = doubts.map(d => ({
            ...d,
            solutions: solutions.filter(s => s.doubt_id === d.id)
        }));
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/doubts', authMiddleware, async (req, res) => {
    const { question, question_image } = req.body;
    const user = await getUserData(req.userId);
    if(!user) return res.status(401).json({error: "User not found"});
    
    const doubtId = `D${Date.now()}`;
    try {
        await pool.query(
            "INSERT INTO doubts (id, user_sid, question, question_image, created_at, author_name, author_photo, status) VALUES (?, ?, ?, ?, NOW(), ?, ?, 'active')",
            [doubtId, user.sid, question, question_image, user.fullName, user.profilePhoto]
        );
        res.json({ success: true, id: doubtId });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/doubts/:doubtId/solutions', authMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { solution, solution_image } = req.body;
    const user = await getUserData(req.userId);
    
    const solId = `SOL${Date.now()}`;
    try {
        await pool.query(
            "INSERT INTO doubt_solutions (id, doubt_id, user_sid, solution, solution_image, created_at, solver_name, solver_photo) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)",
            [solId, doubtId, user.sid, solution, solution_image, user.fullName, user.profilePhoto]
        );
        res.json({ success: true, id: solId });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/admin/doubts/:doubtId/status', adminMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { status } = req.body;
    try {
        await pool.query("UPDATE doubts SET status = ? WHERE id = ?", [status, doubtId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- MESSAGING ROUTES ---
apiRouter.get('/messages/:sid', authMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        if (req.userRole !== 'admin' && req.userSid !== sid) return res.status(403).json({error: "Unauthorized"});
        const [msgs] = await pool.query(
            "SELECT * FROM messages WHERE sender_sid = ? OR recipient_sid = ? ORDER BY created_at ASC",
            [sid, sid]
        );
        res.json(msgs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/messages', authMiddleware, async (req, res) => {
    const { recipient_sid, content } = req.body;
    try {
        await pool.query(
            "INSERT INTO messages (sender_sid, recipient_sid, content) VALUES (?, ?, ?)",
            [req.userSid, recipient_sid, content]
        );
        const [rows] = await pool.query("SELECT * FROM messages WHERE sender_sid = ? AND recipient_sid = ? ORDER BY id DESC LIMIT 1", [req.userSid, recipient_sid]);
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MUSIC & FILES ROUTES (WebDAV) ---

apiRouter.get('/music/browse', authMiddleware, async (req, res) => {
    if (!musicWebdavClient) return res.status(503).json({ error: "Music WebDAV not configured" });
    const path = req.query.path || '/';
    try {
        const files = await musicWebdavClient.getDirectoryContents(path);
        res.json(files.map(f => ({
            name: f.basename,
            type: f.type === 'directory' ? 'folder' : 'file',
            path: f.filename,
            size: f.size,
            modified: f.lastmod
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/music/content', async (req, res) => {
    const { path, token } = req.query;
    if (!musicWebdavClient) return res.status(503).send("Service unavailable");
    try {
        jwt.verify(token, JWT_SECRET);
        const stream = musicWebdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

apiRouter.get('/music/album-art', async (req, res) => {
    const { path, token } = req.query;
    if (!musicWebdavClient) return res.status(503).send("Service unavailable");
    try {
        jwt.verify(token, JWT_SECRET);
        const stream = musicWebdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

apiRouter.get('/study-material/browse', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "WebDAV not configured" });
    const path = req.query.path || '/';
    try {
        const files = await webdavClient.getDirectoryContents(path);
        res.json(files.map(f => ({
            name: f.basename,
            type: f.type === 'directory' ? 'folder' : 'file',
            path: f.filename,
            size: f.size,
            modified: f.lastmod
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/study-material/content', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).send("Service unavailable");
    const path = req.query.path;
    try {
        const stream = webdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) { res.status(500).send("Error fetching file"); }
});

apiRouter.post('/study-material/details', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "WebDAV not configured" });
    const { paths } = req.body;
    try {
        const details = [];
        for (const p of paths) {
            try {
                const stat = await webdavClient.stat(p);
                details.push({
                    name: stat.basename,
                    type: stat.type === 'directory' ? 'folder' : 'file',
                    path: stat.filename,
                    size: stat.size,
                    modified: stat.lastmod
                });
            } catch (e) { /* ignore missing */ }
        }
        res.json(details);
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- ADMIN ROUTES (Broadcast, etc) ---
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

// Helper function for simple text generation using new SDK pattern
const simpleAiTask = async (req, res, promptSuffix) => {
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    try {
        const { prompt, imageBase64 } = req.body;
        
        let contents = [];
        if (imageBase64) {
            contents.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        // Append suffix if present
        contents.push({ text: prompt + (promptSuffix || "") });

        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: contents }
        });
        
        res.json({ response: parseAIResponse(response.text) }); // Use parser for safety if JSON expected, or raw text if not?
        // Wait, simpleAiTask usually returns raw text in a JSON wrapper { response: "..." }
        // The parser is for structured data endpoints.
        // Let's stick to returning raw text here for generic tasks, but parsed if it looks like JSON.
        
        // Actually, simpleAiTask is used for "analyze-mistake" and "solve-doubt" which return Markdown or JSON string inside response field.
        // We'll leave it as raw text for frontend to renderMarkdown.
        res.json({ response: response.text }); 

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

apiRouter.post('/ai/parse-text', authMiddleware, async (req, res) => {
    const { text, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });

    try {
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

        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: prompt }] }
        });

        const parsedData = parseAIResponse(response.text);
        res.json(parsedData);
    } catch (e) {
        console.error("AI Parse Error", e);
        res.status(500).json({ error: "Failed to parse text with AI" });
    }
});

apiRouter.post('/ai/chat', authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });

    try {
        // Convert history to Gemini format (user/model)
        const chatHistory = history.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        // Handle image by appending to current prompt (multimodal turn)
        const currentParts = [];
        if (imageBase64) {
            currentParts.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        
        // System instructions for deep linking
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
        
        currentParts.push({ text: `${systemPrompt}\nUser: ${prompt}` });

        // Use chat interface for history context
        const chat = genAI.chats.create({
            model: 'gemini-1.5-flash',
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const response = await chat.sendMessage(currentParts);
        res.json({ role: 'model', parts: [{ text: response.text }] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/ai/daily-insight', authMiddleware, async (req, res) => {
    const { weaknesses, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    try {
        const prompt = `
        Generate a short, motivational study tip or insight for a JEE student.
        User weaknesses: ${weaknesses.join(', ')}.
        Upcoming exam syllabus: ${syllabus || 'General JEE Prep'}.
        Return JSON: { "quote": "Motivational quote...", "insight": "Specific study tip..." }
        `;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [{ text: prompt }] }
        });
        
        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/ai/analyze-test-results', authMiddleware, async (req, res) => {
    const { imageBase64, userAnswers, timings, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });

    try {
        const prompt = `
        Analyze this test answer key image.
        User Answers: ${JSON.stringify(userAnswers)}
        Timings (sec): ${JSON.stringify(timings)}
        Syllabus: ${syllabus}
        
        Match the image key with user answers.
        Calculate score (+4 correct, -1 incorrect).
        Identify weak chapters based on incorrect answers and the syllabus.
        
        Return strictly valid JSON:
        {
            "score": 120,
            "totalMarks": 300,
            "incorrectQuestionNumbers": [2, 5, ...],
            "subjectTimings": { "Physics": 3600, "Chemistry": 2400, "Maths": 4000 },
            "chapterScores": { "Rotational Motion": {"correct": 1, "incorrect": 2, "accuracy": 33}, ... },
            "aiSuggestions": "Markdown study advice based on weaknesses...",
            "suggestedFlashcards": [ {"front": "Q...", "back": "A..."} ]
        }
        `;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-pro',
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
                    { text: prompt }
                ]
            }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/ai/generate-flashcards', authMiddleware, async (req, res) => {
    const { topic, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    try {
        const prompt = `Create 10 flashcards for "${topic}". Context: ${syllabus || ''}. Return JSON: { "flashcards": [{"front": "...", "back": "..."}] }`;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [{ text: prompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/ai/generate-answer-key', authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    try {
        const fullPrompt = `Generate the official answer key for: ${prompt}. If unknown, generate a realistic practice key. Return JSON: { "answerKey": {"1": "A", "2": "B", ...} }`;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [{ text: fullPrompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/ai/generate-practice-test', authMiddleware, async (req, res) => {
    const { topic, numQuestions, difficulty } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    try {
        const prompt = `
        Generate a ${difficulty} practice test on "${topic}" with ${numQuestions} questions.
        Return JSON:
        {
            "questions": [
                { "number": 1, "text": "Question text...", "options": ["A. ..", "B. ..", "C. ..", "D. .."], "type": "MCQ" }
            ],
            "answers": { "1": "A", "2": "C" ... }
        }
        `;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-pro',
            contents: { parts: [{ text: prompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/ai/analyze-specific-mistake', authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    try {
        const fullPrompt = `Analyze this specific mistake. User thought: "${prompt}". Return JSON: { "topic": "Main Topic", "explanation": "Detailed explanation of why it is wrong and the correct concept." }`;
        
        const parts = [];
        if (imageBase64) {
            parts.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        parts.push({ text: fullPrompt });
        
        const response = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: parts }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generic tasks using simpleAiTask helper
apiRouter.post('/ai/analyze-mistake', authMiddleware, (req, res) => 
    simpleAiTask(req, res, "\n\nAnalyze this mistake. Return JSON: { \"mistake_topic\": \"Short Topic Name\", \"explanation\": \"Detailed markdown explanation\" }")
);

apiRouter.post('/ai/solve-doubt', authMiddleware, (req, res) => 
    simpleAiTask(req, res, "\n\nSolve this doubt with step-by-step markdown explanation.")
);

apiRouter.post('/ai/correct-json', authMiddleware, (req, res) => {
    const { brokenJson } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    
    const prompt = `Fix this broken JSON and return ONLY the valid JSON string: ${brokenJson}`;
    
    genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: { parts: [{ text: prompt }] }
    }).then(result => {
        // Just return cleaned text for this specific utility endpoint
        const text = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json({ correctedJson: text });
    }).catch(e => {
        res.status(500).json({ error: e.message });
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;