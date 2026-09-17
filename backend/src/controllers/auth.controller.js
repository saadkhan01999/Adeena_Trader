/**
 * ============================================
 * Auth Controller
 * ============================================
 * Sign-in, session refresh, sign-out, password change, profile and first-run
 * setup.
 *
 * Sign-in accepts either an email address or a username. Staff created by the
 * administrator are given a username they can actually remember; the owner
 * tends to use their email. One field, one endpoint, either identifier.
 */

import crypto from 'node:crypto';

import User from '../models/User.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';
import { generateTokens, verifyRefreshToken } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { toFileDescriptor, removeUploadedFile } from '../middleware/upload.js';
import env from '../config/env.js';
import { refreshCookieOptions } from '../utils/cookiePolicy.js';
import { ROLES, ROLE_META, ROLE_PERMISSIONS } from '../constants/index.js';

// ============================================================================
// Helpers
// ============================================================================

/** Hash a refresh token before storing it. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** The user shape returned to the client. Never includes credential material. */
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  roleLabel: ROLE_META[user.role]?.label || user.role,
  phone: user.phone,
  photo: user.photo,
  designation: user.designation,
  permissions: ROLE_PERMISSIONS[user.role] || [],
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  lastLogin: user.lastLogin,
});

/**
 * Persist a refresh token against the user, hashed.
 *
 * Expired entries are pruned and the list is capped at five, so a user who
 * signs in from several devices does not accumulate tokens without limit.
 */
const storeRefreshToken = async (user, token, userAgent = '') => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.COOKIE_EXPIRES_DAYS * 86_400_000);

  const kept = (user.refreshTokens || []).filter((t) => t.expiresAt > now).slice(-4);
  kept.push({ tokenHash: hashToken(token), expiresAt, userAgent, createdAt: now });

  user.refreshTokens = kept;
  await user.save({ validateBeforeSave: false });
};

// ============================================================================
// Sign-in
// ============================================================================

/**
 * POST /api/auth/login
 * Body: { identifier | email, password, rememberMe }
 *
 * Failure messages are deliberately identical whether the account does not
 * exist or the password is wrong. Distinguishing them would let an attacker
 * enumerate valid usernames.
 */
export const login = asyncHandler(async (req, res) => {
  const { identifier, email, password, rememberMe = false } = req.body;

  const login = String(identifier || email || '').trim().toLowerCase();
  if (!login || !password) {
    throw new BadRequestError('Enter your username or email and your password.');
  }

  const settings = await Settings.getSingleton();

  const user = await User.findOne({ $or: [{ email: login }, { username: login }] }).select(
    '+password +failedLoginAttempts +lockedUntil +refreshTokens'
  );

  const INVALID = 'Those sign-in details are not correct. Please check and try again.';
  if (!user) throw new UnauthorizedError(INVALID);

  // ---- Locked out? --------------------------------------------------
  if (user.isLocked) {
    const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60_000);
    throw new UnauthorizedError(
      `Too many failed attempts. This account is locked for another ${minutes} minute(s).`
    );
  }

  // ---- Deactivated? -------------------------------------------------
  if (!user.isActive) {
    throw new UnauthorizedError(
      'This account has been deactivated. Please contact your administrator.'
    );
  }

  // ---- Password -----------------------------------------------------
  if (!(await user.comparePassword(password))) {
    const { locked, lockedUntil } = await user.registerFailedLogin(
      settings.security.maxLoginAttempts,
      settings.security.lockoutMinutes
    );

    if (locked) {
      const minutes = Math.ceil((lockedUntil - Date.now()) / 60_000);
      throw new UnauthorizedError(
        `Too many failed attempts. This account is locked for ${minutes} minute(s).`
      );
    }
    throw new UnauthorizedError(INVALID);
  }

  // ---- Success ------------------------------------------------------
  const { accessToken, refreshToken } = generateTokens(user);

  await user.registerSuccessfulLogin(req.ip);
  await storeRefreshToken(user, refreshToken, req.headers['user-agent'] || '');

  res.cookie('refreshToken', refreshToken, refreshCookieOptions(req, rememberMe));

  await logAudit({
    req: { user: { id: user._id, name: user.name }, ip: req.ip, headers: req.headers },
    module: 'auth',
    action: 'login',
    recordId: user._id.toString(),
    reason: `Signed in as ${ROLE_META[user.role]?.label || user.role}`,
  });

  return sendSuccess(
    res,
    { user: publicUser(user), accessToken },
    200,
    `Welcome back, ${user.name.split(' ')[0]}.`
  );
});

/**
 * POST /api/auth/refresh
 * Exchange the refresh cookie for a new access token, rotating the refresh
 * token in the process.
 *
 * Rotation matters: if a refresh token is stolen, it is single-use, so the
 * first party to redeem it invalidates it for the other.
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new UnauthorizedError('Your session has ended. Please sign in again.');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (error) {
    res.clearCookie('refreshToken', refreshCookieOptions(req));
    throw new UnauthorizedError(error.message);
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.isActive) {
    res.clearCookie('refreshToken', refreshCookieOptions(req));
    throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
  }

  // The presented token must be one we actually issued and not yet expired
  const presented = hashToken(token);
  const match = (user.refreshTokens || []).find(
    (t) => t.tokenHash === presented && t.expiresAt > new Date()
  );

  if (!match) {
    // Either replayed after rotation or forged. Drop every session for this
    // user - if a token really was stolen, this ends the attacker's access.
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
    res.clearCookie('refreshToken', refreshCookieOptions(req));
    throw new UnauthorizedError('Your session has expired. Please sign in again.');
  }

  const { accessToken, refreshToken: rotated } = generateTokens(user);

  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== presented);
  await storeRefreshToken(user, rotated, req.headers['user-agent'] || '');

  res.cookie('refreshToken', rotated, refreshCookieOptions(req, true));

  return sendSuccess(res, { accessToken, user: publicUser(user) }, 200, 'Session refreshed.');
});

/**
 * POST /api/auth/logout
 * Clears the cookie and revokes the presented refresh token server-side, so
 * signing out genuinely ends the session rather than only forgetting it locally.
 */
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      const user = await User.findById(decoded.id).select('+refreshTokens');
      if (user) {
        const presented = hashToken(token);
        user.refreshTokens = (user.refreshTokens || []).filter((t) => t.tokenHash !== presented);
        await user.save({ validateBeforeSave: false });
      }
    } catch {
      // An expired or malformed token still results in a successful sign-out.
    }
  }

  res.clearCookie('refreshToken', refreshCookieOptions(req));

  if (req.user) {
    await logAudit({ req, module: 'auth', action: 'logout', recordId: req.user.id });
  }

  return sendSuccess(res, null, 200, 'You have been signed out.');
});

// ============================================================================
// Profile
// ============================================================================

/** GET /api/auth/me */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new NotFoundError('User');
  return sendSuccess(res, { user: publicUser(user) });
});

/**
 * PUT /api/auth/change-password
 * Enforces the password policy configured in Settings.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const settings = await Settings.getSingleton();

  const user = await User.findById(req.user.id).select('+password');
  if (!user) throw new NotFoundError('User');

  if (!(await user.comparePassword(currentPassword))) {
    throw new BadRequestError('Your current password is not correct.');
  }
  if (currentPassword === newPassword) {
    throw new BadRequestError('Your new password must be different from the current one.');
  }
  if (newPassword.length < settings.security.minPasswordLength) {
    throw new BadRequestError(
      `Your password must be at least ${settings.security.minPasswordLength} characters.`
    );
  }
  if (settings.security.requireStrongPassword) {
    const strong = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
    if (!strong) {
      throw new BadRequestError('Your password must contain both letters and numbers.');
    }
  }

  user.password = newPassword;
  user.mustChangePassword = false;

  // Revoke every session, then immediately issue a fresh pair for the device
  // making the change. Other devices are signed out - which is the point - but
  // the person who just changed their password is not thrown back to the
  // sign-in screen for doing the right thing.
  user.refreshTokens = [];
  await user.save();

  const { accessToken, refreshToken: newRefresh } = generateTokens(user);

  const withTokens = await User.findById(user._id).select('+refreshTokens');
  await storeRefreshToken(withTokens, newRefresh, req.headers['user-agent'] || '');
  res.cookie('refreshToken', newRefresh, refreshCookieOptions(req, true));

  await logAudit({
    req,
    module: 'auth',
    action: 'security_change',
    recordId: user._id.toString(),
    reason: 'Changed own password',
  });

  return sendSuccess(
    res,
    { accessToken, user: publicUser(user) },
    200,
    'Password changed. Other devices have been signed out for your security.'
  );
});

/** PUT /api/auth/profile - update own name, phone, photo and designation. */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new NotFoundError('User');

  const before = { name: user.name, phone: user.phone, designation: user.designation };

  // Role, email, username and isActive are deliberately not editable here -
  // letting a user change their own role would be a privilege escalation.
  for (const field of ['name', 'phone', 'photo', 'designation']) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }

  await user.save();

  await logAudit({
    req,
    module: 'users',
    action: 'update',
    recordId: user._id.toString(),
    before,
    after: { name: user.name, phone: user.phone, designation: user.designation },
    reason: 'Updated own profile',
  });

  return sendSuccess(res, { user: publicUser(user) }, 200, 'Profile updated.');
});

/** POST /api/auth/profile/photo - upload own avatar. */
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No image received. Attach a JPG, PNG or WEBP file.');

  const user = await User.findById(req.user.id);
  if (!user) throw new NotFoundError('User');

  if (user.photo) removeUploadedFile(user.photo);
  user.photo = toFileDescriptor(req.file, req.uploadBucket).url;
  await user.save();

  return sendSuccess(res, { user: publicUser(user) }, 200, 'Profile photo updated.');
});

// ============================================================================
// First-run setup
// ============================================================================

/**
 * GET /api/auth/setup-status
 * Public. Tells the client whether to show the setup wizard or the sign-in
 * screen, and which roles exist so the sign-in form can offer them.
 */
export const getSetupStatus = asyncHandler(async (req, res) => {
  const [userCount, hasBusiness] = await Promise.all([
    User.countDocuments(),
    BusinessProfile.countDocuments(),
  ]);

  // The sign-in screen shows only roles that actually have an account, so staff
  // are not offered a role nobody has been given.
  const activeRoles = userCount > 0 ? await User.distinct('role', { isActive: true }) : [];

  let business = null;
  if (hasBusiness > 0) {
    const profile = await BusinessProfile.findOne().select('name tagline logo owner phone address city');
    business = profile;
  }

  return sendSuccess(res, {
    isSetupRequired: userCount === 0,
    userCount,
    hasBusinessProfile: hasBusiness > 0,
    business,
    roles: activeRoles.map((role) => ({
      role,
      label: ROLE_META[role]?.label || role,
      description: ROLE_META[role]?.description || '',
    })),
  });
});

/**
 * POST /api/auth/setup
 * Create the first administrator and the business profile.
 * Guarded by a user count of zero, so it cannot be replayed later.
 */
export const initialSetup = asyncHandler(async (req, res) => {
  const { admin, business } = req.body;

  if ((await User.countDocuments()) > 0) {
    throw new BadRequestError('Setup has already been completed. Please sign in instead.');
  }
  if (!admin?.email || !admin?.password) {
    throw new BadRequestError('An email address and password are required for the administrator.');
  }
  if (admin.password.length < 8) {
    throw new BadRequestError('Choose an administrator password of at least 8 characters.');
  }

  const adminUser = await User.create({
    name: admin.name || 'Administrator',
    username: (admin.username || 'admin').toLowerCase(),
    email: admin.email.toLowerCase(),
    password: admin.password,
    role: ROLES.ADMIN,
    phone: admin.phone || '',
  });

  const profile = await BusinessProfile.getSingleton();
  Object.assign(profile, business || {});
  await profile.save();

  // Create the settings singleton now, so the first screens have values to read
  await Settings.getSingleton();

  const { accessToken, refreshToken: refresh } = generateTokens(adminUser);
  const withTokens = await User.findById(adminUser._id).select('+refreshTokens');
  await storeRefreshToken(withTokens, refresh, req.headers['user-agent'] || '');

  res.cookie('refreshToken', refresh, refreshCookieOptions(req, true));

  return sendSuccess(
    res,
    { user: publicUser(adminUser), accessToken, business: profile },
    201,
    'Setup complete. Welcome to ADEENA TRADERS.'
  );
});
