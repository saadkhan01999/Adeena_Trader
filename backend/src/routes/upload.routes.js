/**
 * ============================================
 * Upload Routes
 * ============================================
 * Mounted at /api/uploads.
 *
 * `:folder` buckets files by the module that owns them (customers, products,
 * agreements, expenses, business, users). The value is sanitised inside the
 * multer storage engine, so a crafted folder name cannot escape the upload
 * directory.
 */

import express from 'express';
import {
  uploadSingle, uploadMultiple, deleteUpload, getUploadStats,
} from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.js';
import { restrictTo } from '../middleware/rbac.js';
import { uploadDocument, uploadDocuments } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

/** Disk usage summary for Settings > Data Management. */
router.get('/stats', restrictTo('admin'), getUploadStats);

/** Remove a file. Declared before the :folder routes so it is not shadowed. */
router.delete('/', deleteUpload);

/** POST /api/uploads/:folder/multiple - up to 10 images or PDFs. */
router.post('/:folder/multiple', uploadDocuments.array('files', 10), uploadMultiple);

/** POST /api/uploads/:folder - a single image or PDF. */
router.post('/:folder', uploadDocument.single('file'), uploadSingle);

export default router;
