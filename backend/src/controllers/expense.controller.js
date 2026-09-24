/**
 * ============================================
 * Expense Controller
 * ============================================
 */

import Expense from '../models/Expense.js';
import { containsText, endOfDay } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';

export const getExpenses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', category, ownership, startDate, endDate, sortBy = 'expenseDate', sortOrder = 'desc' } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { description: containsText(search) },
      { category: containsText(search) },
      { paidTo: containsText(search) },
      { referenceNumber: containsText(search) },
    ];
  }
  if (category && category !== 'all') query.category = category;
  // Owner / partner lens: each side sees its own and the shared expenses.
  if (ownership && ownership !== 'all') query.ownership = { $in: [ownership, 'shared'] };
  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) query.expenseDate.$gte = new Date(startDate);
    if (endDate) query.expenseDate.$lte = endOfDay(endDate);
  }

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 500);
  const skip = (pageNumber - 1) * pageSize;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [expenses, total, byCategory] = await Promise.all([
    Expense.find(query).populate('partner', 'name').sort(sort).skip(skip).limit(pageSize),
    Expense.countDocuments(query),
    // Summary cards across every matching expense, not just this page.
    Expense.aggregate([
      { $match: query },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const summary = {
    total: byCategory.reduce((sum, row) => sum + row.total, 0),
    count: byCategory.reduce((sum, row) => sum + row.count, 0),
    topCategory: byCategory[0] ? { category: byCategory[0]._id, total: byCategory[0].total } : null,
    byCategory: byCategory.map((row) => ({ category: row._id, total: row.total, count: row.count })),
  };

  return sendSuccess(res, {
    expenses,
    summary,
    pagination: { page: pageNumber, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
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
