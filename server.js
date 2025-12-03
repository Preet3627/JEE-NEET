
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