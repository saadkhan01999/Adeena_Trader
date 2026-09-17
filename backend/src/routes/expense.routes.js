/**
 * ============================================
 * Expense Routes
 * ============================================
 */

import express from 'express';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createExpenseSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.EXPENSES), getExpenses);
router.post('/', requirePermission(PERMISSIONS.EXPENSES), validateSchema({ body: createExpenseSchema }), createExpense);
router.put('/:id', requirePermission(PERMISSIONS.EXPENSES), updateExpense);
router.delete('/:id', requirePermission(PERMISSIONS.EXPENSES), deleteExpense);

export default router;
