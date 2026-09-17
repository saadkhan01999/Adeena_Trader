/**
 * ============================================
 * Role-Based Authorization Middleware
 * ============================================
 * Restricts endpoint access to specific roles or permissions.
 * Must be used AFTER protect() middleware.
 */

import { ForbiddenError, UnauthorizedError } from '../utils/AppError.js';
import { ROLE_PERMISSIONS, PERMISSIONS } from '../constants/index.js';

/**
 * Restrict access to specific roles.
 * Usage: router.post('/', protect, restrictTo('admin', 'manager'), handler)
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }
    next();
  };
};

/**
 * Restrict access to users with specific permission.
 * Usage: router.get('/', protect, requirePermission('products'), handler)
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user's role grants this permission
    const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
    if (!rolePermissions.includes(permission)) {
      return next(new ForbiddenError(`You need the '${permission}' permission to access this resource.`));
    }

    next();
  };
};

/**
 * Check if user has any of the given permissions.
 */
export const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasPermission = permissions.some((p) => rolePermissions.includes(p));

    if (!hasPermission) {
      return next(new ForbiddenError('Insufficient permissions.'));
    }

    next();
  };
};
