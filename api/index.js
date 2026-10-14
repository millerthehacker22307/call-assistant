'use strict';
/**
 * Vercel serverless entry point.
 *
 * Vercel deploys every file under api/ as a serverless function. This file
 * simply re-exports the Express app defined in server.js — server.js only
 * calls listen() when run directly, so requiring it here is safe.
 *
 * vercel.json rewrites /voice/* and /api/* to this function; the function
 * still receives the ORIGINAL request path, so the Express routes match
 * unchanged. Everything else (/, /test-call.html, ...) is served as static
 * files from public/ by Vercel — the app is not involved.
 *
 * Locally this file is unused: `npm start` runs server.js as before.
 */
const app = require('../server');

module.exports = app;
