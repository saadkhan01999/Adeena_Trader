/**
 * ============================================
 * Agreement Controller
 * ============================================
 * Issue, list, sign, amend and cancel the legal documents the business puts in
 * front of customers, investors and partners.
 */

import Agreement from '../models/Agreement.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptors, removeUploadedFile } from '../middleware/upload.js';
import {
  createInstallmentAgreement,
  createInvestorAgreement,
  createPartnerAgreement,
  regenerateAgreement,
} from '../services/agreement.service.js';
import { DOCUMENT_TYPES } from '../constants/index.js';

/**
 * GET /api/agreements
 * Paginated, filterable list. Supports ?type, ?status, ?partyId, ?search and a
 * date range, which is everything the Agreements screen filters on.
 */
export const getAgreements = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    partyId,
    search = '',
    startDate,
    endDate,
    sortBy = 'agreementDate',
    sortOrder = 'desc',
  } = req.query;

  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (partyId) query.party = partyId;

  if (search) {
    // Escape regex metacharacters so a search for "A(1)" cannot throw
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { agreementNumber: { $regex: safe, $options: 'i' } },
      { partyName: { $regex: safe, $options: 'i' } },
      { partyCnic: { $regex: safe, $options: 'i' } },
      { partyPhone: { $regex: safe, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.agreementDate = {};
    if (startDate) query.agreementDate.$gte = new Date(startDate);
    if (endDate) query.agreementDate.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [agreements, total, counts] = await Promise.all([
    Agreement.find(query)
      .populate('sale', 'invoiceNumber grandTotal status')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Agreement.countDocuments(query),
    // Summary tiles above the table, computed in the same round trip
    Agreement.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, value: { $sum: '$principalAmount' } } },
    ]),
  ]);

  return sendSuccess(res, {
    agreements,
    summary: counts.reduce((acc, c) => {
      acc[c._id] = { count: c.count, value: c.value };
      return acc;
    }, {}),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * GET /api/agreements/:id
 * The full agreement plus the business profile, which the printable view needs
 * for the letterhead, stamp and signature block.
 */
export const getAgreement = asyncHandler(async (req, res) => {
  const [agreement, business] = await Promise.all([
    Agreement.findById(req.params.id).populate('sale').populate('party'),
    BusinessProfile.getSingleton(),
  ]);

  if (!agreement) throw new NotFoundError('Agreement');
  return sendSuccess(res, { agreement, business });
});

/**
 * POST /api/agreements
 * Issue an agreement. The `type` decides which service builds it.
 *
 * Body: { type, saleId | investorId | partnerId, ...overrides }
 */
export const createAgreement = asyncHandler(async (req, res) => {
  const { type, saleId, investorId, partnerId, ...overrides } = req.body;

  let agreement;
  switch (type) {
    case DOCUMENT_TYPES.INSTALLMENT_AGREEMENT:
      if (!saleId) throw new BadRequestError('saleId is required for an installment agreement.');
      agreement = await createInstallmentAgreement(saleId, req.user);
      break;

    case DOCUMENT_TYPES.INVESTOR_AGREEMENT:
      if (!investorId) throw new BadRequestError('investorId is required for an investor agreement.');
      agreement = await createInvestorAgreement(investorId, req.user, {
        investmentId: overrides.investmentId || null,
        overrides,
      });
      break;

    case DOCUMENT_TYPES.PARTNER_AGREEMENT:
      if (!partnerId) throw new BadRequestError('partnerId is required for a partnership agreement.');
      agreement = await createPartnerAgreement(partnerId, req.user, { overrides });
      break;

    default:
      throw new BadRequestError(
        'type must be installment_agreement, investor_agreement or partner_agreement.'
      );
  }

  await logAudit({
    req,
    module: 'agreements',
    action: 'create',
    recordId: agreement._id.toString(),
    after: agreement.toObject(),
  });

  return sendSuccess(res, { agreement }, 201, `Agreement ${agreement.agreementNumber} issued.`);
});

/**
 * PUT /api/agreements/:id
 * Amend an agreement that has not been signed yet.
 */
export const updateAgreement = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  if (['signed', 'active', 'completed'].includes(agreement.status)) {
    throw new BadRequestError(
      'A signed agreement cannot be edited. Cancel it and issue a replacement instead.'
    );
  }

  const before = agreement.toObject();
  // Identity and lineage fields are set at issue time and never edited
  const { agreementNumber, type, party, partyModel, _id, ...updates } = req.body;

  Object.assign(agreement, updates, { updatedBy: req.user.id });
  await agreement.save();

  await logAudit({
    req,
    module: 'agreements',
    action: 'update',
    recordId: agreement._id.toString(),
    before,
    after: agreement.toObject(),
  });

  return sendSuccess(res, { agreement }, 200, 'Agreement updated.');
});

/**
 * POST /api/agreements/:id/sign
 * Record execution. This is the point after which the wording is frozen.
 */
export const signAgreement = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  if (agreement.status === 'cancelled') {
    throw new BadRequestError('A cancelled agreement cannot be signed.');
  }

  agreement.status = 'signed';
  agreement.signedAt = req.body.signedAt || new Date();
  agreement.signedBy = req.body.signedBy || agreement.partyName;
  if (Array.isArray(req.body.witnesses)) agreement.witnesses = req.body.witnesses;
  agreement.updatedBy = req.user.id;
  await agreement.save();

  await logAudit({
    req,
    module: 'agreements',
    action: 'update',
    recordId: agreement._id.toString(),
    after: agreement.toObject(),
    reason: 'Agreement marked as signed',
  });

  return sendSuccess(res, { agreement }, 200, 'Agreement marked as signed.');
});

/**
 * POST /api/agreements/:id/attachments
 * Attach the scanned, physically signed copy (image or PDF).
 */
export const addAttachments = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('No files received. Attach a JPG, PNG, WEBP or PDF file.');
  }

  const attachments = toFileDescriptors(req.files, req.uploadBucket).map((file) => ({
    ...file,
    label: req.body.label || 'Signed copy',
  }));

  agreement.attachments.push(...attachments);
  agreement.updatedBy = req.user.id;
  await agreement.save();

  return sendSuccess(res, { agreement }, 201, `${attachments.length} file(s) attached.`);
});

/**
 * DELETE /api/agreements/:id/attachments/:index
 * Detach a file and remove it from disk, so deleting a scan actually reclaims
 * the space rather than leaving an orphan behind.
 */
export const removeAttachment = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  const index = Number(req.params.index);
  const attachment = agreement.attachments[index];
  if (!attachment) throw new NotFoundError('Attachment');

  removeUploadedFile(attachment.url);
  agreement.attachments.splice(index, 1);
  await agreement.save();

  return sendSuccess(res, { agreement }, 200, 'Attachment removed.');
});

/**
 * POST /api/agreements/:id/regenerate
 * Re-render an unsigned agreement against the current template wording.
 */
export const regenerate = asyncHandler(async (req, res) => {
  const agreement = await regenerateAgreement(req.params.id, req.user);
  return sendSuccess(res, { agreement }, 200, 'Agreement regenerated from the current template.');
});

/**
 * DELETE /api/agreements/:id
 * Cancel rather than delete: a legal document that existed should stay on the
 * record, with a reason attached.
 */
export const cancelAgreement = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  const reason = req.body?.reason || req.query?.reason;
  if (!reason) {
    throw new BadRequestError('A reason is required when cancelling an agreement.');
  }

  agreement.status = 'cancelled';
  agreement.cancelledAt = new Date();
  agreement.cancellationReason = reason;
  agreement.updatedBy = req.user.id;
  await agreement.save();

  await logAudit({
    req,
    module: 'agreements',
    action: 'void',
    recordId: agreement._id.toString(),
    after: agreement.toObject(),
    reason,
  });

  return sendSuccess(res, { agreement }, 200, `Agreement ${agreement.agreementNumber} cancelled.`);
});

/**
 * DELETE /api/agreements/:id/permanent
 *
 * Remove an agreement outright - one issued by mistake, or a draft never
 * signed. Cancelling (DELETE /:id) is still the right choice for an agreement
 * the customer has seen, because it keeps the record of what was agreed.
 */
export const deleteAgreementPermanently = asyncHandler(async (req, res) => {
  const agreement = await Agreement.findById(req.params.id);
  if (!agreement) throw new NotFoundError('Agreement');

  for (const file of agreement.attachments || []) removeUploadedFile(file?.url);
  await Agreement.findByIdAndDelete(agreement._id);

  await logAudit({
    req,
    module: 'agreements',
    action: 'delete',
    recordId: agreement._id.toString(),
    before: agreement.toObject(),
    reason: 'Agreement deleted permanently',
  });

  return sendSuccess(res, null, 200, `Agreement ${agreement.agreementNumber} deleted permanently.`);
});
