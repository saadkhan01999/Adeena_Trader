/**
 * ============================================
 * User Controller
 * ============================================
 * Staff account management, available to administrators only.
 *
 * Guard rails
 * -----------
 * - The last active administrator can never be disabled or demoted. Losing
 *   every admin means nobody can reach Settings or Users again, which can only
 *   be fixed at the database.
 * - An administrator cannot change their own role or disable themselves; those
 *   are the two ways to lock yourself out by accident.
 * - Passwords are never returned, and are only ever set through create or the
 *   dedicated reset endpoint.
 */

import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, removeUploadedFile } from '../middleware/upload.js';
import Settings from '../models/Settings.js';
import { ROLES, ROLE_PERMISSIONS, ROLE_META } from '../constants/index.js';

/** Escape user input before it becomes part of a regular expression. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Refuse an operation that would remove the last active administrator.
 * @param {string} excludeId The user being changed, excluded from the count.
 */
const assertNotLastAdmin = async (user, excludeId) => {
  if (user.role !== ROLES.ADMIN) return;

  const remaining = await User.countDocuments({
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: excludeId },
  });

  if (remaining === 0) {
    throw new BadRequestError(
      'This is the only active administrator. Promote another user to administrator first.'
    );
  }
};

/**
 * GET /api/users
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [{ name: rx }, { username: rx }, { email: rx }, { phone: rx }];
  }
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(query),
  ]);

  return sendSuccess(res, {
    users,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

/** GET /api/users/:id */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');
  return sendSuccess(res, { user });
});

/**
 * POST /api/users
 * Create a staff account.
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, username, email, password, role, phone, designation, photo, mustChangePassword } = req.body;

  const settings = await Settings.getSingleton();

  if (password.length < settings.security.minPasswordLength) {
    throw new BadRequestError(
      `The password must be at least ${settings.security.minPasswordLength} characters.`
    );
  }

  // Check both uniqueness constraints up front, so the message names the field
  const [existingEmail, existingUsername] = await Promise.all([
    User.findOne({ email: email.toLowerCase() }),
    User.findOne({ username: username.toLowerCase() }),
  ]);

  if (existingEmail) throw new ConflictError(`${email} is already used by another account.`);
  if (existingUsername) throw new ConflictError(`The username "${username}" is already taken.`);

  const user = await User.create({
    name,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    role: role || ROLES.SALESMAN,
    phone: phone || '',
    designation: designation || '',
    photo: photo || null,
    // Default to true: a password an administrator chose should not stay in use
    mustChangePassword: mustChangePassword ?? true,
  });

  await logAudit({
    req,
    module: 'users',
    action: 'create',
    recordId: user._id.toString(),
    after: { name: user.name, username: user.username, email: user.email, role: user.role },
    reason: `Created a ${ROLE_META[user.role]?.label || user.role} account`,
  });

  return sendSuccess(
    res,
    { user },
    201,
    `${user.name} can now sign in as ${ROLE_META[user.role]?.label || user.role}.`
  );
});

/**
 * PUT /api/users/:id
 * Credentials are not editable here - use the reset endpoint for a password,
 * and the username is immutable so audit history stays attributable.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');

  const isSelf = req.user.id === user._id.toString();
  const before = {
    name: user.name, email: user.email, role: user.role,
    isActive: user.isActive, designation: user.designation,
  };

  const { name, email, role, phone, designation, photo, isActive, mustChangePassword } = req.body;

  // ---- Role changes ------------------------------------------------
  if (role !== undefined && role !== user.role) {
    if (isSelf) {
      throw new ForbiddenError('You cannot change your own role. Ask another administrator.');
    }
    await assertNotLastAdmin(user, user._id);
    user.role = role;
  }

  // ---- Deactivation ------------------------------------------------
  if (isActive !== undefined && isActive !== user.isActive) {
    if (isSelf && !isActive) {
      throw new ForbiddenError('You cannot disable your own account.');
    }
    if (!isActive) await assertNotLastAdmin(user, user._id);
    user.isActive = isActive;
  }

  // ---- Email -------------------------------------------------------
  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (existing) throw new ConflictError(`${email} is already used by another account.`);
    user.email = email.toLowerCase();
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (designation !== undefined) user.designation = designation;
  if (photo !== undefined) user.photo = photo;
  if (mustChangePassword !== undefined) user.mustChangePassword = mustChangePassword;

  await user.save();

  await logAudit({
    req,
    module: 'users',
    action: 'update',
    recordId: user._id.toString(),
    before,
    after: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });

  return sendSuccess(res, { user }, 200, 'User updated.');
});

/**
 * PUT /api/users/:id/reset-password
 *
 * The new password is set by an administrator and handed over directly. Every
 * existing session for that user is revoked, so a device they no longer control
 * cannot keep working.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword, mustChangePassword = true } = req.body;
  const settings = await Settings.getSingleton();

  if (!newPassword || newPassword.length < settings.security.minPasswordLength) {
    throw new BadRequestError(
      `The password must be at least ${settings.security.minPasswordLength} characters.`
    );
  }

  const user = await User.findById(req.params.id).select('+password +refreshTokens');
  if (!user) throw new NotFoundError('User');

  user.password = newPassword;
  user.mustChangePassword = mustChangePassword;
  user.refreshTokens = [];   // Revoke every active session
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;   // A reset also clears a lockout
  await user.save();

  await logAudit({
    req,
    module: 'users',
    action: 'security_change',
    recordId: user._id.toString(),
    reason: `Administrator reset the password for ${user.name}`,
  });

  return sendSuccess(
    res,
    null,
    200,
    `Password reset. Give ${user.name.split(' ')[0]} the new password directly — it is not sent anywhere.`
  );
});

/**
 * POST /api/users/:id/photo
 */
export const uploadUserPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No image received. Attach a JPG, PNG or WEBP file.');

  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');

  if (user.photo) removeUploadedFile(user.photo);
  user.photo = toFileDescriptor(req.file, req.uploadBucket).url;
  await user.save();

  return sendSuccess(res, { user }, 200, 'Photo updated.');
});

/**
 * DELETE /api/users/:id
 * Deactivates rather than deletes: audit entries, sales and payments reference
 * the user, and removing the record would orphan that history.
 */
/**
 * DELETE /api/users/:id
 *
 * Permanent: the account is removed and can never sign in again. Records the
 * user created (sales, payments...) are untouched and still show who made them
 * through the audit log. To stop someone signing in without deleting them,
 * switch the account off from Edit instead.
 *
 * Nobody can delete their own account, and the last active administrator
 * cannot be deleted - either would lock the shop out of its own system.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');

  if (req.user.id === user._id.toString()) {
    throw new ForbiddenError('You cannot delete your own account.');
  }

  await assertNotLastAdmin(user, user._id);

  if (user.photo) removeUploadedFile(user.photo);
  await User.findByIdAndDelete(user._id);

  await logAudit({
    req,
    module: 'users',
    action: 'delete',
    recordId: user._id.toString(),
    before: { name: user.name, email: user.email, username: user.username, role: user.role },
    reason: `Deleted the account for ${user.name} permanently`,
  });

  return sendSuccess(res, null, 200, `${user.name}'s account has been deleted permanently.`);
});

/**
 * GET /api/users/roles
 * Roles with their labels, descriptions and the modules each unlocks.
 * Drives the role picker and the permission preview in the Users screen.
 */
export const getRoles = asyncHandler(async (req, res) => {
  const roles = Object.values(ROLES).map((role) => ({
    role,
    label: ROLE_META[role]?.label || role,
    description: ROLE_META[role]?.description || '',
    permissions: ROLE_PERMISSIONS[role] || [],
  }));

  return sendSuccess(res, { roles });
});
