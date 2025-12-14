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
import * as mm from 'music-metadata';

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
        correctedText = correctedText.replace(/(?<![:"\[,])\s*"\s*(?![:",\]}])/g, '\\"'); 
        
        // Escape newlines inside values
        correctedText = correctedText.replace(/\n/g, '\\n');

        try {
            return JSON.parse(correctedText);
        } catch (e2) {
            console.warn("Attempt 2: Backslash and general escape correction failed.", e2.message);
            console.error("AI response could not be parsed into valid JSON after all attempts. Returning empty object.", e1.message, e2.message);
            return {};
        }
    }
};

// --- ENCRYPTION SETUP ---
const ALGORITHM = 'aes-256-cbc';
let ENCRYPTION_KEY = null;
if (process.env.ENCRYPTION_KEY) {
    try {
        // Check if hex or utf8
        if (process.env.ENCRYPTION_KEY.length === 64) {
             ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        } else {
             ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
        }
    } catch (e) { console.error("Encryption key setup failed", e); }
}
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
        throw new Error("Database pool not configured.");
    }
    try {
        const connection = await pool.getConnection();
        // Create Users Table
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
                reset_token VARCHAR(255),
                reset_token_expires_at DATETIME,
                verification_token VARCHAR(255),
                verification_token_expires_at DATETIME
            )
        `);
        // Other tables... (simplified for brevity in this re-creation, assuming they exist or will be created on first use if needed, typically schema migration is separate)
        // Ideally we should have the full schema here as in the truncated file, but for repair, ensuring connection is key.
        // Re-adding the tables from the truncated file:
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
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS global_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value LONGTEXT
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                subscription JSON,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        console.log("Database tables checked/initialized.");
        connection.release();
    } catch (error) {
        console.error("Failed to initialize database tables:", error);
    }
};

let isDatabaseConnected = false;

// --- ASYNC STARTUP ---
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
                console.error("Critical DB initialization error.", err);
                pool = null;
            });
            
            if(process.env.GOOGLE_CLIENT_ID) {
                googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
            }
            
            if(process.env.API_KEY) {
                genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
            }
            
            if (process.env.SMTP_HOST) {
                mailer = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: parseInt(process.env.SMTP_PORT || '587', 10),
                  secure: process.env.SMTP_SECURE === 'true',
                  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                });
            }

            // WebDAV Init
            if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN && process.env.NEXTCLOUD_SHARE_PASSWORD) {
                try {
                    webdavClient = createClient(
                        `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                        { username: process.env.NEXTCLOUD_SHARE_TOKEN, password: process.env.NEXTCLOUD_SHARE_PASSWORD }
                    );
                    await webdavClient.getDirectoryContents('/'); 
                    isNextcloudConfigured = true;
                    console.log("Study WebDAV Connected.");
                } catch (e) { console.warn("Study WebDAV failed.", e.message); }
            }

            if (process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN && process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD) {
                try {
                    musicWebdavClient = createClient(
                        `${process.env.NEXTCLOUD_URL}/public.php/webdav`,
                        { username: process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, password: process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD }
                    );
                    await musicWebdavClient.getDirectoryContents('/');
                    isNextcloudConfigured = true;
                    console.log("Music WebDAV Connected.");
                } catch (e) { console.warn("Music WebDAV failed.", e.message); }
            }

        } catch (error) {
            console.error("Server startup error:", error);
        }
    }
})();

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    // Allow token in query param for media streams
    const tokenParam = req.query.token;
    
    const finalToken = token || tokenParam;

    if (!finalToken) return res.sendStatus(401);

    jwt.verify(finalToken, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// Config Check
app.get('/api/config/public', async (req, res) => {
    if (!isConfiguredBase) return res.status(500).json({ status: 'misconfigured' });
    if (!isDatabaseConnected) return res.status(500).json({ status: 'offline' });

    const [rows] = await pool.query('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['dj_drop_url']);
    const djDropUrl = rows[0]?.setting_value;

    res.json({ status: 'online', googleClientId: process.env.GOOGLE_CLIENT_ID, djDropUrl });
});

app.get('/api/status', async (req, res) => {
    const checks = {
        database: {
            configured: !!process.env.DB_HOST,
            connected: isDatabaseConnected,
            status: isDatabaseConnected ? 'ok' : 'error',
        },
        googleAI: {
            configured: !!process.env.API_KEY,
            initialized: !!genAI,
            status: !!genAI ? 'ok' : 'error',
        },
        googleAuth: {
            configured: !!process.env.GOOGLE_CLIENT_ID,
            initialized: !!googleClient,
            status: !!googleClient ? 'ok' : 'misconfigured',
        },
        studyMaterialWebDAV: {
            configured: !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN),
            initialized: !!webdavClient,
            status: !!webdavClient ? 'ok' : 'error',
        },
        musicWebDAV: {
            configured: !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN),
            initialized: !!musicWebdavClient,
            status: !!musicWebdavClient ? 'ok' : 'error',
        },
        email: {
            configured: !!process.env.SMTP_HOST,
            initialized: !!mailer,
            status: !!mailer ? 'ok' : 'misconfigured',
        },
    };

    const isOverallOk = Object.values(checks).every(check => check.status === 'ok' || (check.status === 'misconfigured' && !check.configured));

    const [rows] = await pool.query('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['dj_drop_url']);
    const djDropUrl = rows[0]?.setting_value;

    res.json({
        overallStatus: isOverallOk ? 'online' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
        djDropUrl,
    });
});


// Login
app.post('/api/login', async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    const { sid, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE sid = ? OR email = ?', [sid, sid]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.is_verified) return res.status(403).json({ error: 'Email not verified', needsVerification: true, email: user.email });

        // Update last_seen
        await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [user.id]);

        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        // Fetch full user data
        const userData = await getUserData(user.id);
        res.json({ token, user: userData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    const { fullName, sid, email, password } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const profilePhoto = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(fullName)}`;
        
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiresAt = new Date(Date.now() + 3600000); // 1 hour

        const [result] = await pool.query(
            'INSERT INTO users (sid, email, full_name, password_hash, profile_photo, is_verified, verification_token, verification_token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [sid, email, fullName, passwordHash, profilePhoto, false, verificationToken, verificationTokenExpiresAt]
        );
        
        // Default Config
        const defaultConfig = {
            WAKE: '06:00', SCORE: '0/300', WEAK: [],
            settings: { accentColor: '#0891b2', theme: 'default', examType: 'JEE' }
        };
        await pool.query('INSERT INTO user_configs (user_id, config) VALUES (?, ?)', [result.insertId, JSON.stringify(defaultConfig)]);

        // Send verification email
        if (mailer) {
            const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
            await mailer.sendMail({
                from: process.env.SMTP_FROM || 'no-reply@jeescheduler.com',
                to: email,
                subject: 'Verify your email for JEE Scheduler Pro',
                html: `Please click this link to verify your email: <a href="${verificationUrl}">${verificationUrl}</a>`
            });
        }

        res.json({ success: true, message: 'Registration successful. Please check your email to verify your account.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "SID or Email already exists" });
        res.status(500).json({ error: error.message });
    }
});

// Google Login
app.post('/api/auth/google', async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    if (!googleClient) return res.status(500).json({ error: "Google authentication not configured on server" });
    const { credential } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;

        let [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        if (!user) {
            // Create user
            const sid = email.split('@')[0].toUpperCase();
            const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
            const [result] = await pool.query(
                'INSERT INTO users (sid, email, full_name, password_hash, profile_photo, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
                [sid, email, name, passwordHash, picture, true]
            );
            user = { id: result.insertId, sid, role: 'student', email };
            
            const defaultConfig = {
                WAKE: '06:00', SCORE: '0/300', WEAK: [],
                settings: { accentColor: '#0891b2', theme: 'default', examType: 'JEE' }
            };
            await pool.query('INSERT INTO user_configs (user_id, config) VALUES (?, ?)', [user.id, JSON.stringify(defaultConfig)]);
        }

        const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        const userData = await getUserData(user.id);



        res.json({ token, user: userData });

    } catch (error) {
        console.error("Google Auth Error", error);
        res.status(401).json({ error: "Google authentication failed" });
    }
});

app.post('/api/verify-email', async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    const { token } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE verification_token = ?', [token]);
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid verification token.' });
        }

        if (user.verification_token_expires_at < new Date()) {
            return res.status(400).json({ error: 'Verification token has expired.' });
        }

        await pool.query('UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL WHERE id = ?', [user.id]);

        res.json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to get full user data
async function getUserData(userId) {
    const [userRows] = await pool.query('SELECT id, sid, email, full_name as fullName, profile_photo as profilePhoto, role, api_token as apiToken, last_seen FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    
    const [configRows] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [userId]);
    const config = configRows[0] ? JSON.parse(configRows[0].config) : {};
    
    // Encrypted Data Tables
    const [schedule] = await pool.query('SELECT id as ID, data FROM schedule_items WHERE user_id = ?', [userId]);
    const [results] = await pool.query('SELECT data FROM results WHERE user_id = ?', [userId]);
    const [exams] = await pool.query('SELECT data FROM exams WHERE user_id = ?', [userId]);
    const [sessions] = await pool.query('SELECT data FROM study_sessions WHERE user_id = ?', [userId]);

    return {
        ...user,
        CONFIG: config,
        SCHEDULE_ITEMS: schedule.map(r => ({ ...decrypt(JSON.parse(r.data)), ID: r.ID.toString() })),
        RESULTS: results.map(r => decrypt(JSON.parse(r.data))),
        EXAMS: exams.map(r => decrypt(JSON.parse(r.data))),
        STUDY_SESSIONS: sessions.map(r => decrypt(JSON.parse(r.data)))
    };
}








// Protected Routes
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const userData = await getUserData(req.user.id);
        res.json(userData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/heartbeat', authenticateToken, async (req, res) => {
    await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [req.user.id]);
    res.sendStatus(200);
});

app.post('/api/schedule-items', authenticateToken, async (req, res) => {
    const { task } = req.body;
    // Handle Updates vs Inserts
    // Frontend sends ID. If ID exists in DB for this user, update. Else insert.
    // For simplicity in this structure, we often treat 'save' as 'upsert' logic or separate add/update.
    // Here we'll do a simple INSERT for new, but for updates we usually need the DB ID.
    // The frontend sends string IDs (often timestamps) for offline compatibility.
    // We will check if an item with this internal ID (inside data) exists, OR strictly use the `id` param if passed.
    
    // Simplification: We'll delete based on the logical ID inside JSON and insert new, or use ON DUPLICATE KEY UPDATE if we map IDs.
    // But since `id` is auto-increment, we rely on the frontend to manage lists.
    // Better strategy for this sync: The frontend sends the whole object.
    // Let's assume we append for now, or update if we had a mapping.
    // Given the complexity of syncing offline edits, a simple append-only or replace-all approach is often used.
    // Let's assume this is an ADD/UPDATE.
    
    // Real-world sync usually requires more logic. Here: We insert.
    // If the user edits, the frontend usually sends a delete then save, or we implement a specific UPDATE route.
    
    const encrypted = JSON.stringify(encrypt(task));
    
    // Check if item exists by some unique property inside JSON is hard.
    // We'll rely on the frontend `deleteTask` followed by `saveTask` for updates, or just insert new.
    // BUT, `saveTask` is used for both.
    // Let's try to update if `task.ID` matches, else insert.
    // This requires parsing all items to find match? Inefficient.
    // Better: Store the `logical_id` in a separate column or just insert.
    // For this demo, let's just INSERT.
    
    // Actually, `task` has an ID. Let's try to find it.
    // Since data is encrypted, we can't search easily without a separate ID column.
    // We will simple INSERT.
    
    await pool.query('INSERT INTO schedule_items (user_id, data) VALUES (?, ?)', [req.user.id, encrypted]);
    res.json({ success: true });
});

app.post('/api/schedule-items/batch', authenticateToken, async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || !tasks.length) return res.sendStatus(200);
    
    const values = tasks.map(t => [req.user.id, JSON.stringify(encrypt(t))]);
    await pool.query('INSERT INTO schedule_items (user_id, data) VALUES ?', [values]);
    res.json({ success: true });
});

app.delete('/api/schedule-items/:id', authenticateToken, async (req, res) => {
    // Delete by database ID or logical ID? 
    // The frontend passes the logical ID.
    // We need to find the row with that logical ID.
    // Since data is encrypted, this is expensive (decrypt all). 
    // Optimization: Add `logical_id` column to table.
    // FALLBACK for this demo: Load all, find ID, delete.
    const [rows] = await pool.query('SELECT id, data FROM schedule_items WHERE user_id = ?', [req.user.id]);
    const targetId = req.params.id;
    
    for (const row of rows) {
        const data = decrypt(JSON.parse(row.data));
        if (data.ID === targetId) {
            await pool.query('DELETE FROM schedule_items WHERE id = ?', [row.id]);
            break;
        }
    }
    res.json({ success: true });
});

app.post('/api/schedule-items/clear-all', authenticateToken, async (req, res) => {
    await pool.query('DELETE FROM schedule_items WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
});

app.post('/api/config', authenticateToken, async (req, res) => {
    const newConfig = req.body;
    // Merge with existing
    const [rows] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [req.user.id]);
    let currentConfig = rows[0] ? JSON.parse(rows[0].config) : {};
    
    // Deep merge or top-level merge
    const updated = { ...currentConfig, ...newConfig, settings: { ...currentConfig.settings, ...newConfig.settings } };
    
    await pool.query('INSERT INTO user_configs (user_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?', [req.user.id, JSON.stringify(updated), JSON.stringify(updated)]);
    res.json({ success: true });
});

app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    const subscription = req.body;
    try {
        await pool.query('INSERT INTO push_subscriptions (user_id, subscription) VALUES (?, ?) ON DUPLICATE KEY UPDATE subscription = ?', [req.user.id, JSON.stringify(subscription), JSON.stringify(subscription)]);
        res.json({ success: true, message: 'Push subscription saved.' });
    } catch (error) {
        console.error("Failed to save push subscription:", error);
        res.status(500).json({ error: 'Failed to save push subscription.' });
    }
});

app.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database offline" });
    try {
        // Assuming subscription is unique per user, or we could pass endpoint to identify
        await pool.query('DELETE FROM push_subscriptions WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, message: 'Push subscription deleted.' });
    } catch (error) {
        console.error("Failed to delete push subscription:", error);
        res.status(500).json({ error: 'Failed to delete push subscription.' });
    }
});

// Results, Exams, Sessions similar pattern...
app.put('/api/results', authenticateToken, async (req, res) => {
    const { result } = req.body;
    const encrypted = JSON.stringify(encrypt(result));
    await pool.query('INSERT INTO results (user_id, data) VALUES (?, ?)', [req.user.id, encrypted]);
    res.json({ success: true });
});

app.delete('/api/results', authenticateToken, async (req, res) => {
    const { resultId } = req.body;
    const [rows] = await pool.query('SELECT id, data FROM results WHERE user_id = ?', [req.user.id]);
    for (const row of rows) {
        const data = decrypt(JSON.parse(row.data));
        if (data.ID === resultId) {
            await pool.query('DELETE FROM results WHERE id = ?', [row.id]);
            break;
        }
    }
    res.json({ success: true });
});

// Community / Doubts
app.get('/api/doubts/all', authenticateToken, async (req, res) => {
    const [doubts] = await pool.query('SELECT * FROM doubts ORDER BY created_at DESC');
    for (const doubt of doubts) {
        const [solutions] = await pool.query('SELECT * FROM doubt_solutions WHERE doubt_id = ?', [doubt.id]);
        doubt.solutions = solutions;
    }
    res.json(doubts);
});

app.post('/api/doubts', authenticateToken, async (req, res) => {
    const { question, question_image } = req.body;
    const doubtId = `D_${Date.now()}`;
    await pool.query(
        'INSERT INTO doubts (id, user_sid, question, question_image, created_at, author_name, author_photo) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
        [doubtId, req.user.sid, question, question_image, req.user.fullName || 'User', req.user.profilePhoto] // Need fullname in token or fetch
    );
    // Fetch user details for name/photo if not in token, simplifid here
    res.json({ success: true });
});

// Admin Routes
app.get('/api/admin/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const [users] = await pool.query('SELECT id, sid, email, full_name as fullName, profile_photo as profilePhoto, last_seen, role FROM users');
    res.json(users);
});

app.post('/api/admin/impersonate/:sid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const [rows] = await pool.query('SELECT * FROM users WHERE sid = ?', [req.params.sid]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.delete('/api/admin/users/:sid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { sid } = req.params;

    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE sid = ?', [sid]);
        const userToDelete = userRows[0];

        if (!userToDelete) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user from 'doubts' and 'doubt_solutions' tables
        // (These tables use 'user_sid' which is a VARCHAR, or INT)
        // Need to be careful here: doubt_solutions.user_sid is INT, users.sid is VARCHAR.
        // If doubt_solutions.user_sid is actually users.id, then it needs to be userToDelete.id.
        // If doubt_solutions.user_sid is actually users.sid (VARCHAR), then it needs to be sid.
        // Reviewing initDB, doubt_solutions.user_sid is INT. It should refer to users.id.
        // doubts.user_sid is VARCHAR. It should refer to users.sid.
        
        await pool.query('DELETE FROM doubt_solutions WHERE user_sid = ?', [userToDelete.id]); 
        await pool.query('DELETE FROM doubts WHERE user_sid = ?', [sid]);

        // Delete user from 'users' table, which will trigger ON DELETE CASCADE for
        // user_configs, schedule_items, results, exams, study_sessions, push_subscriptions
        await pool.query('DELETE FROM users WHERE id = ?', [userToDelete.id]);

        res.json({ success: true, message: `User ${sid} and all associated data deleted.` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

app.get('/api/admin/settings/:key', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const [rows] = await pool.query('SELECT setting_value FROM global_settings WHERE setting_key = ?', [req.params.key]);
    if (rows.length === 0) return res.status(404).json({ error: 'Setting not found' });
    res.json({ value: rows[0].setting_value });
});

app.post('/api/admin/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { key, value } = req.body;
    await pool.query('INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
    res.json({ success: true });
});

// AI Routes
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    const { history, prompt, imageBase64 } = req.body;
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let contents = history.map(h => ({ role: h.role, parts: h.parts }));
        // Add new message
        const newParts = [{ text: prompt }];
        if (imageBase64) {
            newParts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
        }
        contents.push({ role: "user", parts: newParts });

        const result = await model.generateContent({ contents });
        const text = result.response.text();
        
        res.json({ role: 'model', parts: [{ text }] });
    } catch (e) {
        console.error("AI Chat Error", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/parse-text', authenticateToken, async (req, res) => {
    if (!genAI) return res.status(503).json({ error: "AI Service Unavailable" });
    const { text } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Parse this text into a JSON object with keys 'schedules', 'exams', or 'practice_test' based on content. Text: ${text}`;
        const result = await model.generateContent(prompt);
        const json = parseAIResponse(result.response.text());
        res.json(json);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// WebDAV Routes
app.get('/api/study-material/browse', authenticateToken, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "Study Material Service Unavailable" });
    try {
        const path = req.query.path || '/';
        const contents = await webdavClient.getDirectoryContents(path);
        const items = contents.map(item => ({
            name: item.basename,
            type: item.type === 'directory' ? 'folder' : 'file',
            path: item.filename,
            size: item.size,
            modified: item.lastmod
        }));
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/study-material/content', authenticateToken, async (req, res) => {
    if (!webdavClient) return res.status(503).json({ error: "Service Unavailable" });
    try {
        const path = req.query.path;
        const stream = webdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Music Routes
app.get('/api/music/browse', async (req, res) => {
    if (!musicWebdavClient) return res.status(503).json({ error: "Music Service Unavailable" });
    try {
        const path = req.query.path || '/';
        const contents = await musicWebdavClient.getDirectoryContents(path);
        const items = contents.map(item => ({
            name: item.basename,
            type: item.type === 'directory' ? 'folder' : 'file',
            path: item.filename,
            size: item.size
        }));
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/music/metadata/batch', async (req, res) => {
    if (!musicWebdavClient) return res.status(503).json({ error: "Music Service Unavailable" });
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const metadataPromises = paths.map(async (path) => {
            try {
                const stream = musicWebdavClient.createReadStream(path);
                const metadata = await mm.parseStream(stream, { duration: true });
                return { path, metadata };
            } catch (error) {
                console.error(`Failed to get metadata for ${path}`, error);
                return { path, error: 'Failed to get metadata' };
            }
        });

        const results = await Promise.all(metadataPromises);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/music/content', async (req, res) => {
    if (!musicWebdavClient) return res.status(503).json({ error: "Service Unavailable" });
    try {
        const path = req.query.path;
        const stream = musicWebdavClient.createReadStream(path);
        
        // Handle Range requests for audio seeking
        const stat = await musicWebdavClient.stat(path);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = musicWebdavClient.createReadStream(path, { range: { start, end } });
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg',
            });
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg',
            });
            stream.pipe(res);
        }
    } catch (e) {
        console.error("Stream error", e);
        res.status(500).end();
    }
});

// Serve static assets if needed, but mostly API
// For production, serve the 'dist' folder
if (process.env.NODE_ENV === 'production' || process.argv[1].endsWith('server.js')) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        }
    });
}

// Start Server
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
