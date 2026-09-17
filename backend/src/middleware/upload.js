/**
 * ============================================
 * File Upload Middleware (Multer, disk storage)
 * ============================================
 * Accepts JPG / JPEG / PNG / WEBP images and PDF documents.
 *
 * Why disk instead of base64-in-MongoDB
 * ------------------------------------
 * Base64 inflates every byte by ~33% and drags the binary through every query
 * that touches the document. Writing to disk keeps documents small, lets the
 * browser cache images normally, and means a 4 MB CNIC scan never slows down a
 * customer list. Records store a short relative URL (e.g. `/uploads/customers/
 * 2026-09/ab12….jpg`) instead of the payload.
 */

import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import env from '../config/env.js';
import { BadRequestError } from '../utils/AppError.js';
import { ALLOWED_UPLOAD_MIME } from '../constants/index.js';

// ----------------------------------------------------------------------------
// Directory helpers
// ----------------------------------------------------------------------------

/**
 * Uploads are bucketed by folder and month (`customers/2026-09`) so a single
 * directory never accumulates tens of thousands of entries, which slows down
 * filesystem listing and backup tooling.
 */
const resolveBucket = (folder = 'misc') => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Strip any path traversal attempt from the caller-supplied folder name
  const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  return path.join(safeFolder, month);
};

/** Create a directory tree if it does not exist yet. */
export const ensureUploadDir = (relativeBucket = '') => {
  const dir = path.join(env.UPLOAD_DIR, relativeBucket);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ----------------------------------------------------------------------------
// Storage engine
// ----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      // `folder` may arrive as a route param, query string or form field.
      const folder = req.params.folder || req.query.folder || req.body?.folder || 'misc';
      const bucket = resolveBucket(folder);
      req.uploadBucket = bucket; // Remembered so we can build the public URL
      cb(null, ensureUploadDir(bucket));
    } catch (error) {
      cb(error);
    }
  },
  filename(req, file, cb) {
    // Random name: prevents collisions, guessing, and leaking the original
    // filename (which often contains a customer's name).
    const ext = ALLOWED_UPLOAD_MIME[file.mimetype] || path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

// ----------------------------------------------------------------------------
// Filters
// ----------------------------------------------------------------------------
const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const imageOnly = (req, file, cb) => {
  if (IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new BadRequestError('Only JPG, JPEG, PNG and WEBP images are allowed.'));
};

const imageOrPdf = (req, file, cb) => {
  if (Object.keys(ALLOWED_UPLOAD_MIME).includes(file.mimetype)) return cb(null, true);
  cb(new BadRequestError('Only JPG, JPEG, PNG, WEBP and PDF files are allowed.'));
};

const limits = { fileSize: env.MAX_FILE_UPLOAD_MB * 1024 * 1024 };

// ----------------------------------------------------------------------------
// Exported uploaders
// ----------------------------------------------------------------------------

/** Single image (profile photo, logo, product cover). */
export const uploadImage = multer({ storage, fileFilter: imageOnly, limits });

/** Up to 10 images at once (product gallery). */
export const uploadImages = multer({
  storage,
  fileFilter: imageOnly,
  limits: { ...limits, files: 10 },
});

/** Image or PDF (CNIC scan, signed agreement, supplier bill). */
export const uploadDocument = multer({ storage, fileFilter: imageOrPdf, limits });

/** Mixed batch of images and PDFs. */
export const uploadDocuments = multer({
  storage,
  fileFilter: imageOrPdf,
  limits: { ...limits, files: 10 },
});

// ----------------------------------------------------------------------------
// Post-processing helpers
// ----------------------------------------------------------------------------

/**
 * Convert a stored multer file into the public descriptor saved on records.
 * Always returns forward slashes so the URL is valid on Windows too.
 *
 * @returns {{url:string, name:string, mimetype:string, size:number, uploadedAt:Date}|null}
 */
export const toFileDescriptor = (file, bucket = '') => {
  if (!file) return null;
  const relative = path.join(bucket || '', file.filename).split(path.sep).join('/');
  return {
    url: `${env.UPLOAD_URL_PATH}/${relative}`,
    name: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date(),
  };
};

/** Batch version of {@link toFileDescriptor}. */
export const toFileDescriptors = (files = [], bucket = '') =>
  (Array.isArray(files) ? files : []).map((f) => toFileDescriptor(f, bucket));

/**
 * Delete a previously uploaded file from disk.
 *
 * Safe by construction: the resolved path must stay inside UPLOAD_DIR, so a
 * crafted value such as `/uploads/../../.env` cannot escape the directory.
 * Missing files are ignored - deleting an already-deleted file is not an error.
 */
export const removeUploadedFile = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return false;
  if (!publicUrl.startsWith(env.UPLOAD_URL_PATH)) return false;

  const relative = publicUrl.slice(env.UPLOAD_URL_PATH.length).replace(/^\/+/, '');
  const absolute = path.resolve(env.UPLOAD_DIR, relative);

  if (!absolute.startsWith(path.resolve(env.UPLOAD_DIR))) return false;

  try {
    fs.unlinkSync(absolute);
    return true;
  } catch {
    return false;
  }
};
