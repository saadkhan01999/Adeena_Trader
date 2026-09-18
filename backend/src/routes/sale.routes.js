/**
 * ============================================
 * Sale Routes
 * ============================================
 * Mounted at /api/sales.
 */

import express from 'express';
import {
  getSales, getSale, createSale, issueAgreement, getOverdueInstallments,
  cancelSale, removeSale,
} from '../controllers/sale.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
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

// Cancelling reverses the sale but keeps the invoice in history. Deleting is
// admin-only, because it removes the record itself.
router.patch('/:id/cancel', requirePermission(PERMISSIONS.SALES), cancelSale);
router.delete('/:id', restrictTo('admin'), removeSale);

export default router;
