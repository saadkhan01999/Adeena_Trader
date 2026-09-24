/**
 * ============================================
 * Return Routes
 * ============================================
 */

import express from 'express';
import { updateReturnDetails, getReturnById } from '../controllers/details.controller.js';
import {
  getReturns, createReturn,
  cancelReturn, removeReturn,
} from '../controllers/return.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createReturnSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.RETURNS), getReturns);
router.post('/', requirePermission(PERMISSIONS.RETURNS), validateSchema({ body: createReturnSchema }), createReturn);

router.get('/:id', requirePermission(PERMISSIONS.RETURNS), getReturnById);
router.put('/:id', requirePermission(PERMISSIONS.RETURNS), updateReturnDetails);
router.patch('/:id/reverse', requirePermission(PERMISSIONS.RETURNS), cancelReturn);
router.delete('/:id', restrictTo('admin'), removeReturn);

export default router;
