/**
 * ============================================
 * Form Label Translations (English -> اردو)
 * ============================================
 * Urdu for the labels that appear on data-entry forms.
 *
 * Keyed by the English label text itself
 * -------------------------------------
 * Every input in the app already passes a `label` string, and they are written
 * inconsistently across nineteen screens - "Phone", "Mobile", "Alternate
 * phone". Keying on that string means the whole app gains Urdu from one
 * change in components/common/Form.jsx, with nothing to edit on any screen
 * and no chance of a form being missed.
 *
 * The alternative - adding a field key to several hundred call sites - would
 * have translated whichever forms someone remembered to update.
 *
 * Deliberately partial. There are 361 distinct labels in the app and most are
 * table headers, buttons and stat captions where a second line of Nastaliq
 * would crowd the layout for no gain. What is here is the vocabulary a
 * salesman meets while entering a sale, a customer or a payment. Anything
 * missing simply renders in English, which is the existing behaviour.
 */

/** Exact English label -> Urdu. Lookup is case-insensitive and trimmed. */
const FORM_LABEL_URDU = {
  // ---- People ----
  'name': 'نام',
  'full name': 'پورا نام',
  'business name': 'کاروبار کا نام',
  "father's name": 'والد کا نام',
  'customer': 'گاہک',
  'supplier': 'سپلائر',
  'partner': 'شراکت دار',
  'investor': 'سرمایہ کار',
  'guarantor': 'ضامن',
  'contact person': 'رابطہ فرد',
  'proprietor': 'مالک',
  'introduced by': 'متعارف کرایا',
  'relationship': 'رشتہ',
  'designation': 'عہدہ',
  'role': 'عہدہ',
  'username': 'صارف نام',
  'password': 'پاس ورڈ',
  'new password': 'نیا پاس ورڈ',
  'current password': 'موجودہ پاس ورڈ',
  'confirm password': 'پاس ورڈ کی تصدیق',
  'your password': 'آپ کا پاس ورڈ',
  'username or email': 'صارف نام یا ای میل',
  'email or username': 'ای میل یا صارف نام',
  'administrator email': 'ایڈمن ای میل',

  // ---- Contact ----
  'phone': 'فون نمبر',
  'mobile': 'موبائل نمبر',
  'alternate phone': 'دوسرا نمبر',
  'alternate': 'متبادل',
  'email': 'ای میل',
  'address': 'پتہ',
  'city': 'شہر',
  'cnic': 'شناختی کارڈ',
  'website': 'ویب سائٹ',
  'location': 'مقام',

  // ---- Money ----
  'amount': 'رقم',
  'amount received': 'وصول شدہ رقم',
  'price': 'قیمت',
  'selling price': 'فروخت قیمت',
  'cash price': 'نقد قیمت',
  'purchase cost': 'خرید قیمت',
  'unit cost': 'فی عدد قیمت',
  'unit price': 'فی عدد قیمت',
  'total': 'کل',
  'total price': 'کل قیمت',
  'subtotal': 'میزان',
  'discount': 'رعایت',
  'advance': 'پیشگی رقم',
  'paid': 'ادا شدہ',
  'paid now': 'اب ادا کیا',
  'paid to': 'کس کو دیا',
  'paid by': 'کس نے دیا',
  'balance': 'بقایا',
  'outstanding': 'واجب الادا',
  'still owed': 'باقی رقم',
  'capital': 'سرمایہ',
  'profit share': 'نفع کا حصہ',
  'capital placed': 'لگایا گیا سرمایہ',
  'capital contributed': 'دیا گیا سرمایہ',
  'profit earned': 'حاصل شدہ نفع',
  'total receivable': 'کل وصول طلب',
  'total purchases': 'کل خریداری',
  'markup': 'منافع شرح',
  'cash in hand': 'نقد رقم',
  'bank balance': 'بینک بیلنس',
  'value': 'مالیت',

  // ---- Goods ----
  'product': 'مصنوعات',
  'category': 'قسم',
  'quantity': 'تعداد',
  'stock': 'اسٹاک',
  'stock level': 'اسٹاک کی مقدار',
  'reorder at': 'دوبارہ منگوائیں',
  'brand': 'برانڈ',
  'model': 'ماڈل',
  'barcode': 'بار کوڈ',
  'serial number': 'سیریل نمبر',
  'warranty': 'وارنٹی',
  'warranty (months)': 'وارنٹی (مہینے)',
  'bought from': 'کس سے خریدا',
  'add a product': 'مصنوعات شامل کریں',
  'their invoice number': 'اُن کا رسید نمبر',
  'this stock belongs to': 'یہ اسٹاک کس کا ہے',
  'low stock alert': 'کم اسٹاک انتباہ',
  'purchase date': 'خریداری کی تاریخ',
  'sale date': 'فروخت کی تاریخ',
  'payment date': 'ادائیگی کی تاریخ',
  'source': 'ذریعہ',

  // ---- Time and terms ----
  'date': 'تاریخ',
  'due date': 'مقررہ تاریخ',
  'next due': 'اگلی مقررہ تاریخ',
  'from': 'سے',
  'to': 'تک',
  'plan': 'منصوبہ',
  'months': 'مہینے',
  'installment': 'قسط',
  'instalment': 'قسط',
  'agreement date': 'معاہدے کی تاریخ',
  'zakat year': 'زکوٰۃ کا سال',
  'zakat rate': 'زکوٰۃ کی شرح',

  // ---- Classification ----
  'status': 'حالت',
  'type': 'قسم',
  'method': 'طریقہ',
  'payment method': 'ادائیگی کا طریقہ',
  'ownership': 'ملکیت',
  'reference': 'حوالہ',
  'display order': 'ترتیب',

  // ---- Free text ----
  'description': 'تفصیل',
  'notes': 'نوٹس',
  'note': 'نوٹ',
  'reason': 'وجہ',
  'photo': 'تصویر',
  'tagline': 'نعرہ',
  'terms & conditions': 'شرائط و ضوابط',
};

/**
 * Urdu for an English form label, or '' when there is none.
 *
 * Accepts the label exactly as a screen wrote it: trailing spaces, a different
 * case, or a trailing colon all still resolve.
 *
 * @param {unknown} label
 * @returns {string}
 */
export const urduForLabel = (label) => {
  if (typeof label !== 'string') return '';
  const key = label.trim().replace(/[:*]\s*$/, '').toLowerCase();
  return FORM_LABEL_URDU[key] || '';
};

export default FORM_LABEL_URDU;
