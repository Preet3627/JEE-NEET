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
const isNextcloudConfigured = !!(process.env.NEXTCLOUD_URL && (process.env.NEXTCLOUD_SHARE_TOKEN || process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN));

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
        // Replace all single backslashes that are NOT part of a valid JSON escape sequence.
        // This regex ensures we don't double already-escaped characters.
        const fixedBackslashes = cleaned.replace(/\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
        try {
            return JSON.parse(fixedBackslashes);
        } catch (e2) {
            console.error("Auto-fix failed. Trying to extract object/array.", e2.message);
            
            // 4. Try to extract the first JSON object or array if there's surrounding text
            const match = fixedBackslashes.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                } catch (e3) {
                    throw new Error(`Failed to parse AI response after all attempts: ${e.message} | ${e2.message} | ${e3.message}`);
                }
            }
            throw new Error(`Failed to parse AI response: ${e.message} | ${e2.message}`);
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
    if (!pool) return; // Pool might be null if misconfigured
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
        throw error; // Re-throw to indicate a critical setup failure
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
        
        initDB().catch(err => {
            console.error("Critical DB initialization error. Server may not function.", err);
            pool = null; // Mark pool as unusable
        });
        
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

        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN && process.env.NEXTCLOUD_SHARE_PASSWORD) {
            webdavClient = createClient(
                `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                { username: process.env.NEXTCLOUD_SHARE_TOKEN, password: process.env.NEXTCLOUD_SHARE_PASSWORD }
            );
        }

        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN && process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD) {
            musicWebdavClient = createClient(
                `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                { username: process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, password: process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD }
            );
        }

    } catch (error) {
        console.error("FATAL ERROR: Could not create database pool or initialize services. Server will be misconfigured.", error);
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
    if (!pool) throw new Error("Database not initialized");
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
    if (!pool) return null; // Can't fetch data if DB isn't ready
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
    let config = { 
        WAKE: '06:00', SCORE: '0/300', WEAK: [], UNACADEMY_SUB: false, flashcardDecks: [], pinnedMaterials: [], customWidgets: [], localPlaylists: [],
        settings: { 
            accentColor: '#0891b2', blurEnabled: true, mobileLayout: 'standard', 
            forceOfflineMode: false, perQuestionTime: 180, examType: 'JEE',
            showAiChatAssistant: true, hasGeminiKey: false, theme: 'default',
            dashboardLayout: [], dashboardFlashcardDeckIds: [], musicPlayerWidgetLayout: 'minimal',
            dashboardBackgroundImage: '', dashboardTransparency: 50,
            notchSettings: { position: 'top', size: 'medium', width: 30, enabled: true },
            visualizerSettings: { preset: 'bars', colorMode: 'rgb' },
            djDropSettings: { enabled: true, autoTrigger: true }
        }
    };
    
    if (configRows.length > 0) {
        const rawConfig = configRows[0].config;
        const decrypted = decrypt(rawConfig);
        let parsedConfig = {};
        if (typeof decrypted === 'string') {
            try { parsedConfig = JSON.parse(decrypted); } catch (e) { console.warn("Config parse error (string)", e); }
        } else if (typeof decrypted === 'object' && decrypted !== null) {
            parsedConfig = decrypted;
        }
        
        // Deep merge for settings
        config = { 
            ...config, 
            ...parsedConfig, 
            settings: { ...config.settings, ...parsedConfig.settings } 
        };
    }

    // Ensure default settings are always present
    if (!config.settings) config.settings = {};
    if (!config.settings.accentColor) config.settings.accentColor = '#0891b2';
    if (!config.settings.theme) config.settings.theme = 'default';
    if (!config.settings.examType) config.settings.examType = 'JEE';
    if (config.settings.showAiChatAssistant === undefined) config.settings.showAiChatAssistant = true;
    if (config.settings.hasGeminiKey === undefined) config.settings.hasGeminiKey = !!process.env.API_KEY; // Reflect server key status

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
        DOUBTS: [] // Doubts are fetched globally for community
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
    const djDropUrl = process.env.NEXTCLOUD_DJ_DROP_URL || 'https://nc.ponsrischool.in/index.php/s/em85Zdf2EYEkz3j/download';
    try {
        // Fetch as buffer to avoid Vercel's body parser limits if it's a large file
        const response = await fetch(djDropUrl);
        if (!response.ok) throw new Error('Failed to fetch DJ drop');
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
        res.setHeader('Content-Length', response.headers.get('Content-Length') || buffer.byteLength);
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error("DJ Drop error:", error);
        res.status(500).send("Error fetching DJ drop");
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
        console.error("Google Auth error:", error);
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
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

apiRouter.get('/me', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const user = await getUserData(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
        res.json(user);
    } catch (error) {
        console.error("GetMe error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

apiRouter.post('/heartbeat', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
        res.json({ status: 'ok' });
    } catch (e) {
        console.error("Heartbeat error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/register', async (req, res) => {
    const { fullName, sid, email, password } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    
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
        console.error("Register error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!pool || !mailer) return res.status(503).json({ error: "Service unavailable" });

    try {
        const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        const user = users[0];

        if (!user) return res.status(404).json({ message: "If an account with that email exists, a password reset link has been sent." });

        const resetToken = crypto.randomBytes(32).toString('hex');
        // Store resetToken in DB (e.g., in users table or a separate password_resets table)
        // For simplicity, let's just use it in the link for now. In a real app, securely store and associate it with the user.
        
        const resetLink = `${req.protocol}://${req.get('host')}/?reset-token=${resetToken}`;
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Password Reset Request for JEE Scheduler Pro',
            html: `<p>You requested a password reset for your JEE Scheduler Pro account.</p>
                   <p>Click <a href="${resetLink}">this link</a> to reset your password.</p>
                   <p>This link is valid for a short time. If you did not request this, please ignore this email.</p>`,
        };
        await mailer.sendMail(mailOptions);
        res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (e) {
        console.error("Forgot password error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });

    try {
        // In a real app, validate the token against what's stored in DB and its expiry
        // For simplicity, we'll assume the token is valid if it exists.
        // This is a placeholder for actual token validation.
        // Assuming 'token' here is directly from the URL and needs to be matched to a user.
        // This requires a real token storage/retrieval mechanism.
        // For this demo, let's assume `token` can directly map to a user for a brief period after email.
        
        // As a demo simplification, let's assume the token is actually an API token temporarily
        // and we are resetting password using that. This is NOT how real reset works.
        const [users] = await pool.query("SELECT id FROM users WHERE api_token = ?", [token]);
        if (users.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }
        const userId = users[0].id;
        
        const hash = bcrypt.hashSync(password, 10);
        await pool.query("UPDATE users SET password_hash = ?, api_token = NULL WHERE id = ?", [hash, userId]);
        res.json({ message: "Your password has been reset successfully." });
    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: e.message });
    }
});


// --- USER DATA CRUD ---

apiRouter.post('/schedule-items', authMiddleware, async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "No task data" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });

    try {
        const existingRowId = await findRowIdByInnerId('schedule_items', req.userId, task.ID);
        
        if (existingRowId) {
            await pool.query("UPDATE schedule_items SET data = ? WHERE id = ?", [encrypt(task), existingRowId]);
        } else {
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
        }
        res.json({ success: true });
    } catch (e) { 
        console.error("Save task error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/schedule-items/batch', authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: "Invalid tasks array" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const task of tasks) {
            const existingRowId = await findRowIdByInnerId('schedule_items', req.userId, task.ID);
            if (existingRowId) {
                await connection.query("UPDATE schedule_items SET data = ? WHERE id = ?", [encrypt(task), existingRowId]);
            } else {
                await connection.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
            }
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { 
        console.error("Batch save tasks error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.delete('/schedule-items/:taskId', authMiddleware, async (req, res) => {
    const { taskId } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const rowId = await findRowIdByInnerId('schedule_items', req.userId, taskId);
        if (rowId) {
            await pool.query("DELETE FROM schedule_items WHERE id = ?", [rowId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Task not found" });
        }
    } catch (e) { 
        console.error("Delete task error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/schedule-items/batch-delete', authMiddleware, async (req, res) => {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds)) return res.status(400).json({ error: "Invalid taskIds array" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const taskId of taskIds) {
            const rowId = await findRowIdByInnerId('schedule_items', req.userId, taskId);
            if (rowId) {
                await connection.query("DELETE FROM schedule_items WHERE id = ?", [rowId]);
            }
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) {
        console.error("Batch delete tasks error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/clear-all', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [req.userId]);
        res.json({ success: true });
    } catch (e) {
        console.error("Clear all schedule error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/batch-move', authMiddleware, async (req, res) => {
    const { taskIds, newDate } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || !newDate) return res.status(400).json({ error: "Invalid input" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        for (const taskId of taskIds) {
            const [rows] = await connection.query(`SELECT id, data FROM schedule_items WHERE user_id = ? AND data LIKE ?`, [req.userId, `%"ID":"${taskId}"%`]);
            if (rows.length > 0) {
                let task = decrypt(rows[0].data);
                if (typeof task === 'string') task = JSON.parse(task); // Ensure it's an object

                // Update task to be a one-off event on newDate
                task.date = newDate;
                task.DAY.EN = new Date(`${newDate}T12:00:00Z`).toLocaleString('en-us', {weekday: 'long', timeZone: 'UTC'}).toUpperCase();
                task.isRecurring = false; // Important: convert to non-recurring

                await connection.query("UPDATE schedule_items SET data = ? WHERE id = ?", [encrypt(task), rows[0].id]);
            }
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) {
        console.error("Batch move tasks error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Config
apiRouter.post('/config', authMiddleware, async (req, res) => {
    const updates = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
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

        // If Gemini API key is being set, update hasGeminiKey flag
        if (updates.geminiApiKey !== undefined) {
            newConfig.settings.hasGeminiKey = !!updates.geminiApiKey.trim();
        }
        
        if (rows.length > 0) {
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(newConfig), req.userId]);
        } else {
            await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(newConfig)]);
        }
        res.json({ success: true });
    } catch (e) { 
        console.error("Update config error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// Full Sync (Used for backup/restore)
apiRouter.post('/user-data/full-sync', authMiddleware, async (req, res) => {
    const { userData } = req.body;
    if (!userData) return res.status(400).json({ error: "No data" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        if (userData.CONFIG) {
             await connection.query("DELETE FROM user_configs WHERE user_id = ?", [req.userId]);
             await connection.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(userData.CONFIG)]);
        }

        const syncTable = async (tableName, items) => {
            await connection.query(`DELETE FROM ${tableName} WHERE user_id = ?`, [req.userId]);
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    await connection.query(`INSERT INTO ${tableName} (user_id, data) VALUES (?, ?)`, [req.userId, encrypt(item)]);
                }
            }
        };

        if (userData.SCHEDULE_ITEMS) await syncTable('schedule_items', userData.SCHEDULE_ITEMS);
        if (userData.RESULTS) await syncTable('results', userData.RESULTS);
        if (userData.EXAMS) await syncTable('exams', userData.EXAMS);
        if (userData.STUDY_SESSIONS) await syncTable('study_sessions', userData.STUDY_SESSIONS);

        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { 
        console.error("Full sync error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// Results CRUD
apiRouter.put('/results', authMiddleware, async (req, res) => {
    const { result } = req.body;
    if (!result) return res.status(400).json({ error: "No result data" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, result.ID);
        if (rowId) {
            await pool.query("UPDATE results SET data = ? WHERE id = ?", [encrypt(result), rowId]);
        } else {
            await pool.query("INSERT INTO results (user_id, data) VALUES (?, ?)", [req.userId, encrypt(result)]);
        }
        res.json({ success: true });
    } catch (e) { 
        console.error("Save result error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.delete('/results', authMiddleware, async (req, res) => {
    const { resultId } = req.body;
    if (!resultId) return res.status(400).json({ error: "No resultId provided" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, resultId);
        if (rowId) {
            await pool.query("DELETE FROM results WHERE id = ?", [rowId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Result not found" });
        }
    } catch (e) { 
        console.error("Delete result error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// Exams CRUD
apiRouter.post('/exams', authMiddleware, async (req, res) => {
    const { exam } = req.body;
    if (!exam) return res.status(400).json({ error: "No exam data" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const existingRowId = await findRowIdByInnerId('exams', req.userId, exam.ID);
        if (existingRowId) {
            await pool.query("UPDATE exams SET data = ? WHERE id = ?", [encrypt(exam), existingRowId]);
        } else {
            await pool.query("INSERT INTO exams (user_id, data) VALUES (?, ?)", [req.userId, encrypt(exam)]);
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Save exam error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/exams/:examId', authMiddleware, async (req, res) => {
    const { examId } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const rowId = await findRowIdByInnerId('exams', req.userId, examId);
        if (rowId) {
            await pool.query("DELETE FROM exams WHERE id = ?", [rowId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Exam not found" });
        }
    } catch (e) {
        console.error("Delete exam error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Profile
apiRouter.put('/profile', authMiddleware, async (req, res) => {
    const { fullName, profilePhoto } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const updates = [];
        const params = [];
        if (fullName !== undefined) { updates.push("full_name = ?"); params.push(fullName); }
        if (profilePhoto !== undefined) { updates.push("profile_photo = ?"); params.push(profilePhoto); }
        
        if (updates.length > 0) {
            params.push(req.userId);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        res.json({ success: true });
    } catch (e) { 
        console.error("Update profile error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/me/api-token', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const token = crypto.randomBytes(24).toString('hex');
        await pool.query("UPDATE users SET api_token = ? WHERE id = ?", [token, req.userId]);
        res.json({ token });
    } catch (e) { 
        console.error("Generate API token error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.delete('/me/api-token', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query("UPDATE users SET api_token = NULL WHERE id = ?", [req.userId]);
        res.json({ success: true });
    } catch (e) { 
        console.error("Revoke API token error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// --- DOUBTS ROUTES ---
apiRouter.get('/doubts/all', authMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const [doubts] = await pool.query("SELECT * FROM doubts WHERE status != 'deleted' ORDER BY created_at DESC");
        const [solutions] = await pool.query("SELECT * FROM doubt_solutions ORDER BY created_at ASC");
        
        const result = doubts.map(d => ({
            ...d,
            solutions: solutions.filter(s => s.doubt_id === d.id)
        }));
        res.json(result);
    } catch (e) { 
        console.error("Get all doubts error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/doubts', authMiddleware, async (req, res) => {
    const { question, question_image } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    const user = await getUserData(req.userId); // Fetch full user data to get name/photo
    if(!user) return res.status(401).json({error: "User not found"});
    
    const doubtId = `D${Date.now()}`;
    try {
        await pool.query(
            "INSERT INTO doubts (id, user_sid, question, question_image, created_at, author_name, author_photo, status) VALUES (?, ?, ?, ?, NOW(), ?, ?, 'active')",
            [doubtId, user.sid, question, question_image, user.fullName, user.profilePhoto]
        );
        res.json({ success: true, id: doubtId });
    } catch(e) { 
        console.error("Post doubt error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/doubts/:doubtId/solutions', authMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { solution, solution_image } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    const user = await getUserData(req.userId);
    if(!user) return res.status(401).json({error: "User not found"});
    
    const solId = `SOL${Date.now()}`;
    try {
        await pool.query(
            "INSERT INTO doubt_solutions (id, doubt_id, user_sid, solution, solution_image, created_at, solver_name, solver_photo) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)",
            [solId, doubtId, user.sid, solution, solution_image, user.fullName, user.profilePhoto]
        );
        res.json({ success: true, id: solId });
    } catch(e) { 
        console.error("Post solution error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.put('/admin/doubts/:doubtId/status', adminMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { status } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query("UPDATE doubts SET status = ? WHERE id = ?", [status, doubtId]);
        res.json({ success: true });
    } catch(e) { 
        console.error("Update doubt status error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// --- MESSAGING ROUTES ---
apiRouter.get('/messages/:sid', authMiddleware, async (req, res) => {
    const { sid } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        if (req.userRole !== 'admin' && req.userSid !== sid) return res.status(403).json({error: "Unauthorized"});
        const [msgs] = await pool.query(
            "SELECT * FROM messages WHERE (sender_sid = ? AND recipient_sid = ?) OR (sender_sid = ? AND recipient_sid = ?) ORDER BY created_at ASC",
            [req.userSid, sid, sid, req.userSid] // Fetch messages where current user is sender to sid, or sid is sender to current user
        );
        res.json(msgs);
    } catch (e) { 
        console.error("Get messages error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/messages', authMiddleware, async (req, res) => {
    const { recipient_sid, content } = req.body;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query(
            "INSERT INTO messages (sender_sid, recipient_sid, content) VALUES (?, ?, ?)",
            [req.userSid, recipient_sid, content]
        );
        const [rows] = await pool.query("SELECT * FROM messages WHERE sender_sid = ? AND recipient_sid = ? ORDER BY id DESC LIMIT 1", [req.userSid, recipient_sid]);
        res.json(rows[0]);
    } catch (e) { 
        console.error("Post message error:", e);
        res.status(500).json({ error: e.message }); 
    }
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
    } catch (e) { 
        console.error("Music browse error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.get('/music/content', async (req, res) => {
    const { path: filePath, token } = req.query; // Renamed 'path' to 'filePath' to avoid conflict
    if (!musicWebdavClient) return res.status(503).send("Service unavailable");
    try {
        jwt.verify(token, JWT_SECRET); // Verify the token that grants access to the music content
        const stream = musicWebdavClient.createReadStream(filePath);
        stream.pipe(res);
    } catch (e) { 
        console.error("Music content error:", e);
        res.status(401).send("Unauthorized or invalid token for music content"); 
    }
});

apiRouter.get('/music/album-art', async (req, res) => {
    const { path: filePath, token } = req.query; // Renamed 'path' to 'filePath'
    if (!musicWebdavClient) return res.status(503).send("Service unavailable");
    try {
        jwt.verify(token, JWT_SECRET); // Verify the token
        const stream = musicWebdavClient.createReadStream(filePath);
        stream.pipe(res);
    } catch (e) { 
        console.error("Album art error:", e);
        res.status(401).send("Unauthorized or invalid token for album art"); 
    }
});

apiRouter.get('/study-material/browse', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "Study Material WebDAV not configured" });
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
    } catch (e) { 
        console.error("Study material browse error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.get('/study-material/content', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).send("Service unavailable");
    const path = req.query.path;
    try {
        const stream = webdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) { 
        console.error("Study material content error:", e);
        res.status(500).send("Error fetching study material file"); 
    }
});

apiRouter.post('/study-material/details', authMiddleware, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "Study Material WebDAV not configured" });
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: "Invalid paths array" });

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
            } catch (e) { /* ignore missing files in details fetch */ }
        }
        res.json(details);
    } catch (e) { 
        console.error("Study material details error:", e);
        res.status(500).json({ error: e.message }); 
    }
});


// --- ADMIN ROUTES (Broadcast, etc) ---
apiRouter.get('/admin/students', adminMiddleware, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const [students] = await pool.query("SELECT id, sid, email, full_name as fullName, profile_photo as profilePhoto, role, last_seen, is_verified FROM users");
        for (let s of students) {
            const [configRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [s.id]);
            if (configRows.length > 0) {
                const raw = configRows[0].config;
                const decrypted = decrypt(raw);
                let parsedConfig = {};
                if (typeof decrypted === 'string') {
                    try { parsedConfig = JSON.parse(decrypted); } catch { parsedConfig = {}; }
                } else {
                    parsedConfig = decrypted;
                }
                s.CONFIG = parsedConfig;
            }
            if (!s.CONFIG) s.CONFIG = { settings: {} }; // Ensure CONFIG exists
            if (!s.CONFIG.settings) s.CONFIG.settings = {}; // Ensure settings exists
        }
        res.json(students);
    } catch (e) {
        console.error("Admin students error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/impersonate/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        const [users] = await pool.query("SELECT * FROM users WHERE sid = ?", [sid]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        const user = users[0];
        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (e) {
        console.error("Admin impersonate error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/broadcast-task', adminMiddleware, async (req, res) => {
    const { task, examType } = req.body;
    if (!task) return res.status(400).json({ error: "No task provided" });
    if (!pool) return res.status(503).json({ error: "Database not initialized" });

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
            const taskForUser = { ...task, ID: `BCAST_${Date.now()}_${userId}_${Math.random().toString(36).substring(7)}` }; // Add random suffix for uniqueness
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [userId, encrypt(taskForUser)]);
        }

        res.json({ success: true, count: targetUserIds.length });
    } catch (e) {
        console.error("Admin broadcast error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/admin/students/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    try {
        await pool.query("DELETE FROM users WHERE sid = ?", [sid]);
        res.json({ success: true });
    } catch (e) {
        console.error("Admin delete student error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/students/:sid/clear-data', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
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
            // Preserve existing settings
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(config), userId]);
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error("Admin clear data error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- AI ROUTES (GENAI) ---

// Helper function for simple text generation using new SDK pattern
const simpleAiTask = async (req, res, promptSuffix, modelName = 'gemini-2.5-flash') => {
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    try {
        const { prompt, imageBase64 } = req.body;
        
        let contents = [];
        if (imageBase64) {
            contents.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        // Append suffix if present
        contents.push({ text: prompt + (promptSuffix || "") });

        const response = await genAI.models.generateContent({
            model: modelName,
            contents: { parts: contents }
        });
        
        res.json({ response: response.text }); 

    } catch (e) {
        console.error("AI Simple Task Error:", e);
        res.status(500).json({ error: e.message });
    }
};

apiRouter.post('/ai/parse-text', authMiddleware, async (req, res) => {
    const { text, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });

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
              "externalLink": "https://..." (optional, if a URL is present),
              "date": "YYYY-MM-DD" (optional, for one-off tasks),
              "isRecurring": true (optional, if weekly recurring)
            }
          ],
          "exams": [
             { "title": "Exam Name", "subject": "FULL" | "PHYSICS" | "CHEMISTRY" | "MATHS" | "BIOLOGY", "date": "YYYY-MM-DD", "time": "HH:MM", "syllabus": "Topics..." }
          ],
          "metrics": [],
          "flashcard_deck": { "name": "Deck Name", "subject": "PHYSICS" | "CHEMISTRY" | "MATHS" | "BIOLOGY", "chapter": "Optional chapter", "cards": [{"front": "Q", "back": "A"}] } (optional),
          "custom_widget": { "title": "Widget Title", "content": "Markdown content" } (optional)
        }
        
        If no valid data is found, return empty arrays or null for objects.
        `;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash for general text parsing
            contents: { parts: [{ text: prompt }] }
        });

        const parsedData = parseAIResponse(response.text);
        res.json(parsedData);
    } catch (e) {
        console.error("AI Parse Text Error", e);
        res.status(500).json({ error: "Failed to parse text with AI" });
    }
});

apiRouter.post('/ai/chat', authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64, domain } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });

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
        You are an academic assistant for JEE/NEET. Your knowledge base covers Physics, Chemistry, Maths, and Biology.
        Respond conversationally, but if the user asks you to take an action in the app, respond *only* with a deep link URL.
        
        Deep Link URL Format: ${domain}/?action=[action_name]&data=[URL_encoded_JSON_object]

        Supported Actions and Data:
        1. new_schedule: Create a new schedule item.
           Data: {"title":"...","day":"MONDAY","time":"HH:MM","type":"ACTION"|"HOMEWORK","subject":"PHYSICS"|... ,"detail":"...","gradient":"from-blue-500 to-cyan-500","externalLink":"https://...", "date":"YYYY-MM-DD", "isRecurring":true}
        2. search: Open universal search with a query.
           Data: {"query":"..."}
        3. import_exam: Import new exams.
           Data: {"exams":[{"title":"...","date":"YYYY-MM-DD","time":"HH:MM","subject":"FULL"|"PHYSICS"|...,"syllabus":"..."}]}
        
        Example Deep Link: ${domain}/?action=new_schedule&data=%7B%22title%22%3A%22Physics%3A%20Rotational%20Motion%22%2C%22day%22%3A%22MONDAY%22%2C%22time%22%3A%2210%3A00%22%2C%22type%22%3A%22ACTION%22%2C%22subject%22%3A%22PHYSICS%22%2C%22detail%22%3A%22Deep%20dive%20into%20moment%20of%20inertia%20and%20torque.%22%2C%22gradient%22%3A%22from-blue-500%20to-cyan-500%22%7D
        `;
        
        currentParts.push({ text: `${systemPrompt}\nUser: ${prompt}` });

        // Use chat interface for history context
        const chat = genAI.chats.create({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash for chat
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const response = await chat.sendMessage(currentParts);
        res.json({ role: 'model', parts: [{ text: response.text }] });
    } catch (e) {
        console.error("AI Chat Error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/ai/daily-insight', authMiddleware, async (req, res) => {
    const { weaknesses, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
    try {
        const prompt = `
        Generate a short, motivational study tip or insight for a JEE student.
        User weaknesses: ${weaknesses.join(', ')}.
        Upcoming exam syllabus: ${syllabus || 'General JEE Prep'}.
        Return JSON: { "quote": "Motivational quote...", "insight": "Specific study tip..." }
        `;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash
            contents: { parts: [{ text: prompt }] }
        });
        
        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Daily Insight Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/ai/analyze-test-results', authMiddleware, async (req, res) => {
    const { imageBase64, userAnswers, timings, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });

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
            model: 'gemini-3-pro-preview', // Use gemini-3-pro-preview for complex tasks like image analysis
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
                    { text: prompt }
                ]
            }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Analyze Test Results Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/ai/generate-flashcards', authMiddleware, async (req, res) => {
    const { topic, syllabus } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
    try {
        const prompt = `Create 10 flashcards for "${topic}". Context: ${syllabus || ''}. Return JSON: { "flashcards": [{"front": "...", "back": "..."}] }`;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash
            contents: { parts: [{ text: prompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Generate Flashcards Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/ai/generate-answer-key', authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
    try {
        const fullPrompt = `Generate the official answer key for: ${prompt}. If unknown, generate a realistic practice key. Return JSON: { "answerKey": {"1": "A", "2": "B", ...} }`;
        
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash
            contents: { parts: [{ text: fullPrompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Generate Answer Key Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/ai/generate-practice-test', authMiddleware, async (req, res) => {
    const { topic, numQuestions, difficulty } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
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
            model: 'gemini-3-pro-preview', // Use gemini-3-pro-preview for generating complex tests
            contents: { parts: [{ text: prompt }] }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Generate Practice Test Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

apiRouter.post('/ai/analyze-specific-mistake', authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
    try {
        const fullPrompt = `Analyze this specific mistake. User thought: "${prompt}". Return JSON: { "topic": "Main Topic", "explanation": "Detailed explanation of why it is wrong and the correct concept." }`;
        
        const contents = [];
        if (imageBase64) {
            contents.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
        }
        contents.push({ text: fullPrompt });
        
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash', // Use gemini-2.5-flash
            contents: { parts: contents }
        });

        res.json(parseAIResponse(response.text));
    } catch (e) { 
        console.error("AI Analyze Specific Mistake Error:", e);
        res.status(500).json({ error: e.message }); 
    }
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
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid." });
    
    const prompt = `Fix this broken JSON and return ONLY the valid JSON string: ${brokenJson}`;
    
    genAI.models.generateContent({
        model: 'gemini-2.5-flash', // Use gemini-2.5-flash
        contents: { parts: [{ text: prompt }] }
    }).then(result => {
        // Just return cleaned text for this specific utility endpoint
        const text = result.text;
        res.json({ correctedJson: parseAIResponse(text) });
    }).catch(e => {
        console.error("AI Correct JSON Error:", e);
        res.status(500).json({ error: e.message });
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;