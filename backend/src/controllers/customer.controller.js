/**
 * ============================================
 * Customer Controller
 * ============================================
 */

import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, toFileDescriptors, removeUploadedFile } from '../middleware/upload.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search = '', status, sortBy = 'createdAt', sortOrder = 'desc',
  } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { cnic: { $regex: search, $options: 'i' } },
      { mobile1: { $regex: search, $options: 'i' } },
      { mobile2: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [customers, total] = await Promise.all([
    Customer.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
    Customer.countDocuments(query),
  ]);

  return sendSuccess(res, {
    customers,
    pagination: {
      page: parseInt(page), limit: parseInt(limit), total,
      totalPages: Math.ceil(total / parseInt(limit)),
      hasNext: skip + customers.length < total,
    },
  });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  // Get recent sales and payments
  const [sales, payments, ledger] = await Promise.all([
    Sale.find({ customer: customer._id }).sort({ saleDate: -1 }).limit(10),
    Payment.find({ customer: customer._id }).sort({ paymentDate: -1 }).limit(10),
    LedgerEntry.find({ entityType: 'customer', entityId: customer._id }).sort({ entryDate: -1 }).limit(20),
  ]);

  return sendSuccess(res, { customer, recentSales: sales, recentPayments: payments, ledger });
});

export const getCustomerLedger = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [entries, total] = await Promise.all([
    LedgerEntry.find({ entityType: 'customer', entityId: req.params.id })
      .sort({ entryDate: -1 }).skip(skip).limit(parseInt(limit)),
    LedgerEntry.countDocuments({ entityType: 'customer', entityId: req.params.id }),
  ]);

  return sendSuccess(res, {
    entries,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);

  await logAudit({
    req, module: 'customers', action: 'create',
    recordId: customer._id.toString(), after: customer.toObject(),
  });

  return sendSuccess(res, { customer }, 201, 'Customer created successfully.');
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  const before = customer.toObject();
  Object.assign(customer, req.body);
  await customer.save();

  await logAudit({
    req, module: 'customers', action: 'update',
    recordId: customer._id.toString(), before, after: customer.toObject(),
  });

  return sendSuccess(res, { customer }, 200, 'Customer updated successfully.');
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  // Check for existing sales - can't hard delete
  const saleCount = await Sale.countDocuments({ customer: customer._id });
  if (saleCount > 0) {
    customer.status = 'inactive';
    await customer.save();
    return sendSuccess(res, null, 200, `Customer deactivated (${saleCount} sales linked).`);
  }

  await Customer.findByIdAndDelete(req.params.id);
  await logAudit({ req, module: 'customers', action: 'delete', recordId: req.params.id, before: customer.toObject() });

  return sendSuccess(res, null, 200, 'Customer deleted successfully.');
});

/**
 * POST /api/customers/:id/photo?field=photo|cnicFrontPhoto|cnicBackPhoto
 * Replace one of a customer's three identity images.
 *
 * The field comes from the query string rather than the form body: multer
 * parses text fields only after the file, so `req.body` is not yet populated
 * when the destination handler needs to know where the file belongs.
 */
export const uploadCustomerPhoto = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  if (!req.file) throw new BadRequestError('No image received. Attach a JPG, PNG or WEBP file.');

  const field = req.query.field || req.body?.field || 'photo';
  if (!['photo', 'cnicFrontPhoto', 'cnicBackPhoto'].includes(field)) {
    throw new BadRequestError('field must be photo, cnicFrontPhoto or cnicBackPhoto.');
  }

  // Replace rather than accumulate, so re-taking a CNIC scan does not leave the
  // superseded file behind on disk forever.
  if (customer[field]) removeUploadedFile(customer[field]);

  customer[field] = toFileDescriptor(req.file, req.uploadBucket).url;
  await customer.save();

  return sendSuccess(res, { customer }, 200, 'Photo uploaded.');
});

/**
 * POST /api/customers/:id/documents
 * Attach supporting documents (CNIC scans, signed agreements, bills).
 * Accepts images and PDFs.
 */
export const uploadCustomerDocuments = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('No files received. Attach a JPG, PNG, WEBP or PDF file.');
  }

  const documents = toFileDescriptors(req.files, req.uploadBucket).map((file) => ({
    ...file,
    type: req.query.type || 'other',
  }));

  customer.documents.push(...documents);
  await customer.save();

  return sendSuccess(res, { customer }, 201, `${documents.length} document(s) attached.`);
});

/**
 * DELETE /api/customers/:id/documents/:index
 */
export const deleteCustomerDocument = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  const index = parseInt(req.params.index, 10);
  if (Number.isNaN(index) || index < 0 || index >= customer.documents.length) {
    throw new BadRequestError('That document no longer exists.');
  }

  const [removed] = customer.documents.splice(index, 1);
  if (removed?.url) removeUploadedFile(removed.url);
  await customer.save();

  return sendSuccess(res, { customer }, 200, 'Document removed.');
});
