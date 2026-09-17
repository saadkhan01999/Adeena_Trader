/**
 * ============================================
 * Business Profile & Settings Controller
 * ============================================
 *
 * Read vs write
 * -------------
 * Settings are READABLE by every signed-in user and WRITABLE only by an
 * administrator. That split matters: a salesman's screen needs to know the
 * default installment plan, the currency symbol and the low-stock threshold to
 * render correctly. Locking reads to admins - as the previous version did -
 * made the Settings screen fail with a 403 for everyone else.
 *
 * To keep that safe, `getSettings` returns a reduced view to non-admins that
 * omits the security block (lockout thresholds, password policy) and the
 * WhatsApp business number.
 */

import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, removeUploadedFile } from '../middleware/upload.js';
import { ROLES } from '../constants/index.js';

// ============================================================================
// Business profile
// ============================================================================

/**
 * GET /api/business/profile
 * Readable by every signed-in user - invoices and headers depend on it.
 */
export const getBusinessProfile = asyncHandler(async (req, res) => {
  const profile = await BusinessProfile.getSingleton();
  return sendSuccess(res, { profile });
});

/**
 * PUT /api/business/profile
 *
 * Document counters are stripped from the payload. They are consumed atomically
 * by `BusinessProfile.nextNumber()`, and letting the form post them back would
 * rewind the series and produce duplicate invoice numbers.
 */
export const updateBusinessProfile = asyncHandler(async (req, res) => {
  const profile = await BusinessProfile.getSingleton();
  const before = profile.toObject();

  const {
    invoiceCounter, receiptCounter, agreementCounter, purchaseCounter,
    _id, createdAt, updatedAt,
    ...updates
  } = req.body;

  Object.assign(profile, updates);

  // Raising a starting number is allowed (a shop migrating from a manual book
  // wants to continue its existing series); lowering it is not, because the
  // numbers below it are already issued.
  for (const series of ['invoice', 'receipt', 'agreement']) {
    const startField = `${series}StartingNumber`;
    const counterField = `${series}Counter`;
    if (updates[startField] !== undefined && updates[startField] > profile[counterField]) {
      profile[counterField] = updates[startField];
    }
  }

  await profile.save();

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: profile._id.toString(),
    before,
    after: profile.toObject(),
    reason: 'Updated the business profile',
  });

  return sendSuccess(res, { profile }, 200, 'Business profile saved.');
});

/**
 * POST /api/business/branding?field=logo|stamp|signature
 * Upload one of the three brand images used on printed documents.
 */
export const uploadBranding = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No image received. Attach a JPG, PNG or WEBP file.');

  const field = req.query.field || 'logo';
  if (!['logo', 'stamp', 'signature'].includes(field)) {
    throw new BadRequestError('field must be logo, stamp or signature.');
  }

  const profile = await BusinessProfile.getSingleton();

  // Replace, don't accumulate: drop the previous file so repeated logo changes
  // do not leave orphaned images filling the disk.
  if (profile[field]) removeUploadedFile(profile[field]);

  profile[field] = toFileDescriptor(req.file, req.uploadBucket).url;
  await profile.save();

  return sendSuccess(res, { profile }, 200, `${field} uploaded.`);
});

/** DELETE /api/business/branding?field=logo|stamp|signature */
export const removeBranding = asyncHandler(async (req, res) => {
  const field = req.query.field || 'logo';
  if (!['logo', 'stamp', 'signature'].includes(field)) {
    throw new BadRequestError('field must be logo, stamp or signature.');
  }

  const profile = await BusinessProfile.getSingleton();
  if (profile[field]) removeUploadedFile(profile[field]);
  profile[field] = null;
  await profile.save();

  return sendSuccess(res, { profile }, 200, `${field} removed.`);
});

// ============================================================================
// Application settings
// ============================================================================

/** Setting groups that only an administrator may read. */
const ADMIN_ONLY_GROUPS = ['security'];

/**
 * GET /api/settings
 * Everyone signed in may read; non-admins get a reduced view.
 */
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (isAdmin) {
    return sendSuccess(res, { settings, canEdit: true });
  }

  const view = settings.toObject();
  for (const group of ADMIN_ONLY_GROUPS) delete view[group];
  if (view.whatsapp) delete view.whatsapp.businessNumber;

  return sendSuccess(res, { settings: view, canEdit: false });
});

/**
 * PUT /api/settings
 * Admin only. Accepts a partial payload.
 *
 * Nested groups are merged rather than replaced, so posting
 * `{ installment: { gracePeriodDays: 3 } }` changes that one field instead of
 * wiping the rest of the installment group back to schema defaults.
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const before = settings.toObject();

  const { _id, createdAt, updatedAt, ...updates } = req.body;

  for (const [key, value] of Object.entries(updates)) {
    const isPlainObject =
      value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

    if (isPlainObject && settings[key]) {
      const current = settings[key].toObject?.() ?? settings[key];
      settings[key] = { ...current, ...value };
    } else {
      settings[key] = value;
    }
  }

  settings.updatedBy = req.user.id;
  await settings.save();

  await logAudit({
    req,
    module: 'settings',
    action: 'security_change',
    recordId: settings._id.toString(),
    before,
    after: settings.toObject(),
    reason: `Updated settings: ${Object.keys(updates).join(', ')}`,
  });

  return sendSuccess(res, { settings }, 200, 'Settings saved.');
});
