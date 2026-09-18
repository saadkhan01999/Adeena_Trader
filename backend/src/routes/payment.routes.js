/**
 * ============================================
 * Payment Routes
 * ============================================
 */

import express from 'express';
import {
  getPayments, getPayment, createPayment,
  reversePayment, removePayment,
} from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createPaymentSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.PAYMENTS), getPayments);
router.get('/:id', requirePermission(PERMISSIONS.PAYMENTS), getPayment);
router.post('/', requirePermission(PERMISSIONS.PAYMENTS), validateSchema({ body: createPaymentSchema }), createPayment);

router.patch('/:id/reverse', requirePermission(PERMISSIONS.PAYMENTS), reversePayment);
router.delete('/:id', restrictTo('admin'), removePayment);

export default router;
