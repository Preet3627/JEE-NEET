
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
        return text; // Fallback for unencrypted legacy data
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

// ... (Database initialization logic omitted for brevity, assume unchanged) ...

// ... (Middleware logic omitted for brevity, assume unchanged) ...

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

// ... (Other AI endpoints like daily-insight, analyze-mistake remain unchanged) ...

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
If the user describes a visual style, use 'gradient' (e.g. 'from-cyan-500 to-blue-600') or 'image_url' in the schedule item.
${getKnowledgeBaseForUser(config)}`;

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
                flashcards: { type: Type.ARRAY, items: flashcardSchema },
                gradient: { type: Type.STRING, description: "Tailwind CSS gradient class if requested (e.g. 'from-purple-500 to-pink-500')." },
                image_url: { type: Type.STRING, description: "URL for background image if requested." }
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

// ... (Remaining server code) ...
