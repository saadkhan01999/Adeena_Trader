/**
 * ============================================
 * SupplierPayment Model
 * ============================================
 * Money paid to a supplier after the purchase, against what is owed.
 *
 * Before this existed, the only way a supplier's payable ever went down was by
 * cancelling the purchase - so "Owed to suppliers" on the dashboard could only
 * rise. A payment here is applied to the supplier's unpaid purchases oldest
 * first (the same rule customer payments follow), and each purchase's paid /
 * payable figures move with it, so a purchase reads "Paid" once it is settled.
 */

import mongoose from 'mongoose';
import { PAYMENT_METHODS } from '../constants/index.js';

const allocationSchema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
    invoiceNumber: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const supplierPaymentSchema = new mongoose.Schema(
  {
    // Null once the supplier itself is deleted; the name is kept for history.
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null, index: true },
    supplierName: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    paymentDate: { type: Date, default: Date.now, index: true },
    referenceNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    allocations: [allocationSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);
export default SupplierPayment;
