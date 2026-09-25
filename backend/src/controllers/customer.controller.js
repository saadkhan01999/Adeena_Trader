/**
 * ============================================
 * Customer Controller
 * ============================================
 */

import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  NotFoundError, BadRequestError, LinkedRecordsError, describeLinks, summariseLinks, isForced,
} from '../utils/AppError.js';
import { customerFootprint, deleteCustomerCompletely } from '../services/reversal.service.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, toFileDescriptors, removeUploadedFile } from '../middleware/upload.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search = '', status, sortBy = 'createdAt', sortOrder = 'desc',
  } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: containsText(search) },
      { cnic: containsText(search) },
      { mobile1: containsText(search) },
      { mobile2: containsText(search) },
    ];
  }
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Tiles above the table total every customer matching the filters, not
  // just the twenty on this page.
  const [customers, total, totals] = await Promise.all([
    Customer.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
    Customer.countDocuments(query),
    Customer.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalSales' },
          totalPaid: { $sum: '$totalPaid' },
          outstanding: { $sum: '$outstanding' },
          overdue: { $sum: '$overdue' },
          withBalance: { $sum: { $cond: [{ $gt: ['$outstanding', 0] }, 1, 0] } },
          behind: { $sum: { $cond: [{ $gt: ['$overdue', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const { _id, ...summary } = totals[0] || {
    _id: null, totalSales: 0, totalPaid: 0, outstanding: 0, overdue: 0, withBalance: 0, behind: 0,
  };

  return sendSuccess(res, {
    customers,
    summary,
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

/**
 * DELETE /api/customers/:id[?force=true]
 *
 * A customer with no history is deleted at once. One with sales, payments or
 * agreements is refused with a count of each; confirming (`?force=true`)
 * deletes the customer together with all of it, and every sale undone puts its
 * stock back on the shelf.
 *
 * It no longer quietly marks the customer inactive and reports success - the
 * shop wants delete to mean delete. Marking a customer inactive is still
 * available from the edit form's Status field.
 */
export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer');

  const links = describeLinks(await customerFootprint(customer._id));

  if (links.length > 0 && !isForced(req)) {
    throw new LinkedRecordsError(
      `${customer.name} has ${summariseLinks(links)} on record.`,
      links,
      'Deleting removes the customer together with all of these. Stock from every sale is put back on the shelf. This cannot be undone.'
    );
  }

  for (const field of ['photo', 'cnicFrontPhoto', 'cnicBackPhoto']) {
    if (customer[field]) removeUploadedFile(customer[field]);
  }
  for (const doc of customer.documents || []) removeUploadedFile(doc?.url);

  await deleteCustomerCompletely(customer._id, req.user);
  await logAudit({
    req,
    module: 'customers',
    action: 'delete',
    recordId: req.params.id,
    before: customer.toObject(),
    reason: links.length ? `Deleted with ${summariseLinks(links)}` : 'Deleted',
  });

  return sendSuccess(
    res,
    null,
    200,
    links.length
      ? `${customer.name} and ${summariseLinks(links)} deleted permanently.`
      : `${customer.name} deleted permanently.`
  );
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
