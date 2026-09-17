/**
 * ============================================
 * Frontend Constants
 * ============================================
 * Static configuration shared across screens. Anything the server also needs
 * is mirrored in backend/src/constants/index.js - keep the two in step.
 */

/** Vite proxies /api to the backend in development (see vite.config.js). */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Origin used to build absolute URLs for uploaded files. */
export const FILE_BASE_URL = import.meta.env.VITE_FILE_URL || '';

// ============================================================================
// Identity
// ============================================================================
export const APP_NAME = 'ADEENA TRADERS';
export const APP_SHORT = 'AT';
export const APP_TAGLINE = 'Easy Installments • Quality Products • Best Service';
export const APP_VERSION = '2.0.0';

/** Fallbacks used before the business profile loads. */
export const APP_OWNER = 'IMRAN ULLAH';
export const APP_PHONE = '03100091875';
export const APP_ALT_PHONE = '03110086667';
export const APP_ADDRESS = 'Mardan, Pakistan';

export const CURRENCY_SYMBOL = 'Rs.';
export const CURRENCY_CODE = 'PKR';

// ============================================================================
// Roles
// ============================================================================
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
  SALESMAN: 'salesman',
};

/**
 * Role presentation. `icon` and `accent` drive the role tabs on the sign-in
 * screen, which change the form's framing depending on who is signing in.
 */
export const ROLE_META = {
  [ROLES.ADMIN]: {
    label: 'Administrator',
    short: 'Admin',
    icon: 'ShieldCheck',
    accent: 'gold',
    description: 'Full control of settings, users, agreements, Zakat and data.',
    hint: 'Sign in with the administrator email or username.',
  },
  [ROLES.MANAGER]: {
    label: 'Manager',
    short: 'Manager',
    icon: 'ClipboardList',
    accent: 'blue',
    description: 'Runs sales, stock, purchases, partners and reports.',
    hint: 'Use the username your administrator gave you.',
  },
  [ROLES.ACCOUNTANT]: {
    label: 'Accountant',
    short: 'Accounts',
    icon: 'Calculator',
    accent: 'green',
    description: 'Handles collections, expenses, receivables and Zakat workings.',
    hint: 'Use the username your administrator gave you.',
  },
  [ROLES.SALESMAN]: {
    label: 'Sales Staff',
    short: 'Sales',
    icon: 'ShoppingCart',
    accent: 'navy',
    description: 'Creates sales, registers customers and records payments.',
    hint: 'Use the username your administrator gave you.',
  },
};

// ============================================================================
// Ownership
// ============================================================================
export const OWNERSHIP_TYPES = { ALL: 'all', OWNER: 'owner', PARTNER: 'partner' };

export const OWNERSHIP_LABELS = {
  all: 'All Business',
  owner: 'My Share',
  partner: 'Partner Share',
};

export const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'All Business', icon: 'Building2', hint: 'Combined owner and partner figures' },
  { value: 'owner', label: 'My Share', icon: 'User', hint: 'Only your portion of every record' },
  { value: 'partner', label: 'Partner Share', icon: 'Users', hint: 'Only the partner portion' },
];

export const OWNERSHIP_ALLOCATIONS = [
  { value: 'owner', label: 'Owner only' },
  { value: 'partner', label: 'Partner only' },
  { value: 'shared', label: 'Shared' },
];

// ============================================================================
// Sales & installments
// ============================================================================
export const SALE_TYPES = { CASH: 'cash', INSTALLMENT: 'installment' };

/** Business rule: only 6- and 12-month plans are offered. */
export const INSTALLMENT_PLANS = [
  { value: 6, label: '6 Months', hint: 'Half-yearly plan' },
  { value: 12, label: '12 Months', hint: 'Full-year plan' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'Banknote' },
  { value: 'bank', label: 'Bank Transfer', icon: 'Landmark' },
  { value: 'card', label: 'Card', icon: 'CreditCard' },
  { value: 'other', label: 'Other', icon: 'Wallet' },
];

export const SALE_STATUSES = {
  completed: { label: 'Completed', color: 'success' },
  ongoing: { label: 'Ongoing', color: 'info' },
  overdue: { label: 'Overdue', color: 'danger' },
  returned: { label: 'Returned', color: 'warning' },
  cancelled: { label: 'Cancelled', color: 'neutral' },
};

export const INSTALLMENT_STATUSES = {
  upcoming: { label: 'Upcoming', color: 'neutral' },
  due_today: { label: 'Due Today', color: 'warning' },
  partially_paid: { label: 'Part Paid', color: 'info' },
  paid: { label: 'Paid', color: 'success' },
  late: { label: 'In Grace', color: 'warning' },
  overdue: { label: 'Overdue', color: 'danger' },
};

export const PRODUCT_STATUSES = {
  active: { label: 'Active', color: 'success' },
  archived: { label: 'Archived', color: 'neutral' },
  out_of_stock: { label: 'Out of Stock', color: 'danger' },
};

export const CUSTOMER_STATUSES = {
  active: { label: 'Active', color: 'success' },
  inactive: { label: 'Inactive', color: 'neutral' },
  blacklisted: { label: 'Blacklisted', color: 'danger' },
};

export const AGREEMENT_STATUSES = {
  draft: { label: 'Draft', color: 'neutral' },
  issued: { label: 'Issued', color: 'info' },
  signed: { label: 'Signed', color: 'success' },
  active: { label: 'Active', color: 'success' },
  completed: { label: 'Completed', color: 'neutral' },
  cancelled: { label: 'Cancelled', color: 'danger' },
};

// ============================================================================
// Purchases & expenses
// ============================================================================
export const PURCHASE_SOURCE_TYPES = [
  { value: 'registered_supplier', label: 'Registered Supplier' },
  { value: 'market', label: 'Market Purchase' },
  { value: 'other_person', label: 'Other Person' },
  { value: 'direct', label: 'Direct Purchase' },
  { value: 'existing_customer', label: 'From a Customer' },
  { value: 'custom', label: 'Other Source' },
];

export const EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Electricity',
  'Salary',
  'Transport',
  'Marketing',
  'Repair & Maintenance',
  'Other Expenses',
];

export const RETURN_TYPES = [
  { value: 'full', label: 'Full Return' },
  { value: 'partial', label: 'Partial Return' },
  { value: 'exchange', label: 'Exchange' },
];

// ============================================================================
// Documents
// ============================================================================
export const DOCUMENT_TYPES = {
  INVOICE: 'invoice',
  RECEIPT: 'receipt',
  INSTALLMENT_AGREEMENT: 'installment_agreement',
  INVESTOR_AGREEMENT: 'investor_agreement',
  PARTNER_AGREEMENT: 'partner_agreement',
};

export const DOCUMENT_TYPE_META = {
  invoice: { label: 'Sales Invoice', icon: 'FileText', description: 'Issued with every sale' },
  receipt: { label: 'Payment Receipt', icon: 'Receipt', description: 'Issued with every payment received' },
  installment_agreement: { label: 'Installment Agreement', icon: 'FileSignature', description: 'Signed by the customer and guarantor' },
  investor_agreement: { label: 'Investment Agreement', icon: 'Handshake', description: 'Signed when an investor places capital' },
  partner_agreement: { label: 'Partnership Agreement', icon: 'Users', description: 'Signed when a partner joins the business' },
};

export const CUSTOM_FIELD_MODULES = [
  { value: 'product', label: 'Products', icon: 'Package' },
  { value: 'customer', label: 'Customers', icon: 'Users' },
  { value: 'supplier', label: 'Suppliers', icon: 'Truck' },
  { value: 'sale', label: 'Sales', icon: 'ShoppingCart' },
  { value: 'purchase', label: 'Purchases', icon: 'ShoppingBag' },
  { value: 'partner', label: 'Partners', icon: 'UsersRound' },
  { value: 'investor', label: 'Investors', icon: 'BriefcaseBusiness' },
  { value: 'expense', label: 'Expenses', icon: 'ReceiptText' },
  { value: 'payment', label: 'Payments', icon: 'WalletCards' },
];

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long text' },
  { value: 'checkbox', label: 'Yes / No' },
];

/** File types the upload control accepts. Mirrors the server's filter. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ACCEPTED_DOC_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'];
export const ACCEPTED_IMAGE_EXT = '.jpg,.jpeg,.png,.webp';
export const ACCEPTED_DOC_EXT = '.jpg,.jpeg,.png,.webp,.pdf';
export const MAX_UPLOAD_MB = 8;

// ============================================================================
// Zakat
// ============================================================================

/**
 * Shariah-fixed nisab weights. Only the metal price changes, which the admin
 * enters in Zakat Settings.
 */
export const NISAB_WEIGHTS = {
  GOLD_GRAMS: 87.48,   // 7.5 tola
  SILVER_GRAMS: 612.36, // 52.5 tola
  GRAMS_PER_TOLA: 11.6638,
};

export const NISAB_BASIS_OPTIONS = [
  {
    value: 'silver',
    label: 'Silver (612.36 g)',
    hint: 'Recommended. A trading business holds mixed assets, so the lower silver threshold applies.',
  },
  {
    value: 'gold',
    label: 'Gold (87.48 g)',
    hint: 'Use only where wealth is held in gold alone.',
  },
  {
    value: 'manual',
    label: 'Enter manually',
    hint: 'Type the rupee threshold yourself, for example from a local announcement.',
  },
];

export const ZAKAT_RATE = 0.025;
export const HAWL_DAYS = 354;

// ============================================================================
// Navigation
// ============================================================================

/**
 * Sidebar structure. Grouping keeps eighteen destinations readable: a flat list
 * of that length forces the eye to scan every item to find one.
 * `permission` matches the backend permission of the same name.
 */
export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', permission: 'dashboard' },
      { id: 'reports', label: 'Reports', icon: 'ChartNoAxesCombined', path: '/reports', permission: 'reports' },
    ],
  },
  {
    id: 'trade',
    label: 'Sales & Collection',
    items: [
      { id: 'sales', label: 'Sales', icon: 'ShoppingCart', path: '/sales', permission: 'sales' },
      { id: 'installments', label: 'Installments', icon: 'CalendarClock', path: '/installments', permission: 'installments', badge: 'overdue' },
      { id: 'payments', label: 'Payments', icon: 'WalletCards', path: '/payments', permission: 'payments' },
      { id: 'returns', label: 'Returns', icon: 'RotateCcw', path: '/returns', permission: 'returns' },
    ],
  },
  {
    id: 'inventory',
    label: 'Stock',
    items: [
      { id: 'products', label: 'Products', icon: 'Package', path: '/products', permission: 'products' },
      { id: 'categories', label: 'Categories', icon: 'Tags', path: '/categories', permission: 'categories' },
      { id: 'purchases', label: 'Purchases', icon: 'ShoppingBag', path: '/purchases', permission: 'purchases' },
      { id: 'suppliers', label: 'Suppliers', icon: 'Truck', path: '/suppliers', permission: 'suppliers' },
    ],
  },
  {
    id: 'people',
    label: 'People & Capital',
    items: [
      { id: 'customers', label: 'Customers', icon: 'Users', path: '/customers', permission: 'customers' },
      { id: 'partners', label: 'Partners', icon: 'UsersRound', path: '/partners', permission: 'partners' },
      { id: 'investors', label: 'Investors', icon: 'BriefcaseBusiness', path: '/investors', permission: 'investors' },
      { id: 'agreements', label: 'Agreements', icon: 'FileSignature', path: '/agreements', permission: 'agreements' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { id: 'expenses', label: 'Expenses', icon: 'ReceiptText', path: '/expenses', permission: 'expenses' },
      { id: 'zakat', label: 'Zakat', icon: 'HandCoins', path: '/zakat', permission: 'zakat' },
      { id: 'calculator', label: 'Calculator', icon: 'Calculator', path: '/calculator', permission: 'calculator' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'users', label: 'Users & Roles', icon: 'UserCog', path: '/users', permission: 'users' },
      { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', permission: 'settings' },
    ],
  },
];

/** Flat list, for route guards and the command palette. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// ============================================================================
// Storage keys
// ============================================================================
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'at_access_token',
  USER: 'at_user',
  AUTH: 'at-auth',
  UI: 'at-ui',
  OWNERSHIP: 'at_ownership',
  SIDEBAR_COLLAPSED: 'at_sidebar_collapsed',
  LAST_ROLE: 'at_last_role',
  RECENT_SEARCHES: 'at_recent_searches',
};

/** Palette reused by every chart so the whole app reads as one system. */
export const CHART_COLORS = [
  '#0b192c', // navy 950
  '#f59e0b', // gold 500
  '#3b82f6', // info
  '#10b981', // success
  '#ef4444', // danger
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#ec4899', // pink
];
