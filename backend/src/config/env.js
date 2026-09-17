/**
 * ============================================
 * Environment Configuration
 * ============================================
 * Centralised, validated env loader. Boots loudly and early rather than
 * failing deep inside a request handler.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Backend root (…/backend), used to resolve the upload directory. */
const BACKEND_ROOT = path.resolve(__dirname, '../..');

// ----------------------------------------------------------------------------
// Fail fast on missing secrets
// ----------------------------------------------------------------------------
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n[CONFIG] Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('[CONFIG] Copy backend/.env.example to backend/.env and fill in the values.\n');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

// In production, refuse to run on weak secrets - a 32-char minimum keeps the
// HMAC key larger than the SHA-256 block truncation point.
if (isProduction) {
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (process.env[key].length < 32) {
      console.error(`\n[CONFIG] ${key} must be at least 32 characters in production.\n`);
      process.exit(1);
    }
  }
}

/**
 * Parse a comma-separated origin list.
 * Supports several front-ends (dev server, LAN IP, deployed domain).
 */
const parseOrigins = (raw, fallback) => {
  if (!raw) return fallback;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  /** Primary front-end origin (used for links inside generated messages). */
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:8000',

  /** Every origin allowed through CORS. */
  ALLOWED_ORIGINS: parseOrigins(process.env.ALLOWED_ORIGINS, [
    process.env.CLIENT_URL || 'http://localhost:8000',
    https://adeena-trader-frontend.vercel.app
    'http://localhost:8000',
    'http://localhost:5173',
    'http://127.0.0.1:8000',
  ]),

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  COOKIE_EXPIRES_DAYS: parseInt(process.env.COOKIE_EXPIRES_DAYS, 10) || 7,

  // ----------------------------------------------------------------------
  // File uploads
  // Files are written to disk and served from /uploads, so MongoDB documents
  // stay small and images stream with normal HTTP caching.
  // ----------------------------------------------------------------------
  UPLOAD_DIR: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(BACKEND_ROOT, 'uploads'),
  UPLOAD_URL_PATH: '/uploads',
  MAX_FILE_UPLOAD_MB: parseInt(process.env.MAX_FILE_UPLOAD_MB, 10) || 8,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 600,
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,

  // Background jobs
  /** How often the notification sweep runs, in minutes. 0 disables it. */
  NOTIFICATION_SWEEP_MINUTES: parseInt(process.env.NOTIFICATION_SWEEP_MINUTES, 10) || 30,

  // Bootstrap admin (only used by `npm run seed` on an empty database)
  DEFAULT_ADMIN_NAME: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
  DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL || 'admin@adeenatraders.com',
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe@123',

  isProduction,
  isDevelopment: !isProduction,
};

export default env;
