/**
 * ============================================
 * Category Controller
 * ============================================
 */

import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  NotFoundError, BadRequestError, LinkedRecordsError, describeLinks, summariseLinks, isForced,
} from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, removeUploadedFile } from '../middleware/upload.js';

/** Escape user text before it goes into a RegExp - "Mobiles (New)" is a valid name. */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getCategories = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;
  if (search) query.name = { $regex: escapeRegex(search), $options: 'i' };

  // One aggregate for every category's figures, instead of loading every
  // product of every category into memory one category at a time.
  const [categories, stats] = await Promise.all([
    Category.find(query).sort({ displayOrder: 1, name: 1 }).lean(),
    Product.aggregate([
      { $match: { status: { $ne: 'archived' } } },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          stockValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }, 1, 0],
            },
          },
          outOfStockCount: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const byCategory = new Map(stats.map((row) => [String(row._id), row]));
  const categoriesWithStats = categories.map((category) => {
    const row = byCategory.get(String(category._id)) || {};
    return {
      ...category,
      productCount: row.productCount || 0,
      totalStock: row.totalStock || 0,
      stockValue: row.stockValue || 0,
      lowStockCount: row.lowStockCount || 0,
      outOfStockCount: row.outOfStockCount || 0,
    };
  });

  return sendSuccess(res, { categories: categoriesWithStats });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  const products = await Product.find({ category: category._id }).populate('partner', 'name');
  return sendSuccess(res, { category, products });
});

export const createCategory = asyncHandler(async (req, res) => {
  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
  });
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

/**
 * DELETE /api/categories/:id[?moveTo=<categoryId>][&force=true]
 *
 * A category with no items is deleted outright. One that still holds items is
 * refused with the count, and the screen then offers two ways on:
 *
 *   ?moveTo=<id>  move the items to another category first, then delete - the
 *                 usual case ("merge Solar Panels into Solar")
 *   ?force=true   delete the category AND the items in it. Past sales keep
 *                 their line items, which carry the product name and price.
 *
 * It is never silently archived any more: the shop asked for delete to mean
 * delete, and an archive that reported "deleted" left the row reappearing.
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  const productCount = await Product.countDocuments({ category: category._id });
  let outcome = 'Category deleted permanently.';

  if (productCount > 0) {
    const { moveTo } = req.query;

    if (moveTo) {
      if (String(moveTo) === String(category._id)) {
        throw new BadRequestError('Choose a different category to move the items to.');
      }
      const target = await Category.findById(moveTo);
      if (!target) throw new NotFoundError('The category to move the items to');

      await Product.updateMany({ category: category._id }, { $set: { category: target._id } });
      outcome = `Category deleted. ${productCount} item(s) moved to "${target.name}".`;
    } else if (isForced(req)) {
      const products = await Product.find({ category: category._id }).select('images');
      for (const product of products) {
        for (const image of product.images || []) removeUploadedFile(image?.url || image);
      }
      await Product.deleteMany({ category: category._id });
      outcome = `Category and its ${productCount} item(s) deleted permanently.`;
    } else {
      const links = describeLinks({ 'inventory items': productCount });
      throw new LinkedRecordsError(
        `"${category.name}" still holds ${summariseLinks(links)}.`,
        links,
        'Move the items to another category, or delete them together with the category.'
      );
    }
  }

  if (category.image) removeUploadedFile(category.image);
  await Category.findByIdAndDelete(category._id);

  await logAudit({
    req,
    module: 'categories',
    action: 'delete',
    recordId: req.params.id,
    before: category.toObject(),
    reason: outcome,
  });

  return sendSuccess(res, null, 200, outcome);
});

/**
 * POST /api/categories/:id/image
 * Set the category's picture, replacing any previous one.
 */
export const uploadCategoryImage = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');
  if (!req.file) throw new BadRequestError('No image received. Attach a JPG, PNG or WEBP file.');

  if (category.image) removeUploadedFile(category.image);
  category.image = toFileDescriptor(req.file, req.uploadBucket).url;
  await category.save();

  return sendSuccess(res, { category }, 200, 'Category picture saved.');
});

/** DELETE /api/categories/:id/image */
export const removeCategoryImage = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  if (category.image) removeUploadedFile(category.image);
  category.image = null;
  await category.save();

  return sendSuccess(res, { category }, 200, 'Category picture removed.');
});
