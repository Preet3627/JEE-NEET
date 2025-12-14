import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const config = {};

function validateEnv(key, defaultValue = undefined, required = true, type = 'string') {
    const value = process.env[key];

    if (required && (value === undefined || value === '')) {
        console.error(`Error: Missing required environment variable: ${key}`);
        process.exit(1);
    }

    if (value === undefined || value === '') {
        return defaultValue;
    }

    switch (type) {
        case 'number':
            const num = parseInt(value, 10);
            if (isNaN(num)) {
                console.error(`Error: Invalid number format for environment variable: ${key}`);
                process.exit(1);
            }
            return num;
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'string':
        default:
            return value;
    }
}

// Database Configuration (Required)
config.DB_HOST = validateEnv('DB_HOST');
config.DB_USER = validateEnv('DB_USER');
config.DB_PASSWORD = validateEnv('DB_PASSWORD');
config.DB_NAME = validateEnv('DB_NAME');

// JWT Secret (Required)
config.JWT_SECRET = validateEnv('JWT_SECRET');

// Encryption Key (Required)
config.ENCRYPTION_KEY = validateEnv('ENCRYPTION_KEY');

// Google OAuth (Required for Google Login)
config.GOOGLE_CLIENT_ID = validateEnv('GOOGLE_CLIENT_ID');

// Google AI API Key (Optional)
config.API_KEY = validateEnv('API_KEY', undefined, false);

// SMTP (Optional for Email Features)
config.SMTP_HOST = validateEnv('SMTP_HOST', undefined, false);
config.SMTP_PORT = validateEnv('SMTP_PORT', 587, false, 'number');
config.SMTP_SECURE = validateEnv('SMTP_SECURE', true, false, 'boolean');
config.SMTP_USER = validateEnv('SMTP_USER', undefined, false);
config.SMTP_PASS = validateEnv('SMTP_PASS', undefined, false);
config.SMTP_FROM = validateEnv('SMTP_FROM', 'no-reply@jeescheduler.com', false);

// Nextcloud WebDAV (Optional for Study Material/Music)
config.NEXTCLOUD_URL = validateEnv('NEXTCLOUD_URL', undefined, false);
config.NEXTCLOUD_SHARE_TOKEN = validateEnv('NEXTCLOUD_SHARE_TOKEN', undefined, false);
config.NEXTCLOUD_SHARE_PASSWORD = validateEnv('NEXTCLOUD_SHARE_PASSWORD', undefined, false);
config.NEXTCLOUD_MUSIC_SHARE_TOKEN = validateEnv('NEXTCLOUD_MUSIC_SHARE_TOKEN', undefined, false);
config.NEXTCLOUD_MUSIC_SHARE_PASSWORD = validateEnv('NEXTCLOUD_MUSIC_SHARE_PASSWORD', undefined, false);

export default config;
