/**
 * ============================================
 * Upload Controller
 * ============================================
 * Generic file intake for the whole application.
 *
 * One endpoint serves every screen. The client posts a file plus a `folder`
 * (customers, products, agreements, …) and receives a public URL to store on
 * whichever record it belongs to. That keeps upload handling out of a dozen
 * entity controllers and means file validation, size limits and path safety
 * are enforced in exactly one place.
 */

import path from 'node:path';
import fs from 'node:fs';
import env from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/AppError.js';
import { toFileDescriptor, toFileDescriptors, removeUploadedFile } from '../middleware/upload.js';

/**
 * POST /api/uploads/:folder
 * Upload a single image or PDF.
 *
 * @returns 201 { file: { url, name, mimetype, size, uploadedAt } }
 */
export const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('No file received. Attach a JPG, PNG, WEBP or PDF file.');
  }

  const file = toFileDescriptor(req.file, req.uploadBucket);
  return sendSuccess(res, { file }, 201, 'File uploaded successfully.');
});

/**
 * POST /api/uploads/:folder/multiple
 * Upload up to 10 files in one request (product galleries, agreement scans).
 *
 * @returns 201 { files: [...], count }
 */
export const uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('No files received. Attach at least one JPG, PNG, WEBP or PDF file.');
  }

  const files = toFileDescriptors(req.files, req.uploadBucket);
  return sendSuccess(res, { files, count: files.length }, 201, `${files.length} file(s) uploaded.`);
});

/**
 * DELETE /api/uploads?url=/uploads/customers/2026-09/abc.jpg
 * Remove a previously uploaded file from disk.
 *
 * Deleting an already-missing file is reported as success: the caller's intent
 * ("this file should not exist") is satisfied either way, and failing would
 * only block them from clearing the reference on their record.
 */
export const deleteUpload = asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) throw new BadRequestError('Provide the file url to delete.');

  const removed = removeUploadedFile(url);
  return sendSuccess(
    res,
    { removed },
    200,
    removed ? 'File deleted.' : 'File was already removed.'
  );
});

/**
 * GET /api/uploads/stats
 * Disk usage summary, shown in Settings > Data Management so an admin can see
 * how much space scans and product photos are consuming.
 */
export const getUploadStats = asyncHandler(async (req, res) => {
  /** Recursively total file count and bytes under a directory. */
  const walk = (dir) => {
    let files = 0;
    let bytes = 0;

    if (!fs.existsSync(dir)) return { files, bytes };

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = walk(full);
        files += nested.files;
        bytes += nested.bytes;
      } else {
        files += 1;
        bytes += fs.statSync(full).size;
      }
    }
    return { files, bytes };
  };

  const root = walk(env.UPLOAD_DIR);

  // Per-folder breakdown so the admin can see what is taking the space
  const folders = fs.existsSync(env.UPLOAD_DIR)
    ? fs
        .readdirSync(env.UPLOAD_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          const stats = walk(path.join(env.UPLOAD_DIR, e.name));
          return { folder: e.name, files: stats.files, bytes: stats.bytes };
        })
        .sort((a, b) => b.bytes - a.bytes)
    : [];

  return sendSuccess(res, {
    totalFiles: root.files,
    totalBytes: root.bytes,
    totalMB: Math.round((root.bytes / (1024 * 1024)) * 100) / 100,
    maxFileSizeMB: env.MAX_FILE_UPLOAD_MB,
    folders,
  });
});
