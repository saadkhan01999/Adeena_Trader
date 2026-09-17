/**
 * ============================================
 * Audit Log Middleware
 * ============================================
 * Records mutations for compliance and traceability.
 * Captures: user, action, module, recordId, before/after values.
 */

import AuditLog from '../models/AuditLog.js';

/**
 * Create an audit log entry.
 * Call this from controllers after successful mutations.
 *
 * @param {object} params
 * @param {object} params.req      - Express request (for user info)
 * @param {string} params.module   - Module name (e.g., 'sales', 'products')
 * @param {string} params.action   - Action type (create, update, delete, void, etc.)
 * @param {string} params.recordId - ID of affected record
 * @param {object} params.before   - Previous state (for updates)
 * @param {object} params.after    - New state
 * @param {string} params.reason   - Optional reason (required for voids/reversals)
 */
export const logAudit = async ({ req, module, action, recordId, before = null, after = null, reason = null }) => {
  try {
    await AuditLog.create({
      user: req.user?.id || null,
      userName: req.user?.name || 'System',
      module,
      action,
      recordId,
      before,
      after,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('[AUDIT] Failed to log:', error.message);
  }
};
