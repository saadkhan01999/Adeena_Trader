/**
 * ============================================
 * Sale Model
 * ============================================
 * Records sales transactions (cash and installment).
 * Installment sales embed the full installment schedule.
 *
 * Only 6-month and 12-month installment plans are supported.
 */

import mongoose from 'mongoose';

const installmentSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    expected: { type: Number, required: true, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    remaining: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['upcoming', 'due_today', 'partially_paid', 'paid', 'late', 'overdue'],
      default: 'upcoming',
    },
    paidDate: { type: Date, default: null },
  },
  { _id: false }
);

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true }, // Snapshot
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    // Serial tracking at sale time
    imei1: { type: String, default: '' },
    imei2: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    warranty: { type: String, default: '' },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true }, // Snapshot
    customerPhone: { type: String, default: '' },
    customerCnic: { type: String, default: '' },
    items: [saleItemSchema],
    // Pricing
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    // Payment
    saleType: {
      type: String,
      enum: ['cash', 'installment'],
      required: true,
      index: true,
    },
    // Installment-specific
    advance: { type: Number, default: 0, min: 0 },
    remainingBalance: { type: Number, default: 0, min: 0 },
    installmentPlan: {
      type: Number,
      enum: [6, 12],
      default: null,
    },
    monthlyInstallment: { type: Number, default: 0 },
    installments: [installmentSchema],
    // Cash sale payment
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'card', 'other'],
      default: 'cash',
    },
    amountReceived: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    // Ownership
    ownership: {
      type: String,
      enum: ['owner', 'partner', 'shared'],
      default: 'owner',
    },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    // Status
    status: {
      type: String,
      enum: ['completed', 'ongoing', 'overdue', 'returned', 'cancelled'],
      default: 'completed',
      index: true,
    },
    saleDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '' },
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Indexes for reporting
saleSchema.index({ customer: 1, saleDate: -1 });
saleSchema.index({ saleType: 1, status: 1 });
saleSchema.index({ saleDate: -1 });

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
