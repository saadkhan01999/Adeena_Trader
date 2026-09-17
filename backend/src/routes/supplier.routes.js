/**
 * ============================================
 * Supplier Routes
 * ============================================
 */

import express from 'express';
import { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.SUPPLIERS), getSuppliers);
router.get('/:id', requirePermission(PERMISSIONS.SUPPLIERS), getSupplier);
router.post('/', requirePermission(PERMISSIONS.SUPPLIERS), validateSchema({ body: createSupplierSchema }), createSupplier);
router.put('/:id', requirePermission(PERMISSIONS.SUPPLIERS), validateSchema({ body: updateSupplierSchema }), updateSupplier);
router.delete('/:id', requirePermission(PERMISSIONS.SUPPLIERS), deleteSupplier);

export default router;
