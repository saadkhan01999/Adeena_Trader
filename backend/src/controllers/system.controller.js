/**
 * ============================================
 * System Controller
 * ============================================
 * Cross-cutting endpoints that do not belong to a single business module:
 * notifications, the audit trail, and global search.
 */

import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Supplier from '../models/Supplier.js';
import Investor from '../models/Investor.js';
import Partner from '../models/Partner.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { runNotificationSweep, pruneOldNotifications } from '../services/notification.service.js';

/** Escape user input before it becomes part of a regular expression. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ============================================================================
// Notifications
// ============================================================================

/**
 * GET /api/notifications
 * Query: page, limit, isRead, type, severity
 *
 * The response carries `unreadCount` alongside the page so the header badge
 * never needs a second request.
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isRead, type, severity } = req.query;

  const query = { isDeleted: false };
  if (isRead !== undefined) query.isRead = isRead === 'true';
  if (type) query.type = type;
  if (severity) query.severity = severity;

  const skip = (Number(page) - 1) * Number(limit);

  const [notifications, total, unreadCount, bySeverity] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Notification.countDocuments(query),
    Notification.countDocuments({ isRead: false, isDeleted: false }),
    Notification.aggregate([
      { $match: { isDeleted: false, isRead: false } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
  ]);

  return sendSuccess(res, {
    notifications,
    unreadCount,
    bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * POST /api/notifications/refresh
 * Re-scan the business for alert conditions on demand.
 *
 * The same sweep runs on a timer; this is the "check now" button, useful right
 * after recording payments when the user wants the badge to settle immediately.
 */
export const refreshNotifications = asyncHandler(async (req, res) => {
  const result = await runNotificationSweep();
  const unreadCount = await Notification.countDocuments({ isRead: false, isDeleted: false });

  return sendSuccess(
    res,
    { ...result, unreadCount },
    200,
    result.skipped ? result.reason : 'Notifications refreshed.'
  );
});

/** PUT /api/notifications/:id/read */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new NotFoundError('Notification');

  const unreadCount = await Notification.countDocuments({ isRead: false, isDeleted: false });
  return sendSuccess(res, { notification, unreadCount }, 200, 'Marked as read.');
});

/** PUT /api/notifications/read-all */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() }
  );
  return sendSuccess(
    res,
    { updated: result.modifiedCount, unreadCount: 0 },
    200,
    'All notifications marked as read.'
  );
});

/**
 * DELETE /api/notifications/:id
 * Soft delete, so a dismissed alert is not re-raised by the next sweep - the
 * dedupe key still exists, it is simply hidden.
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { isDeleted: true },
    { new: true }
  );
  if (!notification) throw new NotFoundError('Notification');

  const unreadCount = await Notification.countDocuments({ isRead: false, isDeleted: false });
  return sendSuccess(res, { unreadCount }, 200, 'Notification dismissed.');
});

/** DELETE /api/notifications - dismiss every read notification. */
export const clearReadNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ isRead: true, isDeleted: false }, { isDeleted: true });
  const pruned = await pruneOldNotifications(30);

  return sendSuccess(
    res,
    { cleared: result.modifiedCount, pruned },
    200,
    `${result.modifiedCount} notification(s) cleared.`
  );
});

// ============================================================================
// Audit log
// ============================================================================

/**
 * GET /api/audit-logs
 * Admin-only. Filterable by module, action, user and date.
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, module, action, userId, search, startDate, endDate } = req.query;

  const query = {};
  if (module) query.module = module;
  if (action) query.action = action;
  if (userId) query.user = userId;
  if (search) {
    const safe = escapeRegex(search);
    query.$or = [
      { userName: { $regex: safe, $options: 'i' } },
      { reason: { $regex: safe, $options: 'i' } },
      { recordId: { $regex: safe, $options: 'i' } },
    ];
  }
  if (startDate || endDate) {
    query.logDate = {};
    if (startDate) query.logDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.logDate.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total, modules] = await Promise.all([
    AuditLog.find(query)
      .populate('user', 'name email role')
      .sort({ logDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(query),
    AuditLog.distinct('module'),
  ]);

  return sendSuccess(res, {
    logs,
    modules,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// ============================================================================
// Global search
// ============================================================================

/**
 * GET /api/search?q=...
 * Powers the Ctrl+K command palette.
 *
 * Searches every entity the user is permitted to see, in parallel, and returns
 * a small, uniformly-shaped result set per group so the palette can render
 * everything with one row component.
 */
export const globalSearch = asyncHandler(async (req, res) => {
  const { q = '', limit = 5 } = req.query;
  const term = String(q).trim();

  // Two characters is the point at which results become meaningful rather than
  // a near-full table scan of the customer list.
  if (term.length < 2) {
    return sendSuccess(res, { results: [], query: term, total: 0 });
  }

  const rx = { $regex: escapeRegex(term), $options: 'i' };
  const cap = Math.min(Number(limit) || 5, 20);
  const can = (permission) => req.user.permissions.includes(permission) || req.user.role === 'admin';

  const [customers, products, sales, payments, suppliers, investors, partners] = await Promise.all([
    can('customers')
      ? Customer.find({ $or: [{ name: rx }, { mobile1: rx }, { mobile2: rx }, { cnic: rx }] })
          .select('name mobile1 cnic outstanding').limit(cap)
      : [],
    can('products')
      ? Product.find({ $or: [{ name: rx }, { brand: rx }, { model: rx }, { barcode: rx }, { imei1: rx }, { serialNumber: rx }] })
          .select('name brand stock cashPrice').limit(cap)
      : [],
    can('sales')
      ? Sale.find({ $or: [{ invoiceNumber: rx }, { customerName: rx }, { customerPhone: rx }] })
          .select('invoiceNumber customerName grandTotal saleType status saleDate').limit(cap)
      : [],
    can('payments')
      ? Payment.find({ $or: [{ receiptNumber: rx }, { customerName: rx }, { referenceNumber: rx }] })
          .select('receiptNumber customerName paymentAmount paymentDate').limit(cap)
      : [],
    can('suppliers')
      ? Supplier.find({ $or: [{ name: rx }, { phone: rx }, { contactPerson: rx }] })
          .select('name phone payable').limit(cap)
      : [],
    can('investors')
      ? Investor.find({ $or: [{ name: rx }, { phone: rx }, { cnic: rx }] })
          .select('name phone totalInvestment').limit(cap)
      : [],
    can('partners')
      ? Partner.find({ $or: [{ name: rx }, { phone: rx }, { cnic: rx }] })
          .select('name phone ownershipPercent').limit(cap)
      : [],
  ]);

  // Uniform shape: { id, title, subtitle, path, group }
  const results = [
    ...customers.map((c) => ({
      id: c._id, group: 'Customers', title: c.name,
      subtitle: `${c.mobile1}${c.cnic ? ` - ${c.cnic}` : ''}`,
      meta: c.outstanding > 0 ? `Rs. ${c.outstanding.toLocaleString('en-PK')} due` : 'Clear',
      path: '/customers',
    })),
    ...products.map((p) => ({
      id: p._id, group: 'Products', title: p.name,
      subtitle: p.brand || 'Product',
      meta: `${p.stock} in stock`,
      path: '/products',
    })),
    ...sales.map((s) => ({
      id: s._id, group: 'Sales', title: s.invoiceNumber,
      subtitle: s.customerName,
      meta: `Rs. ${s.grandTotal.toLocaleString('en-PK')} - ${s.saleType}`,
      path: '/sales',
    })),
    ...payments.map((p) => ({
      id: p._id, group: 'Payments', title: p.receiptNumber,
      subtitle: p.customerName,
      meta: `Rs. ${p.paymentAmount.toLocaleString('en-PK')}`,
      path: '/payments',
    })),
    ...suppliers.map((s) => ({
      id: s._id, group: 'Suppliers', title: s.name,
      subtitle: s.phone || 'Supplier',
      meta: s.payable > 0 ? `Rs. ${s.payable.toLocaleString('en-PK')} payable` : 'Settled',
      path: '/suppliers',
    })),
    ...investors.map((i) => ({
      id: i._id, group: 'Investors', title: i.name,
      subtitle: i.phone || 'Investor',
      meta: `Rs. ${i.totalInvestment.toLocaleString('en-PK')} invested`,
      path: '/investors',
    })),
    ...partners.map((p) => ({
      id: p._id, group: 'Partners', title: p.name,
      subtitle: p.phone || 'Partner',
      meta: `${p.ownershipPercent}% share`,
      path: '/partners',
    })),
  ];

  return sendSuccess(res, { results, query: term, total: results.length });
});
