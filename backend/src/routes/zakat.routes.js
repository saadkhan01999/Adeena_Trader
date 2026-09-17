/**
 * ============================================
 * Zakat Routes
 * ============================================
 * Mounted at /api/zakat.
 *
 * Settings are admin-only (the Nisab basis and rate are the owner's religious
 * decision); calculating and viewing are open to anyone with the `zakat`
 * permission, so an accountant can prepare the workings.
 */

import express from 'express';
import {
  getZakatSettings, updateZakatSettings, previewNisab, getZakatableAssets,
  calculateZakatForOwner, getZakatHistory, getZakatCalculation,
  recordZakatPayment, deleteZakatCalculation,
} from '../controllers/zakat.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { updateZakatSettingsSchema, createZakatCalculationSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);
router.use(requirePermission(PERMISSIONS.ZAKAT));

// ---- Settings -------------------------------------------------------------
router.get('/settings', getZakatSettings);
router.put(
  '/settings',
  restrictTo('admin'),
  validateSchema({ body: updateZakatSettingsSchema }),
  updateZakatSettings
);
router.get('/nisab-preview', previewNisab);

// ---- Calculation ----------------------------------------------------------
// Live zakatable position, used to pre-fill the calculator
router.get('/assets', getZakatableAssets);
router.post('/calculate', validateSchema({ body: createZakatCalculationSchema }), calculateZakatForOwner);

// ---- History --------------------------------------------------------------
// `/history` precedes `/:id` so it is not matched as an id.
router.get('/history', getZakatHistory);
router.get('/:id', getZakatCalculation);
router.put('/:id/payment', recordZakatPayment);
router.delete('/:id', restrictTo('admin'), deleteZakatCalculation);

export default router;
