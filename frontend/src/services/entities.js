/**
 * ============================================
 * Entity Services
 * ============================================
 * A thin, typed-by-convention wrapper over every API endpoint.
 *
 * Screens import from here rather than calling `api.get('/customers')` inline,
 * so a route change is a one-line edit in this file instead of a hunt across
 * twenty components.
 */

import api, { downloadFromApi } from './api.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build the standard CRUD surface for a collection endpoint.
 * Individual services extend the result with their own extras.
 */
const crud = (resource) => ({
  list: (params) => api.get(`/${resource}`, { params }),
  get: (id) => api.get(`/${resource}/${id}`),
  create: (data) => api.post(`/${resource}`, data),
  update: (id, data) => api.put(`/${resource}/${id}`, data),
  delete: (id, params) => api.delete(`/${resource}/${id}`, { params }),
});

/** Wrap a single file into the FormData shape the upload endpoints expect. */
const fileForm = (file, field = 'file') => {
  const form = new FormData();
  form.append(field, file);
  return form;
};

/** Wrap several files into one FormData. */
const filesForm = (files, field = 'files') => {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append(field, file));
  return form;
};

// ============================================================================
// Catalogue
// ============================================================================
export const productService = {
  ...crud('products'),
  getLowStock: () => api.get('/products/low-stock'),
  uploadImages: (id, files) => api.post(`/products/${id}/images`, filesForm(files, 'images')),
  deleteImage: (id, index) => api.delete(`/products/${id}/images/${index}`),
  setPrimaryImage: (id, index) => api.put(`/products/${id}/images/${index}/primary`),
};

export const categoryService = crud('categories');

// ============================================================================
// People
// ============================================================================
export const customerService = {
  ...crud('customers'),
  getLedger: (id, params) => api.get(`/customers/${id}/ledger`, { params }),
  /** @param {'photo'|'cnicFrontPhoto'|'cnicBackPhoto'} field */
  uploadPhoto: (id, file, field = 'photo') =>
    api.post(`/customers/${id}/photo`, fileForm(file, 'photo'), { params: { field } }),
  uploadDocuments: (id, files, type = 'other') =>
    api.post(`/customers/${id}/documents`, filesForm(files), { params: { type } }),
  deleteDocument: (id, index) => api.delete(`/customers/${id}/documents/${index}`),
};

export const supplierService = crud('suppliers');

export const partnerService = {
  ...crud('partners'),
  getDashboard: (id) => api.get(`/partners/${id}/dashboard`),
};

export const investorService = {
  ...crud('investors'),
  getDashboard: () => api.get('/investors/dashboard'),
  addInvestment: (id, data) => api.post(`/investors/${id}/investments`, data),
  recordPayout: (id, data) => api.post(`/investors/${id}/payouts`, data),
};

// ============================================================================
// Trading
// ============================================================================
export const saleService = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  /** The installment worklist: overdue, due today, upcoming, later. */
  getInstallments: (params) => api.get('/sales/overdue/list', { params }),
  issueAgreement: (id) => api.post(`/sales/${id}/agreement`),
};

export const paymentService = {
  list: (params) => api.get('/payments', { params }),
  get: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
};

export const purchaseService = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
};

export const expenseService = crud('expenses');

export const returnService = {
  list: (params) => api.get('/returns', { params }),
  create: (data) => api.post('/returns', data),
};

// ============================================================================
// Agreements & documents
// ============================================================================
export const agreementService = {
  ...crud('agreements'),
  sign: (id, data) => api.post(`/agreements/${id}/sign`, data),
  regenerate: (id) => api.post(`/agreements/${id}/regenerate`),
  addAttachments: (id, files, label) => {
    const form = filesForm(files);
    if (label) form.append('label', label);
    return api.post(`/agreements/${id}/attachments`, form);
  },
  removeAttachment: (id, index) => api.delete(`/agreements/${id}/attachments/${index}`),
  cancel: (id, reason) => api.delete(`/agreements/${id}`, { data: { reason } }),
};

export const templateService = {
  list: () => api.get('/templates'),
  get: (type) => api.get(`/templates/${type}`),
  update: (type, data) => api.put(`/templates/${type}`, data),
  reset: (type) => api.post(`/templates/${type}/reset`),
  getDefault: (type) => api.get(`/templates/${type}/default`),
};

export const customFieldService = {
  list: (params) => api.get('/custom-fields', { params }),
  create: (data) => api.post('/custom-fields', data),
  update: (id, data) => api.put(`/custom-fields/${id}`, data),
  delete: (id, hard = false) => api.delete(`/custom-fields/${id}`, { params: { hard } }),
  reorder: (module, orderedIds) => api.put('/custom-fields/reorder', { module, orderedIds }),
};

// ============================================================================
// Zakat
// ============================================================================
export const zakatService = {
  getSettings: () => api.get('/zakat/settings'),
  updateSettings: (data) => api.put('/zakat/settings', data),
  previewNisab: (params) => api.get('/zakat/nisab-preview', { params }),
  /** Live zakatable position, used to pre-fill the calculator. */
  getAssets: (params) => api.get('/zakat/assets', { params }),
  calculate: (data) => api.post('/zakat/calculate', data),
  getHistory: (params) => api.get('/zakat/history', { params }),
  get: (id) => api.get(`/zakat/${id}`),
  recordPayment: (id, data) => api.put(`/zakat/${id}/payment`, data),
  delete: (id) => api.delete(`/zakat/${id}`),
};

// ============================================================================
// Users
// ============================================================================
export const userService = {
  ...crud('users'),
  resetPassword: (id, data) => api.put(`/users/${id}/reset-password`, data),
  getRoles: () => api.get('/users/roles'),
};

// ============================================================================
// Dashboard, settings & system
// ============================================================================
export const dashboardService = {
  get: (ownership = 'all', days = 7) => api.get('/dashboard', { params: { ownership, days } }),
};

export const businessService = {
  get: () => api.get('/business/profile'),
  update: (data) => api.put('/business/profile', data),
  /** @param {'logo'|'stamp'|'signature'} field */
  uploadBranding: (file, field = 'logo') =>
    api.post('/business/branding', fileForm(file), { params: { field } }),
  removeBranding: (field) => api.delete('/business/branding', { params: { field } }),
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const notificationService = {
  list: (params) => api.get('/notifications', { params }),
  /** Re-scan the business for alert conditions right now. */
  refresh: () => api.post('/notifications/refresh'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications/clear-read'),
};

export const reminderService = {
  /** Preview the messages that would be sent - nothing is logged. */
  preview: (params) => api.get('/reminders/generate', { params }),
  forInstallment: (saleId, installmentNumber) =>
    api.get(`/reminders/installment/${saleId}/${installmentNumber}`),
  forCustomer: (customerId) => api.get(`/reminders/customer/${customerId}`),
  /** Record that the reminders were actually sent. */
  log: (reminders, channel = 'whatsapp') => api.post('/reminders/log', { reminders, channel }),
  history: (params) => api.get('/reminders', { params }),
};

export const reportService = {
  list: () => api.get('/reports'),
  get: (type, params) => api.get(`/reports/${type}`, { params }),
  /** Streams a CSV of the complete result set, not just the visible page. */
  exportCSV: (type, params) =>
    downloadFromApi(`/reports/${type}/export`, params, `${type}-report.csv`),
};

export const systemService = {
  search: (q, limit = 5) => api.get('/search', { params: { q, limit } }),
  getAuditLogs: (params) => api.get('/audit-logs', { params }),
};

export const dataService = {
  getStats: () => api.get('/data/stats'),
  downloadBackup: (includeLogs = false) =>
    downloadFromApi('/data/backup', { includeLogs }, 'adeena-traders-backup.json'),
  restore: (backup, mode = 'merge', confirm) =>
    api.post('/data/restore', { backup, mode, confirm }),
  repair: () => api.post('/data/repair'),
  clearTransactions: () => api.delete('/data/transactions', { data: { confirm: 'CLEAR TRANSACTIONS' } }),
  clearAll: (password) => api.delete('/data/all', { data: { confirm: 'DELETE EVERYTHING', password } }),
};

export const uploadService = {
  /** @param {'customers'|'products'|'agreements'|'expenses'|'business'|'users'|'misc'} folder */
  upload: (file, folder = 'misc') => api.post(`/uploads/${folder}`, fileForm(file)),
  uploadMany: (files, folder = 'misc') => api.post(`/uploads/${folder}/multiple`, filesForm(files)),
  remove: (url) => api.delete('/uploads', { params: { url } }),
  getStats: () => api.get('/uploads/stats'),
};
