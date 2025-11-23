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
import { GoogleGenAI, Type } from '@google/genai';
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
const isNextcloudMusicConfigured = !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_MUSIC_SHARE_TOKEN);

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
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        isNextcloudConfigured: isNextcloudMusicConfigured
    });
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
    await pool.query("UPDATE users SET last_seen = NOW() WHERE id = ?", [req.userId]);
    res.json({ status: 'ok' });
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
        const initialConfig = { WAKE: '06:00', SCORE: '0/300', WEAK: [], settings: { accentColor: '#0891b2' } };
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [result.insertId, encrypt(initialConfig)]);

        const token = jwt.sign({ id: result.insertId, sid, role: 'student' }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ADMIN ROUTES ---

apiRouter.get('/admin/students', adminMiddleware, async (req, res) => {
    if (!pool) return res.status(503);
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
});

apiRouter.post('/admin/impersonate/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    const [users] = await pool.query("SELECT * FROM users WHERE sid = ?", [sid]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const user = users[0];
    const token = jwt.sign({ id: user.id, sid: user.sid, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

apiRouter.post('/admin/broadcast-task', adminMiddleware, async (req, res) => {
    const { task, examType } = req.body;
    let query = "SELECT id FROM users WHERE role = 'student'";
    const [users] = await pool.query(query);
    
    for (const u of users) {
        await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [u.id, encrypt(task)]);
    }
    res.json({ success: true, count: users.length });
});

apiRouter.delete('/admin/students/:sid', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    await pool.query("DELETE FROM users WHERE sid = ?", [sid]);
    res.json({ success: true });
});

apiRouter.post('/admin/students/:sid/clear-data', adminMiddleware, async (req, res) => {
    const { sid } = req.params;
    const [users] = await pool.query("SELECT id FROM users WHERE sid = ?", [sid]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const uid = users[0].id;
    await pool.query("DELETE FROM schedule_items WHERE user_id = ?", [uid]);
    await pool.query("DELETE FROM results WHERE user_id = ?", [uid]);
    await pool.query("DELETE FROM study_sessions WHERE user_id = ?", [uid]);
    await pool.query("DELETE FROM exams WHERE user_id = ?", [uid]);
    res.json({ success: true });
});

// --- USER DATA ROUTES ---

apiRouter.post('/schedule-items', authMiddleware, async (req, res) => {
    const { task } = req.body;
    await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(task)]);
    res.json({ success: true, id: task.ID });
});

apiRouter.post('/schedule-items/batch', authMiddleware, async (req, res) => {
    const { tasks } = req.body;
    for (const t of tasks) {
        await pool.query("INSERT INTO schedule_items (user_id, data) VALUES (?, ?)", [req.userId, encrypt(t)]);
    }
    res.json({ success: true });
});

apiRouter.delete('/schedule-items/:id', authMiddleware, async (req, res) => {
    const [rows] = await pool.query("SELECT id, data FROM schedule_items WHERE user_id = ?", [req.userId]);
    for (const row of rows) {
        const data = decrypt(row.data);
        if (data.ID === req.params.id) {
            await pool.query("DELETE FROM schedule_items WHERE id = ?", [row.id]);
            break;
        }
    }
    res.json({ success: true });
});

apiRouter.post('/config', authMiddleware, async (req, res) => {
    const [rows] = await pool.query("SELECT config FROM user_configs WHERE user_id = ?", [req.userId]);
    let currentConfig = rows.length > 0 ? decrypt(rows[0].config) : {};
    const newConfig = { ...currentConfig, ...req.body, settings: { ...currentConfig.settings, ...req.body.settings } };
    
    if (rows.length > 0) {
        await pool.query("UPDATE user_configs SET config = ? WHERE user_id = ?", [encrypt(newConfig), req.userId]);
    } else {
        await pool.query("INSERT INTO user_configs (user_id, config) VALUES (?, ?)", [req.userId, encrypt(newConfig)]);
    }
    res.json({ success: true });
});

// Full Sync
apiRouter.post('/user-data/full-sync', authMiddleware, async (req, res) => {
    const { userData } = req.body;
    const uid = req.userId;
    
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
});

// --- DOUBTS ---
const DOUBTS_CACHE = []; 

apiRouter.get('/doubts/all', async (req, res) => {
    try {
        if (pool) {
             res.json(DOUBTS_CACHE);
        } else {
            res.json(DOUBTS_CACHE);
        }
    } catch {
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
        created_at: new Date().toISOString(),
        author_name: 'Me', 
        author_photo: '',
        solutions: [],
        status: 'active'
    };
    DOUBTS_CACHE.push(newDoubt);
    res.json({ success: true });
});

apiRouter.post('/doubts/:id/solutions', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { solution } = req.body;
    const doubt = DOUBTS_CACHE.find(d => d.id === id);
    if (doubt) {
        doubt.solutions.push({
            id: `S${Date.now()}`,
            doubt_id: id,
            user_sid: req.userSid,
            solution,
            created_at: new Date().toISOString(),
            solver_name: 'Me',
            solver_photo: ''
        });
    }
    res.json({ success: true });
});

apiRouter.put('/admin/doubts/:id/status', adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const doubt = DOUBTS_CACHE.find(d => d.id === id);
    if (doubt) doubt.status = status;
    res.json({ success: true });
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

        const chat = ai.chats.create({ model, config: chatConfig });
        
        const parts = [{ text: userPrompt }];
        if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });

        const result = await chat.sendMessage({ message: parts }); 
        
        if (jsonResponse) {
            res.json(JSON.parse(result.response.text));
        } else {
            res.json({ response: result.response.text });
        }
    } catch (e) {
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
        
        const chat = ai.chats.create({ model, config: { systemInstruction }, history: history.map(h => ({ role: h.role, parts: h.parts })) });
        const parts = [{ text: prompt }];
        if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });

        const result = await chat.sendMessage({ message: parts });
        res.json({ role: 'model', parts: [{ text: result.response.text }] });
    } catch (error) {
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
    // Music streaming often uses direct Audio tags which can't easily send Auth headers.
    // We allow access via query token for this specific route.
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
        const stream = musicWebdavClient.createReadStream(path);
        stream.pipe(res);
    } catch (e) {
        res.status(500).send();
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