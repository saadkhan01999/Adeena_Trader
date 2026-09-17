/**
 * ============================================
 * Express Application
 * ============================================
 * Middleware pipeline, route mounting and error handling.
 *
 * Middleware order is deliberate and load-bearing:
 *   1. helmet          - security headers before anything can respond
 *   2. cors            - reject foreign origins before doing any work
 *   3. body parsers    - populate req.body
 *   4. mongoSanitize   - strip $ and . operators AFTER parsing, BEFORE any
 *                        handler can pass user input into a query
 *   5. compression     - wrap responses
 *   6. rate limiting   - applied to /api, with a stricter limit on /api/auth
 *   7. routes
 *   8. 404 then the error handler, always last
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import mongoose from 'mongoose';
import path from 'node:path';

import env from './config/env.js';

// ---- Routes ----------------------------------------------------------------
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import customerRoutes from './routes/customer.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import saleRoutes from './routes/sale.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import returnRoutes from './routes/return.routes.js';
import partnerRoutes from './routes/partner.routes.js';
import investorRoutes from './routes/investor.routes.js';
import zakatRoutes from './routes/zakat.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import agreementRoutes from './routes/agreement.routes.js';
import templateRoutes from './routes/template.routes.js';
import systemRoutes from './routes/system.routes.js';

import { errorHandler, notFound } from './middleware/error.js';
import { ensureUploadDir } from './middleware/upload.js';

const app = express();

// Behind a reverse proxy (nginx, Render, Railway) the client IP arrives in
// X-Forwarded-For. Without this, rate limiting would see every request as
// coming from the proxy and throttle all users together.
app.set('trust proxy', 1);

// ============================================================================
// 1. Security headers
// ============================================================================
app.use(
  helmet({
    // Uploaded images are served to a front-end on a different origin in dev
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // The SPA is served separately by Vite/nginx
  })
);

// ============================================================================
// 2. CORS
// ============================================================================

/**
 * Is this a local development origin?
 *
 * In development the dev server may land on a different port than expected -
 * Vite picks the next free one when 8000 is taken - and the resulting CORS
 * rejection looks like a broken login rather than a port collision. Any
 * loopback origin is therefore accepted while NODE_ENV is not production.
 * In production only the explicit allow-list applies.
 */
const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests and server-to-server calls carry no Origin header
      if (!origin) return callback(null, true);
      if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (env.isDevelopment && isLocalOrigin(origin)) return callback(null, true);

      return callback(
        new Error(
          `Origin ${origin} is not allowed by CORS policy. ` +
          `Add it to ALLOWED_ORIGINS in backend/.env.`
        )
      );
    },
    credentials: true, // Required for the refresh-token cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'], // So the browser can read export filenames
  })
);

// ============================================================================
// 3. Body parsing
// ============================================================================
// 12 MB accommodates a JSON restore payload; binary uploads go through multer
// and never pass through this parser.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());

// ============================================================================
// 4. NoSQL injection hardening
// ============================================================================
app.use(mongoSanitize({ replaceWith: '_' }));

// ============================================================================
// 5. Compression
// ============================================================================
app.use(compression());

// ============================================================================
// Request logging (development only)
// ============================================================================
if (env.isDevelopment) {
  app.use(morgan('dev'));
}

// ============================================================================
// 6. Rate limiting
// ============================================================================
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Login is the endpoint an attacker brute-forces, so it gets its own, much
// tighter budget. Successful logins are not counted, so a legitimate user
// working normally never runs into it.
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed sign-in attempts. Please wait a few minutes before trying again.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ============================================================================
// Static uploads
// ============================================================================
// Create the directory on boot rather than on first upload.
//
// This is best-effort. A serverless bundle is read-only apart from /tmp, and
// on a locked-down host the directory may not be creatable at all - but an
// upload is one feature among dozens, and throwing here would happen at import
// time and take the entire API down before it served a single request. The
// upload handlers fail loudly on their own if the directory really is missing.
try {
  ensureUploadDir();
} catch (error) {
  console.warn(`[UPLOADS] Could not prepare ${env.UPLOAD_DIR}: ${error.message}`);
  console.warn('[UPLOADS] File uploads will fail until a writable UPLOAD_DIR is configured.');
}

app.use(
  env.UPLOAD_URL_PATH,
  express.static(env.UPLOAD_DIR, {
    maxAge: '7d',        // Filenames are random and immutable, so caching is safe
    etag: true,
    index: false,        // Never serve a directory listing
    dotfiles: 'deny',
    setHeaders(res, filePath) {
      // Force PDFs and images to render/download rather than execute, and stop
      // a browser from MIME-sniffing an upload into something executable.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (path.extname(filePath).toLowerCase() === '.pdf') {
        res.setHeader('Content-Disposition', 'inline');
      }
    },
  })
);

// ============================================================================
// Health check - used by uptime monitors and the frontend's offline banner
// ============================================================================

/** Mongoose readyState as something a human can read in a browser tab. */
const DB_STATE = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.get('/api/health', (req, res) => {
  // Reported rather than required: this route deliberately does not touch the
  // database, so it still answers when the database is unreachable. That is the
  // point of it during a deployment - it separates "the API is not running" from
  // "the API is running and cannot reach MongoDB", which are two very different
  // problems with two very different fixes.
  const database = DB_STATE[mongoose.connection.readyState] || 'unknown';

  res.json({
    success: true,
    data: {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: 'ADEENA TRADERS API',
      version: '2.0.0',
      environment: env.NODE_ENV,
      database,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

// ============================================================================
// 7. API routes
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/zakat', zakatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/agreements', agreementRoutes);

// Both mounted at /api: templates + custom fields, then the system endpoints
// (dashboard, settings, notifications, reports, reminders, search, data).
app.use('/api', templateRoutes);
app.use('/api', systemRoutes);

// ============================================================================
// 8. 404 and error handling - must stay last
// ============================================================================
app.use(notFound);
app.use(errorHandler);

export default app;

