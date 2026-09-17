/**
 * ============================================
 * Return Routes
 * ============================================
 */

import express from 'express';
import { getReturns, createReturn } from '../controllers/return.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createReturnSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.RETURNS), getReturns);
router.post('/', requirePermission(PERMISSIONS.RETURNS), validateSchema({ body: createReturnSchema }), createReturn);

export default router;
