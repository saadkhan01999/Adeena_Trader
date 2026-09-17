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
