
// This file acts as the entry point for Vercel's serverless functions.
// It imports the main Express app from server.js to ensure a single source of truth.
import app from '../server.js';

// Export the app for Vercel's runtime
export default app;
