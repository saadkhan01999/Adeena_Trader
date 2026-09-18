/**
 * ============================================
 * Return Controller
 * ============================================
 */

import Return from '../models/Return.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { generateReturnNumber } from '../services/financial.service.js';
import { cancelReturn as cancelReturnRecord, deleteReturn as deleteReturnRecord } from '../services/reversal.service.js';

export const getReturns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', returnType, sortBy = 'returnDate', sortOrder = 'desc' } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { returnNumber: { $regex: search, $options: 'i' } },
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
    ];
  }
  if (returnType) query.returnType = returnType;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [returns, total] = await Promise.all([
    Return.find(query).populate('sale').populate('customer').populate('items.product')
      .sort(sort).skip(skip).limit(parseInt(limit)),
    Return.countDocuments(query),
  ]);

  return sendSuccess(res, {
    returns,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const createReturn = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.body.sale);
  if (!sale) throw new NotFoundError('Sale');

  const returnNumber = await generateReturnNumber();

  // Create return record
  const returnRecord = await Return.create({
    ...req.body,
    returnNumber,
    invoiceNumber: sale.invoiceNumber,
    customer: sale.customer,
    customerName: sale.customerName,
    status: 'completed',
    createdBy: req.user.id,
  });

  // Restore stock for returned items
  for (const item of req.body.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      if (product.status === 'out_of_stock' && product.stock > 0) {
        product.status = 'active';
      }
      await product.save();
    }

    // For exchange: decrement new product stock
    if (req.body.returnType === 'exchange' && item.exchangeProduct) {
      const newProduct = await Product.findById(item.exchangeProduct);
      if (newProduct) {
        if (newProduct.stock < 1) {
          throw new BadRequestError(`Insufficient stock for exchange product: ${newProduct.name}`);
        }
        newProduct.stock -= 1;
        await newProduct.save();
      }
    }
  }

  // Update sale status
  sale.status = 'returned';
  await sale.save();

  await logAudit({ req, module: 'returns', action: 'create', recordId: returnRecord._id.toString(), after: returnRecord.toObject() });
  return sendSuccess(res, { return: returnRecord }, 201, `Return recorded. Number: ${returnNumber}`);
});

// ============================================================================
// Reversal
// ============================================================================

/** Reverse a return: the goods go back out and the sale stops reading returned. */
export const cancelReturn = asyncHandler(async (req, res) => {
  const record = await cancelReturnRecord(req.params.id, req.user, req.body?.reason || '');

  await logAudit({
    req, module: 'returns', action: 'reverse', recordId: req.params.id,
    after: record.toObject(), reason: req.body?.reason || 'Return reversed',
  });

  return sendSuccess(res, { return: record }, 200, `Return ${record.returnNumber} reversed.`);
});

/** Permanently remove a return. Admin only - see the route. */
export const removeReturn = asyncHandler(async (req, res) => {
  const before = await Return.findById(req.params.id);
  const { returnNumber } = await deleteReturnRecord(req.params.id, req.user);

  await logAudit({
    req, module: 'returns', action: 'delete', recordId: req.params.id,
    before: before?.toObject(), reason: req.body?.reason || 'Return deleted by admin',
  });

  return sendSuccess(res, null, 200, `Return ${returnNumber} deleted and fully reversed.`);
});
