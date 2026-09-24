/**
 * ============================================
 * Bilingual Labels (English / اردو)
 * ============================================
 * Every label the shop floor reads, in both languages.
 *
 * Why paired strings rather than a language switch
 * ------------------------------------------------
 * The staff in Mardan are not uniformly literate in one language: the owner
 * reads English column headings comfortably, a new salesman may not, and both
 * use the same screen on the same counter. A toggle forces a choice and leaves
 * whoever picked wrong unable to read the form.
 *
 * So field labels render BOTH - English as the primary, Urdu underneath in a
 * lighter weight. Nobody has to configure anything and nobody is locked out.
 * Long-form help (see guides.js) is the exception: it is too long to duplicate
 * inline, so it is tabbed.
 *
 * Urdu is right-to-left. Every Urdu string must be rendered inside an element
 * carrying dir="rtl" and the `.urdu` class (defined in index.css), or the
 * punctuation lands on the wrong side.
 */

/**
 * One term in both languages.
 * @typedef {{ en: string, ur: string }} Term
 */

/** Navigation and page titles. */
export const NAV_LABELS = {
  dashboard:    { en: 'Dashboard',       ur: 'ڈیش بورڈ' },
  reports:      { en: 'Reports',         ur: 'رپورٹس' },
  sales:        { en: 'Sales',           ur: 'فروخت' },
  installments: { en: 'Installments',    ur: 'اقساط' },
  payments:     { en: 'Payments',        ur: 'وصولیاں' },
  returns:      { en: 'Returns',         ur: 'واپسی' },
  inventory:    { en: 'Inventory',       ur: 'انوینٹری' },
  products:     { en: 'Inventory',       ur: 'انوینٹری' },
  categories:   { en: 'Categories',      ur: 'اقسام' },
  purchases:    { en: 'Purchases',       ur: 'خریداری' },
  suppliers:    { en: 'Suppliers',       ur: 'سپلائرز' },
  customers:    { en: 'Customers',       ur: 'گاہک' },
  partners:     { en: 'Partners',        ur: 'شراکت دار' },
  investors:    { en: 'Investors',       ur: 'سرمایہ کار' },
  agreements:   { en: 'Agreements',       ur: 'معاہدے' },
  expenses:     { en: 'Expenses',        ur: 'اخراجات' },
  zakat:        { en: 'Zakat',           ur: 'زکوٰۃ' },
  calculator:   { en: 'Calculator',      ur: 'کیلکولیٹر' },
  users:        { en: 'Users & Roles',   ur: 'صارفین اور اختیارات' },
  settings:     { en: 'Settings',        ur: 'ترتیبات' },
};

/** Navigation group headings. */
export const GROUP_LABELS = {
  overview:  { en: 'Overview',           ur: 'خلاصہ' },
  trade:     { en: 'Sales & Collection', ur: 'فروخت و وصولی' },
  inventory: { en: 'Stock',              ur: 'اسٹاک' },
  people:    { en: 'People & Capital',   ur: 'افراد و سرمایہ' },
  finance:   { en: 'Finance',            ur: 'مالیات' },
  system:    { en: 'System',             ur: 'سسٹم' },
};

/** Buttons and menu actions. */
export const ACTION_LABELS = {
  add:      { en: 'Add',       ur: 'شامل کریں' },
  edit:     { en: 'Edit',      ur: 'تبدیل کریں' },
  delete:   { en: 'Delete',    ur: 'حذف کریں' },
  view:     { en: 'View',      ur: 'دیکھیں' },
  save:     { en: 'Save',      ur: 'محفوظ کریں' },
  cancel:   { en: 'Cancel',    ur: 'منسوخ کریں' },
  close:    { en: 'Close',     ur: 'بند کریں' },
  confirm:  { en: 'Confirm',   ur: 'تصدیق کریں' },
  search:   { en: 'Search',    ur: 'تلاش کریں' },
  print:    { en: 'Print',     ur: 'پرنٹ کریں' },
  export:   { en: 'Export',    ur: 'ایکسپورٹ' },
  filter:   { en: 'Filter',    ur: 'چھانٹیں' },
  clear:    { en: 'Clear',     ur: 'صاف کریں' },
  refresh:  { en: 'Refresh',   ur: 'تازہ کریں' },
  help:     { en: 'How to use', ur: 'طریقۂ استعمال' },
};

/**
 * Form field labels.
 *
 * Keyed by the field name used in the forms, so a screen can ask for
 * `FIELD_LABELS.phone` without inventing its own wording - which is how three
 * screens end up calling the same thing "Phone", "Mobile" and "Contact".
 */
export const FIELD_LABELS = {
  // Identity
  name:         { en: 'Name',            ur: 'نام' },
  fatherName:   { en: "Father's name",   ur: 'والد کا نام' },
  phone:        { en: 'Phone',           ur: 'فون نمبر' },
  altPhone:     { en: 'Other phone',     ur: 'دوسرا نمبر' },
  address:      { en: 'Address',         ur: 'پتہ' },
  city:         { en: 'City',            ur: 'شہر' },
  cnic:         { en: 'CNIC',            ur: 'شناختی کارڈ' },
  email:        { en: 'Email',           ur: 'ای میل' },
  username:     { en: 'Username',        ur: 'صارف نام' },
  password:     { en: 'Password',        ur: 'پاس ورڈ' },
  role:         { en: 'Role',            ur: 'عہدہ' },
  photo:        { en: 'Photo',           ur: 'تصویر' },
  designation:  { en: 'Designation',     ur: 'عہدہ' },

  // Money
  amount:       { en: 'Amount',          ur: 'رقم' },
  price:        { en: 'Price',           ur: 'قیمت' },
  salePrice:    { en: 'Sale price',      ur: 'فروخت قیمت' },
  costPrice:    { en: 'Cost price',      ur: 'خرید قیمت' },
  rate:         { en: 'Rate',            ur: 'ریٹ' },
  total:        { en: 'Total',           ur: 'کل رقم' },
  subtotal:     { en: 'Subtotal',        ur: 'میزان' },
  discount:     { en: 'Discount',        ur: 'رعایت' },
  shipping:     { en: 'Shipping',        ur: 'کرایہ' },
  advance:      { en: 'Advance',         ur: 'پیشگی رقم' },
  balance:      { en: 'Balance',         ur: 'بقایا' },
  paid:         { en: 'Paid',            ur: 'ادا شدہ' },
  profit:       { en: 'Profit',          ur: 'نفع' },

  // Goods
  product:      { en: 'Product',         ur: 'مصنوعات' },
  category:     { en: 'Category',        ur: 'قسم' },
  quantity:     { en: 'Quantity',        ur: 'تعداد' },
  stock:        { en: 'Stock',           ur: 'اسٹاک' },
  unit:         { en: 'Unit',            ur: 'اکائی' },
  brand:        { en: 'Brand',           ur: 'برانڈ' },
  model:        { en: 'Model',           ur: 'ماڈل' },
  imei:         { en: 'IMEI',            ur: 'آئی ایم ای آئی' },
  warranty:     { en: 'Warranty',        ur: 'وارنٹی' },
  lowStockAt:   { en: 'Low stock alert', ur: 'کم اسٹاک انتباہ' },

  // Parties
  customer:     { en: 'Customer',        ur: 'گاہک' },
  supplier:     { en: 'Supplier',        ur: 'سپلائر' },
  partner:      { en: 'Partner',         ur: 'شراکت دار' },
  investor:     { en: 'Investor',        ur: 'سرمایہ کار' },
  guarantor:    { en: 'Guarantor',       ur: 'ضامن' },

  // Time and state
  date:         { en: 'Date',            ur: 'تاریخ' },
  dueDate:      { en: 'Due date',        ur: 'مقررہ تاریخ' },
  startDate:    { en: 'From',            ur: 'سے' },
  endDate:      { en: 'To',              ur: 'تک' },
  months:       { en: 'Months',          ur: 'مہینے' },
  installment:  { en: 'Instalment',      ur: 'قسط' },
  status:       { en: 'Status',          ur: 'حالت' },
  paymentMethod:{ en: 'Payment method',  ur: 'ادائیگی کا طریقہ' },

  // Free text
  description:  { en: 'Description',     ur: 'تفصیل' },
  notes:        { en: 'Notes',           ur: 'نوٹس' },
  reason:       { en: 'Reason',          ur: 'وجہ' },
  reference:    { en: 'Reference',       ur: 'حوالہ' },
};

/** Status words, shown on badges. */
export const STATUS_LABELS = {
  active:    { en: 'Active',    ur: 'فعال' },
  inactive:  { en: 'Inactive',  ur: 'غیر فعال' },
  paid:      { en: 'Paid',      ur: 'ادا شدہ' },
  unpaid:    { en: 'Unpaid',    ur: 'غیر ادا' },
  partial:   { en: 'Partial',   ur: 'جزوی' },
  overdue:   { en: 'Overdue',   ur: 'واجب الادا' },
  pending:   { en: 'Pending',   ur: 'زیرِ التوا' },
  completed: { en: 'Completed', ur: 'مکمل' },
  cancelled: { en: 'Cancelled', ur: 'منسوخ' },
  returned:  { en: 'Returned',  ur: 'واپس' },
  inStock:   { en: 'In stock',  ur: 'دستیاب' },
  lowStock:  { en: 'Low stock', ur: 'کم اسٹاک' },
  outOfStock:{ en: 'Out of stock', ur: 'ختم' },
};

/** Everything in one bag, for a single lookup helper. */
const ALL = {
  ...NAV_LABELS, ...GROUP_LABELS, ...ACTION_LABELS,
  ...FIELD_LABELS, ...STATUS_LABELS,
};

/**
 * Look up a term. Falls back to the key itself, so a missing translation shows
 * something readable rather than blank space.
 *
 * @param {string} key
 * @returns {Term}
 */
export const term = (key) => ALL[key] || { en: key, ur: '' };

/** Just the Urdu for a key, or '' when there is none. */
export const urdu = (key) => term(key).ur;

/** Just the English for a key. */
export const english = (key) => term(key).en;
