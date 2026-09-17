/**
 * ============================================
 * Sale Routes
 * ============================================
 * Mounted at /api/sales.
 */

import express from 'express';
import {
  getSales, getSale, createSale, issueAgreement, getOverdueInstallments,
} from '../controllers/sale.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createSaleSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);

// The installment worklist is permissioned separately: an accountant chases
// payments without needing the right to create sales.
router.get('/overdue/list', requirePermission(PERMISSIONS.INSTALLMENTS), getOverdueInstallments);

router.get('/', requirePermission(PERMISSIONS.SALES), getSales);
router.get('/:id', requirePermission(PERMISSIONS.SALES), getSale);
router.post('/', requirePermission(PERMISSIONS.SALES), validateSchema({ body: createSaleSchema }), createSale);
router.post('/:id/agreement', requirePermission(PERMISSIONS.AGREEMENTS), issueAgreement);

export default router;
