/**
 * ============================================
 * Financial Service
 * ============================================
 * The authoritative place where money moves. Controllers validate and
 * authorise; this module decides what the numbers become.
 *
 * Guarantees
 * ----------
 * 1. Atomic document numbers. Invoice/receipt numbers come from
 *    `BusinessProfile.nextNumber()`, which uses `$inc` inside
 *    `findOneAndUpdate`. A read-modify-write would hand two concurrent sales
 *    the same invoice number and the second one would fail on the unique index.
 * 2. All-or-nothing writes. A sale touches five collections (Sale, Product,
 *    StockMovement, LedgerEntry, Customer, sometimes Payment). `withTransaction`
 *    wraps them so a failure half-way cannot leave stock decremented against a
 *    sale that was never saved.
 * 3. One source of arithmetic. Every formula lives in utils/financialEngine.js
 *    and is shared with the frontend, so the figure previewed before saving is
 *    the figure that gets stored.
 */

import mongoose from 'mongoose';

import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import LedgerEntry from '../models/LedgerEntry.js';
import StockMovement from '../models/StockMovement.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';

import {
  calculateInstallment,
  generateInstallmentSchedule,
  resolveInstallmentStatus,
  parseNumber,
} from '../utils/financialEngine.js';
import { BadRequestError, NotFoundError } from '../utils/AppError.js';

// ============================================================================
// Transaction helper
// ============================================================================

/**
 * Run `work` inside a MongoDB transaction when the deployment supports one.
 *
 * Transactions require a replica set. MongoDB Atlas (including the free tier)
 * is always a replica set, but a developer running a standalone `mongod`
 * locally is not - and refusing to start in that case would be hostile. So we
 * try the transaction, and if the server reports that transactions are
 * unsupported we fall back to running the same work without a session.
 *
 * @param {(session: import('mongoose').ClientSession|null) => Promise<any>} work
 */
const withTransaction = async (work) => {
  let session;
  try {
    session = await mongoose.startSession();
  } catch {
    return work(null); // No session support at all
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const unsupported =
      error?.code === 20 ||                                   // IllegalOperation
      /Transaction numbers are only allowed/i.test(error?.message || '') ||
      /replica set/i.test(error?.message || '');

    if (unsupported) {
      console.warn('[FINANCIAL] Transactions unavailable on this deployment; running unguarded.');
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
};

/** Mongoose helpers only accept `{ session }` when a session exists. */
const opts = (session) => (session ? { session } : {});

// ============================================================================
// Document numbering
// ============================================================================

/** Next sales invoice number, e.g. "INV-1042". */
export const generateInvoiceNumber = () => BusinessProfile.nextNumber('invoice');

/** Next payment receipt number, e.g. "RCP-1042". */
export const generateReceiptNumber = () => BusinessProfile.nextNumber('receipt');

/** Next purchase reference, e.g. "PUR-1042". */
export const generatePurchaseNumber = () => BusinessProfile.nextNumber('purchase');

/** Next agreement number, e.g. "AGR-INS-1042". */
export const generateAgreementNumber = (subPrefix) =>
  BusinessProfile.nextNumber('agreement', subPrefix);

/**
 * Next return number. Counted from the Return collection rather than the
 * business counters because returns are rare and never printed as a series.
 */
export const generateReturnNumber = async () => {
  const { default: Return } = await import('../models/Return.js');
  const count = await Return.countDocuments();
  return `RET-${1000 + count + 1}`;
};

// ============================================================================
// Sales
// ============================================================================

/**
 * Create a sale together with every record it implies:
 * stock decrement + movement log, customer ledger entry, running totals, the
 * installment schedule, and an advance-payment receipt when one was taken.
 *
 * @param {object} saleData Validated payload from the sales controller.
 * @param {object} user     `req.user`.
 * @returns {Promise<import('mongoose').Document>} The created sale.
 */
export const createSaleWithRelations = async (saleData, user) => {
  const settings = await Settings.getSingleton();

  // ---- Pre-flight validation (outside the transaction: cheap and read-only)
  const customer = await Customer.findById(saleData.customer);
  if (!customer) throw new NotFoundError('Customer');
  if (customer.status === 'blacklisted') {
    throw new BadRequestError(`${customer.name} is blacklisted and cannot be sold to.`);
  }

  if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
    throw new BadRequestError('A sale must contain at least one item.');
  }

  // Load every product once and key it by id, so the stock loop below does not
  // re-query the same product for repeated line items.
  const productIds = saleData.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const item of saleData.items) {
    const product = productMap.get(String(item.product));
    if (!product) throw new NotFoundError(`Product "${item.productName || item.product}"`);

    if (settings.product.preventNegativeStock && product.stock < item.quantity) {
      throw new BadRequestError(
        `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`
      );
    }
  }

  // ---- Installment terms
  const isInstallment = saleData.saleType === 'installment';
  let installments = [];
  let remainingBalance = 0;
  let monthlyInstallment = 0;

  if (isInstallment) {
    const advance = parseNumber(saleData.advance);
    const grandTotal = parseNumber(saleData.grandTotal);

    // Business rule: enforce the configured minimum down payment.
    const minAdvance = (grandTotal * settings.installment.minAdvancePercent) / 100;
    if (minAdvance > 0 && advance < minAdvance) {
      throw new BadRequestError(
        `A minimum advance of ${settings.installment.minAdvancePercent}% ` +
        `(Rs. ${Math.round(minAdvance).toLocaleString('en-PK')}) is required for installment sales.`
      );
    }

    if (settings.installment.requireGuarantor && !customer.guarantorName) {
      throw new BadRequestError(
        `A guarantor is required for installment sales. Add guarantor details to ${customer.name}'s profile first.`
      );
    }

    const breakdown = calculateInstallment(grandTotal, advance, saleData.installmentPlan);
    remainingBalance = breakdown.remaining;
    monthlyInstallment = breakdown.monthlyInstallment;

    installments = generateInstallmentSchedule(
      saleData.saleDate || new Date(),
      saleData.installmentPlan,
      remainingBalance,
      { gracePeriodDays: settings.installment.gracePeriodDays }
    );
  }

  // ---- Write everything, or nothing
  return withTransaction(async (session) => {
    const invoiceNumber = await generateInvoiceNumber();

    const [sale] = await Sale.create(
      [
        {
          ...saleData,
          invoiceNumber,
          customerName: customer.name,
          customerPhone: customer.mobile1,
          customerCnic: customer.cnic,
          remainingBalance,
          monthlyInstallment,
          installments,
          status: isInstallment ? 'ongoing' : 'completed',
          saleDate: saleData.saleDate || new Date(),
          createdBy: user.id,
        },
      ],
      opts(session)
    );

    // Stock out + movement trail
    for (const item of saleData.items) {
      const product = productMap.get(String(item.product));
      const quantityBefore = product.stock;
      const quantityAfter = Math.max(0, quantityBefore - item.quantity);

      product.stock = quantityAfter;
      product.status = quantityAfter === 0 ? 'out_of_stock' : 'active';
      await product.save(opts(session));

      await StockMovement.create(
        [
          {
            product: product._id,
            productName: product.name,
            type: 'sale',
            quantity: -item.quantity,
            quantityBefore,
            quantityAfter,
            reference: invoiceNumber,
            referenceId: sale._id,
            movementDate: sale.saleDate,
            createdBy: user.id,
          },
        ],
        opts(session)
      );
    }

    // Customer ledger: the sale is a debit, the advance an immediate credit
    const grandTotal = parseNumber(saleData.grandTotal);
    const advance = parseNumber(saleData.advance);
    const previousBalance = parseNumber(customer.outstanding);
    const newBalance = previousBalance + grandTotal - advance;

    await LedgerEntry.create(
      [
        {
          entityType: 'customer',
          entityId: customer._id,
          entityName: customer.name,
          reference: invoiceNumber,
          referenceType: 'sale',
          referenceId: sale._id,
          description: `Sale ${invoiceNumber} - ${saleData.items.map((i) => i.productName).join(', ')}`,
          debit: grandTotal,
          credit: advance,
          balance: newBalance,
          entryDate: sale.saleDate,
          createdBy: user.id,
        },
      ],
      opts(session)
    );

    // Running totals on the customer card
    customer.totalSales = parseNumber(customer.totalSales) + grandTotal;
    customer.totalPaid = parseNumber(customer.totalPaid) + advance;
    customer.outstanding = newBalance;
    customer.nextDueDate = installments.length > 0 ? new Date(installments[0].dueDate) : customer.nextDueDate;
    await customer.save(opts(session));

    // An advance is a real payment - it gets a real receipt
    if (advance > 0) {
      const receiptNumber = await generateReceiptNumber();
      await Payment.create(
        [
          {
            receiptNumber,
            customer: customer._id,
            customerName: customer.name,
            customerPhone: customer.mobile1,
            paymentDate: sale.saleDate,
            paymentAmount: advance,
            paymentMethod: saleData.paymentMethod || 'cash',
            // installmentNumber 0 marks the down payment, not a scheduled one
            allocations: [{ sale: sale._id, installmentNumber: 0, allocatedAmount: advance }],
            previousBalance,
            remainingBalance: newBalance,
            nextDueDate: customer.nextDueDate,
            ownership: saleData.ownership || 'owner',
            status: 'completed',
            notes: 'Advance / down payment received at the time of sale.',
            createdBy: user.id,
          },
        ],
        opts(session)
      );
    }

    return sale;
  });
};

// ============================================================================
// Payments
// ============================================================================

/**
 * Record a customer payment and allocate it across open installments.
 *
 * Allocation is oldest-due-first, which is both the fairest treatment of the
 * customer (their most overdue liability clears first) and the configured
 * default in Settings. Any amount left after every installment is settled is
 * reported back as `remainingPayment` rather than silently absorbed, so the
 * cashier can decide whether to refund it or hold it as credit.
 *
 * @returns {Promise<{payment: object, totalAllocated: number, remainingPayment: number}>}
 */
export const recordPaymentWithAllocation = async (paymentData, user) => {
  const settings = await Settings.getSingleton();
  const paymentAmount = parseNumber(paymentData.paymentAmount);

  if (paymentAmount <= 0) {
    throw new BadRequestError('Payment amount must be greater than zero.');
  }

  const customer = await Customer.findById(paymentData.customer);
  if (!customer) throw new NotFoundError('Customer');

  // ---- Which sales are we settling?
  let salesToUpdate;
  if (paymentData.sale) {
    const sale = await Sale.findById(paymentData.sale);
    if (!sale) throw new NotFoundError('Sale');
    if (sale.customer.toString() !== customer._id.toString()) {
      throw new BadRequestError('That invoice belongs to a different customer.');
    }
    salesToUpdate = [sale];
  } else {
    salesToUpdate = await Sale.find({
      customer: customer._id,
      saleType: 'installment',
      status: { $in: ['ongoing', 'overdue'] },
    }).sort({ saleDate: 1 });
  }

  if (salesToUpdate.length === 0) {
    throw new BadRequestError(`${customer.name} has no outstanding installments.`);
  }

  // ---- Flatten every open installment, oldest due date first
  const openInstallments = [];
  for (const sale of salesToUpdate) {
    for (const inst of sale.installments) {
      if (inst.status !== 'paid' && inst.remaining > 0) {
        openInstallments.push({ sale, installment: inst });
      }
    }
  }
  openInstallments.sort(
    (a, b) => new Date(a.installment.dueDate) - new Date(b.installment.dueDate)
  );

  if (openInstallments.length === 0) {
    throw new BadRequestError('Every installment on the selected invoice is already paid.');
  }

  // Reject an under-payment when the business does not accept partials
  if (!settings.payment.allowPartialPayment) {
    const firstDue = openInstallments[0].installment.remaining;
    if (paymentAmount < firstDue) {
      throw new BadRequestError(
        `Partial payments are disabled. The next installment requires Rs. ${firstDue.toLocaleString('en-PK')}.`
      );
    }
  }

  return withTransaction(async (session) => {
    let unallocated = paymentAmount;
    const allocations = [];
    const touchedSales = new Map();

    for (const { sale, installment } of openInstallments) {
      if (unallocated <= 0) break;

      const allocation = Math.min(installment.remaining, unallocated);

      installment.paid = parseNumber(installment.paid) + allocation;
      installment.remaining = Math.max(0, parseNumber(installment.expected) - installment.paid);

      if (installment.remaining === 0) {
        installment.status = 'paid';
        installment.paidDate = new Date();
      } else {
        installment.status = 'partially_paid';
      }

      allocations.push({
        sale: sale._id,
        installmentNumber: installment.number,
        allocatedAmount: allocation,
      });

      unallocated -= allocation;
      touchedSales.set(sale._id.toString(), sale);
    }

    // Recompute each touched sale's balance and close it when fully settled
    for (const sale of touchedSales.values()) {
      sale.remainingBalance = sale.installments.reduce(
        (sum, inst) => sum + parseNumber(inst.remaining),
        0
      );
      if (sale.remainingBalance === 0) {
        sale.status = 'completed';
      } else {
        // Re-derive overdue vs ongoing from what is left
        const hasOverdue = sale.installments.some((i) => i.status === 'overdue' && i.remaining > 0);
        sale.status = hasOverdue ? 'overdue' : 'ongoing';
      }
      await sale.save(opts(session));
    }

    const totalAllocated = paymentAmount - unallocated;
    const previousBalance = parseNumber(customer.outstanding);
    const newBalance = Math.max(0, previousBalance - totalAllocated);
    const receiptNumber = await generateReceiptNumber();

    // Next unpaid installment across everything we just touched
    const nextUnpaid = openInstallments.find((i) => i.installment.status !== 'paid');
    const nextDueDate = nextUnpaid ? new Date(nextUnpaid.installment.dueDate) : null;

    const [payment] = await Payment.create(
      [
        {
          receiptNumber,
          customer: customer._id,
          customerName: customer.name,
          customerPhone: customer.mobile1,
          paymentDate: paymentData.paymentDate || new Date(),
          paymentAmount,
          paymentMethod: paymentData.paymentMethod || 'cash',
          referenceNumber: paymentData.referenceNumber || '',
          allocations,
          previousBalance,
          remainingBalance: newBalance,
          nextDueDate,
          ownership: paymentData.ownership || 'owner',
          status: 'completed',
          notes: paymentData.notes || '',
          createdBy: user.id,
        },
      ],
      opts(session)
    );

    await LedgerEntry.create(
      [
        {
          entityType: 'customer',
          entityId: customer._id,
          entityName: customer.name,
          reference: receiptNumber,
          referenceType: 'payment',
          referenceId: payment._id,
          description: `Payment received via ${payment.paymentMethod}`,
          debit: 0,
          credit: totalAllocated,
          balance: newBalance,
          entryDate: payment.paymentDate,
          createdBy: user.id,
        },
      ],
      opts(session)
    );

    customer.totalPaid = parseNumber(customer.totalPaid) + totalAllocated;
    customer.outstanding = newBalance;
    customer.nextDueDate = nextDueDate;
    await customer.save(opts(session));

    return {
      payment,
      totalAllocated,
      remainingPayment: Math.max(0, unallocated),
    };
  });
};

// ============================================================================
// Purchases
// ============================================================================

/**
 * Record a stock purchase: raise the purchase document, increase stock, log the
 * movement, and update the supplier's payable balance and ledger.
 *
 * Handles both registered suppliers and the "buy from other" flow (market
 * pickup, another shopkeeper), which has no supplier record at all.
 */
export const createPurchaseWithStock = async (purchaseData, user) => {
  if (!Array.isArray(purchaseData.items) || purchaseData.items.length === 0) {
    throw new BadRequestError('A purchase must contain at least one item.');
  }

  const productIds = purchaseData.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const item of purchaseData.items) {
    if (!productMap.has(String(item.product))) {
      throw new NotFoundError(`Product "${item.productName || item.product}"`);
    }
  }

  // Trust the line items over any client-supplied subtotal
  const subtotal = purchaseData.items.reduce(
    (sum, i) => sum + parseNumber(i.purchasePrice) * parseNumber(i.quantity),
    0
  );
  const paid = parseNumber(purchaseData.paid);
  const payable = Math.max(0, subtotal - paid);

  const supplier = purchaseData.supplier ? await Supplier.findById(purchaseData.supplier) : null;
  if (purchaseData.supplier && !supplier) throw new NotFoundError('Supplier');

  return withTransaction(async (session) => {
    const invoiceNumber = purchaseData.invoiceNumber || (await generatePurchaseNumber());

    const [purchase] = await Purchase.create(
      [
        {
          ...purchaseData,
          invoiceNumber,
          supplierName: supplier?.name || purchaseData.sourceName || '',
          subtotal,
          paid,
          payable,
          status: payable === 0 ? 'completed' : paid > 0 ? 'partial_payment' : 'unpaid',
          purchaseDate: purchaseData.purchaseDate || new Date(),
          createdBy: user.id,
        },
      ],
      opts(session)
    );

    // Stock in + movement trail
    for (const item of purchaseData.items) {
      const product = productMap.get(String(item.product));
      const quantityBefore = product.stock;
      const quantityAfter = quantityBefore + parseNumber(item.quantity);

      product.stock = quantityAfter;
      if (quantityAfter > 0 && product.status === 'out_of_stock') product.status = 'active';

      // Keep the costing current so stock valuation and profit stay honest
      if (parseNumber(item.purchasePrice) > 0) {
        product.purchasePrice = parseNumber(item.purchasePrice);
      }
      await product.save(opts(session));

      const isExternalSource = ['market', 'other_person', 'existing_customer'].includes(
        purchaseData.sourceType
      );

      await StockMovement.create(
        [
          {
            product: product._id,
            productName: product.name,
            type: isExternalSource ? 'buy_from_other' : 'purchase',
            quantity: parseNumber(item.quantity),
            quantityBefore,
            quantityAfter,
            reference: invoiceNumber,
            referenceId: purchase._id,
            movementDate: purchase.purchaseDate,
            createdBy: user.id,
          },
        ],
        opts(session)
      );
    }

    // Supplier account
    if (supplier) {
      const previousPayable = parseNumber(supplier.payable);
      supplier.totalPurchases = parseNumber(supplier.totalPurchases) + subtotal;
      supplier.totalPaid = parseNumber(supplier.totalPaid) + paid;
      supplier.payable = previousPayable + payable;
      await supplier.save(opts(session));

      await LedgerEntry.create(
        [
          {
            entityType: 'supplier',
            entityId: supplier._id,
            entityName: supplier.name,
            reference: invoiceNumber,
            referenceType: 'purchase',
            referenceId: purchase._id,
            description: `Purchase ${invoiceNumber} - ${purchaseData.items.map((i) => i.productName).join(', ')}`,
            debit: paid,          // We paid them, reducing what we owe
            credit: subtotal,     // The goods increased what we owe
            balance: supplier.payable,
            entryDate: purchase.purchaseDate,
            createdBy: user.id,
          },
        ],
        opts(session)
      );
    }

    return purchase;
  });
};

// ============================================================================
// Maintenance
// ============================================================================

/**
 * Re-derive installment and sale statuses against today's date.
 *
 * An installment's status is time-dependent: an "upcoming" row silently becomes
 * "due today" and then "overdue" as the calendar moves, with nothing writing to
 * the database. This sweep makes the stored state match reality and is called
 * by the notification job and before any overdue listing.
 *
 * @returns {Promise<{salesScanned: number, salesUpdated: number}>}
 */
export const refreshInstallmentStatuses = async () => {
  const settings = await Settings.getSingleton();
  const grace = settings.installment.gracePeriodDays;

  const sales = await Sale.find({
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
  });

  let salesUpdated = 0;

  for (const sale of sales) {
    let changed = false;

    for (const inst of sale.installments) {
      if (inst.status === 'paid') continue;

      const next = resolveInstallmentStatus({
        dueDate: inst.dueDate,
        expected: inst.expected,
        paid: inst.paid,
        gracePeriodDays: grace,
      });

      if (next !== inst.status) {
        inst.status = next;
        changed = true;
      }
    }

    if (changed) {
      const hasOverdue = sale.installments.some((i) => i.status === 'overdue' && i.remaining > 0);
      sale.status = hasOverdue ? 'overdue' : 'ongoing';
      await sale.save();
      salesUpdated += 1;
    }
  }

  return { salesScanned: sales.length, salesUpdated };
};

/**
 * Recompute a customer's cached totals from their source transactions.
 * Cached aggregates can drift after a reversal or a manual edit; this is the
 * repair tool, exposed to admins from Settings > Data Management.
 */
export const recalculateCustomerTotals = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new NotFoundError('Customer');

  const [sales, payments] = await Promise.all([
    Sale.find({ customer: customer._id, status: { $ne: 'cancelled' } }),
    Payment.find({ customer: customer._id, status: 'completed' }),
  ]);

  const totalSales = sales.reduce((s, sale) => s + parseNumber(sale.grandTotal), 0);
  const totalPaid = payments.reduce((s, p) => s + parseNumber(p.paymentAmount), 0);
  const outstanding = sales.reduce((s, sale) => s + parseNumber(sale.remainingBalance), 0);

  // Earliest unpaid installment across every open sale
  const dueDates = sales
    .flatMap((sale) => sale.installments || [])
    .filter((i) => i.status !== 'paid' && i.remaining > 0)
    .map((i) => new Date(i.dueDate))
    .sort((a, b) => a - b);

  const overdue = sales
    .flatMap((sale) => sale.installments || [])
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + parseNumber(i.remaining), 0);

  customer.totalSales = totalSales;
  customer.totalPaid = totalPaid;
  customer.outstanding = outstanding;
  customer.overdue = overdue;
  customer.nextDueDate = dueDates[0] || null;
  await customer.save();

  return customer;
};
