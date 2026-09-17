/**
 * ============================================
 * Application Constants
 * ============================================
 * Single source of truth for enums, role permissions and business defaults.
 * Anything the frontend also needs is mirrored in frontend/src/constants.
 */

// ============================================
// Roles & access control
// ============================================

/** Every role the system recognises. */
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
  SALESMAN: 'salesman',
};

/** Ordered most-privileged first. Used for "at least this role" checks. */
export const ROLE_HIERARCHY = [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.SALESMAN];

/** Human labels + descriptions, surfaced in the Users screen and login. */
export const ROLE_META = {
  [ROLES.ADMIN]: {
    label: 'Administrator',
    description: 'Full control: settings, users, agreements, Zakat and data management.',
  },
  [ROLES.MANAGER]: {
    label: 'Manager',
    description: 'Runs day-to-day operations: sales, stock, purchases, partners and reports.',
  },
  [ROLES.ACCOUNTANT]: {
    label: 'Accountant',
    description: 'Handles collections, expenses, receivables, reporting and Zakat workings.',
  },
  [ROLES.SALESMAN]: {
    label: 'Sales Staff',
    description: 'Creates sales, registers customers and records installment payments.',
  },
};

/** Module-level permissions. One entry per navigable screen. */
export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  SALES: 'sales',
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  PURCHASES: 'purchases',
  SUPPLIERS: 'suppliers',
  INSTALLMENTS: 'installments',
  PAYMENTS: 'payments',
  EXPENSES: 'expenses',
  RETURNS: 'returns',
  PARTNERS: 'partners',
  INVESTORS: 'investors',
  AGREEMENTS: 'agreements',
  REPORTS: 'reports',
  ZAKAT: 'zakat',
  CALCULATOR: 'calculator',
  USERS: 'users',
  SETTINGS: 'settings',
};

/**
 * Role -> permission map.
 *
 * Admin is deliberately computed from PERMISSIONS so a newly added module is
 * available to the administrator without a second edit here.
 */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.DASHBOARD, PERMISSIONS.SALES, PERMISSIONS.CUSTOMERS,
    PERMISSIONS.PRODUCTS, PERMISSIONS.CATEGORIES, PERMISSIONS.PURCHASES,
    PERMISSIONS.SUPPLIERS, PERMISSIONS.INSTALLMENTS, PERMISSIONS.PAYMENTS,
    PERMISSIONS.EXPENSES, PERMISSIONS.RETURNS, PERMISSIONS.PARTNERS,
    PERMISSIONS.INVESTORS, PERMISSIONS.AGREEMENTS, PERMISSIONS.REPORTS,
    PERMISSIONS.ZAKAT, PERMISSIONS.CALCULATOR,
  ],
  [ROLES.ACCOUNTANT]: [
    PERMISSIONS.DASHBOARD, PERMISSIONS.CUSTOMERS, PERMISSIONS.INSTALLMENTS,
    PERMISSIONS.PAYMENTS, PERMISSIONS.EXPENSES, PERMISSIONS.RETURNS,
    PERMISSIONS.REPORTS, PERMISSIONS.ZAKAT, PERMISSIONS.CALCULATOR,
    PERMISSIONS.AGREEMENTS,
  ],
  [ROLES.SALESMAN]: [
    PERMISSIONS.DASHBOARD, PERMISSIONS.SALES, PERMISSIONS.CUSTOMERS,
    PERMISSIONS.PRODUCTS, PERMISSIONS.INSTALLMENTS, PERMISSIONS.PAYMENTS,
    PERMISSIONS.CALCULATOR,
  ],
};

// ============================================
// Business enums
// ============================================
export const OWNERSHIP_TYPES = { ALL: 'all', OWNER: 'owner', PARTNER: 'partner' };
export const OWNERSHIP_ALLOCATIONS = ['owner', 'partner', 'shared'];

export const SALE_TYPES = { CASH: 'cash', INSTALLMENT: 'installment' };

/** Business rule: the shop only offers 6- and 12-month plans. */
export const INSTALLMENT_PLANS = [6, 12];

export const PAYMENT_METHODS = ['cash', 'bank', 'card', 'other'];
export const SALE_STATUSES = ['completed', 'ongoing', 'overdue', 'returned', 'cancelled'];
export const INSTALLMENT_STATUSES = ['upcoming', 'due_today', 'partially_paid', 'paid', 'late', 'overdue'];
export const PRODUCT_STATUSES = ['active', 'archived', 'out_of_stock'];
export const EXPENSE_CATEGORIES = ['Shop Rent', 'Electricity', 'Salary', 'Transport', 'Marketing', 'Repair & Maintenance', 'Other Expenses'];
export const PURCHASE_SOURCE_TYPES = [
  'registered_supplier', 'market', 'other_person', 'direct', 'existing_customer', 'custom',
];
export const RETURN_TYPES = ['full', 'partial', 'exchange'];

// ============================================
// Documents & agreements
// ============================================

/** Every printable document the system can issue. */
export const DOCUMENT_TYPES = {
  INVOICE: 'invoice',
  RECEIPT: 'receipt',
  INSTALLMENT_AGREEMENT: 'installment_agreement',
  INVESTOR_AGREEMENT: 'investor_agreement',
  PARTNER_AGREEMENT: 'partner_agreement',
};

export const DOCUMENT_TYPE_LABELS = {
  [DOCUMENT_TYPES.INVOICE]: 'Sales Invoice',
  [DOCUMENT_TYPES.RECEIPT]: 'Payment Receipt',
  [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: 'Installment Agreement',
  [DOCUMENT_TYPES.INVESTOR_AGREEMENT]: 'Investor Agreement',
  [DOCUMENT_TYPES.PARTNER_AGREEMENT]: 'Partnership Agreement',
};

/** Modules that accept admin-defined custom fields. */
export const CUSTOM_FIELD_MODULES = [
  'product', 'customer', 'supplier', 'sale', 'purchase',
  'partner', 'investor', 'expense', 'payment',
];

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea', 'checkbox'];

/** Files accepted by the upload endpoint (images for photos, PDF for scans). */
export const ALLOWED_UPLOAD_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

// ============================================
// Zakat
// ============================================

/** Zakat rate: 2.5% = 1/40 of net zakatable assets. */
export const ZAKAT_DEFAULT_RATE = 0.025;

/**
 * Nisab reference weights, fixed by Shariah (they do not change).
 * The *monetary* value changes with the metal rate, which the admin enters
 * in Settings; these constants let the app do the multiplication.
 *
 *   Gold nisab   = 87.48 g  (7.5 tola)
 *   Silver nisab = 612.36 g (52.5 tola)
 *
 * When a person holds a mix of assets - which is always the case for a trading
 * business - the lower silver nisab is the one that applies. That is why
 * 'silver' is the default basis below.
 */
export const NISAB_WEIGHTS = {
  GOLD_GRAMS: 87.48,
  SILVER_GRAMS: 612.36,
  GRAMS_PER_TOLA: 11.6638,
};

export const NISAB_BASIS = { GOLD: 'gold', SILVER: 'silver', MANUAL: 'manual' };

/** A hawl is one lunar year - the holding period before Zakat falls due. */
export const HAWL_DAYS = 354;

// ============================================
// Notifications & reminders
// ============================================
export const NOTIFICATION_TYPES = [
  'installment_due', 'installment_overdue', 'upcoming_payment',
  'low_stock', 'out_of_stock', 'supplier_payable',
  'investor_payout_due', 'zakat_due', 'system_warning', 'sync_error',
];

export const REMINDER_CHANNELS = ['whatsapp', 'sms', 'manual'];

/**
 * Default auto-generated reminder bodies.
 * Tokens in {braces} are replaced by reminder.service.js.
 */
export const REMINDER_TEMPLATES = {
  upcoming: 'Assalam-o-Alaikum {customerName}. Your installment #{installmentNumber} of {amount} for invoice {invoiceNumber} is due on {dueDate}. Remaining balance: {balance}. - {businessName}, {businessPhone}',
  due_today: 'Assalam-o-Alaikum {customerName}. Your installment #{installmentNumber} of {amount} (invoice {invoiceNumber}) is due TODAY, {dueDate}. Kindly pay today to keep your account clear. - {businessName}, {businessPhone}',
  overdue: 'Assalam-o-Alaikum {customerName}. Your installment #{installmentNumber} of {amount} for invoice {invoiceNumber} was due on {dueDate} and is now {daysOverdue} day(s) overdue. Total outstanding: {balance}. Please clear it at your earliest. - {businessName}, {businessPhone}',
  thank_you: 'Assalam-o-Alaikum {customerName}. We have received your payment of {amount} (receipt {receiptNumber}). Remaining balance: {balance}. JazakAllah for your trust. - {businessName}',
};

// ============================================
// Defaults
// ============================================
export const DEFAULT_CATEGORIES = [
  { name: 'Mobile & Accessories', icon: 'Smartphone', description: 'Mobile phones and accessories' },
  { name: 'Solar System', icon: 'Sun', description: 'Solar panels, inverters, batteries' },
  { name: 'Bikes', icon: 'Bike', description: 'Motorbikes and bicycles' },
  { name: 'Home Appliances', icon: 'Refrigerator', description: 'Home and kitchen appliances' },
  { name: 'Furniture', icon: 'Sofa', description: 'Furniture and fixtures' },
  { name: 'Construction', icon: 'HardHat', description: 'Construction materials' },
  { name: 'Properties', icon: 'Building2', description: 'Real estate properties' },
  { name: 'Other Goods', icon: 'Package', description: 'Other miscellaneous goods' },
];

export const BUSINESS_DEFAULTS = {
  name: 'ADEENA TRADERS',
  tagline: 'Easy Installments - Quality Products - Best Service',
  owner: 'IMRAN ULLAH',
  phone: '03100091875',
  alternatePhone: '03110086667',
  address: 'Mardan, Pakistan',
  currency: 'PKR',
  currencySymbol: 'Rs.',
};
