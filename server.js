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
import { generateAvatar } from './utils/generateAvatar.js';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { parseStringPromise } from 'xml2js';
import { knowledgeBase } from './data/knowledgeBase.js';

// --- SERVER SETUP ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure dotenv to load .env from the project root
dotenv.config({ path: path.resolve(__dirname, '.env') });


// --- ENV & SETUP CHECK ---
const isConfigured = process.env.DB_HOST && process.env.JWT_SECRET && process.env.DB_USER && process.env.DB_NAME && process.env.ENCRYPTION_KEY && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const isNextcloudMusicConfigured = !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN);
const isNextcloudStudyConfigured = !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_SHARE_TOKEN);

let pool = null;
let mailer = null;
const JWT_SECRET = process.env.JWT_SECRET;
let googleClient = null;

// --- ENCRYPTION SETUP ---
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = isConfigured ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32) : null;
const IV_LENGTH = 16;

const encrypt = (text) => {
    if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured.');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (text) => {
    if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured.');
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        return text; // Fallback to returning original text if decryption fails
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
        
        googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            mailer = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587', 10),
              secure: process.env.SMTP_SECURE === 'true',
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
        }

    } catch (error) {
        console.error("FATAL ERROR: Could not create database pool or initialize services. Check credentials.", error);
    }
} else {
    console.error("FATAL ERROR: Server environment variables are not configured. The server will run in a misconfigured state.");
}

// --- DATABASE SCHEMA INITIALIZATION ---
const initializeDatabaseSchema = async () => {
    if (!pool) return;
    const connection = await pool.getConnection();
    try {
        console.log("Verifying database schema...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              sid VARCHAR(255) UNIQUE NOT NULL,
              email VARCHAR(255) UNIQUE NOT NULL,
              password VARCHAR(255),
              full_name VARCHAR(255) NOT NULL,
              profile_photo TEXT,
              is_verified BOOLEAN DEFAULT false,
              role ENUM('student', 'admin') DEFAULT 'student',
              google_id VARCHAR(255) UNIQUE,
              verification_code VARCHAR(10),
              verification_expires DATETIME,
              password_reset_token VARCHAR(255),
              password_reset_expires DATETIME,
              api_token VARCHAR(255) UNIQUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              last_seen TIMESTAMP
            )
        `);
        // Add last_seen column if it doesn't exist
        const [lastSeenCols] = await connection.query("SHOW COLUMNS FROM users LIKE 'last_seen'");
        if (lastSeenCols.length === 0) {
            await connection.query("ALTER TABLE users ADD COLUMN last_seen TIMESTAMP NULL");
        }
        
        // Add password reset and api_token columns if they don't exist
        const [cols] = await connection.query("SHOW COLUMNS FROM users LIKE 'password_reset_token'");
        if (cols.length === 0) {
            await connection.query("ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255), ADD COLUMN password_reset_expires DATETIME");
        }
        const [apiTokenCols] = await connection.query("SHOW COLUMNS FROM users LIKE 'api_token'");
        if (apiTokenCols.length === 0) {
            await connection.query("ALTER TABLE users ADD COLUMN api_token VARCHAR(255) UNIQUE");
        }


        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_configs (
              user_id INT PRIMARY KEY,
              config TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schedule_items (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              item_id_str VARCHAR(255) NOT NULL,
              item_data JSON NOT NULL,
              UNIQUE KEY (user_id, item_id_str),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS doubts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              question TEXT NOT NULL,
              question_image MEDIUMTEXT,
              status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        const [doubtStatusCols] = await connection.query("SHOW COLUMNS FROM doubts LIKE 'status'");
        if (doubtStatusCols.length === 0) {
            await connection.query("ALTER TABLE doubts ADD COLUMN status ENUM('active', 'archived', 'deleted') DEFAULT 'active'");
        }
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS solutions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              doubt_id INT NOT NULL,
              user_id INT NOT NULL,
              solution TEXT NOT NULL,
              solution_image MEDIUMTEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (doubt_id) REFERENCES doubts(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
              id INT AUTO_INCREMENT PRIMARY KEY,
              sender_sid VARCHAR(255) NOT NULL,
              recipient_sid VARCHAR(255) NOT NULL,
              content TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX (sender_sid, recipient_sid)
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS broadcast_tasks (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_data JSON NOT NULL,
              exam_type ENUM('JEE', 'NEET', 'ALL') DEFAULT 'ALL',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        const [broadcastCols] = await connection.query("SHOW COLUMNS FROM broadcast_tasks LIKE 'exam_type'");
        if (broadcastCols.length === 0) {
            await connection.query("ALTER TABLE broadcast_tasks ADD COLUMN exam_type ENUM('JEE', 'NEET', 'ALL') DEFAULT 'ALL'");
        }
        console.log("Database schema verified successfully.");
    } catch (error) {
        console.error("FATAL: Could not initialize database schema.", error);
    } finally {
        connection.release();
    }
};

const ensureAdminUserExists = async () => {
    if (!pool) return;
    const connection = await pool.getConnection();
    try {
        const adminEmail = 'patelbhavna107@gmail.com';
        const adminName = 'Bhavna Patel';
        const adminSid = 'ADMIN_BHAVNA';

        const [[existingAdmin]] = await connection.query('SELECT id, role FROM users WHERE email = ?', [adminEmail]);

        if (existingAdmin) {
            if (existingAdmin.role !== 'admin') {
                console.log(`Updating user ${adminEmail} to admin role.`);
                await connection.query('UPDATE users SET role = "admin" WHERE id = ?', [existingAdmin.id]);
            } else {
                console.log(`Admin user ${adminEmail} already exists and has correct role.`);
            }
        } else {
            console.log(`Creating new admin user for ${adminEmail}. This user must log in with Google.`);
            const profilePhoto = generateAvatar(adminName);
            // No password is set. Admin must use Google OAuth.
            await connection.query(
                'INSERT INTO users (sid, email, full_name, profile_photo, is_verified, role) VALUES (?, ?, ?, ?, ?, ?)',
                [adminSid, adminEmail, adminName, profilePhoto, true, 'admin']
            );
        }
    } catch (error) {
        console.error("Error during admin user setup:", error);
    } finally {
        connection.release();
    }
};

// --- MIDDLEWARE ---
const configurationCheckMiddleware = (req, res, next) => {
    if (!isConfigured || !pool) {
        return res.status(503).json({ error: 'Server is not configured. Administrator needs to set environment variables.' });
    }
    next();
};

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    const [[user]] = await pool.query('SELECT role, sid FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.userRole = user.role;
    req.userSid = user.sid;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const apiTokenAuthMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized: API token is missing.' });
    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const [[user]] = await pool.query('SELECT id, role, sid FROM users WHERE api_token = ?', [hashedToken]);
        if (!user) return res.status(401).json({ error: 'Invalid API token.' });
        req.userId = user.id;
        req.userRole = user.role;
        req.userSid = user.sid;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error during token authentication.' });
    }
};


const adminMiddleware = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// --- API ROUTES ---
const apiRouter = express.Router();

// --- HELPERS ---
const syncBroadcastsForUser = async (userId, connection) => {
    const conn = connection || await pool.getConnection();
    try {
        // Get user's exam type
        const [[userConfigRow]] = await conn.query('SELECT config FROM user_configs WHERE user_id = ?', [userId]);
        let userExamType = 'JEE'; // Default to JEE
        if (userConfigRow) {
            try {
                const config = JSON.parse(decrypt(userConfigRow.config));
                userExamType = config.settings?.examType || 'JEE';
            } catch (e) {
                console.error("Could not parse user config during broadcast sync, defaulting to JEE.");
            }
        }
        
        // Fetch relevant broadcasts
        const [broadcasts] = await conn.query(
            'SELECT item_data FROM broadcast_tasks WHERE exam_type = "ALL" OR exam_type = ?', 
            [userExamType]
        );

        if (broadcasts.length > 0) {
            const values = broadcasts.map(b => {
                const itemData = typeof b.item_data === 'string' ? JSON.parse(b.item_data) : b.item_data;
                return [userId, itemData.ID, JSON.stringify(itemData)];
            });
            if (values.length > 0) {
                await conn.query(
                    `INSERT IGNORE INTO schedule_items (user_id, item_id_str, item_data) VALUES ?`,
                    [values]
                );
            }
        }
    } catch (error) {
        console.error(`Failed to sync broadcasts for user ${userId}:`, error);
    } finally {
        if (!connection) {
            conn.release();
        }
    }
};

const getUserData = async (userId) => {
    const [[user]] = await pool.query('SELECT id, sid, email, full_name, role, profile_photo, is_verified, last_seen FROM users WHERE id = ?', [userId]);
    if (!user) return null;
    
    // User data that is safe to send to the client
    const clientSafeUser = {
        id: user.id,
        sid: user.sid,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        profilePhoto: user.profile_photo,
        isVerified: !!user.is_verified,
        last_seen: user.last_seen,
    };

    const [scheduleRows] = await pool.query('SELECT item_data FROM schedule_items WHERE user_id = ?', [userId]);
    
    let [[userConfigRow]] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [userId]);
    
    if (!userConfigRow) {
        const defaultConfig = {
            WAKE: '06:00', SCORE: '0/300', WEAK: [], UNACADEMY_SUB: false,
            settings: { accentColor: '#0891b2', blurEnabled: true, mobileLayout: 'standard', forceOfflineMode: false, perQuestionTime: 180 },
            RESULTS: [], EXAMS: [], STUDY_SESSIONS: [], DOUBTS: [], flashcardDecks: [], customWidgets: []
        };
        const encryptedDefaultConfig = encrypt(JSON.stringify(defaultConfig));
        await pool.query(
            `INSERT INTO user_configs (user_id, config) VALUES (?, ?)`,
            [userId, encryptedDefaultConfig]
        );
        userConfigRow = { config: encryptedDefaultConfig }; // Use the new default for the current request
    }

    const decryptedConfig = decrypt(userConfigRow.config);
    const configObject = JSON.parse(decryptedConfig);

    // Add a safe flag for the frontend to know if a key is set, without exposing the key.
    if (!configObject.settings) configObject.settings = {};
    configObject.settings.hasGeminiKey = !!configObject.geminiApiKey;

    // IMPORTANT: Remove any sensitive keys before sending the config to the client.
    delete configObject.geminiApiKey;
    
    // This is now a complete StudentData object
    return { 
      ...clientSafeUser, 
      CONFIG: configObject,
      SCHEDULE_ITEMS: scheduleRows.map(r => typeof r.item_data === 'string' ? JSON.parse(r.item_data) : r.item_data),
      RESULTS: configObject.RESULTS || [],
      EXAMS: configObject.EXAMS || [],
      STUDY_SESSIONS: configObject.STUDY_SESSIONS || [],
      DOUBTS: configObject.DOUBTS || [],
    };
};

// PUBLIC STATUS ROUTE (no middleware)
apiRouter.get('/status', (req, res) => {
    if (!isConfigured || !pool) {
        return res.status(200).json({ status: 'misconfigured' });
    }
    res.status(200).json({ status: 'online' });
});

// PUBLIC CONFIG ROUTE
apiRouter.get('/config/public', (req, res) => {
    if (!isConfigured || !process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google integration is not configured on the server.' });
    }
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
});


// Apply configuration check for all subsequent routes
apiRouter.use(configurationCheckMiddleware);

// --- AUTH ENDPOINTS ---
apiRouter.post('/register', async (req, res) => {
    const { sid, fullName, email, password } = req.body;
    if (!sid || !password || !fullName || !email) return res.status(400).json({ error: 'All fields are required' });
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[existingUser]] = await connection.query('SELECT id FROM users WHERE sid = ? OR email = ?', [sid, email]);
        if (existingUser) {
            await connection.rollback();
            return res.status(409).json({ error: 'Student ID or Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const profilePhoto = generateAvatar(fullName);
        let userId;

        if (mailer) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
            
            const [result] = await connection.query(
                'INSERT INTO users (sid, email, password, full_name, profile_photo, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [sid, email, hashedPassword, fullName, profilePhoto, code, new Date(expires)]
            );
            userId = result.insertId;

            await syncBroadcastsForUser(userId, connection);
            await connection.commit();
            
            await mailer.sendMail({
                from: `"JEE Scheduler Pro" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Verify your email for JEE Scheduler Pro',
                text: `Hi ${fullName},\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nBest,\nThe JEE Scheduler Pro Team`,
                html: `<p>Hi ${fullName},</p><p>Your verification code is: <strong>${code}</strong></p><p>This code will expire in 15 minutes.</p><p>Best,<br>The JEE Scheduler Pro Team</p>`,
            });
            res.status(200).json({ message: 'Verification code sent to your email.', email });
        } else {
            // Auto-verify if mailer is not set up
            const [result] = await connection.query(
                'INSERT INTO users (sid, email, password, full_name, profile_photo, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
                [sid, email, hashedPassword, fullName, profilePhoto, true]
            );
            userId = result.insertId;

            await syncBroadcastsForUser(userId, connection);
            await connection.commit();

            const token = jwt.sign({ id: userId, sid: sid }, JWT_SECRET, { expiresIn: '7d' });
            res.status(201).json({ token, message: "Registered and auto-verified (mailer not configured)." });
        }
    } catch (error) {
        await connection.rollback();
        console.error("Registration error:", error);
        res.status(500).json({ error: 'Server error during registration process.' });
    } finally {
        connection.release();
    }
});

apiRouter.post('/verify-email', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    try {
        const [[user]] = await pool.query('SELECT id, sid, verification_code, verification_expires FROM users WHERE email = ? AND is_verified = false', [email]);
        
        if (!user) return res.status(404).json({ error: 'User not found or already verified.' });
        if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid verification code.' });
        if (new Date() > new Date(user.verification_expires)) return res.status(400).json({ error: 'Verification code has expired.' });

        await pool.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_expires = NULL WHERE id = ?', [user.id]);
        
        const token = jwt.sign({ id: user.id, sid: user.sid }, JWT_SECRET, { expiresIn: '7d' });
        const fullUserData = await getUserData(user.id);

        res.status(200).json({ token, user: fullUserData });
    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ error: 'Server error during verification.' });
    }
});


apiRouter.post('/login', async (req, res) => {
    const { sid, password } = req.body;
    if (!sid || !password) return res.status(400).json({ error: 'SID and password are required' });
    try {
        const [[user]] = await pool.query('SELECT id, password, is_verified, email FROM users WHERE sid = ? OR email = ?', [sid, sid]);
        if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials or sign in with Google' });

        if (!user.is_verified) {
            return res.status(403).json({ error: 'Account not verified. Please check your email.', needsVerification: true, email: user.email });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        
        await syncBroadcastsForUser(user.id);
        const userData = await getUserData(user.id);
        const token = jwt.sign({ id: user.id, sid: userData.sid }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: userData });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

apiRouter.post('/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!googleClient) return res.status(500).json({ error: 'Google Auth is not configured on the server.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

        const { email, name, sub: googleId, picture } = payload;
        
        let [[user]] = await pool.query('SELECT id, sid FROM users WHERE google_id = ? OR email = ?', [googleId, email]);
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            const [result] = await pool.query(
                'INSERT INTO users (sid, email, full_name, google_id, profile_photo, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
                [email, email, name, googleId, picture, true]
            );
            user = { id: result.insertId, sid: email };
        } else {
            // Update user details if they already exist from an email signup
            await pool.query('UPDATE users SET google_id = ?, profile_photo = IF(profile_photo LIKE "https://api.dicebear.com%", ?, profile_photo) WHERE id = ?', [googleId, picture, user.id]);
        }
        
        await syncBroadcastsForUser(user.id);

        const userData = await getUserData(user.id);
        const token = jwt.sign({ id: user.id, sid: user.sid }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: userData });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Google authentication failed' });
    }
});

apiRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!mailer) return res.status(500).json({ error: 'Password reset is not configured on this server.' });
    try {
        const [[user]] = await pool.query('SELECT id, full_name, password FROM users WHERE email = ?', [email]);
        if (user && user.password) { // Only allow reset for non-Google-only accounts
            const token = crypto.randomBytes(32).toString('hex');
            const expires = Date.now() + 3600000; // 1 hour
            await pool.query('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?', [token, new Date(expires), user.id]);
            
            // In a real app, use the actual domain from an env var
            const resetLink = `http://localhost:5173/?reset-token=${token}`;
            
            await mailer.sendMail({
                from: `"JEE Scheduler Pro" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Password Reset Request',
                text: `Hi ${user.full_name},\n\nYou requested a password reset. Click this link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
                html: `<p>Hi ${user.full_name},</p><p>You requested a password reset. Click this link to reset your password: <a href="${resetLink}">Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you did not request this, please ignore this email.</p>`,
            });
        }
        // Always send a success message to prevent user enumeration
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

apiRouter.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });
    try {
        const [[user]] = await pool.query('SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()', [token]);
        if (!user) return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
        
        res.status(200).json({ message: 'Password has been successfully reset.' });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- GOOGLE ASSISTANT FULFILLMENT ---
apiRouter.post('/assistant-action', async (req, res) => {
    const text = req.body.queryResult?.queryText || req.body.query;
    if (!text) {
        return res.status(400).json({ error: "Query text is required." });
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("Google Assistant Error: Global API_KEY is not set.");
        return res.status(500).json({ error: "AI service is not configured on the server." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const assistantDataSchema = {
            type: Type.OBJECT,
            description: "The structured details for the action.",
            properties: {
                subject: { type: Type.STRING, description: "The academic subject (e.g., Physics, Chemistry, Math)." },
                topic: { type: Type.STRING, description: "The specific chapter or concept (e.g., Rotational Dynamics)." },
                date: { type: Type.STRING, description: "The target date (YYYY-MM-DD)." },
                time: { type: Type.STRING, description: "The start time (HH:MM, 24-hour). Optional for new_schedule." },
                task_type: { type: Type.STRING, description: "The task type (e.g., deep_dive, test_review). Optional for new_schedule." },
                score: { type: Type.INTEGER, description: "The numeric score achieved. Optional for log_score." },
                max_score: { type: Type.INTEGER, description: "The total possible score. Optional for log_score." },
                details: { type: Type.STRING, description: "Specific notes (e.g., 'NCERT 1-15'). Optional." }
            },
            required: ["subject", "topic", "date"]
        };

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                action: {
                    type: Type.STRING,
                    description: "The primary action: 'new_schedule', 'log_score', or 'create_homework'.",
                    enum: ["new_schedule", "log_score", "create_homework"]
                },
                data: assistantDataSchema
            },
            required: ["action", "data"]
        };
        
        const systemInstruction = `You are the JEE Scheduler Pro Fulfillment Bot. Your ONLY response must be a single, non-conversational JSON object that strictly adheres to the provided schema. DO NOT include any introductory text, Markdown formatting (e.g., \`\`\`json), explanations, or closing remarks.

### MANDATORY CONSTRAINTS:
1.  **Output:** Output MUST be a single, clean JSON object.
2.  **Schema Adherence:** Output MUST strictly follow the JSON Schema provided in the configuration.
3.  **Action Mapping:** The 'action' key must map the user's intent to one of the following: "new_schedule", "log_score", or "create_homework".
4.  **Date/Time Calculation:**
    * **Current Date Context:** Today is Monday, 2025-11-17.
    * **Relative Dates:** Accurately calculate and convert relative times ("tomorrow," "Friday," "next week") to the required **YYYY-MM-DD** format.
    * **Time:** Convert any time reference (e.g., "7 PM") to the **HH:MM** (24-hour) format (e.g., "19:00").

### MAPPING RULES:
* **Scheduling:** Use \`action: "new_schedule"\` for requests to set a time/date. Infer \`task_type\` (e.g., "deep_dive", "practice").
* **Logging:** Use \`action: "log_score"\` for requests mentioning "score," "marks," or "test result."
* **Homework/Tasks:** Use \`action: "create_homework"\` for requests mentioning "assignment" or "questions."

### MISSING DATA POLICY:
If the user's request is valid but lacks an optional field (like \`time\` or \`details\`), omit that key from the final JSON object. If a required field (\`subject\`, \`topic\`, \`date\`) is missing, include it with an empty string (\`""\`).`;


        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: text,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const parsedJson = JSON.parse(response.text);

        if (parsedJson && parsedJson.action && parsedJson.data) {
            const { action, data } = parsedJson;
            // The frontend expects the `data` object to be stringified and encoded
            const encodedData = encodeURIComponent(JSON.stringify(data));
            const frontendUrl = 'https://jee.ponsrischool.in/';
            // The frontend reads 'action' and 'data' query params
            const deepLink = `${frontendUrl}?action=${action}&data=${encodedData}`;

            // Respond to Google Assistant with a modern fulfillment response that opens a deep link.
            return res.json({
                fulfillmentResponse: {
                    messages: [{
                        payload: {
                            richResponse: {
                                items: [{
                                    simpleResponse: {
                                        textToSpeech: "Opening JEE Scheduler Pro to complete your request."
                                    }
                                }, {
                                    openUrlAction: {
                                        url: deepLink
                                    }
                                }]
                            }
                        }
                    }]
                }
            });

        } else {
            console.error("AI returned malformed JSON for Assistant:", response.text);
            throw new Error("AI returned malformed JSON.");
        }
    } catch (error) {
        console.error("Google Assistant fulfillment error:", error);
        return res.status(500).json({ error: `Server error during AI processing: ${error.message}` });
    }
});

// --- ASSET PROXY ---
// This endpoint securely fetches the DJ drop without exposing the direct Nextcloud URL
// or requiring client-side CORS configuration on Nextcloud.
apiRouter.get('/assets/dj-drop', async (req, res) => {
    try {
        const djDropUrl = 'https://nc.ponsrischool.in/index.php/s/em85Zdf2EYEkz3j/download';
        const response = await fetch(djDropUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch asset, status: ${response.status}`);
        }
        res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Content-Length', response.headers.get('content-length') || '0');
        response.body.pipe(res);
    } catch (error) {
        console.error("Asset proxy error:", error);
        res.status(502).json({ error: "Could not retrieve asset from source." });
    }
});


// --- USER DATA ENDPOINTS ---
apiRouter.post('/heartbeat', authMiddleware, async(req, res) => {
    try {
        await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [req.userId]);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Heartbeat update error:", error);
        res.status(500).json({ error: "Failed to update user status." });
    }
});

apiRouter.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await getUserData(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

apiRouter.put('/profile', authMiddleware, async (req, res) => {
    const { fullName, profilePhoto } = req.body; // profilePhoto is base64 data URI
    try {
        let query = 'UPDATE users SET';
        const params = [];
        if (fullName) {
            query += ' full_name = ?';
            params.push(fullName);
        }
        if (profilePhoto) {
            if(params.length > 0) query += ',';
            query += ' profile_photo = ?';
            params.push(profilePhoto);
        }
        query += ' WHERE id = ?';
        params.push(req.userId);

        if (params.length > 1) {
             await pool.query(query, params);
        }
       
        const updatedUser = await getUserData(req.userId);
        res.json(updatedUser);
    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

apiRouter.post('/me/api-token', authMiddleware, async (req, res) => {
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        await pool.query('UPDATE users SET api_token = ? WHERE id = ?', [hashedToken, req.userId]);
        res.json({ token }); // Return the plain text token ONLY once.
    } catch (error) {
        console.error("API Token generation error:", error);
        res.status(500).json({ error: "Failed to generate API token." });
    }
});

apiRouter.delete('/me/api-token', authMiddleware, async (req, res) => {
    try {
        await pool.query('UPDATE users SET api_token = NULL WHERE id = ?', [req.userId]);
        res.status(200).json({ message: 'API token revoked.' });
    } catch (error) {
        console.error("API Token revocation error:", error);
        res.status(500).json({ error: "Failed to revoke API token." });
    }
});


apiRouter.post('/schedule-items', authMiddleware, async (req, res) => {
    const { task } = req.body;
    try {
        await pool.query(
            `INSERT INTO schedule_items (user_id, item_id_str, item_data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE item_data = ?`,
            [req.userId, task.ID, JSON.stringify(task), JSON.stringify(task)]
        );
        res.status(201).json(task);
    } catch (error) {
        console.error("Error saving task:", error);
        res.status(500).json({ error: 'Failed to save task' });
    }
});

apiRouter.post('/schedule-items/batch', authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Tasks array is required.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const query = `INSERT INTO schedule_items (user_id, item_id_str, item_data) VALUES ?
                       ON DUPLICATE KEY UPDATE item_data = VALUES(item_data)`;
        const values = tasks.map(task => [req.userId, task.ID, JSON.stringify(task)]);
        
        await connection.query(query, [values]);
        
        await connection.commit();
        res.status(201).json({ success: true, count: tasks.length });
    } catch (error) {
        await connection.rollback();
        console.error("Error batch saving tasks:", error);
        res.status(500).json({ error: 'Failed to save tasks' });
    } finally {
        connection.release();
    }
});

apiRouter.post('/schedule-items/batch-move', authMiddleware, async (req, res) => {
    const { taskIds, newDate } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0 || !newDate) {
        return res.status(400).json({ error: 'An array of task IDs and a new date are required.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const newDay = new Date(`${newDate}T12:00:00Z`).toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
        const newDayData = { EN: newDay, GU: "" };
        
        const placeholders = taskIds.map(() => '?').join(',');
        const [items] = await connection.query(`SELECT item_id_str, item_data FROM schedule_items WHERE user_id = ? AND item_id_str IN (${placeholders})`, [req.userId, ...taskIds]);

        if (items.length !== taskIds.length) {
             console.warn("Mismatch in tasks found for batch move.");
        }
        
        for (const item of items) {
            const taskData = typeof item.item_data === 'string' ? JSON.parse(item.item_data) : item.item_data;
            taskData.date = newDate;
            taskData.DAY = newDayData;
            
            await connection.query(
                'UPDATE schedule_items SET item_data = ? WHERE user_id = ? AND item_id_str = ?',
                [JSON.stringify(taskData), req.userId, item.item_id_str]
            );
        }

        await connection.commit();
        res.status(200).json({ message: `${items.length} items moved successfully.` });
    } catch (error) {
        await connection.rollback();
        console.error("Error batch moving tasks:", error);
        res.status(500).json({ error: 'Failed to move tasks.' });
    } finally {
        connection.release();
    }
});

apiRouter.delete('/schedule-items/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM schedule_items WHERE user_id = ? AND item_id_str = ?', [req.userId, req.params.id]);
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

apiRouter.post('/schedule-items/batch-delete', authMiddleware, async (req, res) => {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: 'An array of task IDs is required.' });
    }
    try {
        const placeholders = taskIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM schedule_items WHERE user_id = ? AND item_id_str IN (${placeholders})`, [req.userId, ...taskIds]);
        res.status(200).json({ message: `${taskIds.length} items deleted successfully.` });
    } catch (error) {
        console.error("Error batch deleting tasks:", error);
        res.status(500).json({ error: 'Failed to delete tasks.' });
    }
});

apiRouter.post('/schedule-items/clear-all', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM schedule_items WHERE user_id = ?', [req.userId]);
        res.status(200).json({ message: 'All schedule items have been cleared.' });
    } catch (error) {
        console.error("Error clearing schedule:", error);
        res.status(500).json({ error: 'Failed to clear schedule.' });
    }
});


apiRouter.post('/config', authMiddleware, async (req, res) => {
    try {
        const updates = req.body;
        const [[userConfig]] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
        const currentConfig = userConfig?.config ? JSON.parse(decrypt(userConfig.config)) : {};
        
        // Securely handle Gemini API key update
        let newConfig = { ...currentConfig };
        if (updates.geminiApiKey) {
            newConfig.geminiApiKey = updates.geminiApiKey;
            // Do not let the rest of the updates overwrite this
            delete updates.geminiApiKey;
        }

        const newSettings = updates.settings 
            ? { ...currentConfig.settings, ...updates.settings }
            : currentConfig.settings;
            
        newConfig = { 
            ...newConfig, 
            ...updates,
            settings: newSettings
        };

        const encryptedConfig = encrypt(JSON.stringify(newConfig));

        await pool.query(
            `INSERT INTO user_configs (user_id, config) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE config = ?`,
            [req.userId, encryptedConfig, encryptedConfig]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating config:", error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// A new endpoint to sync the whole user object.
// USE WITH CAUTION. It replaces the entire config blob.
apiRouter.post('/user-data/full-sync', authMiddleware, async (req, res) => {
    try {
        const { userData } = req.body;
        
        const { SCHEDULE_ITEMS, id, sid, email, fullName, profilePhoto, isVerified, role, RESULTS, EXAMS, STUDY_SESSIONS, DOUBTS, CONFIG } = userData;
        
        // Preserve sensitive data like API keys that aren't sent to the frontend
        const [[userConfig]] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
        const currentConfig = userConfig?.config ? JSON.parse(decrypt(userConfig.config)) : {};

        // 1. Update the main config blob
        const configToSave = {
            ...CONFIG,
            geminiApiKey: currentConfig.geminiApiKey, // Preserve existing key
            RESULTS,
            EXAMS,
            STUDY_SESSIONS,
            DOUBTS
        };
        const encryptedConfig = encrypt(JSON.stringify(configToSave));
        await pool.query(
            `INSERT INTO user_configs (user_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?`,
            [req.userId, encryptedConfig, encryptedConfig]
        );

        // 2. Clear and re-insert all schedule items for simplicity
        // In a high-performance scenario, you'd diff these.
        await pool.query('DELETE FROM schedule_items WHERE user_id = ?', [req.userId]);
        if (SCHEDULE_ITEMS && SCHEDULE_ITEMS.length > 0) {
            const scheduleValues = SCHEDULE_ITEMS.map(item => [req.userId, item.ID, JSON.stringify(item)]);
            await pool.query(
                `INSERT INTO schedule_items (user_id, item_id_str, item_data) VALUES ?`,
                [scheduleValues]
            );
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Full sync error:", error);
        res.status(500).json({ error: 'Full data sync failed.' });
    }
});

apiRouter.post('/import', apiTokenAuthMiddleware, async (req, res) => {
    try {
        const data = req.body;
        const userId = req.userId;
        
        // 1. Add new schedule items
        const newSchedules = data.schedules || [];
        if (newSchedules.length > 0) {
            const scheduleValues = newSchedules.map((item) => [userId, item.ID, JSON.stringify(item)]);
            await pool.query(
                `INSERT INTO schedule_items (user_id, item_id_str, item_data) VALUES ? ON DUPLICATE KEY UPDATE item_data = VALUES(item_data)`,
                [scheduleValues]
            );
        }

        // 2. Fetch, update, and re-encrypt the config blob
        const [[userConfigRow]] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [userId]);
        if (!userConfigRow) {
            return res.status(404).json({ error: "User configuration not found." });
        }

        const decryptedConfig = decrypt(userConfigRow.config);
        const configObject = JSON.parse(decryptedConfig);
        
        const newExams = data.exams || [];
        let newResults = [];
        let newWeaknesses = [];

        if (data.metrics && Array.isArray(data.metrics)) {
            data.metrics.forEach((metric) => {
                if (metric.type === 'RESULT' && metric.score && metric.mistakes) {
                    newResults.push({
                        ID: `R_API_${Date.now()}${Math.random().toString(36).substring(2, 7)}`,
                        DATE: new Date().toISOString().split('T')[0],
                        SCORE: metric.score,
                        MISTAKES: metric.mistakes.split(';').map((s) => s.trim()).filter(Boolean)
                    });
                } else if (metric.type === 'WEAKNESS' && metric.weaknesses) {
                    newWeaknesses.push(...metric.weaknesses.split(';').map((s) => s.trim()).filter(Boolean));
                }
            });
        }
        
        configObject.EXAMS = [...(configObject.EXAMS || []), ...newExams];
        configObject.RESULTS = [...(configObject.RESULTS || []), ...newResults];
        
        const combinedWeaknesses = new Set([...(configObject.WEAK || []), ...newWeaknesses]);
        newResults.forEach(r => {
            r.MISTAKES.forEach((m) => combinedWeaknesses.add(m));
        });
        configObject.WEAK = Array.from(combinedWeaknesses);

        if (newResults.length > 0) {
            const allResults = [...configObject.RESULTS].sort((a, b) => new Date(b.DATE).getTime() - new Date(a.DATE).getTime());
            configObject.SCORE = allResults[0].SCORE;
        }

        const encryptedConfig = encrypt(JSON.stringify(configObject));
        await pool.query(
            `UPDATE user_configs SET config = ? WHERE user_id = ?`,
            [encryptedConfig, userId]
        );

        res.status(200).json({ success: true, message: 'Data imported successfully.' });

    } catch (error) {
        console.error("API Import Error:", error);
        res.status(500).json({ error: 'Failed to import data.' });
    }
});


// --- RESULT MANAGEMENT ---
apiRouter.put('/results', authMiddleware, async (req, res) => {
    const { result } = req.body;
    if (!result || !result.ID) {
        return res.status(400).json({ error: 'Result data with an ID is required.' });
    }
    try {
        const [[userConfigRow]] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [req.userId]);
        if (!userConfigRow) return res.status(404).json({ error: 'User config not found.' });
        
        const config = JSON.parse(decrypt(userConfigRow.config));
        const resultIndex = (config.RESULTS || []).findIndex(r => r.ID === result.ID);
        
        if (resultIndex === -1) return res.status(404).json({ error: 'Result not found.' });

        config.RESULTS[resultIndex] = result;
        
        const encryptedConfig = encrypt(JSON.stringify(config));
        await pool.query('UPDATE user_configs SET config = ? WHERE user_id = ?', [encryptedConfig, req.userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error("Update result error:", error);
        res.status(500).json({ error: 'Failed to update result.' });
    }
});

apiRouter.delete('/results', authMiddleware, async (req, res) => {
    const { resultId } = req.body;
    if (!resultId) {
        return res.status(400).json({ error: 'Result ID is required.' });
    }
    try {
        const [[userConfigRow]] = await pool.query('SELECT config FROM user_configs WHERE user_id = ?', [req.userId]);
        if (!userConfigRow) return res.status(404).json({ error: 'User config not found.' });

        const config = JSON.parse(decrypt(userConfigRow.config));
        const initialCount = (config.RESULTS || []).length;
        config.RESULTS = (config.RESULTS || []).filter(r => r.ID !== resultId);

        if (config.RESULTS.length === initialCount) {
            return res.status(404).json({ error: 'Result not found.' });
        }

        const encryptedConfig = encrypt(JSON.stringify(config));
        await pool.query('UPDATE user_configs SET config = ? WHERE user_id = ?', [encryptedConfig, req.userId]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Delete result error:", error);
        res.status(500).json({ error: 'Failed to delete result.' });
    }
});


// --- DOUBTS FORUM ENDPOINTS ---
apiRouter.get('/doubts/all', authMiddleware, async (req, res) => {
    try {
        const [doubts] = await pool.query(`
            SELECT d.id, d.user_id, d.question, d.question_image, d.created_at, d.status, u.sid as user_sid, u.full_name as author_name, u.profile_photo as author_photo
            FROM doubts d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC
        `);
        const [solutions] = await pool.query(`
            SELECT s.id, s.doubt_id, s.user_id, s.solution, s.solution_image, s.created_at, u.sid as user_sid, u.full_name as solver_name, u.profile_photo as solver_photo
            FROM solutions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at ASC
        `);
        const doubtsWithSolutions = doubts.map(doubt => ({
            ...doubt,
            solutions: solutions.filter(s => s.doubt_id === doubt.id)
        }));
        res.json(doubtsWithSolutions);
    } catch (error) {
        console.error("Error fetching doubts:", error);
        res.status(500).json({ error: "Failed to fetch doubts." });
    }
});

apiRouter.post('/doubts', authMiddleware, async (req, res) => {
    const { question, question_image } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO doubts (user_id, question, question_image) VALUES (?, ?, ?)',
            [req.userId, question, question_image]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error("Error posting doubt:", error);
        res.status(500).json({ error: "Failed to post doubt." });
    }
});

apiRouter.post('/doubts/:id/solutions', authMiddleware, async (req, res) => {
    const { solution, solution_image } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO solutions (doubt_id, user_id, solution, solution_image) VALUES (?, ?, ?, ?)',
            [req.params.id, req.userId, solution, solution_image]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error("Error posting solution:", error);
        res.status(500).json({ error: "Failed to post solution." });
    }
});

// --- MESSAGING ENDPOINTS ---
apiRouter.get('/messages/:studentSid', authMiddleware, adminMiddleware, async (req, res) => {
    const { studentSid } = req.params;
    const adminSid = req.userSid; 
    try {
        const [messages] = await pool.query(
            'SELECT * FROM messages WHERE (sender_sid = ? AND recipient_sid = ?) OR (sender_sid = ? AND recipient_sid = ?) ORDER BY created_at ASC',
            [adminSid, studentSid, studentSid, adminSid]
        );
        res.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages." });
    }
});

apiRouter.post('/messages', authMiddleware, adminMiddleware, async (req, res) => {
    const { recipient_sid, content } = req.body;
    const sender_sid = req.userSid;
    try {
        const [result] = await pool.query(
            'INSERT INTO messages (sender_sid, recipient_sid, content) VALUES (?, ?, ?)',
            [sender_sid, recipient_sid, content]
        );
        const [[newMessage]] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Failed to send message." });
    }
});


// --- MUSIC (NEW WEB-DAV) ENDPOINTS ---
const browseNextcloudShare = async (req, res, shareToken, sharePassword) => {
    if (!shareToken) {
        return res.status(503).json({ error: 'Service is not configured by the administrator.' });
    }
    
    const requestedPath = req.query.path || '/';
    const { NEXTCLOUD_URL } = process.env;
    const webdavUrl = `${NEXTCLOUD_URL}/public.php/webdav${requestedPath}`;

    try {
        const auth = 'Basic ' + Buffer.from(`${shareToken}:${sharePassword || ''}`).toString('base64');
        const response = await fetch(webdavUrl, {
            method: 'PROPFIND',
            headers: { 'Authorization': auth, 'Depth': '1' }
        });

        if (!response.ok) {
            throw new Error(`Nextcloud server responded with status ${response.status}`);
        }

        const xmlData = await response.text();
        const jsonData = await parseStringPromise(xmlData, { explicitArray: false, mergeAttrs: true });
        
        const items = (jsonData['d:multistatus']['d:response'] || [])
            .map((item) => {
                const clientPath = decodeURIComponent(item['d:href']).replace('/public.php/webdav', '');
                const normalize = (p) => (p.length > 1 && p.endsWith('/')) ? p.slice(0, -1) : p;
                if (normalize(clientPath) === normalize(requestedPath)) return null;

                const prop = item['d:propstat']['d:prop'];
                const isCollection = prop['d:resourcetype'] && typeof prop['d:resourcetype'] === 'object' && 'd:collection' in prop['d:resourcetype'];
                const name = decodeURIComponent(item['d:href']).split('/').filter(Boolean).pop();

                return {
                    name,
                    path: clientPath,
                    type: isCollection ? 'folder' : 'file',
                    size: prop['d:getcontentlength'] || 0,
                    modified: prop['d:getlastmodified'] || '',
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });
        
        res.json(items);

    } catch (error) {
        console.error("Nextcloud browse error:", error);
        res.status(500).json({ error: "Failed to retrieve directory contents." });
    }
}

apiRouter.get('/music/browse', authMiddleware, async (req, res) => {
    await browseNextcloudShare(req, res, process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN, process.env.NEXTCLOUD_MUSIC_SHARE_PASSWORD);
});

apiRouter.get('/music/content', (req, res) => {
    // This endpoint is a proxy to bypass CORS and add auth for direct streaming.
    const { path: requestedPath, token } = req.query;
    if (!requestedPath || !token) {
        return res.status(400).send('File path and token are required.');
    }

    try {
        // Verify token to ensure only logged-in users can access
        jwt.verify(token, JWT_SECRET);
        
        const { NEXTCLOUD_URL, NEXTCLOUD_MUSIC_SHARE_TOKEN, NEXTCLOUD_MUSIC_SHARE_PASSWORD } = process.env;
        const fileUrl = `${NEXTCLOUD_URL}/public.php/webdav${requestedPath}`;
        const auth = 'Basic ' + Buffer.from(`${NEXTCLOUD_MUSIC_SHARE_TOKEN}:${NEXTCLOUD_MUSIC_SHARE_PASSWORD || ''}`).toString('base64');

        // Forward the request to Nextcloud
        fetch(fileUrl, { headers: { 'Authorization': auth } })
            .then(ncRes => {
                if (!ncRes.ok) throw new Error(`Nextcloud responded with ${ncRes.status}`);
                res.setHeader('Content-Type', ncRes.headers.get('content-type'));
                res.setHeader('Content-Length', ncRes.headers.get('content-length'));
                res.setHeader('Accept-Ranges', 'bytes');
                ncRes.body.pipe(res);
            })
            .catch(err => {
                console.error("Music streaming proxy error:", err);
                res.status(502).send('Failed to stream file.');
            });

    } catch (error) {
        res.status(401).send('Invalid token.');
    }
});


// --- STUDY MATERIAL (NEXTCLOUD) ENDPOINTS ---
apiRouter.get('/study-material/browse', authMiddleware, async (req, res) => {
    await browseNextcloudShare(req, res, process.env.NEXTCLOUD_SHARE_TOKEN, process.env.NEXTCLOUD_SHARE_PASSWORD);
});

apiRouter.post('/study-material/details', authMiddleware, async (req, res) => {
    if (!isNextcloudStudyConfigured) {
        return res.status(503).json({ error: 'Study material repository is not configured.' });
    }
    const { paths } = req.body;
    if (!Array.isArray(paths)) {
        return res.status(400).json({ error: 'An array of paths is required.' });
    }
    
    const { NEXTCLOUD_URL, NEXTCLOUD_SHARE_TOKEN, NEXTCLOUD_SHARE_PASSWORD } = process.env;
    const auth = 'Basic ' + Buffer.from(`${NEXTCLOUD_SHARE_TOKEN}:${NEXTCLOUD_SHARE_PASSWORD || ''}`).toString('base64');
    
    try {
        const itemPromises = paths.map(async (p) => {
            const webdavUrl = `${NEXTCLOUD_URL}/public.php/webdav${p}`;
            const response = await fetch(webdavUrl, {
                method: 'PROPFIND',
                headers: { 'Authorization': auth, 'Depth': '0' } // Depth 0 for single item
            });
            if (!response.ok) return null;

            const xmlData = await response.text();
            const jsonData = await parseStringPromise(xmlData, { explicitArray: false, mergeAttrs: true });
            
            const item = jsonData['d:multistatus']['d:response'];
            if (!item) return null;

            const prop = item['d:propstat']['d:prop'];
            const isCollection = prop['d:resourcetype'] && typeof prop['d:resourcetype'] === 'object' && 'd:collection' in prop['d:resourcetype'];
            const name = decodeURIComponent(item['d:href']).split('/').filter(Boolean).pop();

            return {
                name,
                path: decodeURIComponent(item['d:href']).replace('/public.php/webdav', ''),
                type: isCollection ? 'folder' : 'file',
                size: prop['d:getcontentlength'] || 0,
                modified: prop['d:getlastmodified'] || '',
            };
        });

        const results = (await Promise.all(itemPromises)).filter(Boolean);
        res.json(results);

    } catch (error) {
        console.error("Nextcloud details error:", error);
        res.status(500).json({ error: "Failed to retrieve item details." });
    }
});

apiRouter.get('/study-material/content', authMiddleware, async (req, res) => {
    if (!isNextcloudStudyConfigured) {
        return res.status(503).json({ error: 'Study material repository is not configured.' });
    }
    const requestedPath = req.query.path;
    if (!requestedPath) return res.status(400).json({ error: 'File path is required.' });

    const { NEXTCLOUD_URL, NEXTCLOUD_SHARE_TOKEN, NEXTCLOUD_SHARE_PASSWORD } = process.env;
    const fileUrl = `${NEXTCLOUD_URL}/public.php/webdav${requestedPath}`;

    try {
        const auth = 'Basic ' + Buffer.from(`${NEXTCLOUD_SHARE_TOKEN}:${NEXTCLOUD_SHARE_PASSWORD || ''}`).toString('base64');
        const response = await fetch(fileUrl, {
            headers: { 'Authorization': auth }
        });

        if (!response.ok) {
            throw new Error(`Nextcloud server responded with status ${response.status}`);
        }
        
        // Instead of piping, buffer the response to prevent streaming issues.
        const fileBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('Content-Length', fileBuffer.byteLength);
        res.send(Buffer.from(fileBuffer));

    } catch (error) {
        console.error("Nextcloud content error:", error);
        res.status(500).json({ error: "Failed to retrieve file content." });
    }
});


// --- AI ENDPOINTS ---
const getKnowledgeBaseForUser = (userConfig) => {
    const examType = userConfig.settings?.examType || 'JEE';
    const base = `
### INTERNAL KNOWLEDGE BASE
You have access to the following comprehensive library. Ground your answers and content generation in this information.

**PHYSICS:**
${knowledgeBase.PHYSICS}

**CHEMISTRY:**
${knowledgeBase.CHEMISTRY}
`;
    if (examType === 'NEET') {
        return base + `
**BIOLOGY:**
${knowledgeBase.BIOLOGY}
`;
    }
    return base + `
**MATHS:**
${knowledgeBase.MATHS}
`;
};


const getApiKeyAndConfigForUser = async (userId) => {
    const [[userConfigRow]] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [userId]);
    let config = {};
    let apiKey = process.env.API_KEY; // Fallback to global key

    if (userConfigRow) {
        config = JSON.parse(decrypt(userConfigRow.config));
        if (config.geminiApiKey) {
            apiKey = config.geminiApiKey;
        }
    }
    return { apiKey, config };
};

apiRouter.post('/ai/correct-json', authMiddleware, async (req, res) => {
    const { brokenJson } = req.body;
    if (!brokenJson) return res.status(400).json({ error: "String to correct is required." });

    const { apiKey } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are a JSON syntax correction bot. Your ONLY task is to fix the provided malformed JSON string and return a single, valid, raw JSON object. Do not add any explanations, conversational text, or markdown formatting like \`\`\`json. If the input is not fixable as JSON, return an empty object {}.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Fix this JSON: ${brokenJson}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            },
        });

        res.json({ correctedJson: response.text });
    } catch (error) {
        console.error("Gemini API error (correct json):", error);
        res.status(500).json({ error: `Failed to correct JSON with AI: ${error.message}` });
    }
});


apiRouter.post('/ai/daily-insight', authMiddleware, async (req, res) => {
    const { weaknesses, syllabus } = req.body;
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are a helpful AI assistant for students. Your task is to provide a daily motivational quote and a relevant, useful piece of academic information.
        Your response MUST be a single, valid JSON object with two keys: "quote" and "insight".
        - "quote": A short, motivational quote for a student.
        - "insight": A string containing a relevant formula or important point, sourced from the provided knowledge base. Make it concise and easy to understand.
        ${getKnowledgeBaseForUser(config)}`;
        
        let prompt = `Generate a quote and an insight for a student.`;
        if (syllabus) {
            prompt += ` The student's upcoming exam has this syllabus: "${syllabus}". The insight should be relevant to this.`;
        } else if (weaknesses && weaknesses.length > 0) {
            prompt += ` The student's current weaknesses are: ${weaknesses.join(', ')}. The insight should be related to one of these weaknesses.`;
        }


        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });
        
        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error("Gemini API error (daily insight):", error);
        res.status(500).json({ error: `Failed to get daily insight from AI: ${error.message}` });
    }
});


apiRouter.post('/ai/analyze-mistake', authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    if (!prompt) return res.status(400).json({ error: "A prompt describing the mistake is required." });

    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are a test preparation expert. A student has provided an image of a question and a description of their mistake. Analyze their conceptual error using your internal knowledge base. Respond ONLY with a valid JSON object with two keys: "mistake_topic" (a short, specific topic name like "Conservation of Momentum") and "explanation" (a detailed but concise explanation of the fundamental concept they misunderstood and how to correct it). Do not include any other text or markdown formatting.
        ${getKnowledgeBaseForUser(config)}`;

        const contentParts = [{ text: `Student's mistake description: "${prompt}"` }];
        if (imageBase64) {
            contentParts.unshift({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: contentParts },
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });
        
        // Gemini with JSON output mode returns the JSON string directly in response.text
        res.json({ response: response.text });
    } catch (error) {
        console.error("Gemini API error (analyze mistake):", error);
        res.status(500).json({ error: `Failed to get analysis from AI: ${error.message}` });
    }
});


apiRouter.post('/ai/solve-doubt', authMiddleware, async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: "A prompt is required." });
    }
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) {
        return res.status(500).json({ error: "AI service is not configured. Please add a Gemini API key in settings." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const systemInstruction = `You are an expert tutor. Answer the student's question accurately and concisely, using the provided knowledge base as your primary reference. Use markdown and the specified text formats (e.g., H_2O, x^2, log_b(x)) for clarity.
        ${getKnowledgeBaseForUser(config)}`;

        const contents = { parts: [{ text: prompt }] };
        if (imageBase64) {
            contents.parts.unshift({
                inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            });
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction
            }
        });

        res.json({ response: response.text });
    } catch (error) {
        console.error("Gemini API error:", error);
        res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
});

apiRouter.post('/ai/parse-text', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required." });
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured. Please add a Gemini API key in settings." });

    try {
        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `Your entire response MUST be a single, raw JSON object based on the user's text. DO NOT include any explanations, conversational text, or markdown formatting. The JSON object must adhere to the provided schema. Use the knowledge base for context on subjects and topics.
If the user's request is vague, ask for clarification by returning an error. You MUST ask for details like timetables, exam dates, syllabus, and weak topics for schedules.
If the user's request is for 'PYQs', 'questions', or 'problems', you MUST use the 'HOMEWORK' type.
If the user mentions creating a 'custom widget', 'note panel', or 'info box', use the 'custom_widget' structure.
${getKnowledgeBaseForUser(config)}`;

        // Modular and robust schema definition
        const flashcardSchema = {
            type: Type.OBJECT,
            properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING }
            },
            required: ['front', 'back']
        };

        const scheduleItemSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['ACTION', 'HOMEWORK'] },
                day: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                subject: { type: Type.STRING },
                q_ranges: { type: Type.STRING },
                sub_type: { type: Type.STRING },
                answers: { type: Type.STRING, description: "A stringified JSON object mapping question numbers to answers." },
                flashcards: { type: Type.ARRAY, items: flashcardSchema }
            },
            required: ['id', 'type', 'day', 'title', 'detail', 'subject']
        };

        const examSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['EXAM'] },
                subject: { type: Type.STRING, enum: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'BIOLOGY', 'FULL'] },
                title: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                syllabus: { type: Type.STRING }
            },
            required: ['id', 'type', 'subject', 'title', 'date', 'time', 'syllabus']
        };

        const metricSchema = {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['RESULT', 'WEAKNESS'] },
                score: { type: Type.STRING },
                mistakes: { type: Type.STRING },
                weaknesses: { type: Type.STRING }
            },
            required: ['type']
        };

        const practiceQuestionSchema = {
            type: Type.OBJECT,
            properties: {
                number: { type: Type.INTEGER },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                type: { type: Type.STRING, enum: ['MCQ', 'NUM'] }
            },
            required: ['number', 'text', 'type']
        };

        const practiceTestSchema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                    type: Type.ARRAY,
                    items: practiceQuestionSchema
                },
                answers: { type: Type.STRING, description: "A stringified JSON object mapping question numbers to answers." },
                solutions: { type: Type.STRING, description: "A stringified JSON object mapping question numbers to detailed solutions." }
            },
            required: ['questions', 'answers']
        };

        const customWidgetSchema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING, description: 'Markdown-compatible content for the widget body.'}
            },
            required: ['title', 'content']
        };

        const aiImportSchema = {
            type: Type.OBJECT,
            properties: {
                schedules: { type: Type.ARRAY, items: scheduleItemSchema },
                exams: { type: Type.ARRAY, items: examSchema },
                metrics: { type: Type.ARRAY, items: metricSchema },
                practice_test: practiceTestSchema,
                custom_widget: customWidgetSchema,
            },
            nullable: true
        };


        const model = config.settings?.creditSaver ? 'gemini-2.5-flash' : 'gemini-2.5-pro';

        const response = await ai.models.generateContent({
            model: model,
            contents: `User request: ${text}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: aiImportSchema
            },
        });

        const mappedData = JSON.parse(response.text);
        return res.json(mappedData);

    } catch (error) {
        console.error("Gemini API error (text parse):", error);
        res.status(500).json({ error: `Failed to parse text: ${error.message}` });
    }
});


apiRouter.post('/ai/analyze-test-results', authMiddleware, async (req, res) => {
    const { imageBase64, userAnswers, timings, syllabus } = req.body;
    if (!imageBase64 || !userAnswers || !timings || !syllabus) return res.status(400).json({ error: "Answer key image, user answers, timings, and syllabus are required." });

    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are an expert AI assistant for analyzing exam results. Your tasks:
        1.  **Grade the Exam:** Extract answers from the image. Grade using +4/-1 (MCQ), +4/0 (Num).
        2.  **Analyze Timing & Mistakes:** Use the syllabus and knowledge base to map incorrect questions to topics. Calculate subject timings.
        3.  **Provide Suggestions:** Generate actionable suggestions.

        **Output Format:** Your ENTIRE response MUST be a single, valid JSON object with the specified structure. Do not include any other text.
        ${getKnowledgeBaseForUser(config)}`;
            
        const prompt = `
        Student's Answers: ${JSON.stringify(userAnswers)}
        Time per Question (seconds): ${JSON.stringify(timings)}
        Exam Syllabus: ${syllabus}
        
        Analyze the provided answer key image and the student's data. Return the full analysis in the specified JSON format.`;
        
        const model = config.settings?.creditSaver ? 'gemini-2.5-flash' : 'gemini-2.5-pro';

        const response = await ai.models.generateContent({
            model: model, 
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                ]
            },
            config: { 
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error("Gemini API error (analyze results):", error);
        res.status(500).json({ error: `Failed to analyze test results with AI: ${error.message}` });
    }
});

apiRouter.post('/ai/analyze-specific-mistake', authMiddleware, async (req, res) => {
    const { imageBase64, prompt } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: "Image of the question and a description are required." });

    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are a master tutor. A student has uploaded an image of a specific question they got wrong and a brief description of their error. Your task is to provide a clear, concise analysis using the knowledge base.
        **Output Format:** Your ENTIRE response MUST be a single, valid JSON object with two keys:
        1. "topic": A very specific, short topic name for this question.
        2. "explanation": A step-by-step explanation. Start with the core concept, identify the error, and provide the correct method. Use markdown for formatting.
        ${getKnowledgeBaseForUser(config)}`;
            
        const fullPrompt = `Student's description of mistake: "${prompt}". Please analyze the attached question image and provide the analysis in the specified JSON format.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: fullPrompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                ]
            },
            config: { 
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error("Gemini API error (specific mistake):", error);
        res.status(500).json({ error: `Failed to analyze mistake with AI: ${error.message}` });
    }
});


apiRouter.post('/ai/chat', authMiddleware, async (req, res) => {
    const { history, prompt, imageBase64 } = req.body;
    if (!prompt) return res.status(400).json({ error: "A prompt is required." });

    const { apiKey, config: userStoredConfig } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured. Please add a Gemini API key in settings." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const fullUserData = await getUserData(req.userId);

        const context = `
        Here is the user's current schedule for context. When asked to modify or delete something, find the relevant ID from this list and use it in your function call.
        ${JSON.stringify(fullUserData.SCHEDULE_ITEMS, null, 2)}
        `;

        const systemInstruction = `You are a helpful and friendly AI assistant for students with the ability to modify user data through function calls. Your goal is to help students with their academic questions, provide guidance, and manage their schedule.
        - Use the provided user schedule data to find the correct IDs for updating or deleting tasks.
        - When asked to perform an action (create, update, delete, generate flashcards), use the provided tools.
        - After a tool is called, you MUST confirm what you did in a friendly message (e.g., "I've deleted that task for you.").
        - If the user asks for 'PYQs', 'questions', or 'problems', you MUST use the 'HOMEWORK' type when calling 'createOrUpdateTask'.
        - Politely decline questions outside of academics and student wellness. Be encouraging and supportive.
        ${context}
        ${getKnowledgeBaseForUser(userStoredConfig)}`;
        
        const contents = [];
        if (history) {
            const validHistory = history.filter(msg => msg.parts && msg.parts[0] && typeof msg.parts[0].text === 'string' && msg.parts[0].text.trim() !== '');
            contents.push(...validHistory);
        }
        
        const userParts = [{ text: prompt }];
        if (imageBase64) {
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } };
            userParts.unshift(imagePart);
        }
        contents.push({ role: 'user', parts: userParts });

        const model = userStoredConfig.settings?.creditSaver ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
        
        // --- Function Calling Setup ---
        const createOrUpdateTaskFunction = {
            name: 'createOrUpdateTask',
            description: 'Creates a new schedule item or updates an existing one.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: 'The ID of the task to update. Omit to create a new task.' },
                    title: { type: Type.STRING },
                    details: { type: Type.STRING },
                    subject: { type: Type.STRING, description: 'PHYSICS, CHEMISTRY, MATHS, BIOLOGY, or OTHER' },
                    day: { type: Type.STRING, description: 'e.g., MONDAY, TUESDAY' },
                    time: { type: Type.STRING, description: 'HH:MM format. Required for study sessions.' },
                    date: { type: Type.STRING, description: 'YYYY-MM-DD for one-off events. Overrides day.' },
                    type: { type: Type.STRING, enum: ['ACTION', 'HOMEWORK'] },
                    q_ranges: { type: Type.STRING, description: 'For homework, e.g., "1-10; 15"' }
                },
                required: ['title', 'subject', 'details', 'type']
            }
        };

        const deleteTasksFunction = {
            name: 'deleteTasks',
            description: 'Deletes one or more schedule items based on their unique IDs.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    taskIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of specific task IDs to delete.' }
                },
                required: ['taskIds']
            }
        };

        const generateFlashcardDeckFunction = {
            name: 'generateFlashcardDeck',
            description: 'Generates a new flashcard deck based on a topic or syllabus and saves it for the user.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING, description: 'The main topic for the flashcard deck, e.g., "Rotational Motion".' },
                    subject: { type: Type.STRING, description: 'The subject of the deck, e.g., "PHYSICS", "CHEMISTRY", "MATHS", "BIOLOGY".' },
                    chapter: { type: Type.STRING, description: 'Optional chapter name to categorize the deck.' },
                    syllabus: { type: Type.STRING, description: 'Optional syllabus context to narrow down the content.' }
                },
                required: ['topic', 'subject']
            }
        };

        let response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: { 
                systemInstruction,
                tools: [{ functionDeclarations: [createOrUpdateTaskFunction, deleteTasksFunction, generateFlashcardDeckFunction] }]
            },
        });
        
        if (response.functionCalls && response.functionCalls.length > 0) {
            const functionResponses = [];
            for (const fc of response.functionCalls) {
                let toolResult = { success: false, message: "Unknown function" };
                if (fc.name === 'createOrUpdateTask') {
                    const { id, title, details, subject, day, time, date, type, q_ranges } = fc.args;
                    const isUpdate = !!id;
                    const taskId = isUpdate ? id : `${type.charAt(0)}${Date.now()}`;
                    
                    const dayData = date ? { EN: new Date(`${date}T12:00:00Z`).toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase(), GU: "" } : { EN: day, GU: "" };

                    const taskData = {
                        ID: taskId,
                        type,
                        isUserCreated: true,
                        CARD_TITLE: { EN: title, GU: "" },
                        FOCUS_DETAIL: { EN: details, GU: "" },
                        SUBJECT_TAG: { EN: subject.toUpperCase(), GU: "" },
                        DAY: dayData,
                        ...(date && { date }),
                        ...(time && { TIME: time }),
                        ...(q_ranges && { Q_RANGES: q_ranges }),
                    };

                    await pool.query(
                        `INSERT INTO schedule_items (user_id, item_id_str, item_data) VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE item_data = ?`,
                        [req.userId, taskId, JSON.stringify(taskData), JSON.stringify(taskData)]
                    );
                    toolResult = { success: true, message: `${isUpdate ? 'Updated' : 'Created'} task ${taskId}` };
                } else if (fc.name === 'deleteTasks') {
                    const { taskIds } = fc.args;
                    if (taskIds && taskIds.length > 0) {
                        const placeholders = taskIds.map(() => '?').join(',');
                        await pool.query(`DELETE FROM schedule_items WHERE user_id = ? AND item_id_str IN (${placeholders})`, [req.userId, ...taskIds]);
                        toolResult = { success: true, message: `Deleted ${taskIds.length} tasks.` };
                    } else {
                        toolResult = { success: false, message: "No task IDs provided to delete." };
                    }
                } else if (fc.name === 'generateFlashcardDeck') {
                    const { topic, subject, chapter, syllabus } = fc.args;

                    const generationSystemInstruction = `You are an expert academic content creator...`; // Simplified for brevity
                    const generationPrompt = `Generate 5-10 flashcards for the topic: "${topic}". ${syllabus ? `Syllabus: ${syllabus}`: ''}`;
                    
                    const cardGenResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: generationPrompt,
                        config: { 
                            systemInstruction: generationSystemInstruction,
                            responseMimeType: 'application/json'
                        },
                    });
                
                    const { flashcards } = JSON.parse(cardGenResponse.text);
                
                    if (flashcards && flashcards.length > 0) {
                        const [[userConfigRow]] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
                        const currentConfig = JSON.parse(decrypt(userConfigRow.config));
                        
                        const newDeck = {
                            id: `deck_${Date.now()}`,
                            name: topic,
                            subject: subject.toUpperCase(),
                            chapter: chapter || undefined,
                            isLocked: false,
                            cards: flashcards.map((card, i) => ({ ...card, id: `card_${Date.now()}_${i}` })),
                        };
                
                        if (!currentConfig.flashcardDecks) currentConfig.flashcardDecks = [];
                        currentConfig.flashcardDecks.push(newDeck);
                
                        const encryptedConfig = encrypt(JSON.stringify(currentConfig));
                        await pool.query('UPDATE user_configs SET config = ? WHERE user_id = ?', [encryptedConfig, req.userId]);
                
                        toolResult = { success: true, message: `Successfully created a new flashcard deck named "${topic}".` };
                    } else {
                        toolResult = { success: false, message: "Could not generate any flashcards for that topic." };
                    }
                }
                functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: JSON.stringify(toolResult) }
                });
            }
            
            // Send the function response back to the model
            response = await ai.models.generateContent({
                model: model,
                contents: [
                    ...contents,
                    { role: 'model', parts: [{ functionCalls: response.functionCalls }] },
                    { role: 'tool', parts: [{ functionResponses: functionResponses }] }
                ],
                config: { systemInstruction }
            });
        }
        
        res.json({ response: response.text });
    } catch (error) {
        console.error("Gemini API error (chat):", error);
        res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
});

apiRouter.post('/ai/generate-flashcards', async (req, res) => {
    const { topic, syllabus } = req.body;
    if (!topic) return res.status(400).json({ error: "A topic is required." });

    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are an expert academic content creator. Your task is to generate flashcards based on a given topic, using the knowledge base.
        - Prioritize fundamental concepts, important formulas, and common points of confusion.
        - Your entire response MUST be a single, valid JSON object with one key: "flashcards". The value should be an array of objects, each with "front" and "back" string properties.
        - Do not include any other text, explanations, or markdown formatting.
        ${getKnowledgeBaseForUser(config)}`;

        const prompt = `Generate 5-10 flashcards for the topic: "${topic}". ${syllabus ? `Syllabus: ${syllabus}` : ''}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });
        
        res.json(JSON.parse(response.text));

    } catch (error) {
        console.error("Gemini API error (generate flashcards):", error);
        res.status(500).json({ error: `Failed to generate flashcards: ${error.message}` });
    }
});

apiRouter.post('/ai/generate-answer-key', authMiddleware, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    
    const { apiKey } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are an answer key retrieval bot. Find the official answer key for the specified test. Respond ONLY with a valid JSON object where keys are question numbers (as strings) and values are the correct answers (as strings). Example: {"1": "A", "2": "C", "3": "12.5"}. Do not include any other text or markdown.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `Find the answer key for: ${prompt}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });

        res.json({ answerKey: response.text });
    } catch (error) {
        console.error("Gemini API error (answer key):", error);
        res.status(500).json({ error: `Failed to generate answer key: ${error.message}` });
    }
});

apiRouter.post('/ai/generate-practice-test', authMiddleware, async (req, res) => {
    const { topic, numQuestions, difficulty } = req.body;
    if (!topic || !numQuestions || !difficulty) return res.status(400).json({ error: "Topic, number of questions, and difficulty are required." });
    
    const { apiKey, config } = await getApiKeyAndConfigForUser(req.userId);
    if (!apiKey) return res.status(500).json({ error: "AI service is not configured." });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are an expert question bank. Generate a practice test based on the user's request using the knowledge base.
        - Your entire response MUST be a single, valid JSON object with "questions" (an array) and "answers" (a stringified JSON object).
        - Each question object in the array must have "number", "text", "options" (array of 4 for MCQ, empty for NUM), and "type" (MCQ/NUM).
        - Use the advanced text formatting (e.g., H_2O, x^2) where appropriate.
        ${getKnowledgeBaseForUser(config)}`;

        const prompt = `Generate a ${difficulty} difficulty practice test with ${numQuestions} questions on the topic: "${topic}".`;

        const response = await ai.models.generateContent({
            model: config.settings?.creditSaver ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            },
        });
        
        const parsedResponse = JSON.parse(response.text);
        
        // Ensure answers are correctly formatted as a stringified JSON
        if (typeof parsedResponse.answers === 'object') {
            parsedResponse.answers = JSON.stringify(parsedResponse.answers);
        }

        res.json(parsedResponse);

    } catch (error) {
        console.error("Gemini API error (practice test):", error);
        res.status(500).json({ error: `Failed to generate practice test: ${error.message}` });
    }
});

// --- ADMIN ENDPOINTS ---
apiRouter.get('/admin/students', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [students] = await pool.query(`
            SELECT u.id, u.sid, u.email, u.full_name, u.profile_photo, u.is_verified, u.role, u.last_seen, c.config
            FROM users u
            LEFT JOIN user_configs c ON u.id = c.user_id
            WHERE u.role = 'student'
        `);
        const studentData = students.map(s => {
            let config = {};
            if (s.config) {
                try {
                    config = JSON.parse(decrypt(s.config));
                    delete config.geminiApiKey; // Never send sensitive keys
                } catch (e) {
                    console.error(`Could not parse config for student ${s.sid}`);
                }
            }
            return {
                id: s.id, sid: s.sid, email: s.email, fullName: s.full_name, profilePhoto: s.profile_photo,
                isVerified: s.is_verified, role: s.role, last_seen: s.last_seen, CONFIG: config
            };
        });
        res.json(studentData);
    } catch (error) {
        console.error("Get students error:", error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

apiRouter.delete('/admin/students/:sid', authMiddleware, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM users WHERE sid = ? AND role = "student"', [sid]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Student not found or user is not a student.' });
        }
        res.status(200).json({ message: 'Student deleted successfully.' });
    } catch (error) {
        console.error("Delete student error:", error);
        res.status(500).json({ error: 'Failed to delete student.' });
    }
});

apiRouter.post('/admin/students/:sid/clear-data', authMiddleware, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    const connection = await pool.getConnection();
    try {
        const [[user]] = await connection.query('SELECT id FROM users WHERE sid = ?', [sid]);
        if (!user) {
            return res.status(404).json({ error: 'Student not found' });
        }
        await connection.beginTransaction();
        await connection.query('DELETE FROM schedule_items WHERE user_id = ?', [user.id]);
        await connection.query('DELETE FROM user_configs WHERE user_id = ?', [user.id]);
        // Also clear doubts and solutions from this user
        await connection.query('DELETE FROM doubts WHERE user_id = ?', [user.id]);
        await connection.query('DELETE FROM solutions WHERE user_id = ?', [user.id]);
        
        await connection.commit();
        res.status(200).json({ message: 'Student data cleared.' });
    } catch (error) {
        await connection.rollback();
        console.error("Clear student data error:", error);
        res.status(500).json({ error: 'Failed to clear student data.' });
    } finally {
        connection.release();
    }
});


apiRouter.post('/admin/broadcast-task', authMiddleware, adminMiddleware, async (req, res) => {
    const { task, examType } = req.body;
    try {
        await pool.query('INSERT INTO broadcast_tasks (item_data, exam_type) VALUES (?, ?)', [JSON.stringify(task), examType]);
        res.status(201).json({ message: 'Broadcast task created successfully. It will be synced to users on their next login.' });
    } catch (error) {
        console.error("Broadcast task error:", error);
        res.status(500).json({ error: 'Failed to create broadcast task.' });
    }
});

apiRouter.post('/admin/impersonate/:sid', authMiddleware, adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    try {
        const [[userToImpersonate]] = await pool.query('SELECT id FROM users WHERE sid = ? AND role = "student"', [sid]);
        if (!userToImpersonate) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        const token = jwt.sign({ id: userToImpersonate.id, sid: sid }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error("Impersonation error:", error);
        res.status(500).json({ error: 'Failed to impersonate student.' });
    }
});

apiRouter.put('/admin/doubts/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    const { status } = req.body;
    if (!['archived', 'deleted'].includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
    }
    try {
        await pool.query('UPDATE doubts SET status = ? WHERE id = ?', [status, req.params.id]);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Update doubt status error:", error);
        res.status(500).json({ error: "Failed to update doubt status." });
    }
});



app.use('/api', apiRouter);

// --- STATIC FILE SERVING (for production) ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- SERVER START ---
const PORT = process.env.PORT || 3001;
if (isConfigured) {
    initializeDatabaseSchema().then(() => {
        ensureAdminUserExists().then(() => {
            app.listen(PORT, () => {
                console.log(`Server listening on port ${PORT}`);
            });
        });
    });
} else {
    // Start the server anyway to serve the misconfigured error message via the API status
    app.listen(PORT, () => {
        console.log(`Server started in a MISCONFIGURED state on port ${PORT}. Please check your .env file.`);
    });
}

// Export the app for Vercel
export default app;