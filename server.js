
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
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                reset_token VARCHAR(255), -- Added for password reset
                reset_token_expires_at DATETIME -- Added for password reset
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
                user_sid INT,
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
            
            if(process.env.GOOGLE_CLIENT_ID) { // Ensure GOOGLE_CLIENT_ID is defined before initializing
                googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
            } else {
                console.warn("GOOGLE_CLIENT_ID is not defined in .env. Google Auth will be unavailable.");
            }
            
            if(process.env.API_KEY) {
                genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
            } else {
                console.warn("API_KEY is not defined in .env. AI features will be unavailable.");
            }
            
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                mailer = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: parseInt(process.env.SMTP_PORT || '587', 10),
                  secure: process.env.SMTP_SECURE === 'true',
                  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                });
            } else {
                console.warn("SMTP credentials not fully configured. Email features will be unavailable.");
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
                    isNextcloudConfigured = true; // Set to true if this one connects
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
                    isNextcloudConfigured = true; // Set to true if this one connects too (OR if study material connected)
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
    if (!config.settings.dashboardLayout) config.settings.dashboardLayout = [];
    if (!config.settings.dashboardFlashcardDeckIds) config.settings.dashboardFlashcardDeckIds = [];
    if (!config.settings.musicPlayerWidgetLayout) config.settings.musicPlayerWidgetLayout = 'minimal';
    if (!config.settings.dashboardBackgroundImage) config.settings.dashboardBackgroundImage = '';
    if (config.settings.dashboardTransparency === undefined) config.settings.dashboardTransparency = 50;
    if (!config.settings.notchSettings) config.settings.notchSettings = { position: 'top', size: 'medium', width: 30, enabled: true };
    if (!config.settings.visualizerSettings) config.settings.visualizerSettings = { preset: 'bars', colorMode: 'rgb' };
    if (!config.settings.djDropSettings) config.settings.djDropSettings = { enabled: true, autoTrigger: true };
    if (!config.flashcardDecks) config.flashcardDecks = [];
    if (!config.pinnedMaterials) config.pinnedMaterials = [];
    if (!config.customWidgets) config.customWidgets = [];
    if (!config.localPlaylists) config.localPlaylists = [];


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
        const [users] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        const user = users[0];

        if (!user) return res.status(404).json({ message: "If an account with that email exists, a password reset link has been sent." });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

        await pool.query(
            "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
            [resetToken, resetTokenExpiresAt, user.id]
        );

        const resetLink = `${req.protocol}://${req.get('host')}/?reset-token=${resetToken}`;
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Password Reset Request for JEE Scheduler Pro',
            html: `<p>You requested a password reset for your JEE Scheduler Pro account.</p>
                   <p>Click <a href="${resetLink}">this link</a> to reset your your password.</p>
                   <p>This link is valid for 1 hour. If you did not request this, please ignore this email.</p>`,
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
        const [users] = await pool.query(
            "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires_at > NOW()",
            [token]
        ); 
        if (users.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }
        const userId = users[0].id;
        
        const hash = bcrypt.hashSync(password, 10);
        await pool.query(
            "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?",
            [hash, userId]
        );
        res.json({ message: "Password has been reset successfully." });
    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.put('/profile', checkDbConnection, authMiddleware, async (req, res) => {
    const { fullName, profilePhoto } = req.body;
    try {
        const updates = [];
        const params = [];
        if (fullName !== undefined) {
            updates.push('full_name = ?');
            params.push(fullName);
        }
        if (profilePhoto !== undefined) {
            updates.push('profile_photo = ?');
            params.push(profilePhoto);
        }
        
        if (updates.length === 0) return res.status(400).json({ message: "No data to update." });

        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            [...params, req.userId]
        );
        res.json({ message: "Profile updated successfully." });
    } catch (e) {
        console.error("Update profile error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/me/api-token', checkDbConnection, authMiddleware, async (req, res) => {
    try {
        const newToken = crypto.randomBytes(32).toString('hex');
        await pool.query("UPDATE users SET api_token = ? WHERE id = ?", [newToken, req.userId]);
        res.json({ token: newToken });
    } catch (e) {
        console.error("Generate API token error:", e);
        res.status(500).json({ error: "Failed to generate API token." });
    }
});

apiRouter.delete('/me/api-token', checkDbConnection, authMiddleware, async (req, res) => {
    try {
        await pool.query("UPDATE users SET api_token = NULL WHERE id = ?", [req.userId]);
        res.json({ message: "API token revoked." });
    } catch (e) {
        console.error("Revoke API token error:", e);
        res.status(500).json({ error: "Failed to revoke API token." });
    }
});

// --- SCHEDULE ITEMS ---
apiRouter.post('/schedule-items', checkDbConnection, authMiddleware, async (req, res) => {
    const { task } = req.body;
    try {
        await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
        res.json({ message: "Task saved" });
    } catch (e) {
        console.error("Save task error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/batch', checkDbConnection, authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    try {
        const inserts = tasks.map(task => [req.userId, encrypt(task)]);
        if (inserts.length > 0) {
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES ?", [inserts]);
        }
        res.json({ message: "Batch tasks saved" });
    } catch (e) {
        console.error("Save batch tasks error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/schedule-items/:taskId', checkDbConnection, authMiddleware, async (req, res) => {
    const { taskId } = req.params;
    try {
        const rowId = await findRowIdByInnerId('schedule_items', req.userId, taskId);
        if (!rowId) return res.status(404).json({ error: "Task not found" });
        await pool.query("DELETE FROM schedule_items WHERE id = ? AND user_id = ?", [rowId, req.userId]);
        res.json({ message: "Task deleted" });
    } catch (e) {
        console.error("Delete task error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/batch-delete', checkDbConnection, authMiddleware, async (req, res) => {
    const { taskIds } = req.body;
    try {
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ error: "No task IDs provided." });
        }

        const [rows] = await pool.query(`SELECT id, data FROM schedule_items WHERE user_id = ?`, [req.userId]);
        const dbIdsToDelete = [];
        for (const row of rows) {
            const item = decrypt(row.data);
            if (item && taskIds.includes(item.ID)) {
                dbIdsToDelete.push(row.id);
            }
        }

        if (dbIdsToDelete.length > 0) {
            await pool.query(`DELETE FROM schedule_items WHERE id IN (?) AND user_id = ?`, [dbIdsToDelete, req.userId]);
        }
        res.json({ message: `Deleted ${dbIdsToDelete.length} tasks.` });
    } catch (e) {
        console.error("Batch delete tasks error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/clear-all', checkDbConnection, authMiddleware, async (req, res) => {
    try {
        await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [req.userId]);
        res.json({ message: "All schedule items cleared." });
    } catch (e) {
        console.error("Clear all schedule error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/schedule-items/batch-move', checkDbConnection, authMiddleware, async (req, res) => {
    const { taskIds, newDate } = req.body;
    try {
        if (!Array.isArray(taskIds) || taskIds.length === 0 || !newDate) {
            return res.status(400).json({ error: "Invalid request for batch move." });
        }

        const [rows] = await pool.query(`SELECT id, data FROM schedule_items WHERE user_id = ?`, [req.userId]);
        const updates = [];
        const params = [];

        for (const row of rows) {
            let item = decrypt(row.data);
            if (item && taskIds.includes(item.ID)) {
                // Update the date, make it a one-off task, clear googleEventId if any
                item = { ...item, date: newDate, isRecurring: false, googleEventId: undefined };
                updates.push(`UPDATE schedule_items SET data = ? WHERE id = ?`);
                params.push(encrypt(item), row.id);
            }
        }

        if (updates.length > 0) {
            await pool.query(updates.join('; '), params);
        }
        res.json({ message: `Moved ${updates.length} tasks to ${newDate}.` });
    } catch (e) {
        console.error("Batch move tasks error:", e);
        res.status(500).json({ error: e.message });
    }
});


// --- USER CONFIG ---
apiRouter.post('/config', checkDbConnection, authMiddleware, async (req, res) => {
    const newConfig = req.body;
    try {
        const [existingConfigRows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
        let updatedConfig;
        if (existingConfigRows.length > 0) {
            const currentConfig = decrypt(existingConfigRows[0].config);
            updatedConfig = { ...currentConfig, ...newConfig, settings: { ...currentConfig.settings, ...newConfig.settings } };
            await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(updatedConfig), req.userId]);
        } else {
            updatedConfig = { ...newConfig, settings: { ...newConfig.settings } };
            await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(updatedConfig)]);
        }
        res.json({ message: "Config updated" });
    } catch (e) {
        console.error("Update config error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/user-data/full-sync', checkDbConnection, authMiddleware, async (req, res) => {
    const { userData } = req.body;
    try {
        // Update user config
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?", 
            [req.userId, encrypt(userData.CONFIG), encrypt(userData.CONFIG)]);

        // Clear existing data and insert new for relevant tables
        const tables = ['schedule_items', 'results', 'exams', 'study_sessions'];
        for (const table of tables) {
            await pool.query(`DELETE FROM ${table} WHERE user_id = ?`, [req.userId]);
            if (userData[table.toUpperCase()] && userData[table.toUpperCase()].length > 0) {
                const inserts = userData[table.toUpperCase()].map(item => [req.userId, encrypt(item)]);
                await pool.query(`INSERT INTO ${table} (user_id, data) VALUES ?`, [inserts]);
            }
        }
        res.json({ message: "Full sync successful" });
    } catch (e) {
        console.error("Full sync error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- RESULTS ---
apiRouter.put('/results', checkDbConnection, authMiddleware, async (req, res) => {
    const { result } = req.body;
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, result.ID);
        if (!rowId) return res.status(404).json({ error: "Result not found" });
        await pool.query("UPDATE results SET data = ? WHERE id = ? AND user_id = ?", [encrypt(result), rowId, req.userId]);
        res.json({ message: "Result updated" });
    } catch (e) {
        console.error("Update result error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/results', checkDbConnection, authMiddleware, async (req, res) => {
    const { resultId } = req.body;
    try {
        const rowId = await findRowIdByInnerId('results', req.userId, resultId);
        if (!rowId) return res.status(404).json({ error: "Result not found" });
        await pool.query("DELETE FROM results WHERE id = ? AND user_id = ?", [rowId, req.userId]);
        res.json({ message: "Result deleted" });
    } catch (e) {
        console.error("Delete result error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- EXAMS ---
apiRouter.post('/exams', checkDbConnection, authMiddleware, async (req, res) => {
    const { exam } = req.body;
    try {
        await pool.query("INSERT INTO exams (user_id, data) VALUES (?, ?)", [req.userId, encrypt(exam)]);
        res.json({ message: "Exam added" });
    } catch (e) {
        console.error("Add exam error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.put('/exams/:examId', checkDbConnection, authMiddleware, async (req, res) => {
    const { examId } = req.params;
    const { exam } = req.body;
    try {
        const rowId = await findRowIdByInnerId('exams', req.userId, examId);
        if (!rowId) return res.status(404).json({ error: "Exam not found" });
        await pool.query("UPDATE exams SET data = ? WHERE id = ? AND user_id = ?", [encrypt(exam), rowId, req.userId]);
        res.json({ message: "Exam updated" });
    } catch (e) {
        console.error("Update exam error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/exams/:examId', checkDbConnection, authMiddleware, async (req, res) => {
    const { examId } = req.params;
    try {
        const rowId = await findRowIdByInnerId('exams', req.userId, examId);
        if (!rowId) return res.status(404).json({ error: "Exam not found" });
        await pool.query("DELETE FROM exams WHERE id = ? AND user_id = ?", [rowId, req.userId]);
        res.json({ message: "Exam deleted" });
    } catch (e) {
        console.error("Delete exam error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- DOUBTS ---
apiRouter.get('/doubts/all', checkDbConnection, authMiddleware, async (req, res) => {
    try {
        const [doubtsRows] = await pool.query("SELECT * FROM doubts ORDER BY created_at DESC");
        const allDoubts = [];
        for (const doubtRow of doubtsRows) {
            const [solutionsRows] = await pool.query("SELECT * FROM doubt_solutions WHERE doubt_id = ? ORDER BY created_at ASC", [doubtRow.id]);
            allDoubts.push({
                ...doubtRow,
                solutions: solutionsRows
            });
        }
        res.json(allDoubts);
    } catch (e) {
        console.error("Get all doubts error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/doubts', checkDbConnection, authMiddleware, async (req, res) => {
    const { question, question_image } = req.body;
    try {
        const [userRows] = await pool.query("SELECT full_name, profile_photo FROM users WHERE id = ?", [req.userId]);
        const user = userRows[0];
        const newDoubt = {
            id: `doubt_${Date.now()}_${req.userSid}`,
            user_sid: req.userSid,
            question,
            question_image,
            created_at: new Date().toISOString(),
            author_name: user.full_name || 'Anonymous',
            author_photo: user.profile_photo || '',
            status: 'active'
        };
        await pool.query("INSERT INTO doubts SET ?", [newDoubt]);
        res.json({ message: "Doubt posted" });
    } catch (e) {
        console.error("Post doubt error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/doubts/:doubtId/solutions', checkDbConnection, authMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { solution, solution_image } = req.body;
    try {
        const [userRows] = await pool.query("SELECT full_name, profile_photo FROM users WHERE id = ?", [req.userId]);
        const user = userRows[0];
        const newSolution = {
            id: `sol_${Date.now()}_${req.userSid}`,
            doubt_id: doubtId,
            user_sid: req.userId, // Store user_id instead of sid for foreign key
            solution,
            solution_image,
            created_at: new Date().toISOString(),
            solver_name: user.full_name || 'Anonymous',
            solver_photo: user.profile_photo || ''
        };
        await pool.query("INSERT INTO doubt_solutions SET ?", [newSolution]);
        res.json({ message: "Solution posted" });
    } catch (e) {
        console.error("Post solution error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.put('/admin/doubts/:doubtId/status', checkDbConnection, adminMiddleware, async (req, res) => {
    const { doubtId } = req.params;
    const { status } = req.body; // 'active', 'archived', 'deleted'
    if (!['active', 'archived', 'deleted'].includes(status)) {
        return res.status(400).json({ error: "Invalid status provided." });
    }
    try {
        await pool.query("UPDATE doubts SET status = ? WHERE id = ?", [status, doubtId]);
        res.json({ message: `Doubt ${doubtId} status updated to ${status}` });
    } catch (e) {
        console.error("Update doubt status error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- MESSAGING ---
apiRouter.get('/messages/:recipientSid', checkDbConnection, authMiddleware, async (req, res) => {
    const { recipientSid } = req.params;
    const senderSid = req.userSid; // Current user's SID

    try {
        const [messages] = await pool.query(
            `SELECT * FROM messages 
             WHERE (sender_sid = ? AND recipient_sid = ?) 
                OR (sender_sid = ? AND recipient_sid = ?)
             ORDER BY created_at ASC`,
            [senderSid, recipientSid, recipientSid, senderSid]
        );
        res.json(messages);
    } catch (e) {
        console.error("Get messages error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/messages', checkDbConnection, authMiddleware, async (req, res) => {
    const { recipient_sid, content } = req.body;
    const sender_sid = req.userSid; // Current user's SID

    try {
        const [result] = await pool.query(
            "INSERT INTO messages (sender_sid, recipient_sid, content) VALUES (?, ?, ?)",
            [sender_sid, recipient_sid, content]
        );
        res.json({ id: result.insertId, sender_sid, recipient_sid, content, created_at: new Date().toISOString(), is_read: false });
    } catch (e) {
        console.error("Send message error:", e);
        res.status(500).json({ error: e.message });
    }
});


// --- ADMIN ROUTES ---
apiRouter.get('/admin/students', checkDbConnection, adminMiddleware, async (req, res) => {
    try {
        const [studentRows] = await pool.query("SELECT id, sid, email, full_name, profile_photo, is_verified, role, last_seen FROM users WHERE role = 'student'");
        const students = [];
        for (const student of studentRows) {
            const studentData = await getUserData(student.id); // Get full data for each student
            students.push(studentData);
        }
        res.json(students);
    } catch (e) {
        console.error("Get students error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.delete('/admin/students/:sid', checkDbConnection, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [userRows] = await pool.query("SELECT id FROM users WHERE sid = ?", [sid]);
        if (userRows.length === 0) return res.status(404).json({ error: "Student not found" });
        await pool.query("DELETE FROM users WHERE id = ?", [userRows[0].id]);
        res.json({ message: "Student deleted" });
    } catch (e) {
        console.error("Delete student error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/students/:sid/clear-data', checkDbConnection, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [userRows] = await pool.query("SELECT id FROM users WHERE sid = ?", [sid]);
        if (userRows.length === 0) return res.status(404).json({ error: "Student not found" });
        const userId = userRows[0].id;

        const tablesToClear = ['schedule_items', 'results', 'exams', 'study_sessions', 'user_configs'];
        for (const table of tablesToClear) {
            await pool.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
        }
        // Re-insert default config after clearing
        const initialConfig = { WAKE: '06:00', SCORE: '0/300', WEAK: [], UNACADEMY_SUB: false, settings: { accentColor: '#0891b2', blurEnabled: true, mobileLayout: 'standard', forceOfflineMode: false, perQuestionTime: 180, examType: 'JEE' } };
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [userId, encrypt(initialConfig)]);

        res.json({ message: `All data cleared for student ${sid}.` });
    } catch (e) {
        console.error("Clear student data error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/impersonate/:sid', checkDbConnection, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [userRows] = await pool.query("SELECT id, role FROM users WHERE sid = ?", [sid]);
        if (userRows.length === 0) return res.status(404).json({ error: "Student not found" });
        
        // Generate a token for the target student
        const token = jwt.sign({ id: userRows[0].id, sid: sid, role: userRows[0].role }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, message: `Impersonating student ${sid}.` });
    } catch (e) {
        console.error("Impersonate student error:", e);
        res.status(500).json({ error: e.message });
    }
});

apiRouter.post('/admin/broadcast-task', checkDbConnection, adminMiddleware, async (req, res) => {
    const { task, examType } = req.body; // examType can be 'ALL', 'JEE', 'NEET'
    try {
        let query = "SELECT id FROM users WHERE role = 'student'";
        const queryParams = [];

        if (examType !== 'ALL') {
            query += " AND id IN (SELECT user_id FROM user_configs WHERE JSON_EXTRACT(config, '$.settings.examType') = ?)";
            queryParams.push(examType);
        }

        const [usersToBroadcast] = await pool.query(query, queryParams);

        if (usersToBroadcast.length === 0) {
            return res.status(200).json({ message: "No students matched the broadcast criteria." });
        }

        for (const user of usersToBroadcast) {
            // Ensure a unique ID for each broadcasted task, if not already handled
            const broadcastTask = { ...task, ID: `${task.ID}_${user.id}` }; 
            await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [user.id, encrypt(broadcastTask)]);
        }

        res.json({ message: `Task broadcasted to ${usersToBroadcast.length} students.` });
    } catch (e) {
        console.error("Broadcast task error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- STUDY MATERIAL ---
apiRouter.get('/study-material/browse', checkDbConnection, authMiddleware, async (req, res) => {
    const { path: requestedPath } = req.query;
    if (!webdavClient) return res.status(503).json({ error: "Study Material service not configured or reachable." });

    try {
        const contents = await webdavClient.getDirectoryContents(requestedPath || '/');
        const formattedContents = contents.map(item => ({
            name: item.basename,
            type: item.type,
            path: item.filename,
            size: item.size || 0,
            modified: item.lastmod,
        }));
        res.json(formattedContents);
    } catch (e) {
        console.error("WebDAV browse error:", e);
        res.status(500).json({ error: "Failed to browse study materials. Check Nextcloud configuration." });
    }
});

apiRouter.post('/study-material/details', checkDbConnection, authMiddleware, async (req, res) => {
    const { paths } = req.body;
    if (!webdavClient) return res.status(503).json({ error: "Study Material service not configured or reachable." });

    try {
        const detailedItems = [];
        for (const p of paths) {
            try {
                const stat = await webdavClient.stat(p);
                detailedItems.push({
                    name: stat.basename,
                    type: stat.type,
                    path: stat.filename,
                    size: stat.size || 0,
                    modified: stat.lastmod,
                });
            } catch (e) {
                console.warn(`Could not get details for ${p}:`, e.message);
                // Optionally push a placeholder or skip
            }
        }
        res.json(detailedItems);
    } catch (e) {
        console.error("WebDAV details error:", e);
        res.status(500).json({ error: "Failed to retrieve study material details." });
    }
});

apiRouter.get('/study-material/content', checkDbConnection, authMiddleware, async (req, res) => {
    const { path: requestedPath } = req.query;
    if (!webdavClient) return res.status(503).json({ error: "Study Material service not configured or reachable." });
    if (!requestedPath) return res.status(400).json({ error: "File path is required." });

    try {
        // Stream the file directly from WebDAV to the response
        const fileStream = await webdavClient.createReadStream(requestedPath);
        
        const stat = await webdavClient.stat(requestedPath);
        res.setHeader('Content-Type', stat.mime); // Set content type from WebDAV stat
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${stat.basename}"`); // Suggest download
        
        fileStream.pipe(res);
    } catch (e) {
        console.error("WebDAV file content error:", e);
        res.status(500).json({ error: "Failed to retrieve file content." });
    }
});

// --- MUSIC ---
apiRouter.get('/music/browse', checkDbConnection, authMiddleware, async (req, res) => {
    const { path: requestedPath } = req.query;
    if (!musicWebdavClient) return res.status(503).json({ error: "Music service not configured or reachable." });

    try {
        const contents = await musicWebdavClient.getDirectoryContents(requestedPath || '/');
        const formattedContents = contents.map(item => ({
            name: item.basename,
            type: item.type,
            path: item.filename,
            size: item.size || 0,
            modified: item.lastmod,
        }));
        res.json(formattedContents);
    } catch (e) {
        console.error("Music WebDAV browse error:", e);
        res.status(500).json({ error: "Failed to browse music files. Check Nextcloud configuration." });
    }
});

apiRouter.get('/music/content', checkDbConnection, authMiddleware, async (req, res) => {
    const { path: requestedPath } = req.query;
    if (!musicWebdavClient) return res.status(503).json({ error: "Music service not configured or reachable." });
    if (!requestedPath) return res.status(400).json({ error: "File path is required." });

    try {
        const fileStream = await musicWebdavClient.createReadStream(requestedPath);
        const stat = await musicWebdavClient.stat(requestedPath);
        res.setHeader('Content-Type', stat.mime); 
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${stat.basename}"`);
        fileStream.pipe(res);
    } catch (e) {
        console.error("Music file content error:", e);
        res.status(500).json({ error: "Failed to stream music file." });
    }
});

apiRouter.get('/music/album-art', checkDbConnection, authMiddleware, async (req, res) => {
    const { path: requestedPath } = req.query;
    if (!musicWebdavClient) return res.status(503).json({ error: "Music service not configured or reachable." });
    if (!requestedPath) return res.status(400).json({ error: "File path is required." });

    try {
        // For simplicity, we assume album art is embedded in the audio file.
        // In a real scenario, you might have separate image files or a dedicated metadata service.
        // Here, we just proxy the audio file itself to let the frontend extract metadata.
        const fileStream = await musicWebdavClient.createReadStream(requestedPath);
        const stat = await musicWebdavClient.stat(requestedPath);
        res.setHeader('Content-Type', stat.mime); 
        res.setHeader('Content-Length', stat.size);
        fileStream.pipe(res);
    } catch (e) {
        console.error("Music album art error:", e);
        res.status(500).json({ error: "Failed to retrieve album art." });
    }
});


// --- AI ROUTES ---
apiRouter.post('/ai/parse-text', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { text, domain } = req.body;
    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `The user wants to import data into their JEE Scheduler Pro app. Parse the following text into a JSON object. If you find data for multiple categories (schedules, exams, results, weaknesses, custom_widget, flashcard_deck, homework_assignment, practice_test), include them all in a single JSON. For schedules, please use specific dates (e.g., "2025-12-01") instead of relative days ("MONDAY") if possible, and set \`isUserCreated: true\`. For flashcard_deck or practice_test, ensure cards/questions have unique IDs and \`isLocked: false\`. If creating a deep link, use the domain "${domain}" and action 'import_data'. Ensure any text fields containing LaTeX are wrapped in double quotes.
            
            Return ONLY the JSON. Do not include any conversational text.
            
            Text to parse: """${text}"""
            
            Expected JSON format examples:
            {
                "schedules": [
                    {
                        "ID": "A1",
                        "type": "ACTION",
                        "CARD_TITLE": {"EN": "Physics Revision", "GU": ""},
                        "FOCUS_DETAIL": {"EN": "Revise Electrostatics", "GU": ""},
                        "SUBJECT_TAG": {"EN": "PHYSICS", "GU": ""},
                        "TIME": "10:00",
                        "DAY": {"EN": "MONDAY", "GU": ""},
                        "date": "2025-12-01",
                        "isUserCreated": true,
                        "SUB_TYPE": "DEEP_DIVE",
                        "gradient": "from-cyan-500 to-blue-600",
                        "imageUrl": "https://example.com/image.jpg",
                        "externalLink": "https://zoom.us/j/12345",
                        "isRecurring": false
                    },
                    {
                        "ID": "H1",
                        "type": "HOMEWORK",
                        "CARD_TITLE": {"EN": "Maths Homework", "GU": ""},
                        "FOCUS_DETAIL": {"EN": "Practice Calculus", "GU": ""},
                        "SUBJECT_TAG": {"EN": "MATHS", "GU": ""},
                        "Q_RANGES": "1-10",
                        "category": "Level-1",
                        "answers": {"1":"A", "2":"B"}
                    }
                ],
                "exams": [
                    {"ID": "E1", "title": "Mock Test", "subject": "FULL", "date": "2025-12-15", "time": "09:00", "syllabus": "Full JEE"}
                ],
                "results": [
                    {"ID": "R1", "DATE": "2025-11-01", "SCORE": "180/300", "MISTAKES": ["Kinematics", "Thermodynamics"]}
                ],
                "weaknesses": ["Vectors", "Chemical Kinetics"],
                "custom_widget": {"title": "Daily Tip", "content": "Stay focused!"},
                "flashcard_deck": {
                    "id": "deck_123",
                    "name": "Physics Formulas",
                    "subject": "PHYSICS",
                    "chapter": "Mechanics",
                    "cards": [
                        {"id": "card_1", "front": "F=ma", "back": "Newton's 2nd Law"},
                        {"id": "card_2", "front": "E=mc^2", "back": "Mass-Energy Equivalence"}
                    ],
                    "isLocked": false
                },
                "practice_test": {
                    "questions": [
                        {"number": 1, "text": "What is 2+2?", "options": ["3", "4", "5"], "type": "MCQ"},
                        {"number": 2, "text": "Value of pi?", "type": "NUM"}
                    ],
                    "answers": {"1":"4", "2":"3.14"}
                }
            }`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        schedules: { type: "ARRAY", items: { type: "OBJECT" } },
                        exams: { type: "ARRAY", items: { type: "OBJECT" } },
                        results: { type: "ARRAY", items: { type: "OBJECT" } },
                        weaknesses: { type: "ARRAY", items: { type: "STRING" } },
                        custom_widget: { type: "OBJECT", properties: {"title": {type: "STRING"}, "content": {type: "STRING"}} },
                        flashcard_deck: { type: "OBJECT" },
                        practice_test: { type: "OBJECT" }
                    }
                }
            }
        });

        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return the parsed JSON directly
    } catch (e) {
        console.error("AI parse text error:", e);
        res.status(500).json({ error: e.message || "Failed to parse text with AI." });
    }
});

apiRouter.post('/ai/correct-json', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { brokenJson } = req.body;
    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Correct the following broken JSON string. Return only the corrected JSON. If it's unfixable, return an empty JSON object. Ensure any text fields containing LaTeX are wrapped in double quotes.
            Broken JSON: """${brokenJson}"""`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    // Allow any object structure for flexible correction
                    additionalProperties: true
                }
            }
        });
        const textResponse = result.text;
        const correctedJson = parseAIResponse(textResponse); // Use the robust parser
        res.json({ correctedJson: JSON.stringify(correctedJson) }); // Return as a stringified JSON
    } catch (e) {
        console.error("AI correct JSON error:", e);
        res.status(500).json({ error: e.message || "Failed to correct JSON with AI." });
    }
});

apiRouter.post('/ai/chat', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64, domain } = req.body;
    try {
        const fullHistory = history.map(msg => ({
            role: msg.role,
            parts: msg.parts.map(p => p.text ? { text: p.text } : p) // Ensure parts are in correct format
        }));
        
        const contents = [...fullHistory];

        const userParts = [{ text: prompt }];
        if (imageBase664) {
            userParts.unshift({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        }
        contents.push({ role: 'user', parts: userParts });

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            config: {
                // Guide the AI to respond in JSON for commands, otherwise natural language
                systemInstruction: `You are an AI assistant for JEE Scheduler Pro. You can create, update, or suggest study tasks, homework, exams, results, flashcards, or custom widgets. If the user asks for data or action that can be represented as JSON, return a JSON object with the structure defined in the AI Guide: ${domain}/ai-agent-guide-jee.txt (or /ai-agent-guide-neet.txt depending on user's exam type). If no JSON action is explicitly requested or found, respond in natural language. Always wrap LaTeX in double quotes.`,
                responseMimeType: "text/plain" // Default to text, AI decides if it's JSON based on instruction
            }
        });

        // The AI might still return JSON as text if it thinks it's appropriate
        // Attempt to parse it, otherwise treat as plain text.
        let aiResponseText = result.text;
        let parsedResponse = null;
        try {
            parsedResponse = JSON.parse(aiResponseText);
            // If it's a valid JSON, return it as such
            res.json({ role: 'model', parts: [{ text: JSON.stringify(parsedResponse, null, 2) }] });
        } catch (e) {
            // If not JSON, return as plain text
            res.json({ role: 'model', parts: [{ text: aiResponseText }] });
        }
    } catch (e) {
        console.error("AI chat error:", e);
        res.status(500).json({ error: e.message || "Failed to get AI response." });
    }
});

apiRouter.post('/ai/daily-insight', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { weaknesses, syllabus } = req.body;
    try {
        const prompt = `Generate a motivational quote and a daily study insight for a JEE/NEET student. 
        Focus on their weaknesses: ${weaknesses.join(', ')}. 
        If an upcoming exam syllabus is provided, tailor the insight to it: ${syllabus || 'None'}.
        The insight should be encouraging and actionable.
        Return in JSON format: {"quote": "...", "insight": "..."}`;

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        quote: { type: "STRING" },
                        insight: { type: "STRING" }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return parsed JSON directly
    } catch (e) {
        console.error("AI daily insight error:", e);
        res.status(500).json({ error: e.message || "Failed to generate daily insight." });
    }
});

apiRouter.post('/ai/analyze-mistake', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
        const contents = [];
        if (imageBase64) {
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        }
        contents.push({ text: `Analyze the following student mistake and provide a detailed explanation. Identify the core 'mistake_topic' (e.g., "Vector Dot Product Misapplication", "Incorrect Stoichiometry Calculation") and provide a clear 'explanation' of why it's wrong and how to fix it, referencing the image if provided.
        Student's mistake description: "${prompt}"
        Return in JSON format: {"mistake_topic": "...", "explanation": "..."}. Ensure any LaTeX is double quoted.` });

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        mistake_topic: { type: "STRING" },
                        explanation: { type: "STRING" }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return parsed JSON directly
    } catch (e) {
        console.error("AI mistake analysis error:", e);
        res.status(500).json({ error: e.message || "Failed to analyze mistake with AI." });
    }
});

apiRouter.post('/ai/solve-doubt', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
        const contents = [];
        if (imageBase64) {
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        }
        contents.push({ text: `Solve the following academic doubt/question for a JEE/NEET student. Provide a clear, step-by-step solution. If it's a conceptual question, provide a concise explanation. Use LaTeX for mathematical or chemical equations where appropriate, ensuring they are double quoted.
        Doubt: "${prompt}"` });

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            // By default, text/plain for a solution is better
        });
        const textResponse = result.text;
        res.json({ response: textResponse }); // Return plain text response
    } catch (e) {
        console.error("AI doubt solver error:", e);
        res.status(500).json({ error: e.message || "Failed to solve doubt with AI." });
    }
});

apiRouter.post('/ai/analyze-specific-mistake', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
        if (!imageBase64) {
            return res.status(400).json({ error: "Image of the question is required for specific mistake analysis." });
        }

        const contents = [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: `A student made a mistake on this question. Their description of the error is: "${prompt}".
            Provide a detailed analysis of the common pitfalls related to this question type or topic. Identify the core 'topic' (e.g., "Conservation of Angular Momentum", "Redox Titration Calculations") that the mistake falls under. Provide a clear 'explanation' focusing on the correct concepts and methods, potentially guiding the student to self-correct.
            Return in JSON format: {"topic": "...", "explanation": "..."}. Ensure any LaTeX is double quoted.` }
        ];

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        topic: { type: "STRING" },
                        explanation: { type: "STRING" }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return parsed JSON directly
    } catch (e) {
        console.error("AI specific mistake analysis error:", e);
        res.status(500).json({ error: e.message || "Failed to analyze specific mistake with AI." });
    }
});


apiRouter.post('/ai/analyze-test-results', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { imageBase64, userAnswers, timings, syllabus } = req.body;
    try {
        const contents = [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: `Analyze the student's test results based on the provided image (which is the answer key), their answers, and time spent per question.
            
            Student's Answers: ${JSON.stringify(userAnswers)}
            Time Spent (seconds, per question): ${JSON.stringify(timings)}
            Test Syllabus (chapters): ${syllabus}
            
            Provide the following in JSON format:
            {
                "score": "Calculated total score",
                "totalMarks": "Total marks for the test",
                "incorrectQuestionNumbers": ["List of question numbers that were incorrect or skipped"],
                "subjectTimings": {"Physics": "total time in seconds", "Chemistry": "total time in seconds", "Maths": "total time in seconds"},
                "chapterScores": {
                    "Chapter Name 1": {"correct": N, "incorrect": N, "accuracy": N},
                    "Chapter Name 2": {"correct": N, "incorrect": N, "accuracy": N}
                },
                "aiSuggestions": "Overall suggestions for improvement based on performance. Suggest 3-5 flashcards (front/back) for weakest areas.",
                "suggestedFlashcards": [
                    {"front": "Flashcard front", "back": "Flashcard back"}
                ]
            }
            
            When calculating score, assume: +4 for correct, -1 for incorrect MCQ, 0 for numerical/multi-choice incorrect/skipped.
            Ensure any LaTeX in suggestions or flashcards is double quoted.
            ` }
        ];

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        score: { type: "STRING" },
                        totalMarks: { type: "NUMBER" },
                        incorrectQuestionNumbers: { type: "ARRAY", items: { type: "NUMBER" } },
                        subjectTimings: { 
                            type: "OBJECT", 
                            properties: {
                                "Physics": {type: "NUMBER"}, 
                                "Chemistry": {type: "NUMBER"}, 
                                "Maths": {type: "NUMBER"}
                            }
                        },
                        chapterScores: { type: "OBJECT", additionalProperties: { type: "OBJECT", properties: { correct: {type: "NUMBER"}, incorrect: {type: "NUMBER"}, accuracy: {type: "NUMBER"} } } },
                        aiSuggestions: { type: "STRING" },
                        suggestedFlashcards: { type: "ARRAY", items: { type: "OBJECT", properties: { front: {type: "STRING"}, back: {type: "STRING"} } } }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return parsed JSON directly
    } catch (e) {
        console.error("AI test results analysis error:", e);
        res.status(500).json({ error: e.message || "Failed to analyze test results with AI." });
    }
});

apiRouter.post('/ai/generate-flashcards', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { topic, syllabus } = req.body;
    try {
        const context = syllabus ? `Considering the syllabus: ${syllabus}.` : '';
        const prompt = `Generate 10-15 flashcards (front and back) for the topic: "${topic}". ${context}
        Ensure the content is concise and directly relevant to JEE/NEET.
        Return in JSON format: {"flashcards": [{"front": "...", "back": "..."}, ...]}.
        Ensure any LaTeX for formulas or equations is double quoted.`;

        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        flashcards: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    front: { type: "STRING" },
                                    back: { type: "STRING" }
                                }
                            }
                        }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed); // Return parsed JSON directly
    } catch (e) {
        console.error("AI generate flashcards error:", e);
        res.status(500).json({ error: e.message || "Failed to generate flashcards with AI." });
    }
});

apiRouter.post('/ai/generate-answer-key', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    try {
        const content = `Find the official answer key for "${prompt}". Return ONLY the answer key in JSON format, where keys are question numbers (as strings) and values are the answers (strings). If answers can be multiple, use a comma-separated string (e.g., "1:A,B"). If it's a numerical answer, just the number (e.g., "12.5"). If not found, return an empty JSON object.
        Example: {"1":"A", "2":"B", "3":"12.5", "4":"C,D"}`;
        
        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: content,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    additionalProperties: {
                        type: "STRING"
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json({ answerKey: JSON.stringify(parsed) }); // Return as a stringified JSON
    } catch (e) {
        console.error("AI generate answer key error:", e);
        res.status(500).json({ error: e.message || "Failed to generate answer key with AI." });
    }
});

apiRouter.post('/ai/generate-practice-test', checkDbConnection, checkAiService, authMiddleware, async (req, res) => {
    const { topic, numQuestions, difficulty, questionTypes, isPYQ, chapters } = req.body;

    // Filter to 'gemini-3-pro-preview' because thinkingConfig is for 2.5 series
    // Although the general rule is to use "gemini-2.5-flash" for basic text tasks
    // Since this is for practice questions, and the prompt implies complex reasoning to generate questions,
    // gemini-3-pro-preview is a more appropriate choice.
    const model = 'gemini-3-pro-preview'; 

    const systemInstruction = `You are a question generator for JEE/NEET students. Based on the provided topic, generate practice questions.
        For multiple-choice questions (MCQ), provide 3-4 options. For numerical questions (NUM), ask for a numerical answer.
        For multi-choice questions (MULTI_CHOICE), explicitly state that multiple options can be correct and provide options.
        Ensure questions are relevant to ${difficulty} difficulty for JEE/NEET level.
        If 'isPYQ' is true, prioritize previous year questions or questions in that style.
        If 'chapters' are provided, focus questions within those chapters.
        Return only a JSON object with 'questions' and 'answers' fields.
        Example:
        {
            "questions": [
                {"number": 1, "text": "What is 2+2?", "options": ["3", "4", "5"], "type": "MCQ"},
                {"number": 2, "text": "What is the square root of 9?", "type": "NUM"},
                {"number": 3, "text": "Which are primary colors?", "options": ["Red", "Blue", "Green", "Yellow"], "type": "MULTI_CHOICE"}
            ],
            "answers": {"1":"4", "2":"3", "3":["Red", "Blue", "Green"]}
        }
        Ensure all LaTeX (e.g., equations, chemical formulas) is correctly formatted and double quoted within text fields.`;

    try {
        const contents = [];
        contents.push({ text: `Generate ${numQuestions} practice questions on the topic "${topic}".` });
        if (difficulty) contents.push({ text: `Difficulty: ${difficulty}.` });
        if (questionTypes && questionTypes.length > 0) contents.push({ text: `Question types: ${questionTypes.join(', ')}.` });
        if (isPYQ) contents.push({ text: `Prioritize Previous Year Questions.` });
        if (chapters && chapters.length > 0) contents.push({ text: `Focus on chapters: ${chapters.join(', ')}.` });

        const result = await genAI.models.generateContent({
            model: model,
            contents: contents.map(c => c.text ? {text: c.text} : c),
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        questions: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    number: { type: "NUMBER" },
                                    text: { type: "STRING" },
                                    options: { type: "ARRAY", items: { type: "STRING" } },
                                    type: { type: "STRING" }
                                },
                                required: ["number", "text", "type"]
                            }
                        },
                        answers: {
                            type: "OBJECT",
                            additionalProperties: {
                                type: "STRING", // Can be string or array of strings, but type "STRING" is the closest.
                                // The frontend will handle parsing "A,B" into array.
                            }
                        }
                    }
                }
            }
        });
        const textResponse = result.text;
        const parsed = parseAIResponse(textResponse);
        res.json(parsed);
    } catch (e) {
        console.error("AI generate practice test error:", e);
        res.status(500).json({ error: e.message || "Failed to generate practice test with AI." });
    }
});

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));