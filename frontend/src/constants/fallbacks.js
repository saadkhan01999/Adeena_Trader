/**
 * ============================================
 * Offline Fallbacks
 * ============================================
 * Minimal, schema-shaped defaults used when the server cannot be reached or a
 * user is not permitted to read a settings group.
 *
 * Why these exist
 * ---------------
 * Half the UI reads `settings.installment.defaultPlan` or
 * `business.currencySymbol` while rendering. Without a fallback, a failed
 * request turns into a white screen from an "undefined is not an object"
 * error. With one, the app degrades to sensible defaults and shows an offline
 * banner instead - which is what a shop with patchy internet actually needs.
 */

import { APP_NAME, APP_TAGLINE, APP_OWNER, APP_PHONE, APP_ALT_PHONE, APP_ADDRESS } from './index.js';

export const BUSINESS_FALLBACK = {
  name: APP_NAME,
  tagline: APP_TAGLINE,
  owner: APP_OWNER,
  phone: APP_PHONE,
  alternatePhone: APP_ALT_PHONE,
  address: APP_ADDRESS,
  city: 'Mardan',
  country: 'Pakistan',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  logo: null,
  stamp: null,
  signature: null,
  invoicePrefix: 'INV',
  receiptPrefix: 'RCP',
  agreementPrefix: 'AGR',
  termsAndConditions: '',
  invoiceFooter: 'Thank you for your business.',
  receiptFooter: 'This is a computer-generated receipt.',
};

export const SETTINGS_FALLBACK = {
  installment: {
    defaultPlan: 6,
    gracePeriodDays: 0,
    roundingRule: 'round',
    lateStatusBehavior: 'strict',
    minAdvancePercent: 0,
    requireGuarantor: true,
    autoGenerateAgreement: true,
  },
  payment: {
    acceptedMethods: ['cash', 'bank', 'card', 'other'],
    receiptPrefix: 'RCP',
    allocationRule: 'oldest_first',
    allowPartialPayment: true,
    sendThankYouMessage: true,
  },
  product: {
    skuPrefix: 'PRD',
    lowStockThreshold: 5,
    defaultWarrantyMonths: 0,
    requireSerial: false,
    preventNegativeStock: true,
    defaultInstallmentMarkupPercent: 20,
  },
  ownership: { defaultPartnerShare: 40, profitSplitMode: 'by_share' },
  investor: {
    defaultProfitPercentage: 10,
    defaultCalcMethod: 'fixed_percent',
    payoutFrequency: 'monthly',
    autoGenerateAgreement: true,
  },
  appearance: {
    theme: 'light',
    primaryColor: '#0b192c',
    accentColor: '#f59e0b',
    sidebarCollapsed: false,
    density: 'comfortable',
  },
  notification: {
    enabled: true,
    upcomingDueDays: 3,
    lowStockAlerts: true,
    overdueAlerts: true,
    supplierPayableAlerts: true,
    investorPayoutAlerts: true,
    zakatReminder: true,
    soundEnabled: false,
  },
  whatsapp: {
    enabled: true,
    businessNumber: '',
    reminderCooldownHours: 20,
  },
};
