/**
 * ============================================
 * Return Model
 * ============================================
 * Records product returns and exchanges.
 * Supports full returns, partial returns, and exchanges.
 */

import mongoose from 'mongoose';
import { PAYMENT_METHODS } from '../constants/index.js';

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 },
    // For exchange: the new product given
    exchangeProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    exchangeProductName: { type: String, default: '' },
    exchangePrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true, index: true },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    invoiceNumber: { type: String, required: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerName: { type: String, required: true },
    items: [returnItemSchema],
    returnType: {
      type: String,
      enum: ['full', 'partial', 'exchange'],
      required: true,
    },
    // Financial
    refundAmount: { type: Number, default: 0, min: 0 },
    differencePayable: { type: Number, default: 0 }, // For exchange
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    reason: { type: String, required: true, default: '' },
    returnDate: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['completed', 'reversed'],
      default: 'completed',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

returnSchema.index({ customer: 1, returnDate: -1 });
returnSchema.index({ sale: 1 });

const Return = mongoose.model('Return', returnSchema);
export default Return;
