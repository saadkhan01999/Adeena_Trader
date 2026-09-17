/**
 * ============================================
 * Category Controller
 * ============================================
 */

import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) query.name = { $regex: search, $options: 'i' };

  const categories = await Category.find(query).sort({ displayOrder: 1, name: 1 });

  // Attach product count and stock value for each category
  const categoriesWithStats = await Promise.all(
    categories.map(async (cat) => {
      const products = await Product.find({ category: cat._id, status: { $ne: 'archived' } });
      const productCount = products.length;
      const stockValue = products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0);
      const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
      return {
        ...cat.toObject(),
        productCount,
        stockValue,
        totalStock,
      };
    })
  );

  return sendSuccess(res, { categories: categoriesWithStats });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  const products = await Product.find({ category: category._id }).populate('partner', 'name');
  return sendSuccess(res, { category, products });
});

export const createCategory = asyncHandler(async (req, res) => {
  const existing = await Category.findOne({ name: { $regex: new RegExp(`^${req.body.name}$`, 'i') } });
  if (existing) throw new BadRequestError('Category with this name already exists.');

  const category = await Category.create(req.body);

  await logAudit({
    req,
    module: 'categories',
    action: 'create',
    recordId: category._id.toString(),
    after: category.toObject(),
  });

  return sendSuccess(res, { category }, 201, 'Category created successfully.');
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  const before = category.toObject();
  Object.assign(category, req.body);
  await category.save();

  await logAudit({
    req,
    module: 'categories',
    action: 'update',
    recordId: category._id.toString(),
    before,
    after: category.toObject(),
  });

  return sendSuccess(res, { category }, 200, 'Category updated successfully.');
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  // Check if any products use this category
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    // Archive instead of delete
    category.status = 'archived';
    await category.save();
    return sendSuccess(res, null, 200, `Category archived (${productCount} products linked).`);
  }

  await Category.findByIdAndDelete(req.params.id);

  await logAudit({
    req,
    module: 'categories',
    action: 'delete',
    recordId: req.params.id,
    before: category.toObject(),
  });

  return sendSuccess(res, null, 200, 'Category deleted successfully.');
});
