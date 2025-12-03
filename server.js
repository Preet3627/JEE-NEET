
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
const isConfiguredBase = process.env.DB_HOST && process.env.JWT_SECRET && process.env.DB_USER && process.env.DB_NAME && process.env.ENCRYPTION_KEY && process.env.GOOGLE_CLIENT_ID;
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
    let cleanedText = text;

    // 1. Aggressively remove Markdown code blocks, if any
    const codeBlockRegex = /```(?:json|javascript|typescript|txt)?\n([\s\S]*?)\n```/g;
    const jsonMatches = [...cleanedText.matchAll(codeBlockRegex)];
    if (jsonMatches.length > 0) {
        // Prefer content inside a json code block
        cleanedText = jsonMatches[0][1].trim();
    } else {
        // If no code block, try to find first { or [ and last } or ]
        const firstBrace = cleanedText.indexOf('{');
        const firstBracket = cleanedText.indexOf('[');
        const lastBrace = cleanedText.lastIndexOf('}');
        const lastBracket = cleanedText.lastIndexOf(']');

        let start = -1;
        let end = -1;

        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            start = firstBrace;
            end = lastBrace + 1;
        }
        if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
            if (start === -1 || firstBracket < start) { // Prioritize array if it starts earlier
                start = firstBracket;
                end = lastBracket + 1;
            }
        }
        
        if (start !== -1 && end !== -1 && start < end) {
            cleanedText = cleanedText.substring(start, end).trim();
        }
    }

    try {
        // Attempt 1: Direct parse
        return JSON.parse(cleanedText);
    } catch (e1) {
        console.warn("Attempt 1: Direct JSON parse failed.", e1.message);
        
        // Attempt 2: Aggressive backslash and quote escaping
        // Replace unescaped backslashes with double backslashes, carefully avoiding already escaped ones
        let correctedText = cleanedText.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');
        
        // Escape unescaped double quotes that are NOT part of a key or value boundary
        // This regex is tricky and might need refinement, but aims to catch " in string values.
        // It tries to avoid escaping quotes that delimit keys or string values themselves.
        // For simplicity, we'll try a more direct approach: if it looks like a quote within a value, escape it.
        correctedText = correctedText.replace(/:\s*"(.*?)(?<!\\)"(.*?)(?<!\\)"(.*?)"/g, ':\\"$1\\"$2\\"$3\\"'); // Basic, may over-escape
        correctedText = correctedText.replace(/(?<![:"])\s*"\s*(?![,}\]])/g, '\\"'); // Catch isolated unescaped quotes
        
        // Escape newlines inside values
        correctedText = correctedText.replace(/\n/g, '\\n');

        // Further fix for specific LaTeX constructs that might still break JSON
        correctedText = correctedText.replace(/\\([()])/g, '\\\\$1'); // Escape ( and ) if preceded by a single backslash.

        try {
            return JSON.parse(correctedText);
        } catch (e2) {
            console.warn("Attempt 2: Backslash and general escape correction failed.", e2.message);

            // If all else fails, return a default empty object to prevent server crash
            console.error("AI response could not be parsed into valid JSON after all attempts. Returning empty object.", e1.message, e2.message);
            return {};
        }
    }
};

// --- ENCRYPTION SETUP ---
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = isConfiguredBase ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32) : null;
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
    if (!pool) {
        console.error("initDB called with null pool.");
        throw new Error("Database pool not configured.");
    }
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

let isDatabaseConnected = false;

// Attempt to initialize DB and services on startup
// This block is now async to handle WebDAV initialization properly
(async () => {
    if (isConfiguredBase) {
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
            
            await initDB().then(() => {
                isDatabaseConnected = true;
            }).catch(err => {
                console.error("Critical DB initialization error. Server may not function. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env", err);
                pool = null; // Mark pool as unusable
                isDatabaseConnected = false;
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
            const hasStudyMaterialWebDAVConfig = process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN && process.env.NEXTCLOUD_SHARE_PASSWORD;
            if (hasStudyMaterialWebDAVConfig) {
                try {
                    const client = createClient(
                        `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                        { username: process.env.NEXTCLOUD_SHARE_TOKEN, password: process.env.NEXTCLOUD_SHARE_PASSWORD }
                    );
                    await client.getDirectoryContents('/'); // Test connection
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
            const hasMusicWebDAVConfig = process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN && process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD;
            if (hasMusicWebDAVConfig) {
                try {
                    const client = createClient(
                        `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                        { username: process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, password: process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD }
                    );
                    await client.getDirectoryContents('/'); // Test connection
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
            console.error("FATAL ERROR: Could not create database pool or initialize other services. Server will be misconfigured. Check .env variables.", error);
            pool = null; // Mark pool as unusable on any fatal error during initial setup
            isDatabaseConnected = false;
        }
    } else {
        console.warn("Base server configuration is incomplete. Check DB_HOST, JWT_SECRET, etc. in .env. Server will start in misconfigured state.");
    }
})(); // IIFE to run async initialization

// Middleware to check DB connection status for all routes needing it
const checkDbConnection = (req, res, next) => {
    if (!isDatabaseConnected || !pool) {
        return res.status(503).json({ error: "Database not initialized or unreachable." });
    }
    next();
};

const checkAiService = (req, res, next) => {
    if (!genAI) {
        return res.status(503).json({ error: "AI Service Unavailable. API Key might be missing or invalid in .env" });
    }
    next();
};

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
    // No need for redundant pool check, checkDbConnection handles it
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
    if (!pool || !isDatabaseConnected) {
        console.error("getUserData failed: Database not initialized or unreachable.");
        return null; 
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
        if (pool && isDatabaseConnected) {
            await pool.query('SELECT 1');
            res.json({ status: 'online' });
        } else {
            // If pool is null or not connected, it means DB init failed
            res.status(200).json({ status: 'misconfigured', error: "Database not initialized or unreachable." });
        }
    } catch (error) {
        console.error("Status check failed:", error);
        res.status(503).json({ status: 'offline', error: error.message });
    }
});

apiRouter.get('/dj-drop', checkDbConnection, async (req, res) => {
    const djDropUrl = process.env.NEXTCLOUD_DJ_DROP_URL || 'https://nc.ponsrischool.in/index.php/s/em85Zdf2EYEkz3j/download';
    try {
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
apiRouter.post('/auth/google', checkDbConnection, async (req, res) => {
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

apiRouter.post('/login', checkDbConnection, async (req, res) => {
    const { sid, password } = req.body;
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

apiRouter.get('/me', checkDbConnection, authMiddleware, async (req, res) => {
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

apiRouter.post('/heartbeat', checkDbConnection, authMiddleware, async (req, res) => {
    try {
        await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
        res.json({ status: 'ok' });
    } catch (e) {
        console.error("Heartbeat error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/register', checkDbConnection, async (req, res) => {
    const { fullName, sid, email, password } = req.body;
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

apiRouter.post('/forgot-password', checkDbConnection, async (req, res) => {
    const { email } = req.body;
    if (!mailer) return res.status(503).json({ error: "Email service not configured. Contact admin." });

    try {
        const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        const user = users[0];

        if (!user) return res.status(404).json({ message: "If an account with that email exists, a password reset link has been sent." });

        const resetToken = crypto.randomBytes(32).toString('hex');
        // In a real app, securely store this token in the DB with an expiry and link to the user.
        // For this demo, we'll use a simplified flow assuming the token is temporary and directly usable.
        // For security, this would require a DB entry: INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?);

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

apiRouter.post('/reset-password', checkDbConnection, async (req, res) => {
    const { token, password } = req.body;
    try {
        // This is a simplified demo implementation.
        // In a real app, 'token' would be validated against a securely stored token in the DB,
        // and its expiry would be checked.
        
        // For demonstration, we assume a direct mapping or a prior verification step.
        // This query is a placeholder, as the forgot-password flow above doesn't store the token in api_token.
        // A dedicated `password_resets` table with `user_id`, `token`, `expires_at` is needed.
        const [users] = await pool.query("SELECT id FROM users WHERE api_token = ?", [token]); 
        if (users.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }
        const userId = users[0].id;
        
        const hash = bcrypt.hashSync(password, 10);
        await pool.query("UPDATE users SET password_hash = ?, api_token = NULL WHERE id =