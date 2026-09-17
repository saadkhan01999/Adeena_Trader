/**
 * ============================================
 * System Routes
 * ============================================
 * Dashboard, business profile, settings, notifications, audit log, global
 * search, reports, reminders and data management.
 *
 * Mounted at /api, so the paths below are absolute API paths.
 */

import express from 'express';

import { getDashboard } from '../controllers/dashboard.controller.js';
import {
  getBusinessProfile, updateBusinessProfile, uploadBranding, removeBranding,
  getSettings, updateSettings,
} from '../controllers/settings.controller.js';
import {
  getAuditLogs, getNotifications, refreshNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification, clearReadNotifications, globalSearch,
} from '../controllers/system.controller.js';
import { getReport, listReports, exportReport } from '../controllers/report.controller.js';
import {
  previewReminders, getInstallmentReminder, getCustomerReminder,
  logReminders, getReminderHistory,
} from '../controllers/reminder.controller.js';
import {
  getDataStats, exportBackup, importBackup, repairData,
  clearTransactions, clearAllData,
} from '../controllers/data.controller.js';

import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { updateBusinessProfileSchema } from '../validators/index.js';
import { uploadImage } from '../middleware/upload.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

// Everything below requires a valid session.
router.use(protect);

// ============================================================================
// Dashboard
// ============================================================================
router.get('/dashboard', requirePermission(PERMISSIONS.DASHBOARD), getDashboard);

// ============================================================================
// Global search (Ctrl+K palette)
// Results are already filtered to the caller's permissions inside the handler.
// ============================================================================
router.get('/search', globalSearch);

// ============================================================================
// Business profile
// Readable by all (invoices and headers need it), writable by admin/manager.
// ============================================================================
router.get('/business/profile', getBusinessProfile);
router.put(
  '/business/profile',
  restrictTo('admin', 'manager'),
  validateSchema({ body: updateBusinessProfileSchema }),
  updateBusinessProfile
);
router.post(
  '/business/branding',
  restrictTo('admin', 'manager'),
  (req, res, next) => { req.params.folder = 'business'; next(); },
  uploadImage.single('file'),
  uploadBranding
);
router.delete('/business/branding', restrictTo('admin', 'manager'), removeBranding);

// ============================================================================
// Settings - readable by all signed-in users, writable by admin only
// ============================================================================
router.get('/settings', getSettings);
router.put('/settings', restrictTo('admin'), updateSettings);

// ============================================================================
// Notifications
// ============================================================================
router.get('/notifications', getNotifications);
router.post('/notifications/refresh', refreshNotifications);
router.put('/notifications/read-all', markAllNotificationsRead);
router.put('/notifications/:id/read', markNotificationRead);
router.delete('/notifications/clear-read', clearReadNotifications);
router.delete('/notifications/:id', deleteNotification);

// ============================================================================
// Reports
// `/reports` must be declared before `/reports/:type` or the literal path
// would be swallowed by the parameterised one.
// ============================================================================
router.get('/reports', requirePermission(PERMISSIONS.REPORTS), listReports);
router.get('/reports/:type/export', requirePermission(PERMISSIONS.REPORTS), exportReport);
router.get('/reports/:type', requirePermission(PERMISSIONS.REPORTS), getReport);

// ============================================================================
// Payment reminders
// ============================================================================
router.get('/reminders', requirePermission(PERMISSIONS.PAYMENTS), getReminderHistory);
router.get('/reminders/generate', requirePermission(PERMISSIONS.INSTALLMENTS), previewReminders);
router.get(
  '/reminders/installment/:saleId/:installmentNumber',
  requirePermission(PERMISSIONS.INSTALLMENTS),
  getInstallmentReminder
);
router.get('/reminders/customer/:customerId', requirePermission(PERMISSIONS.CUSTOMERS), getCustomerReminder);
router.post('/reminders/log', requirePermission(PERMISSIONS.INSTALLMENTS), logReminders);

// ============================================================================
// Audit log - admin only
// ============================================================================
router.get('/audit-logs', restrictTo('admin'), getAuditLogs);

// ============================================================================
// Data management - admin only, destructive actions need a typed confirmation
// ============================================================================
router.get('/data/stats', restrictTo('admin'), getDataStats);
router.get('/data/backup', restrictTo('admin'), exportBackup);
router.post('/data/restore', restrictTo('admin'), importBackup);
router.post('/data/repair', restrictTo('admin'), repairData);
router.delete('/data/transactions', restrictTo('admin'), clearTransactions);
router.delete('/data/all', restrictTo('admin'), clearAllData);

export default router;
