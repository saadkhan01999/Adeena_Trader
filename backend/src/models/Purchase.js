/**
 * ============================================
 * Purchase Model
 * ============================================
 * Records stock purchases from suppliers or external sources.
 * Includes "Buy From Other" workflow for quick purchases.
 */

import mongoose from 'mongoose';
import { PAYMENT_METHODS } from '../constants/index.js';
import { PURCHASE_SOURCE_TYPES } from '../constants/index.js';

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    purchasePrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, default: '', index: true },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    supplierName: { type: String, default: '' },
    items: [purchaseItemSchema],
    // Source info (for Buy From Other)
    sourceType: {
      type: String,
      enum: PURCHASE_SOURCE_TYPES,
      default: 'registered_supplier',
    },
    sourceName: { type: String, default: '' },
    sourcePhone: { type: String, default: '' },
    sourceLocation: { type: String, default: '' },
    // Pricing
    subtotal: { type: Number, required: true, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    /**
     * What was paid on the day of the purchase. `paid` grows as later supplier
     * payments are applied; this does not, so the wallet can count each rupee
     * once - on the day and by the method it actually left.
     */
    paidAtPurchase: { type: Number, default: null },
    /** How the amount paid at purchase left the shop - feeds the wallet. */
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    payable: { type: Number, default: 0, min: 0 },
    // Ownership
    ownership: {
      type: String,
      enum: ['owner', 'partner', 'shared'],
      default: 'owner',
    },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    purchaseDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'partial_payment', 'unpaid', 'cancelled'],
      default: 'completed',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

purchaseSchema.index({ supplier: 1, purchaseDate: -1 });
purchaseSchema.index({ sourceType: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;
