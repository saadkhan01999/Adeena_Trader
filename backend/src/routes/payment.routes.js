/**
 * ============================================
 * Payment Routes
 * ============================================
 */

import express from 'express';
import { getPayments, getPayment, createPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createPaymentSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.PAYMENTS), getPayments);
router.get('/:id', requirePermission(PERMISSIONS.PAYMENTS), getPayment);
router.post('/', requirePermission(PERMISSIONS.PAYMENTS), validateSchema({ body: createPaymentSchema }), createPayment);

export default router;
