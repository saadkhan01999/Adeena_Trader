/**
 * ============================================
 * Product Controller
 * ============================================
 */

import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptors, removeUploadedFile } from '../middleware/upload.js';

/**
 * GET /api/products
 * List products with optional filtering, pagination, and search.
 */
export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    category,
    ownership,
    status,
    lowStock,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const query = {};

  // Text search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { model: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
      { imei1: { $regex: search, $options: 'i' } },
      { serialNumber: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) query.category = category;
  if (ownership) query.ownership = ownership;
  if (status) query.status = status;
  if (lowStock === 'true') query.stock = { $lte: 5, $gt: 0 };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [products, total] = await Promise.all([
    Product.find(query).populate('category', 'name icon').populate('partner', 'name ownershipPercent')
      .sort(sort).skip(skip).limit(parseInt(limit)),
    Product.countDocuments(query),
  ]);

  return sendSuccess(res, {
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      hasNext: skip + products.length < total,
    },
  });
});

/**
 * GET /api/products/:id
 */
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category')
    .populate('partner', 'name ownershipPercent');

  if (!product) throw new NotFoundError('Product');

  return sendSuccess(res, { product });
});

/**
 * POST /api/products
 */
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create({
    ...req.body,
    createdBy: req.user.id,
  });

  await logAudit({
    req,
    module: 'products',
    action: 'create',
    recordId: product._id.toString(),
    after: product.toObject(),
  });

  return sendSuccess(res, { product }, 201, 'Product created successfully.');
});

/**
 * PUT /api/products/:id
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const before = product.toObject();
  Object.assign(product, req.body);
  product.updatedBy = req.user.id;
  await product.save();

  await logAudit({
    req,
    module: 'products',
    action: 'update',
    recordId: product._id.toString(),
    before,
    after: product.toObject(),
  });

  return sendSuccess(res, { product }, 200, 'Product updated successfully.');
});

/**
 * DELETE /api/products/:id
 * Soft delete - archive instead of hard delete.
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  // Check if product has stock - can't delete, only archive
  if (product.stock > 0) {
    product.status = 'archived';
    await product.save();
    return sendSuccess(res, null, 200, 'Product archived (has stock, cannot be deleted).');
  }

  const before = product.toObject();
  await Product.findByIdAndDelete(req.params.id);

  await logAudit({
    req,
    module: 'products',
    action: 'delete',
    recordId: req.params.id,
    before,
  });

  return sendSuccess(res, null, 200, 'Product deleted successfully.');
});

/**
 * POST /api/products/:id/images
 * Attach one or more photos (max 10) to a product.
 *
 * Files are written to disk by the upload middleware; only the resulting URL
 * and metadata are stored on the product, which keeps the document small
 * enough to list hundreds of products in a single query.
 */
export const uploadProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('No images received. Attach a JPG, PNG or WEBP file.');
  }

  const descriptors = toFileDescriptors(req.files, req.uploadBucket);

  const newImages = descriptors.map((file, index) => ({
    ...file,
    // The first image on a product with no gallery becomes the cover shot
    isPrimary: product.images.length === 0 && index === 0,
  }));

  product.images.push(...newImages);
  await product.save();

  return sendSuccess(res, { product }, 201, `${newImages.length} image(s) uploaded.`);
});

/**
 * DELETE /api/products/:id/images/:index
 * Detach an image and delete the underlying file.
 */
export const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const index = parseInt(req.params.index, 10);
  if (Number.isNaN(index) || index < 0 || index >= product.images.length) {
    throw new BadRequestError('That image no longer exists.');
  }

  const [removed] = product.images.splice(index, 1);
  if (removed?.url) removeUploadedFile(removed.url);

  // Removing the cover shot promotes the next image, so a product is never
  // left with a gallery but no primary image.
  if (removed?.isPrimary && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }

  await product.save();
  return sendSuccess(res, { product }, 200, 'Image removed.');
});

/**
 * PUT /api/products/:id/images/:index/primary
 * Choose which photo represents the product in lists and on documents.
 */
export const setPrimaryImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const index = parseInt(req.params.index, 10);
  if (Number.isNaN(index) || index < 0 || index >= product.images.length) {
    throw new BadRequestError('That image no longer exists.');
  }

  product.images.forEach((img, i) => {
    img.isPrimary = i === index;
  });
  await product.save();

  return sendSuccess(res, { product }, 200, 'Cover image updated.');
});

/**
 * GET /api/products/low-stock
 * Products at or below their own reorder threshold, plus those out of stock.
 *
 * The threshold is read per product rather than hard-coded, so a shop that
 * keeps 50 phone covers but only 2 solar inverters gets sensible warnings for
 * both. `$expr` lets the comparison run against another field in the document.
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const [lowStock, outOfStock] = await Promise.all([
    Product.find({
      status: 'active',
      stock: { $gt: 0 },
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .populate('category', 'name')
      .sort({ stock: 1 }),

    Product.find({ stock: 0, status: { $ne: 'archived' } })
      .populate('category', 'name')
      .sort({ name: 1 }),
  ]);

  return sendSuccess(res, {
    lowStock,
    outOfStock,
    counts: { lowStock: lowStock.length, outOfStock: outOfStock.length },
  });
});
