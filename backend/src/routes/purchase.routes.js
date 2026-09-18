/**
 * ============================================
 * Purchase Routes
 * ============================================
 */

import express from 'express';
import {
  getPurchases, getPurchase, createPurchase,
  cancelPurchase, removePurchase,
} from '../controllers/purchase.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createPurchaseSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.PURCHASES), getPurchases);
router.get('/:id', requirePermission(PERMISSIONS.PURCHASES), getPurchase);
router.post('/', requirePermission(PERMISSIONS.PURCHASES), validateSchema({ body: createPurchaseSchema }), createPurchase);

router.patch('/:id/cancel', requirePermission(PERMISSIONS.PURCHASES), cancelPurchase);
router.delete('/:id', restrictTo('admin'), removePurchase);

export default router;
