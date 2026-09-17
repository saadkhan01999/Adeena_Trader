/**
 * ============================================
 * User Model
 * ============================================
 * Credentials, role and profile for everyone who can sign in.
 *
 * Security decisions encoded here
 * -------------------------------
 * - `password` is `select: false`, so it can never leak through a careless
 *   `User.find()` in a controller; it must be asked for explicitly.
 * - Hashing happens in a pre-save hook, so any code path that sets a password -
 *   registration, admin reset, self-service change - is covered automatically.
 * - Permissions are a virtual derived from the role, never a stored field, so a
 *   role change takes effect on the next request with no migration.
 * - Failed sign-in attempts are counted and the account locks temporarily, which
 *   makes online password guessing impractical.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, ROLE_PERMISSIONS } from '../constants/index.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
      match: [/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, underscores and dots'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: { values: Object.values(ROLES), message: '{VALUE} is not a valid role' },
      default: ROLES.SALESMAN,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      match: [/^[0-9+\-\s()]*$/, 'Please provide a valid phone number'],
    },
    /** Public URL of an uploaded avatar. */
    photo: { type: String, default: null },

    /** Free-text note shown on the Users screen, e.g. "Counter 2, evening shift". */
    designation: { type: String, default: '' },

    isActive: { type: Boolean, default: true, index: true },
    lastLogin: { type: Date, default: null },
    lastLoginIp: { type: String, default: '' },

    // ---- Password lifecycle ------------------------------------------
    passwordChangedAt: { type: Date, default: null },
    /** Forces a password change on next sign-in (set by an admin reset). */
    mustChangePassword: { type: Boolean, default: false },

    // ---- Brute-force protection --------------------------------------
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },

    // ---- Session management ------------------------------------------
    /**
     * Active refresh tokens, stored HASHED. If the database were ever exposed,
     * the raw tokens would not be, so an attacker could not mint access tokens
     * from a stolen dump.
     */
    refreshTokens: {
      type: [
        {
          tokenHash: String,
          expiresAt: Date,
          userAgent: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================================
// Virtuals
// ============================================================================

/** Permissions are always derived from the current role, never stored. */
userSchema.virtual('permissions').get(function () {
  return ROLE_PERMISSIONS[this.role] || [];
});

/** True while a temporary lockout is in force. */
userSchema.virtual('isLocked').get(function () {
  return Boolean(this.lockedUntil && this.lockedUntil > new Date());
});

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hash the password whenever it changes.
 *
 * Cost factor 12 is the current sensible balance: roughly 250 ms per hash on
 * commodity hardware - unnoticeable at sign-in, painfully slow to brute-force.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, await bcrypt.genSalt(12));

    // Stamp the change so tokens issued earlier stop working. One second is
    // subtracted because the JWT may be signed a moment before this save
    // completes, which would otherwise invalidate a token the instant it is
    // created during registration.
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Instance methods
// ============================================================================

/** Constant-time password comparison. */
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Was the password changed after this JWT was issued?
 * Used by the auth middleware to reject tokens from before a password change.
 *
 * @param {number} jwtIat `iat` claim, in seconds.
 */
userSchema.methods.changedPasswordAfter = function (jwtIat) {
  if (!this.passwordChangedAt || !jwtIat) return false;
  return jwtIat < Math.floor(this.passwordChangedAt.getTime() / 1000);
};

/**
 * Record a failed sign-in, locking the account once the limit is reached.
 *
 * @param {number} maxAttempts
 * @param {number} lockoutMinutes
 * @returns {Promise<{attempts:number, locked:boolean, lockedUntil:Date|null}>}
 */
userSchema.methods.registerFailedLogin = async function (maxAttempts = 8, lockoutMinutes = 15) {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;

  let locked = false;
  if (this.failedLoginAttempts >= maxAttempts) {
    this.lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
    this.failedLoginAttempts = 0; // Reset the counter alongside the lock
    locked = true;
  }

  await this.save({ validateBeforeSave: false });
  return { attempts: this.failedLoginAttempts, locked, lockedUntil: this.lockedUntil };
};

/** Clear the failure counter after a successful sign-in. */
userSchema.methods.registerSuccessfulLogin = async function (ip = '') {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  this.lastLoginIp = ip;
  await this.save({ validateBeforeSave: false });
};

// ============================================================================
// Indexes
// ============================================================================
// `username` and `email` already have unique indexes from their field
// definitions; declaring them again here would create duplicates.
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ name: 'text', email: 'text', username: 'text' });

const User = mongoose.model('User', userSchema);
export default User;
