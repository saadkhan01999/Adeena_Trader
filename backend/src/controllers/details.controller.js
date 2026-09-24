/**
 * ============================================
 * Editing a financial record's details
 * ============================================
 * PUT /api/{sales|payments|purchases|returns}/:id
 *
 * A posted financial record's AMOUNTS are never edited in place. Stock, the
 * customer's balance, the ledger and the wallet were all worked out from them;
 * changing a figure afterwards would leave every one of those quietly wrong.
 * The correct path for a wrong amount is cancel (or delete) and enter it again,
 * which the screens offer beside Edit.
 *
 * What people do get wrong at the counter - the payment method, a reference
 * number, an IMEI typed with a digit missing, a note - changes nothing that was
 * calculated, and CAN be corrected here. Each record type lists exactly which
 * fields that covers; anything else in the request is ignored.
 */

import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Return from '../models/Return.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { PAYMENT_METHODS } from '../constants/index.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

/**
 * @param {object} config
 * @param {import('mongoose').Model} config.Model
 * @param {string} config.name      For messages, e.g. "Sale".
 * @param {string} config.module    Audit module.
 * @param {string[]} config.fields  Top-level fields that may change.
 * @param {string[]} [config.itemFields] Per-line fields that may change.
 * @param {Function} [config.after] (record, changes) => Promise, e.g. to keep
 *   a ledger description in step with a corrected payment method.
 */
const makeDetailsUpdater = ({ Model, name, module, fields, itemFields = [], after }) =>
  asyncHandler(async (req, res) => {
    const record = await Model.findById(req.params.id);
    if (!record) throw new NotFoundError(name);

    const before = record.toObject();
    const changes = {};

    for (const field of fields) {
      if (req.body[field] === undefined) continue;
      let value = req.body[field];
      if (field === 'paymentMethod') {
        if (!PAYMENT_METHODS.includes(value)) throw new BadRequestError('Choose a valid payment method.');
      } else {
        value = clean(value, field === 'notes' || field === 'reason' ? 1000 : 120);
      }
      if (record[field] !== value) {
        record[field] = value;
        changes[field] = value;
      }
    }

    // Line details, matched by position: the lines themselves cannot be added,
    // removed or re-priced here.
    if (itemFields.length && Array.isArray(req.body.items)) {
      req.body.items.forEach((patch, index) => {
        const line = record.items?.[index];
        if (!line || !patch) return;
        for (const field of itemFields) {
          if (patch[field] === undefined) continue;
          const value = clean(patch[field], 120);
          if (line[field] !== value) {
            line[field] = value;
            changes[`items.${index}.${field}`] = value;
          }
        }
      });
      record.markModified('items');
    }

    if (Object.keys(changes).length === 0) {
      return sendSuccess(res, { [name.toLowerCase()]: record }, 200, 'Nothing changed.');
    }

    await record.save();
    if (after) await after(record, changes);

    await logAudit({
      req, module, action: 'update', recordId: record._id.toString(),
      before, after: record.toObject(), reason: `Corrected ${Object.keys(changes).join(', ')}`,
    });

    return sendSuccess(res, { [name.toLowerCase()]: record }, 200, `${name} updated.`);
  });

export const updateSaleDetails = makeDetailsUpdater({
  Model: Sale,
  name: 'Sale',
  module: 'sales',
  fields: ['notes', 'paymentMethod'],
  itemFields: ['imei1', 'imei2', 'serialNumber', 'warranty'],
});

export const updatePaymentDetails = makeDetailsUpdater({
  Model: Payment,
  name: 'Payment',
  module: 'payments',
  fields: ['paymentMethod', 'referenceNumber', 'notes'],
  after: async (payment, changes) => {
    if (changes.paymentMethod) {
      await LedgerEntry.updateMany(
        { referenceType: 'payment', referenceId: payment._id },
        { $set: { description: `Payment received via ${payment.paymentMethod}` } }
      );
    }
  },
});

export const updatePurchaseDetails = makeDetailsUpdater({
  Model: Purchase,
  name: 'Purchase',
  module: 'purchases',
  fields: ['notes', 'paymentMethod', 'sourceName', 'sourcePhone', 'sourceLocation'],
});

export const updateReturnDetails = makeDetailsUpdater({
  Model: Return,
  name: 'Return',
  module: 'returns',
  fields: ['reason', 'paymentMethod'],
});

/** GET /api/returns/:id - one return, for its detail view. */
export const getReturnById = asyncHandler(async (req, res) => {
  const record = await Return.findById(req.params.id);
  if (!record) throw new NotFoundError('Return');
  return sendSuccess(res, { return: record });
});
