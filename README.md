
# JEE Scheduler Pro - Full Stack Edition

This is a secure, multilingual (EN/GU), full-stack Student Management System (SMS) PWA tailored for JEE preparation. It features a robust Node.js backend with a MySQL database and a modern React frontend.

## Features

- **Full-Stack Architecture:** A secure Node.js/Express backend handles all data, authentication, and business logic, communicating with a MySQL database.
- **Role-Based Dashboards:** Separate, secure dashboards for Students and Admins, powered by live data from the backend.
- **PWA with Offline Sync:** As an installable PWA, the app caches data for offline viewing. Any changes made offline are queued and automatically synced with the server upon reconnection.
- **Google Integration:** Seamless Google Sign-In/Sign-Up, with features for backing up data to Google Drive and syncing schedules with Google Calendar.
- **Admin Broadcast:** Administrators can create and broadcast tasks (schedules, homework) to all students simultaneously, with PWA notifications for users.
- **AI-Powered Imports:** Leverage the Gemini API to parse schedules from unstructured text or timetable images directly into the app.
- **Secure & Configurable:** All sensitive keys and credentials are managed on the backend via environment variables, ensuring the frontend code is secure. User data is encrypted at rest.
- **Nextcloud Integration:** Seamlessly browse and play music from a private Nextcloud instance or access study materials (PDFs, notes) directly within the app.

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JWT (JSON Web Tokens), Google OAuth2
- **Cloud Storage:** Nextcloud (via WebDAV)
- **AI:** Google Gemini API

## Project Setup (Local Development)

1.  **Clone the repository.**
2.  **Setup Database:** Import the provided SQL schema into your MySQL database.
3.  **Configure Environment:** Create a `.env` file in the project root. You can copy the contents from `public/.env.example.txt` and fill in your actual database credentials and secret strings.
    **🚨 IMPORTANT NOTE FOR NEXTCLOUD/WEBDAV 🚨**
    For the "Study Material" and "Music Player" features to work, you **MUST** fully configure all `NEXTCLOUD_URL`, `NEXTCLOUD_SHARE_TOKEN`, `NEXTCLOUD_SHARE_PASSWORD`, `NEXTCLOUD_MUSIC_SHARE_TOKEN`, and `NEXTCLOUD_MUSIC_SHARE_PASSWORD` variables in your `.env` file. These are essential for connecting to your Nextcloud instance via WebDAV. If they are not set correctly, these features will appear as "Service Unavailable" in the app.
4.  **Install Dependencies:**
    ```bash
    npm install
    ```
5.  **Run in Development Mode:**
    This command starts both the backend and frontend servers concurrently with hot-reloading.
    ```bash
    npm run dev
    ```

## Deployment to Vercel

This project is configured for seamless deployment on Vercel.

1.  **Push to GitHub:** Ensure your project is pushed to a GitHub repository.
2.  **Create Vercel Project:** Import your GitHub repository into Vercel.
3.  **Build & Development Settings:** Vercel should automatically detect the Vite frontend and use the following settings. You typically don't need to change these.
    - **Framework Preset:** `Vite`
    - **Build Command:** `npm run build` or `vite build`
    - **Output Directory:** `dist`
    - **Install Command:** `npm install`
4.  **Configure Environment Variables:** This is the most important step. In your Vercel project's settings, go to the "Environment Variables" section and add the following secrets:
    - `DB_HOST`: Your MySQL database host.
    - `DB_USER`: Your MySQL database username.
    - `DB_PASSWORD`: Your MySQL database password.
    - `DB_NAME`: Your MySQL database name.
    - `JWT_SECRET`: A long, random, secure string for signing tokens.
    - `ENCRYPTION_KEY`: A secure, random 32-character string for data encryption. **Do not change this after setting it.**
    - `API_KEY`: Your Google Gemini API Key.
    - `GOOGLE_CLIENT_ID`: Your Google Cloud Console client ID for OAuth.
    - `GOOGLE_CLIENT_SECRET`: Your Google Cloud Console client secret for OAuth.
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: (Optional) Your email server settings for password resets.
    - `NEXTCLOUD_URL`: Your Nextcloud instance URL (e.g., `https://cloud.example.com`).
    - `NEXTCLOUD_SHARE_TOKEN`: WebDAV share token for study materials.
    - `NEXTCLOUD_SHARE_PASSWORD`: Password for the study materials WebDAV share.
    - `NEXTCLOUD_MUSIC_SHARE_TOKEN`: WebDAV share token for music.
    - `NEXTCLOUD_MUSIC_SHARE_PASSWORD`: Password for the music WebDAV share.
5.  **Deploy:** Trigger a new deployment from the Vercel dashboard. Vercel will build the frontend and set up the `api/index.js` file as a Serverless Function to handle all `/api` requests.
