/**
 * ============================================
 * Zod Validation Schemas
 * ============================================
 * Single source of truth for request validation.
 *
 * Conventions used throughout
 * ---------------------------
 * - `z.coerce.number()` for anything numeric, because HTML form fields and
 *   query strings always arrive as strings.
 * - `objectId` for Mongo ids, so an invalid id is a clean 400 rather than a
 *   CastError surfacing from deep inside a query.
 * - Error messages are written for the person filling in the form.
 */

import { z } from 'zod';
import {
  INSTALLMENT_PLANS, PAYMENT_METHODS, EXPENSE_CATEGORIES,
  PURCHASE_SOURCE_TYPES, CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES,
  NISAB_BASIS,
} from '../constants/index.js';

// ============================================================================
// Reusable primitives
// ============================================================================

/** A 24-character hex MongoDB ObjectId. */
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'That reference is not valid');

/** An optional id that may also be sent as null or an empty string. */
const optionalObjectId = z
  .union([objectId, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

/** An optional email that may be sent blank. */
const optionalEmail = z
  .union([z.string().email('Please enter a valid email address'), z.literal('')])
  .optional();

/** An optional ISO date string. */
const optionalDate = z.union([z.string(), z.null()]).optional();

/**
 * Installment tenure.
 *
 * `z.enum` only accepts strings, so a numeric 6 sent by the sale form would be
 * rejected outright. A coerced union of literals accepts both 6 and "6".
 */
const installmentPlan = z
  .union([z.literal(6), z.literal(12), z.literal('6'), z.literal('12')])
  .transform(Number)
  .refine((v) => INSTALLMENT_PLANS.includes(v), {
    message: 'Only 6-month and 12-month plans are available',
  });

/** Free-form map of admin-defined custom field values. */
const customAttributes = z.record(z.any()).optional();

export const idSchema = z.object({ id: objectId });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// Auth
// ============================================================================

/**
 * Sign-in accepts a username or an email in one field. `email` is still
 * accepted so an older client keeps working.
 */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1, 'Please enter your password'),
    rememberMe: z.coerce.boolean().optional().default(false),
    /** Purely cosmetic - which role tab the sign-in form was showing. */
    role: z.string().optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: 'Enter your username or email address',
    path: ['identifier'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password'),
    newPassword: z.string().min(6, 'Your new password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  });

// ============================================================================
// Products
// ============================================================================
export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  description: z.string().optional().default(''),
  category: objectId,
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  color: z.string().optional().default(''),

  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative').default(0),
  cashPrice: z.coerce.number().min(0, 'Cash price cannot be negative').default(0),
  installmentPrice: z.coerce.number().min(0, 'Installment price cannot be negative').default(0),

  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  barcode: z.string().optional().default(''),

  ownership: z.enum(['owner', 'partner', 'shared']).default('owner'),
  partnerSharePercent: z.coerce.number().min(0).max(100).default(0),
  partner: optionalObjectId,

  imei1: z.string().optional().default(''),
  imei2: z.string().optional().default(''),
  serialNumber: z.string().optional().default(''),
  engineNumber: z.string().optional().default(''),
  chassisNumber: z.string().optional().default(''),
  registrationNumber: z.string().optional().default(''),

  solarSpecs: z
    .object({
      panel: z.string().optional().default(''),
      inverter: z.string().optional().default(''),
      battery: z.string().optional().default(''),
    })
    .optional(),
  applianceSpecs: z
    .object({
      capacity: z.string().optional().default(''),
      warranty: z.string().optional().default(''),
    })
    .optional(),

  warrantyMonths: z.coerce.number().int().min(0).default(0),
  customAttributes,
  status: z.enum(['active', 'archived', 'out_of_stock']).default('active'),
});

export const updateProductSchema = createProductSchema.partial();

// ============================================================================
// Categories
// ============================================================================
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  description: z.string().optional().default(''),
  icon: z.string().default('Package'),
  image: z.string().nullable().optional(),
  displayOrder: z.coerce.number().int().default(0),
  status: z.enum(['active', 'archived']).default('active'),
  customFields: z
    .array(
      z.object({
        name: z.string().min(1),
        label: z.string().min(1),
        type: z.enum([
          'text', 'number', 'currency', 'date', 'dropdown',
          'multiselect', 'boolean', 'textarea', 'image',
        ]),
        required: z.coerce.boolean().default(false),
        defaultValue: z.any().optional().nullable(),
        options: z.array(z.string()).optional().default([]),
        displayOrder: z.coerce.number().int().default(0),
        isActive: z.coerce.boolean().default(true),
      })
    )
    .optional()
    .default([]),
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================================================
// Customers
// ============================================================================
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(200),
  cnic: z.string().optional().default(''),
  mobile1: z.string().trim().min(1, 'A mobile number is required'),
  mobile2: z.string().optional().default(''),
  address: z.string().optional().default(''),
  reference: z.string().optional().default(''),

  guarantorName: z.string().optional().default(''),
  guarantorPhone: z.string().optional().default(''),
  guarantorCnic: z.string().optional().default(''),
  guarantorAddress: z.string().optional().default(''),
  guarantorRelation: z.string().optional().default(''),

  photo: z.string().nullable().optional(),
  cnicFrontPhoto: z.string().nullable().optional(),
  cnicBackPhoto: z.string().nullable().optional(),

  customAttributes,
  notes: z.string().optional().default(''),
  status: z.enum(['active', 'inactive', 'blacklisted']).default('active'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ============================================================================
// Suppliers
// ============================================================================
export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  phone: z.string().optional().default(''),
  alternatePhone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  contactPerson: z.string().optional().default(''),
  email: optionalEmail,
  openingBalance: z.coerce.number().min(0).default(0),
  customAttributes,
  notes: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ============================================================================
// Partners (included in Zakat)
// ============================================================================
export const createPartnerSchema = z.object({
  name: z.string().trim().min(1, 'Partner name is required').max(200),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  email: optionalEmail,
  cnic: z.string().optional().default(''),
  ownershipPercent: z.coerce.number().min(0).max(100, 'Ownership cannot exceed 100%').default(0),
  capitalInvested: z.coerce.number().min(0).default(0),
  photo: z.string().nullable().optional(),
  customAttributes,
  notes: z.string().optional().default(''),
  agreementDate: optionalDate,
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updatePartnerSchema = createPartnerSchema.partial();

// ============================================================================
// Investors (NEVER included in Zakat)
// ============================================================================
export const createInvestorSchema = z.object({
  name: z.string().trim().min(1, 'Investor name is required').max(200),
  phone: z.string().optional().default(''),
  alternatePhone: z.string().optional().default(''),
  email: optionalEmail,
  cnic: z.string().optional().default(''),
  address: z.string().optional().default(''),
  photo: z.string().nullable().optional(),

  totalInvestment: z.coerce.number().min(0).default(0),
  investmentDate: optionalDate,
  investmentType: z.enum(['fixed_term', 'ongoing', 'profit_sharing']).default('profit_sharing'),
  profitPercentage: z.coerce.number().min(0).max(100).default(0),
  profitCalculationMethod: z
    .enum(['fixed_percent', 'profit_sharing', 'monthly_fixed'])
    .default('fixed_percent'),

  agreementDocPhoto: z.string().nullable().optional(),
  witnesses: z
    .array(
      z.object({
        name: z.string().optional().default(''),
        cnic: z.string().optional().default(''),
        phone: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
  signedAt: optionalDate,

  customAttributes,
  notes: z.string().optional().default(''),
  status: z.enum(['active', 'inactive', 'closed']).default('active'),
});

export const updateInvestorSchema = createInvestorSchema.partial();

// ============================================================================
// Sales
// ============================================================================
export const createSaleSchema = z
  .object({
    customer: objectId,
    items: z
      .array(
        z.object({
          product: objectId,
          productName: z.string().min(1),
          quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
          price: z.coerce.number().min(0),
          discount: z.coerce.number().min(0).default(0),
          total: z.coerce.number().min(0).optional(),
          imei1: z.string().optional().default(''),
          imei2: z.string().optional().default(''),
          serialNumber: z.string().optional().default(''),
          warranty: z.string().optional().default(''),
        })
      )
      .min(1, 'Add at least one product to the sale'),

    subtotal: z.coerce.number().min(0),
    discount: z.coerce.number().min(0).default(0),
    grandTotal: z.coerce.number().min(0),

    saleType: z.enum(['cash', 'installment'], {
      errorMap: () => ({ message: 'Choose either a cash sale or an installment sale' }),
    }),
    advance: z.coerce.number().min(0).default(0),
    installmentPlan: installmentPlan.nullable().optional(),

    paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
    amountReceived: z.coerce.number().min(0).default(0),

    ownership: z.enum(['owner', 'partner', 'shared']).default('owner'),
    partner: optionalObjectId,

    saleDate: optionalDate,
    customAttributes,
    notes: z.string().optional().default(''),
  })
  .refine((data) => data.saleType !== 'installment' || Boolean(data.installmentPlan), {
    message: 'Choose a 6-month or 12-month plan for an installment sale',
    path: ['installmentPlan'],
  })
  .refine((data) => data.advance <= data.grandTotal, {
    message: 'The advance cannot be more than the total price',
    path: ['advance'],
  });

// ============================================================================
// Payments
// ============================================================================
export const createPaymentSchema = z.object({
  customer: objectId,
  paymentAmount: z.coerce.number().min(1, 'Enter an amount greater than zero'),
  paymentDate: optionalDate,
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  referenceNumber: z.string().optional().default(''),
  /** Settle one specific invoice; omit to settle oldest-first across all. */
  sale: optionalObjectId,
  ownership: z.enum(['owner', 'partner', 'shared']).optional(),
  notes: z.string().optional().default(''),
});

// ============================================================================
// Purchases
// ============================================================================
export const createPurchaseSchema = z.object({
  supplier: optionalObjectId,
  supplierName: z.string().optional().default(''),
  invoiceNumber: z.string().optional().default(''),

  items: z
    .array(
      z.object({
        product: objectId,
        productName: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        purchasePrice: z.coerce.number().min(0),
        total: z.coerce.number().min(0).optional(),
      })
    )
    .min(1, 'Add at least one product to the purchase'),

  subtotal: z.coerce.number().min(0).optional(),
  paid: z.coerce.number().min(0).default(0),
  /** How the amount paid now left the shop - feeds the dashboard wallet. */
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),

  sourceType: z.enum(PURCHASE_SOURCE_TYPES).default('registered_supplier'),
  sourceName: z.string().optional().default(''),
  sourcePhone: z.string().optional().default(''),
  sourceLocation: z.string().optional().default(''),

  ownership: z.enum(['owner', 'partner', 'shared']).default('owner'),
  partner: optionalObjectId,

  purchaseDate: optionalDate,
  customAttributes,
  notes: z.string().optional().default(''),
});

// ============================================================================
// Expenses
// ============================================================================
export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: `Choose one of: ${EXPENSE_CATEGORIES.join(', ')}` }),
  }),
  description: z.string().optional().default(''),
  amount: z.coerce.number().min(1, 'Enter an amount greater than zero'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  expenseDate: optionalDate,
  ownership: z.enum(['owner', 'partner', 'shared']).default('owner'),
  partner: optionalObjectId,
  receiptImage: z.string().nullable().optional(),
  paidTo: z.string().optional().default(''),
  referenceNumber: z.string().optional().default(''),
  customAttributes,
  notes: z.string().optional().default(''),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// ============================================================================
// Returns
// ============================================================================
export const createReturnSchema = z.object({
  sale: objectId,
  items: z
    .array(
      z.object({
        product: objectId,
        productName: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        price: z.coerce.number().min(0),
        exchangeProduct: optionalObjectId,
        exchangeProductName: z.string().optional().default(''),
        exchangePrice: z.coerce.number().min(0).default(0),
      })
    )
    .min(1, 'Select at least one item to return'),
  returnType: z.enum(['full', 'partial', 'exchange']),
  refundAmount: z.coerce.number().min(0).default(0),
  differencePayable: z.coerce.number().default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  reason: z.string().trim().min(1, 'Please give a reason for the return'),
  returnDate: optionalDate,
});

// ============================================================================
// Investments & payouts
// ============================================================================
export const createInvestmentSchema = z.object({
  investor: objectId.optional(),
  amount: z.coerce.number().min(1, 'Enter an amount greater than zero'),
  investmentDate: optionalDate,
  investmentType: z.enum(['fixed_term', 'ongoing', 'profit_sharing']).default('profit_sharing'),
  profitPercentage: z.coerce.number().min(0).max(100).default(0),
  profitCalculationMethod: z
    .enum(['fixed_percent', 'profit_sharing', 'monthly_fixed'])
    .default('fixed_percent'),
  businessAllocation: z.string().optional().default('general'),
  notes: z.string().optional().default(''),
});

export const createInvestorPayoutSchema = z.object({
  investor: objectId.optional(),
  investment: optionalObjectId,
  payoutAmount: z.coerce.number().min(1, 'Enter an amount greater than zero'),
  paymentDate: optionalDate,
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  referenceNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// ============================================================================
// Zakat
// ============================================================================

/**
 * Only the figures the system cannot observe are accepted from the client.
 * Stock, receivables and supplier payables are read from live data by the
 * controller, so a client cannot inflate or deflate the zakatable base.
 */
export const createZakatCalculationSchema = z.object({
  ownershipType: z.enum(['owner', 'partner'], {
    errorMap: () => ({
      message: 'Zakat applies to the owner and to partners only - investors are never included',
    }),
  }),
  partner: optionalObjectId,

  cash: z.coerce.number().min(0).default(0),
  bankBalance: z.coerce.number().min(0).default(0),
  otherAssets: z.coerce.number().min(0).default(0),
  otherLiabilities: z.coerce.number().min(0).default(0),

  /** Optional manual overrides, e.g. after a physical stock count. */
  overrideStock: z.coerce.number().min(0).optional(),
  overrideReceivables: z.coerce.number().min(0).optional(),

  zakatYear: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const updateZakatSettingsSchema = z.object({
  rate: z.coerce.number().min(0).max(1).optional(),
  nisabBasis: z.enum(Object.values(NISAB_BASIS)).optional(),
  nisab: z.coerce.number().min(0).optional(),
  goldRatePerGram: z.coerce.number().min(0).optional(),
  silverRatePerGram: z.coerce.number().min(0).optional(),
  nisabReference: z.string().optional(),
  hawlStartDate: optionalDate,
  effectiveDate: optionalDate,
  calculationNotes: z.string().optional(),
  eligibleAssets: z
    .object({
      stock: z.coerce.boolean().optional(),
      receivables: z.coerce.boolean().optional(),
      cash: z.coerce.boolean().optional(),
      bankBalance: z.coerce.boolean().optional(),
      otherAssets: z.coerce.boolean().optional(),
    })
    .optional(),
  eligibleDeductions: z
    .object({
      supplierPayables: z.coerce.boolean().optional(),
      otherLiabilities: z.coerce.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// Users
// ============================================================================
export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Use only letters, numbers, dots and underscores'),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'accountant', 'salesman']).default('salesman'),
  phone: z.string().optional().default(''),
  designation: z.string().optional().default(''),
  photo: z.string().nullable().optional(),
  isActive: z.coerce.boolean().default(true),
  mustChangePassword: z.coerce.boolean().default(false),
});

/** Password is changed through the dedicated reset endpoint, never here. */
export const updateUserSchema = createUserSchema.partial().omit({ password: true });

// ============================================================================
// Business profile
// ============================================================================
export const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  tagline: z.string().optional(),
  owner: z.string().optional(),
  ownerCnic: z.string().optional(),

  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: optionalEmail,
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),

  ntn: z.string().optional(),
  strn: z.string().optional(),
  registrationNumber: z.string().optional(),

  logo: z.string().nullable().optional(),
  stamp: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),

  currency: z.string().optional(),
  currencySymbol: z.string().optional(),

  invoicePrefix: z.string().optional(),
  invoiceStartingNumber: z.coerce.number().int().min(0).optional(),
  receiptPrefix: z.string().optional(),
  receiptStartingNumber: z.coerce.number().int().min(0).optional(),
  agreementPrefix: z.string().optional(),
  agreementStartingNumber: z.coerce.number().int().min(0).optional(),
  purchasePrefix: z.string().optional(),

  termsAndConditions: z.string().optional(),
  invoiceFooter: z.string().optional(),
  receiptFooter: z.string().optional(),

  bankName: z.string().optional(),
  bankAccountTitle: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIban: z.string().optional(),
});

// ============================================================================
// Custom fields
// ============================================================================
export const createCustomFieldSchema = z.object({
  module: z.enum(CUSTOM_FIELD_MODULES),
  label: z.string().trim().min(1, 'Give the field a label').max(60),
  type: z.enum(CUSTOM_FIELD_TYPES).default('text'),
  options: z.array(z.string()).optional().default([]),
  placeholder: z.string().optional().default(''),
  helpText: z.string().optional().default(''),
  defaultValue: z.string().optional().default(''),
  isRequired: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  showOnDocuments: z.coerce.boolean().default(false),
  span: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const updateCustomFieldSchema = createCustomFieldSchema.partial().omit({ module: true });
