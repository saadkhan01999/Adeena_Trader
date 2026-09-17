/**
 * ============================================
 * Global Error Handler
 * ============================================
 * Converts every error the application can produce into one response shape:
 *
 *   { success: false, message, code, errors? }
 *
 * The messages are written for the shopkeeper who will read them on screen,
 * not for a stack trace. Internal detail (stack, driver text) is logged
 * server-side and never returned in production.
 */

import multer from 'multer';
import env from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Mongo duplicate key (E11000).
 * The field name is turned into something a user recognises.
 */
const handleDuplicateKey = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'value';
  const value = err.keyValue?.[field];

  const friendly = {
    email: 'email address',
    username: 'username',
    invoiceNumber: 'invoice number',
    receiptNumber: 'receipt number',
    agreementNumber: 'agreement number',
    cnic: 'CNIC',
    name: 'name',
    barcode: 'barcode',
  }[field] || field;

  return new AppError(
    value
      ? `That ${friendly} ("${value}") is already in use. Please choose a different one.`
      : `That ${friendly} is already in use.`,
    409,
    'DUPLICATE_KEY',
    [{ field, message: `${friendly} must be unique` }]
  );
};

/** Mongoose schema validation - surfaced as field-level errors for the form. */
const handleMongooseValidation = (err) => {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError('Please correct the highlighted fields.', 400, 'VALIDATION_ERROR', errors);
};

/** Invalid ObjectId or a value that cannot be cast to its schema type. */
const handleCastError = (err) =>
  new AppError(
    err.path === '_id'
      ? 'That record could not be found - the link or id may be incorrect.'
      : `"${err.value}" is not a valid value for ${err.path}.`,
    400,
    'INVALID_ID'
  );

/** A Zod error thrown outside the validation middleware. */
const handleZodError = (err) =>
  new AppError(
    'Please correct the highlighted fields.',
    400,
    'VALIDATION_ERROR',
    (err.errors || []).map((e) => ({ field: e.path.join('.'), message: e.message }))
  );

/**
 * Multer upload failures.
 * Without this, a file that is merely too large surfaces as a bare 500.
 */
const handleMulterError = (err) => {
  const messages = {
    LIMIT_FILE_SIZE: `That file is too large. The maximum size is ${env.MAX_FILE_UPLOAD_MB} MB.`,
    LIMIT_FILE_COUNT: 'Too many files. Please upload fewer at a time.',
    LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Please use the upload button on the form.',
    LIMIT_PART_COUNT: 'The upload contained too many parts.',
  };
  return new AppError(messages[err.code] || 'File upload failed.', 400, err.code || 'UPLOAD_ERROR');
};

/**
 * Every shape in which "the database is not reachable" arrives.
 *
 * The driver raises `MongoServerSelectionError`; Mongoose only re-labels it as
 * `MongooseServerSelectionError` in some versions. Matching one name alone lets
 * the other fall through to the generic 500 branch, and the raw driver text -
 * an OpenSSL alert string, for instance - is what the user then reads on the
 * sign-in screen.
 */
const isDatabaseUnreachable = (err) =>
  [
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoTimeoutError',
    'MongoNotConnectedError',
  ].includes(err.name);

/**
 * A MongoDB connection or timeout problem.
 *
 * A refused TLS handshake is called out separately. It is not a flaky link the
 * user should retry - it is the database declining this machine outright, and
 * on a hosted cluster the usual cause is an internet address that is no longer
 * on the access list.
 */
const handleMongoNetworkError = (err) => {
  const refusedTls = /alert (internal error|number 80)|SSL routines|ERR_SSL|tlsv1/i.test(
    err?.message || ''
  );

  return refusedTls
    ? new AppError(
        'The database refused the connection. The internet address of this computer may no ' +
        'longer be allowed by the database - please ask the administrator to check it.',
        503,
        'DATABASE_REFUSED'
      )
    : new AppError(
        'Cannot reach the database right now. Check your connection and try again.',
        503,
        'DATABASE_UNAVAILABLE'
      );
};

export const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof multer.MulterError) error = handleMulterError(err);
  else if (err.code === 11000) error = handleDuplicateKey(err);
  else if (err.name === 'ValidationError' && err.errors) error = handleMongooseValidation(err);
  else if (err.name === 'CastError') error = handleCastError(err);
  else if (err.name === 'ZodError') error = handleZodError(err);
  else if (isDatabaseUnreachable(err)) {
    error = handleMongoNetworkError(err);
  } else if (/not allowed by CORS/i.test(err.message || '')) {
    error = new AppError('This origin is not permitted to call the API.', 403, 'CORS_REJECTED');
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  // Never leak an internal failure's text to the client in production
  const message =
    statusCode >= 500 && env.isProduction
      ? 'Something went wrong on our side. Please try again.'
      : error.message || 'Something went wrong.';

  // Full detail in development; server errors only in production
  if (env.isDevelopment) {
    console.error('\n[ERROR]', {
      message: err.message,
      code,
      status: statusCode,
      path: `${req.method} ${req.originalUrl}`,
      user: req.user?.email || 'anonymous',
      stack: err.stack,
    });
  } else if (statusCode >= 500) {
    console.error('[ERROR]', {
      message: err.message,
      path: `${req.method} ${req.originalUrl}`,
      user: req.user?.email || 'anonymous',
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(error.errors && { errors: error.errors }),
    ...(env.isDevelopment && statusCode >= 500 && { stack: err.stack }),
  });
};

/** Anything that reached the end of the stack without matching a route. */
export const notFound = (req, res, next) => {
  next(new AppError(`No API route matches ${req.method} ${req.originalUrl}.`, 404, 'ROUTE_NOT_FOUND'));
};
