/**
 * ============================================
 * Payment Model
 * ============================================
 * Records payments from customers.
 * Each payment is allocated to one or more installments (oldest-first).
 */

import mongoose from 'mongoose';
import { PAYMENT_METHODS } from '../constants/index.js';

const paymentAllocationSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    installmentNumber: { type: Number, default: null },
    allocatedAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    // Payment details
    paymentDate: { type: Date, default: Date.now, index: true },
    paymentAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    referenceNumber: { type: String, default: '' },
    // Allocation
    allocations: [paymentAllocationSchema],
    // Balance tracking
    previousBalance: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    nextDueDate: { type: Date, default: null },
    // Ownership
    ownership: {
      type: String,
      enum: ['owner', 'partner', 'shared'],
      default: 'owner',
    },
    // Status
    status: {
      type: String,
      enum: ['completed', 'reversed', 'pending'],
      default: 'completed',
      index: true,
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Set when a payment is reversed - see the note on Sale.cancelledAt.
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ customer: 1, paymentDate: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
