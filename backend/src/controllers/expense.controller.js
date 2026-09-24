/**
 * ============================================
 * Expense Controller
 * ============================================
 */

import Expense from '../models/Expense.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';

export const getExpenses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', category, ownership, startDate, endDate, sortBy = 'expenseDate', sortOrder = 'desc' } = req.query;
  const query = {};
  if (search) query.description = containsText(search);
  if (category) query.category = category;
  if (ownership) query.ownership = ownership;
  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) query.expenseDate.$gte = new Date(startDate);
    if (endDate) query.expenseDate.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [expenses, total] = await Promise.all([
    Expense.find(query).populate('partner', 'name').sort(sort).skip(skip).limit(parseInt(limit)),
    Expense.countDocuments(query),
  ]);

  return sendSuccess(res, {
    expenses,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, createdBy: req.user.id });
  await logAudit({ req, module: 'expenses', action: 'create', recordId: expense._id.toString(), after: expense.toObject() });
  return sendSuccess(res, { expense }, 201, 'Expense recorded successfully.');
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new NotFoundError('Expense');
  const before = expense.toObject();
  Object.assign(expense, req.body);
  await expense.save();
  await logAudit({ req, module: 'expenses', action: 'update', recordId: expense._id.toString(), before, after: expense.toObject() });
  return sendSuccess(res, { expense }, 200, 'Expense updated successfully.');
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new NotFoundError('Expense');
  await Expense.findByIdAndDelete(req.params.id);
  await logAudit({ req, module: 'expenses', action: 'delete', recordId: req.params.id, before: expense.toObject() });
  return sendSuccess(res, null, 200, 'Expense deleted successfully.');
});
