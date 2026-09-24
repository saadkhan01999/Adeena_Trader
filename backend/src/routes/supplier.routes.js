/**
 * ============================================
 * Supplier Routes
 * ============================================
 */

import express from 'express';
import {
  getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  paySupplier, getSupplierPayments, deleteSupplierPayment,
} from '../controllers/supplier.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.SUPPLIERS), getSuppliers);
router.get('/:id', requirePermission(PERMISSIONS.SUPPLIERS), getSupplier);
router.post('/', requirePermission(PERMISSIONS.SUPPLIERS), validateSchema({ body: createSupplierSchema }), createSupplier);
router.put('/:id', requirePermission(PERMISSIONS.SUPPLIERS), validateSchema({ body: updateSupplierSchema }), updateSupplier);
router.delete('/:id', restrictTo('admin', 'manager'), requirePermission(PERMISSIONS.SUPPLIERS), deleteSupplier);

// Paying what is owed
router.get('/:id/payments', requirePermission(PERMISSIONS.SUPPLIERS), getSupplierPayments);
router.post('/:id/payments', requirePermission(PERMISSIONS.SUPPLIERS), paySupplier);
router.delete('/:id/payments/:paymentId', requirePermission(PERMISSIONS.SUPPLIERS), restrictTo('admin', 'manager'), deleteSupplierPayment);

export default router;
