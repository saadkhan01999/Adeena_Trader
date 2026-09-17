/**
 * ============================================
 * Expense Model
 * ============================================
 * Business expenses with categories and ownership allocation.
 */

import mongoose from 'mongoose';
import { EXPENSE_CATEGORIES } from '../constants/index.js';

const expenseSchema = new mongoose.Schema(
  {
    // Sourced from constants so adding a category is a one-line change
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
      index: true,
    },
    description: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'card', 'other'],
      default: 'cash',
    },
    expenseDate: { type: Date, default: Date.now, index: true },
    // Ownership allocation
    ownership: {
      type: String,
      enum: ['owner', 'partner', 'shared'],
      default: 'owner',
    },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    // Scanned bill or receipt - public URL of an uploaded image/PDF
    receiptImage: { type: String, default: null },
    /** Who the money was paid to (landlord, utility company, staff member). */
    paidTo: { type: String, default: '' },
    referenceNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.index({ category: 1, expenseDate: -1 });
expenseSchema.index({ expenseDate: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
