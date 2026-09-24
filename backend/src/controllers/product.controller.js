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
import StockMovement from '../models/StockMovement.js';
import { parseNumber } from '../utils/financialEngine.js';

/** Escape user text before it goes into a RegExp - "Tecno Spark (8GB)" is a real name. */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every response that returns an item carries its category and partner, so the
 * screen can show "Solar Panels" beside a newly added item straight away,
 * instead of a bare id until the next reload.
 */
const withRelations = (query) =>
  query.populate('category', 'name icon image').populate('partner', 'name ownershipPercent');

/** "Low" means at or under the item's OWN threshold, and not already at zero. */
const LOW_STOCK_MATCH = {
  $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
};

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
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [
      { name: pattern }, { brand: pattern }, { model: pattern },
      { barcode: pattern }, { imei1: pattern }, { serialNumber: pattern }, { sku: pattern },
    ];
  }

  if (category && category !== 'all') query.category = category;
  if (ownership && ownership !== 'all') query.ownership = ownership;
  if (status && status !== 'all') query.status = status;
  if (lowStock === 'true') Object.assign(query, LOW_STOCK_MATCH);
  if (req.query.outOfStock === 'true') query.stock = { $lte: 0 };
  if (req.query.inStock === 'true') query.stock = { $gt: 0 };

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 500);
  const skip = (pageNumber - 1) * pageSize;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [products, total, totals] = await Promise.all([
    withRelations(Product.find(query)).sort(sort).skip(skip).limit(pageSize),
    Product.countDocuments(query),
    // Figures for the cards above the list - across ALL live items, not just
    // this page, so they do not change as the user pages through.
    Product.aggregate([
      { $match: { status: { $ne: 'archived' } } },
      {
        $group: {
          _id: null,
          items: { $sum: 1 },
          units: { $sum: '$stock' },
          costValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
          retailValue: { $sum: { $multiply: ['$cashPrice', '$stock'] } },
          lowStock: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }, 1, 0],
            },
          },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  return sendSuccess(res, {
    products,
    summary: totals[0]
      ? { ...totals[0], _id: undefined }
      : { items: 0, units: 0, costValue: 0, retailValue: 0, lowStock: 0, outOfStock: 0 },
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
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

  // The last few stock movements, so the detail view can show where the
  // current count came from.
  const movements = await StockMovement.find({ product: product._id })
    .sort({ movementDate: -1, createdAt: -1 })
    .limit(15)
    .lean();

  return sendSuccess(res, { product, movements });
});

/**
 * POST /api/products
 */
export const createProduct = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.body.category).select('_id');
  if (!category) throw new BadRequestError('Choose a category for this item.');

  const created = await Product.create({
    ...req.body,
    status: parseNumber(req.body.stock) > 0 || req.body.status === 'archived'
      ? (req.body.status || 'active')
      : 'out_of_stock',
    createdBy: req.user.id,
  });

  // An opening balance is a movement too, so the item's stock history adds up
  // from its first line.
  if (parseNumber(created.stock) > 0) {
    await StockMovement.create({
      product: created._id,
      productName: created.name,
      type: 'adjustment',
      quantity: created.stock,
      quantityBefore: 0,
      quantityAfter: created.stock,
      reference: 'Opening stock',
      notes: 'Stock entered when the item was added',
      movementDate: new Date(),
      createdBy: req.user.id,
    }).catch(() => {});
  }

  const product = await withRelations(Product.findById(created._id));

  await logAudit({
    req,
    module: 'products',
    action: 'create',
    recordId: product._id.toString(),
    after: product.toObject(),
  });

  return sendSuccess(res, { product }, 201, 'Item added to inventory.');
});

/**
 * PUT /api/products/:id
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const before = product.toObject();
  const stockBefore = parseNumber(product.stock);
  Object.assign(product, req.body);
  product.updatedBy = req.user.id;

  // Keep the status truthful about the shelf, unless it was archived on purpose.
  if (product.status !== 'archived') {
    product.status = parseNumber(product.stock) > 0 ? 'active' : 'out_of_stock';
  }
  await product.save();

  // A stock count typed into the edit form is a correction - record it, or the
  // stock history stops adding up to the number on the shelf.
  const stockAfter = parseNumber(product.stock);
  if (stockAfter !== stockBefore) {
    await StockMovement.create({
      product: product._id,
      productName: product.name,
      type: 'adjustment',
      quantity: stockAfter - stockBefore,
      quantityBefore: stockBefore,
      quantityAfter: stockAfter,
      reference: 'Manual correction',
      notes: 'Stock changed from the edit form',
      movementDate: new Date(),
      createdBy: req.user.id,
    }).catch(() => {});
  }

  await logAudit({
    req,
    module: 'products',
    action: 'update',
    recordId: product._id.toString(),
    before,
    after: product.toObject(),
  });

  const populated = await withRelations(Product.findById(product._id));
  return sendSuccess(res, { product: populated }, 200, 'Item updated.');
});

/**
 * DELETE /api/products/:id
 *
 * Permanent. The item, its photos and its stock history go. Past sales,
 * purchases and returns are untouched: their line items carry the product's
 * name and price, so an old invoice still prints correctly.
 *
 * To take an item off sale without losing it, edit it and set it to Archived.
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const before = product.toObject();
  for (const image of product.images || []) removeUploadedFile(image?.url || image);

  await StockMovement.deleteMany({ product: product._id });
  await Product.findByIdAndDelete(product._id);

  await logAudit({
    req,
    module: 'products',
    action: 'delete',
    recordId: req.params.id,
    before,
    reason: `Deleted ${product.name} permanently (stock at the time: ${product.stock})`,
  });

  return sendSuccess(res, null, 200, `"${product.name}" deleted permanently.`);
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

  const populated = await withRelations(Product.findById(product._id));
  return sendSuccess(res, { product: populated }, 201, `${newImages.length} image(s) uploaded.`);
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
  const populated = await withRelations(Product.findById(product._id));
  return sendSuccess(res, { product: populated }, 200, 'Image removed.');
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
    Product.find({ status: { $ne: 'archived' }, ...LOW_STOCK_MATCH })
      .populate('category', 'name')
      .sort({ stock: 1 }),

    Product.find({ stock: { $lte: 0 }, status: { $ne: 'archived' } })
      .populate('category', 'name')
      .sort({ name: 1 }),
  ]);

  return sendSuccess(res, {
    lowStock,
    outOfStock,
    counts: { lowStock: lowStock.length, outOfStock: outOfStock.length },
  });
});
