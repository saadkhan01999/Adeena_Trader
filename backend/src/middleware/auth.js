/**
 * ============================================
 * JWT Authentication Middleware
 * ============================================
 * Verifies the access token, then re-checks the user against the database.
 *
 * Why hit the database on every request?
 * --------------------------------------
 * A JWT is a snapshot. Without the lookup, a user who was deactivated or had
 * their role downgraded would keep full access until their token expired. The
 * query is indexed and returns a lean document, so the cost is negligible next
 * to the security guarantee.
 */

import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import { UnauthorizedError } from '../utils/AppError.js';
import { ROLE_PERMISSIONS } from '../constants/index.js';

/**
 * Pull a bearer token out of the Authorization header.
 * @returns {string|null}
 */
const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
};

/**
 * Build the `req.user` shape used by controllers and RBAC.
 * Permissions are derived from the role at request time (never trusted from
 * the token) so a role change takes effect immediately.
 */
const toRequestUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  username: user.username,
  role: user.role,
  permissions: ROLE_PERMISSIONS[user.role] || [],
});

/**
 * Protect a route. Rejects anything without a valid, current session.
 */
export const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    // 1. Verify signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Session expired. Please log in again.');
      }
      throw new UnauthorizedError('Invalid session. Please log in again.');
    }

    // 2. Confirm the account still exists and is still allowed in
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      throw new UnauthorizedError('This account no longer exists.');
    }
    if (!user.isActive) {
      throw new UnauthorizedError('This account has been deactivated. Contact your administrator.');
    }

    // 3. A password change invalidates every token issued before it
    if (user.changedPasswordAfter(decoded.iat)) {
      throw new UnauthorizedError('Password was changed recently. Please log in again.');
    }

    req.user = toRequestUser(user);
    req.userDoc = user; // Controllers that need the full document can reuse it
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Attach the user when a valid token is present, but never reject.
 * Used by endpoints that work anonymously yet personalise when signed in.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) {
        req.user = toRequestUser(user);
        req.userDoc = user;
      }
    }
  } catch {
    // Intentionally silent - authentication is optional here.
  }
  next();
};
