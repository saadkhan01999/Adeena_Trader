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
// Runtime shape
// ----------------------------------------------------------------------------

/**
 * Are we running as a serverless function (Vercel, Lambda) rather than as a
 * long-lived server?
 *
 * This changes three things that would otherwise fail in confusing ways:
 *   - a misconfiguration must throw, not `process.exit` (see `fail` below);
 *   - the filesystem is read-only apart from /tmp;
 *   - the browser talks to the API on a different origin than the SPA, so the
 *     refresh cookie has to be cross-site.
 */
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

/**
 * Report a fatal configuration problem.
 *
 * On a normal server `process.exit(1)` is right: the operator is watching a
 * terminal and a non-zero exit is how a supervisor knows not to restart into
 * the same broken state. Inside a serverless function it is actively harmful -
 * the platform reports it as an opaque crash with none of the text below, so
 * the person reads "FUNCTION_INVOCATION_FAILED" and learns nothing. Throwing
 * puts the message in the function log where they will actually find it.
 */
const fail = (lines) => {
  const message = Array.isArray(lines) ? lines.join('\n') : String(lines);
  console.error(`\n[CONFIG] ${message}\n`);
  if (isServerless) throw new Error(`[CONFIG] ${message}`);
  process.exit(1);
};

// ----------------------------------------------------------------------------
// Fail fast on missing secrets
// ----------------------------------------------------------------------------
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  fail([
    `Missing required environment variable(s): ${missing.join(', ')}`,
    isServerless
      ? 'Set them under Project Settings -> Environment Variables, then redeploy.'
      : 'Copy backend/.env.example to backend/.env and fill in the values.',
  ]);
}

const isProduction = process.env.NODE_ENV === 'production';

// In production, refuse to run on weak secrets - a 32-char minimum keeps the
// HMAC key larger than the SHA-256 block truncation point.
if (isProduction) {
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (process.env[key].length < 32) {
      fail(`${key} must be at least 32 characters in production.`);
    }
  }
}

/**
 * Parse a comma-separated origin list.
 * Supports several front-ends (dev server, LAN IP, deployed domain).
 */
const parseOrigins = (raw, fallback) => {
  const list = raw ? raw.split(',') : fallback;
  // A trailing slash makes an origin that never matches, because the browser
  // never sends one - trimming it here turns a common typo into a no-op rather
  // than a rejected login. Duplicates are dropped so the log line printed on a
  // refusal stays readable.
  return [...new Set(list.map((o) => String(o).trim().replace(/\/+$/, '')).filter(Boolean))];
};

// ----------------------------------------------------------------------------
// Refresh-cookie policy
// ----------------------------------------------------------------------------

/**
 * An explicit SameSite override, or null to decide per request.
 *
 * SameSite cannot be settled from configuration alone, because the right answer
 * depends on who is asking: `strict` is correct when the SPA and the API share
 * a host, and fatal when they do not - the browser quietly declines to send the
 * cookie, so every user is signed out the moment their 15-minute access token
 * expires, with nothing in any log to explain it.
 *
 * Deployments come in both shapes (one nginx serving both, versus Vercel for
 * the SPA and Railway for the API), and a single build can serve both at once.
 * So the decision moved to utils/cookiePolicy.js, which compares the request's
 * Origin against the host it arrived on. This value only exists to force a
 * specific answer when you know better than that comparison does.
 */
const COOKIE_SAME_SITE = (() => {
  const explicit = String(process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  return ['none', 'lax', 'strict'].includes(explicit) ? explicit : null;
})();

// ----------------------------------------------------------------------------
// CORS allow-list
// ----------------------------------------------------------------------------

/**
 * The deployed front-end.
 *
 * Kept as the default so a fresh clone or a redeploy works before anyone opens
 * a hosting dashboard. ALLOWED_ORIGINS overrides it completely - set that (and
 * CLIENT_URL) when you deploy this somewhere else, rather than editing here.
 */
const PRODUCTION_CLIENT_URL = 'https://adeena-trader-frontend.vercel.app';

/**
 * Turn one allow-list entry into a matcher.
 *
 * A plain origin matches exactly. An entry containing `*` becomes a pattern, so
 * that preview deployments - which get a fresh hostname every push and could
 * never be listed individually - can sign in:
 *
 *   https://adeena-trader-frontend-*.vercel.app
 *
 * `*` deliberately does not match a dot, so a narrow pattern stays narrow and
 * cannot be widened by a crafted subdomain. Keep the prefix specific: an entry
 * as broad as `https://*.vercel.app` would let anybody's Vercel project make
 * credentialed calls to this API.
 */
const toOriginMatcher = (entry) => {
  if (!entry.includes('*')) return (origin) => origin === entry;

  const pattern = new RegExp(
    `^${entry.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^./]*')}$`,
    'i'
  );
  return (origin) => pattern.test(origin);
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  /** Primary front-end origin (used for links inside generated messages). */
  CLIENT_URL: process.env.CLIENT_URL || (isProduction ? PRODUCTION_CLIENT_URL : 'http://localhost:8000'),

  /** Every origin allowed through CORS. */
  ALLOWED_ORIGINS: parseOrigins(process.env.ALLOWED_ORIGINS, [
    process.env.CLIENT_URL || PRODUCTION_CLIENT_URL,
    PRODUCTION_CLIENT_URL,
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

  /** Explicit SameSite override for the refresh cookie, or null to auto-detect. */
  COOKIE_SAME_SITE,

  // ----------------------------------------------------------------------
  // File uploads
  // Files are written to disk and served from /uploads, so MongoDB documents
  // stay small and images stream with normal HTTP caching.
  //
  // On serverless the bundle is read-only and only /tmp can be written, so the
  // directory moves there. Note that /tmp is per-instance and is discarded when
  // the instance is recycled: uploads do NOT survive on Vercel. Point
  // UPLOAD_DIR at a persistent volume, or move uploads to object storage (S3,
  // Cloudinary, UploadThing), before relying on them in production.
  // ----------------------------------------------------------------------
  UPLOAD_DIR: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : isServerless
      ? path.join('/tmp', 'uploads')
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
  /** Shared secret Vercel Cron presents when it calls the sweep endpoint. */
  CRON_SECRET: process.env.CRON_SECRET || '',

  // Bootstrap admin (only used by `npm run seed` on an empty database)
  DEFAULT_ADMIN_NAME: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
  DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL || 'admin@adeenatraders.com',
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe@123',

  isProduction,
  isDevelopment: !isProduction,
  isServerless,
};

/**
 * Is this browser Origin allowed to make credentialed calls to the API?
 *
 * Built once at startup rather than per request: the allow-list never changes
 * while the process is alive, and CORS runs ahead of every single route.
 */
const matchers = env.ALLOWED_ORIGINS.map(toOriginMatcher);

export const isAllowedOrigin = (origin) =>
  Boolean(origin) && matchers.some((match) => match(origin));

export default env;
