/**
 * ============================================
 * Audit Log Model
 * ============================================
 * Records all mutations for compliance and traceability.
 * Tracks: user, action, module, record, before/after, reason.
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: 'System' },
    module: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'archive', 'void', 'reverse', 'payment', 'sale', 'purchase', 'ownership_change', 'zakat_change', 'security_change', 'login', 'logout'],
      required: true,
    },
    recordId: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    logDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ module: 1, logDate: -1 });
auditLogSchema.index({ user: 1, logDate: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
