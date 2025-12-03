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
// isNextcloudConfigured will be true if *either* study material or music WebDAV is fully configured AND successfully connected
let isNextcloudConfigured = false; 

let pool = null;
let mailer = null;
const JWT_SECRET = process.env.JWT_SECRET;
let googleClient = null;
let webdavClient = null;
let musicWebdavClient = null;
let genAI = null;

// --- HELPER: Robust AI JSON Parser ---
const parseAIResponse = (text) => {
    // 1. Remove Markdown code blocks, if any
    let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        // Attempt 1: Direct parse
        return JSON.parse(cleanedText);
    } catch (e1) {
        console.warn("Attempt 1: Direct JSON parse failed.", e1.message);
        
        // Attempt 2: Fix common LaTeX/path backslash issues and other problematic characters
        // This regex replaces any backslash that is NOT followed by a valid JSON escape sequence.
        // It also handles common problematic unescaped characters like parentheses in LaTeX.
        let correctedText = cleanedText.replace(/\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
        
        // Further fix for specific LaTeX constructs that might still break JSON
        // Example: `\(` or `\)` might be interpreted as start of escape sequence in JSON.
        correctedText = correctedText.replace(/\\([()])/g, '\\\\$1'); // Escape ( and ) if preceded by a single backslash.
        correctedText = correctedText.replace(/(?<!\\)"/g, '\\"'); // Escape unescaped quotes (common in titles)
        correctedText = correctedText.replace(/\n/g, '\\n'); // Escape newlines within string values
        
        // Try parsing the corrected text
        try {
            return JSON.parse(correctedText);
        } catch (e2) {
            console.warn("Attempt 2: Backslash and general escape correction failed.", e2.message);

            // Attempt 3: Try to extract only the first JSON object or array from potentially messy text
            const match = correctedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match && match[0]) {
                try {
                    // Apply corrections again to the extracted match
                    const extractedAndCorrected = match[0].replace(/\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
                    return JSON.parse(extractedAndCorrected);
                } catch (e3) {
                    console.error("Attempt 3: Extract & parse failed.", e3.message);
                    throw new Error(`Failed to parse AI response after all attempts. Original error: ${e1.message}. Last attempt error: ${e3.message}`);
                }
            }
            throw new Error(`Failed to parse AI response: ${e1.message}. Last attempt error: ${e2.message}`);
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
            console.error("Critical DB initialization error. Server may not function. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env", err);
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

        // Initialize WebDAV client for Study Material
        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN && process.env.NEXTCLOUD_SHARE_PASSWORD) {
            try {
                const client = createClient(
                    `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                    { username: process.env.NEXTCLOUD_SHARE_TOKEN, password: process.env.NEXTCLOUD_SHARE_PASSWORD }
                );
                // Test connection
                await client.getDirectoryContents('/');
                webdavClient = client;
                isNextcloudConfigured = true;
                console.log("Study Material WebDAV client initialized successfully.");
            } catch (e) {
                console.warn("Failed to initialize or connect to Study Material WebDAV. Check NEXTCLOUD_URL, NEXTCLOUD_SHARE_TOKEN, NEXTCLOUD_SHARE_PASSWORD in .env", e);
                webdavClient = null;
            }
        } else {
            console.warn("Study Material WebDAV not fully configured. Missing NEXTCLOUD_URL, NEXTCLOUD_SHARE_TOKEN, or NEXTCLOUD_SHARE_PASSWORD in .env");
            webdavClient = null;
        }

        // Initialize WebDAV client for Music
        if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN && process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD) {
            try {
                const client = createClient(
                    `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                    { username: process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, password: process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD }
                );
                // Test connection
                await client.getDirectoryContents('/');
                musicWebdavClient = client;
                isNextcloudConfigured = true;
                console.log("Music WebDAV client initialized successfully.");
            } catch (e) {
                console.warn("Failed to initialize or connect to Music WebDAV. Check NEXTCLOUD_URL, NEXTCLOUD_MUSIC_SHARE_TOKEN, NEXTCLOUD_MUSIC_SHARE_PASSWORD in .env", e);
                musicWebdavClient = null;
            }
        } else {
            console.warn("Music WebDAV not fully configured. Missing NEXTCLOUD_URL, NEXTCLOUD_MUSIC_SHARE_TOKEN, or NEXTCLOUD_MUSIC_SHARE_PASSWORD in .env");
            musicWebdavClient = null;
        }


    } catch (error) {
        console.error("FATAL ERROR: Could not create database pool or initialize services. Server will be misconfigured. Check .env variables.", error);
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
    if (!pool) {
        console.error("getUserData failed: Database not initialized.");
        return null; // Can't fetch data if DB isn't ready
    }
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
        // Ping database to check connection health
        if (pool) {
            await pool.query('SELECT 1');
            res.json({ status: 'online' });
        } else {
            // If pool is null, it means DB init failed
            res.status(200).json({ status: 'misconfigured', error: "Database not initialized" });
        }
    } catch (error) {
        console.error("Status check failed:", error);
        res.status(503).json({ status: 'offline', error: error.message });
    }
});

apiRouter.get('/dj-drop', async (req, res) => {
    // Check for DB pool early as it's a critical resource
    if (!pool) return res.status(503).send("Database not initialized for DJ Drop.");

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
        isNextcloudConfigured: isNextcloudConfigured // Reflects actual init status now
    });
});

// --- AUTH ROUTES ---
apiRouter.post('/auth/google', async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    const { credential } = req.body;
    if (!credential || !googleClient) return res.status(400).json({ error: "Service unavailable" });

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
    if (!pool) return res.status(500).json({ error: "Database not initialized" });

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
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    if (!mailer) return res.status(503).json({ error: "Email service not configured" });

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
             await connection.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
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
    if (!resultId) return res.status(400