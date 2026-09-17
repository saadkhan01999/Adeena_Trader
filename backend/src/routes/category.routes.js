/**
 * ============================================
 * Category Routes
 * ============================================
 */

import express from 'express';
import { getCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.CATEGORIES), getCategories);
router.get('/:id', requirePermission(PERMISSIONS.CATEGORIES), getCategory);
router.post('/', requirePermission(PERMISSIONS.CATEGORIES), validateSchema({ body: createCategorySchema }), createCategory);
router.put('/:id', requirePermission(PERMISSIONS.CATEGORIES), validateSchema({ body: updateCategorySchema }), updateCategory);
router.delete('/:id', requirePermission(PERMISSIONS.CATEGORIES), deleteCategory);

export default router;
