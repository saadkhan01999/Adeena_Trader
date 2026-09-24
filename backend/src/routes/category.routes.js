/**
 * ============================================
 * Category Routes
 * ============================================
 */

import express from 'express';
import {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory,
  uploadCategoryImage, removeCategoryImage,
} from '../controllers/category.controller.js';
import { uploadImage } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.CATEGORIES), getCategories);
router.get('/:id', requirePermission(PERMISSIONS.CATEGORIES), getCategory);
router.post('/', requirePermission(PERMISSIONS.CATEGORIES), validateSchema({ body: createCategorySchema }), createCategory);
router.put('/:id', requirePermission(PERMISSIONS.CATEGORIES), validateSchema({ body: updateCategorySchema }), updateCategory);
router.delete('/:id', restrictTo('admin', 'manager'), requirePermission(PERMISSIONS.CATEGORIES), deleteCategory);

// The category picture. The folder is fixed here, not taken from the client.
const bucketAsCategories = (req, res, next) => { req.params.folder = 'categories'; next(); };
router.post('/:id/image', requirePermission(PERMISSIONS.CATEGORIES), bucketAsCategories, uploadImage.single('image'), uploadCategoryImage);
router.delete('/:id/image', requirePermission(PERMISSIONS.CATEGORIES), removeCategoryImage);

export default router;
