/**
 * ============================================
 * Auth Service
 * ============================================
 * Handles JWT token generation, verification, and password operations.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import env from '../config/env.js';

/**
 * Generate JWT access token (short-lived, 15 min default).
 * Contains: id, role, email, name, permissions
 */
export const generateAccessToken = (user) => {
  const payload = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
    name: user.name,
    permissions: user.permissions || [],
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Generate JWT refresh token (long-lived, 7 days default).
 * Contains only: id, tokenVersion (for invalidation)
 */
export const generateRefreshToken = (user) => {
  const payload = {
    id: user._id.toString(),
    type: 'refresh',
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Generate both access and refresh tokens.
 */
export const generateTokens = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

/**
 * Verify refresh token and return decoded payload.
 * Throws if invalid/expired.
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired. Please log in again.');
    }
    throw new Error('Invalid refresh token.');
  }
};

/**
 * Hash a password using bcrypt.
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Compare a candidate password against a hash.
 */
export const comparePassword = async (candidatePassword, hash) => {
  return bcrypt.compare(candidatePassword, hash);
};

/**
 * Generate a random token (for password reset, etc).
 */
export const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
