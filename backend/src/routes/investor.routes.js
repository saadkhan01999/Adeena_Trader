/**
 * ============================================
 * Investor Routes
 * ============================================
 * NOTE: Investors are NOT part of Zakat.
 */

import express from 'express';
import {
  getInvestors, getInvestor, createInvestor, updateInvestor, deleteInvestor,
  addInvestment, recordPayout, getInvestorDashboard,
} from '../controllers/investor.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createInvestorSchema, updateInvestorSchema, createInvestmentSchema, createInvestorPayoutSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.INVESTORS), getInvestors);
router.get('/dashboard', requirePermission(PERMISSIONS.INVESTORS), getInvestorDashboard);
router.get('/:id', requirePermission(PERMISSIONS.INVESTORS), getInvestor);

router.post('/', requirePermission(PERMISSIONS.INVESTORS), validateSchema({ body: createInvestorSchema }), createInvestor);
router.put('/:id', requirePermission(PERMISSIONS.INVESTORS), validateSchema({ body: updateInvestorSchema }), updateInvestor);
router.delete('/:id', requirePermission(PERMISSIONS.INVESTORS), deleteInvestor);

router.post('/:id/investments', requirePermission(PERMISSIONS.INVESTORS), validateSchema({ body: createInvestmentSchema }), addInvestment);
router.post('/:id/payouts', requirePermission(PERMISSIONS.INVESTORS), validateSchema({ body: createInvestorPayoutSchema }), recordPayout);

export default router;
