/**
 * ============================================
 * Per-Screen Instructions (English / اردو)
 * ============================================
 * What each screen is for and how to use it, written for someone being shown
 * the software for the first time.
 *
 * Why this lives in the app and not in a manual
 * ---------------------------------------------
 * A printed manual is in a drawer; the question is asked at the counter with a
 * customer waiting. Each screen carries its own instructions, opened from the
 * "How to use" button in its header, so the answer is one click from the thing
 * being asked about.
 *
 * Writing rules followed here:
 *   - Steps describe what the person does, not what the software does.
 *   - No jargon: "the money you took from the customer", not "the payment
 *     entity's amount field".
 *   - Every screen says what CANNOT be undone, because that is the question
 *     that costs money when it goes unanswered.
 *
 * Keys match the `id` in NAV_GROUPS items, so a screen looks its own guide up.
 */

/**
 * @typedef {object} Guide
 * @property {{en: string, ur: string}} purpose  One line: what this screen is for.
 * @property {Array<{en: string, ur: string}>} steps  Ordered instructions.
 * @property {{en: string, ur: string}} [caution]  Anything irreversible.
 */

/** @type {Record<string, Guide>} */
export const GUIDES = {
  // ==========================================================================
  dashboard: {
    purpose: {
      en: 'The daily summary of your shop: what sold, what is owed, and what needs attention today.',
      ur: 'آپ کی دکان کا روزانہ خلاصہ: کیا فروخت ہوا، کتنی رقم باقی ہے، اور آج کس چیز پر توجہ درکار ہے۔',
    },
    steps: [
      { en: 'The cards at the top show today\'s sales, cash received and total outstanding balance.',
        ur: 'اوپر والے کارڈ آج کی فروخت، وصول شدہ رقم اور کل بقایا رقم دکھاتے ہیں۔' },
      { en: 'The "Overdue" card counts customers whose instalment date has passed. Click it to go straight to that list.',
        ur: '"واجب الادا" کارڈ اُن گاہکوں کی تعداد بتاتا ہے جن کی قسط کی تاریخ گزر چکی ہے۔ اس پر کلک کر کے فہرست کھولیں۔' },
      { en: 'Use the owner / partner switch in the header to see only your own share of the figures.',
        ur: 'ہیڈر میں مالک / شراکت دار کا بٹن استعمال کر کے صرف اپنے حصے کے اعداد و شمار دیکھیں۔' },
      { en: 'Charts cover the last 30 days. Hover any bar to read the exact amount.',
        ur: 'چارٹ پچھلے ۳۰ دن کا احوال دکھاتے ہیں۔ کسی بھی بار پر ماؤس رکھ کر درست رقم دیکھیں۔' },
    ],
  },

  // ==========================================================================
  sales: {
    purpose: {
      en: 'Record every sale, whether the customer pays in full today or takes the goods on instalments.',
      ur: 'ہر فروخت درج کریں، خواہ گاہک آج پوری رقم ادا کرے یا سامان اقساط پر لے۔',
    },
    steps: [
      { en: 'Press "Add sale". Choose the customer first - if they are new, add them in the Customers screen before starting.',
        ur: '"فروخت شامل کریں" دبائیں۔ پہلے گاہک منتخب کریں - اگر گاہک نیا ہے تو پہلے گاہک کی سکرین میں اسے شامل کریں۔' },
      { en: 'Add each item with its quantity and rate. The total is calculated for you.',
        ur: 'ہر چیز اس کی تعداد اور ریٹ کے ساتھ شامل کریں۔ کل رقم خود بخود بن جائے گی۔' },
      { en: 'For a cash sale, enter the full amount as advance. For instalments, enter the advance taken and the number of months.',
        ur: 'نقد فروخت کے لیے پوری رقم پیشگی میں لکھیں۔ اقساط کے لیے وصول شدہ پیشگی رقم اور مہینوں کی تعداد لکھیں۔' },
      { en: 'Save, then use the print button on the row to hand the customer their invoice.',
        ur: 'محفوظ کریں، پھر قطار میں موجود پرنٹ کے بٹن سے گاہک کو رسید دیں۔' },
    ],
    caution: {
      en: 'Saving a sale reduces your stock and creates the instalment schedule. Check the items and the advance before saving.',
      ur: 'فروخت محفوظ کرنے سے اسٹاک کم ہو جاتا ہے اور اقساط کا شیڈول بن جاتا ہے۔ محفوظ کرنے سے پہلے اشیاء اور پیشگی رقم ضرور جانچ لیں۔',
    },
  },

  // ==========================================================================
  installments: {
    purpose: {
      en: 'Every instalment due from every customer, with the overdue ones first.',
      ur: 'ہر گاہک کی ہر واجب قسط، جن میں تاخیر شدہ اقساط سب سے پہلے۔',
    },
    steps: [
      { en: 'Red rows are overdue, yellow are due this week, grey are upcoming.',
        ur: 'سرخ قطاریں تاخیر شدہ ہیں، زرد اس ہفتے واجب ہیں، اور سرمئی آنے والی ہیں۔' },
      { en: 'To record money received, press "Receive" on that row. It opens the payment form with the customer and amount already filled.',
        ur: 'رقم وصول کرنے کے لیے اُس قطار میں "وصول کریں" دبائیں۔ ادائیگی کا فارم گاہک اور رقم کے ساتھ پہلے سے بھرا کھلے گا۔' },
      { en: 'Use the reminder button to open a ready-made WhatsApp or SMS message for that customer.',
        ur: 'یاد دہانی کے بٹن سے اُس گاہک کے لیے تیار شدہ واٹس ایپ یا ایس ایم ایس پیغام کھولیں۔' },
      { en: 'Filter by month to plan the week\'s collection round.',
        ur: 'ہفتے کی وصولی کی منصوبہ بندی کے لیے مہینے کے حساب سے چھانٹیں۔' },
    ],
  },

  // ==========================================================================
  payments: {
    purpose: {
      en: 'Every rupee received from customers, and the receipt for each one.',
      ur: 'گاہکوں سے وصول ہونے والا ہر روپیہ، اور ہر ایک کی رسید۔',
    },
    steps: [
      { en: 'Press "Add payment", choose the customer, and the amount still owed appears automatically.',
        ur: '"ادائیگی شامل کریں" دبائیں، گاہک منتخب کریں، اور باقی رقم خود بخود سامنے آ جائے گی۔' },
      { en: 'Enter what the customer actually handed over - it does not have to equal the full instalment.',
        ur: 'گاہک نے حقیقت میں جو رقم دی ہے وہ لکھیں - یہ پوری قسط کے برابر ہونا ضروری نہیں۔' },
      { en: 'Choose cash, bank transfer or other, and save. The customer\'s balance updates at once.',
        ur: 'نقد، بینک ٹرانسفر یا دیگر منتخب کریں اور محفوظ کریں۔ گاہک کا بقایا فوراً تبدیل ہو جائے گا۔' },
      { en: 'Print the receipt from the row and give it to the customer.',
        ur: 'قطار سے رسید پرنٹ کریں اور گاہک کو دے دیں۔' },
    ],
    caution: {
      en: 'A payment changes the customer\'s ledger. If you entered a wrong amount, record a correction rather than leaving it - ask the owner first.',
      ur: 'ادائیگی گاہک کے کھاتے کو تبدیل کرتی ہے۔ اگر رقم غلط لکھ دی ہو تو اسے ویسے نہ چھوڑیں، تصحیح درج کریں - پہلے مالک سے پوچھ لیں۔',
    },
  },

  // ==========================================================================
  returns: {
    purpose: {
      en: 'Goods a customer brought back, and what you credited them for it.',
      ur: 'گاہک کی واپس کی ہوئی اشیاء، اور اُس کے بدلے دی گئی رقم یا رعایت۔',
    },
    steps: [
      { en: 'Press "Add return" and pick the sale the goods came from.',
        ur: '"واپسی شامل کریں" دبائیں اور وہ فروخت منتخب کریں جس سے سامان آیا تھا۔' },
      { en: 'Select the items being returned and their quantity.',
        ur: 'واپس ہونے والی اشیاء اور اُن کی تعداد منتخب کریں۔' },
      { en: 'Write the reason - damaged, wrong item, customer changed mind. This is what you will look back on later.',
        ur: 'وجہ لکھیں - خراب، غلط چیز، یا گاہک کا ارادہ بدل گیا۔ بعد میں یہی تفصیل کام آئے گی۔' },
      { en: 'Save. The stock goes back up and the customer\'s balance is reduced.',
        ur: 'محفوظ کریں۔ اسٹاک واپس بڑھ جائے گا اور گاہک کا بقایا کم ہو جائے گا۔' },
    ],
  },

  // ==========================================================================
  products: {
    purpose: {
      en: 'Everything you sell - mobiles, solar panels, inverters, home appliances - with cost, price and stock.',
      ur: 'وہ تمام اشیاء جو آپ بیچتے ہیں - موبائل، سولر پینل، انورٹر، گھریلو آلات - خرید قیمت، فروخت قیمت اور اسٹاک کے ساتھ۔',
    },
    steps: [
      { en: 'Press "Add product". Name, category and sale price are the minimum needed.',
        ur: '"مصنوعات شامل کریں" دبائیں۔ نام، قسم اور فروخت قیمت لازمی ہیں۔' },
      { en: 'Enter the cost price too - without it the software cannot show your profit.',
        ur: 'خرید قیمت بھی لکھیں - اس کے بغیر سافٹ ویئر آپ کا نفع نہیں دکھا سکتا۔' },
      { en: 'Set "Low stock alert" so the item warns you before it runs out.',
        ur: '"کم اسٹاک انتباہ" مقرر کریں تاکہ چیز ختم ہونے سے پہلے اطلاع مل جائے۔' },
      { en: 'Add a photo - it makes the item far easier to find on a busy counter.',
        ur: 'تصویر شامل کریں - مصروف کاؤنٹر پر چیز ڈھونڈنا بہت آسان ہو جاتا ہے۔' },
      { en: 'Stock rises when you record a purchase and falls when you record a sale. You rarely need to edit it by hand.',
        ur: 'خریداری درج کرنے پر اسٹاک بڑھتا ہے اور فروخت پر کم ہوتا ہے۔ ہاتھ سے تبدیل کرنے کی ضرورت کم ہی پڑتی ہے۔' },
    ],
  },

  // ==========================================================================
  categories: {
    purpose: {
      en: 'The groups your products sit in, such as Mobiles, Solar or Appliances.',
      ur: 'وہ گروپ جن میں آپ کی مصنوعات رکھی جاتی ہیں، جیسے موبائل، سولر یا گھریلو آلات۔',
    },
    steps: [
      { en: 'Press "Add category" and give it a short, clear name.',
        ur: '"قسم شامل کریں" دبائیں اور مختصر، واضح نام دیں۔' },
      { en: 'Keep the list small - six to ten categories is easier to use than thirty.',
        ur: 'فہرست مختصر رکھیں - تیس کی نسبت چھ سے دس اقسام استعمال میں آسان ہیں۔' },
      { en: 'The product count on each row tells you which categories are actually being used.',
        ur: 'ہر قطار پر مصنوعات کی تعداد بتاتی ہے کہ کون سی اقسام واقعی استعمال ہو رہی ہیں۔' },
    ],
    caution: {
      en: 'Deleting a category does not delete its products - they simply become uncategorised.',
      ur: 'قسم حذف کرنے سے اس کی مصنوعات حذف نہیں ہوتیں - وہ صرف بغیر قسم ہو جاتی ہیں۔',
    },
  },

  // ==========================================================================
  purchases: {
    purpose: {
      en: 'Stock you bought from suppliers, and what you still owe them.',
      ur: 'سپلائرز سے خریدا گیا سامان، اور اُن کا بقایا۔',
    },
    steps: [
      { en: 'Press "Add purchase" and choose the supplier.',
        ur: '"خریداری شامل کریں" دبائیں اور سپلائر منتخب کریں۔' },
      { en: 'Add each item with the quantity and the price you paid per unit.',
        ur: 'ہر چیز اس کی تعداد اور فی عدد ادا کی گئی قیمت کے ساتھ شامل کریں۔' },
      { en: 'Enter how much you paid now; the rest is recorded as owed to the supplier.',
        ur: 'ابھی ادا کی گئی رقم لکھیں؛ باقی رقم سپلائر کے بقایا میں درج ہو جائے گی۔' },
      { en: 'Save. Product stock increases by the quantities entered.',
        ur: 'محفوظ کریں۔ درج کی گئی تعداد کے مطابق اسٹاک بڑھ جائے گا۔' },
    ],
  },

  // ==========================================================================
  suppliers: {
    purpose: {
      en: 'The people and companies you buy stock from.',
      ur: 'وہ افراد اور کمپنیاں جن سے آپ سامان خریدتے ہیں۔',
    },
    steps: [
      { en: 'Press "Add supplier" and record at least a name and phone number.',
        ur: '"سپلائر شامل کریں" دبائیں اور کم از کم نام اور فون نمبر درج کریں۔' },
      { en: 'The balance column shows what you still owe each one.',
        ur: 'بقایا کا خانہ دکھاتا ہے کہ ہر ایک کا کتنا واجب الادا ہے۔' },
      { en: 'Open a supplier to see every purchase you have made from them.',
        ur: 'کسی سپلائر کو کھول کر اُس سے کی گئی تمام خریداری دیکھیں۔' },
    ],
  },

  // ==========================================================================
  customers: {
    purpose: {
      en: 'Everyone who buys from you, what they owe, and their instalment history.',
      ur: 'آپ سے خریدنے والے تمام افراد، اُن کا بقایا، اور اقساط کی تفصیل۔',
    },
    steps: [
      { en: 'Press "Add customer". Name and phone are required; CNIC and a guarantor are strongly advised for instalment customers.',
        ur: '"گاہک شامل کریں" دبائیں۔ نام اور فون لازمی ہیں؛ قسطوں والے گاہکوں کے لیے شناختی کارڈ اور ضامن انتہائی ضروری ہیں۔' },
      { en: 'Attach a photo of the CNIC - it is your record if a payment is ever disputed.',
        ur: 'شناختی کارڈ کی تصویر لگائیں - ادائیگی پر تنازع کی صورت میں یہی آپ کا ثبوت ہے۔' },
      { en: 'Open any customer to see their full ledger: every sale, every payment, every balance.',
        ur: 'کسی گاہک کو کھول کر مکمل کھاتہ دیکھیں: ہر فروخت، ہر ادائیگی، ہر بقایا۔' },
      { en: 'The balance column is what they owe you right now.',
        ur: 'بقایا کا خانہ وہ رقم ہے جو اِس وقت اُن کے ذمے ہے۔' },
    ],
  },

  // ==========================================================================
  partners: {
    purpose: {
      en: 'People who share in the profit of the business, and their agreed share.',
      ur: 'کاروبار کے نفع میں شریک افراد، اور اُن کا طے شدہ حصہ۔',
    },
    steps: [
      { en: 'Press "Add partner" and enter their profit share as a percentage.',
        ur: '"شراکت دار شامل کریں" دبائیں اور نفع میں اُن کا حصہ فیصد میں لکھیں۔' },
      { en: 'Shares across all partners should add up to the portion of profit that is shared.',
        ur: 'تمام شراکت داروں کے حصے مل کر نفع کے اُس حصے کے برابر ہوں جو تقسیم ہوتا ہے۔' },
      { en: 'Use the owner / partner switch in the header to view the business through one partner\'s share.',
        ur: 'ہیڈر میں مالک / شراکت دار کا بٹن استعمال کر کے کاروبار کو ایک شراکت دار کے حصے کے لحاظ سے دیکھیں۔' },
    ],
  },

  // ==========================================================================
  investors: {
    purpose: {
      en: 'People who put money into the business, and the payouts made back to them.',
      ur: 'کاروبار میں رقم لگانے والے افراد، اور اُنہیں کی گئی ادائیگیاں۔',
    },
    steps: [
      { en: 'Press "Add investor" and record the amount invested and the date.',
        ur: '"سرمایہ کار شامل کریں" دبائیں اور لگائی گئی رقم اور تاریخ درج کریں۔' },
      { en: 'Add each payout as it is made, so the remaining obligation stays correct.',
        ur: 'ہر ادائیگی اُسی وقت درج کریں تاکہ باقی واجب رقم درست رہے۔' },
      { en: 'Open an investor to see their full history of investments and payouts.',
        ur: 'کسی سرمایہ کار کو کھول کر اُس کی تمام سرمایہ کاری اور ادائیگیوں کی تفصیل دیکھیں۔' },
    ],
  },

  // ==========================================================================
  agreements: {
    purpose: {
      en: 'The printed instalment agreement for a sale, signed by the customer and the guarantor.',
      ur: 'کسی فروخت کے لیے قسطوں کا تحریری معاہدہ، جس پر گاہک اور ضامن کے دستخط ہوتے ہیں۔',
    },
    steps: [
      { en: 'Agreements are created from a sale - open the sale and press "Issue agreement".',
        ur: 'معاہدہ فروخت سے بنتا ہے - فروخت کھولیں اور "معاہدہ جاری کریں" دبائیں۔' },
      { en: 'Check the customer details, guarantor and instalment plan on the preview.',
        ur: 'پیش نظارہ میں گاہک کی تفصیل، ضامن اور اقساط کا منصوبہ جانچ لیں۔' },
      { en: 'Print two copies: one for the customer, one for your file.',
        ur: 'دو نقلیں پرنٹ کریں: ایک گاہک کے لیے، ایک اپنی فائل کے لیے۔' },
      { en: 'Scan the signed copy back in and attach it, so the signature is stored with the record.',
        ur: 'دستخط شدہ نقل اسکین کر کے منسلک کریں، تاکہ دستخط ریکارڈ کے ساتھ محفوظ رہے۔' },
    ],
  },

  // ==========================================================================
  expenses: {
    purpose: {
      en: 'Money going out that is not stock: rent, electricity, salaries, transport.',
      ur: 'سامان کے علاوہ خرچ ہونے والی رقم: کرایہ، بجلی، تنخواہیں، آمد و رفت۔',
    },
    steps: [
      { en: 'Press "Add expense", choose what it was for, and enter the amount and date.',
        ur: '"خرچ شامل کریں" دبائیں، مقصد منتخب کریں، اور رقم اور تاریخ لکھیں۔' },
      { en: 'Record expenses as they happen. A month entered at the end of the month is always wrong.',
        ur: 'اخراجات اُسی وقت درج کریں۔ مہینے کے آخر میں یاد سے لکھا ہوا حساب ہمیشہ غلط ہوتا ہے۔' },
      { en: 'Expenses are subtracted from profit in the Reports screen, so accuracy here matters.',
        ur: 'رپورٹس کی سکرین میں اخراجات نفع سے منہا ہوتے ہیں، اس لیے یہاں درستی ضروری ہے۔' },
    ],
  },

  // ==========================================================================
  zakat: {
    purpose: {
      en: 'Works out the Zakat due on your business assets, and records what you have paid.',
      ur: 'آپ کے کاروباری اثاثوں پر واجب زکوٰۃ کا حساب کرتا ہے، اور ادا شدہ زکوٰۃ درج کرتا ہے۔',
    },
    steps: [
      { en: 'The calculation counts your stock value, cash and receivables, less what you owe.',
        ur: 'حساب میں اسٹاک کی قیمت، نقد اور وصول ہونے والی رقم شامل ہے، اور واجب الادا رقم منہا ہے۔' },
      { en: 'Check the nisab and rate against your own scholar\'s guidance before relying on the figure.',
        ur: 'رقم پر عمل کرنے سے پہلے نصاب اور شرح اپنے عالم کی راہنمائی سے جانچ لیں۔' },
      { en: 'Record each Zakat payment you make, so next year\'s calculation starts from the right place.',
        ur: 'ہر ادا شدہ زکوٰۃ درج کریں، تاکہ اگلے سال کا حساب درست بنیاد سے شروع ہو۔' },
    ],
  },

  // ==========================================================================
  calculator: {
    purpose: {
      en: 'Works out an instalment plan before you commit to it with the customer.',
      ur: 'گاہک سے طے کرنے سے پہلے اقساط کا منصوبہ بنا کر دیکھیں۔',
    },
    steps: [
      { en: 'Enter the item price, the advance the customer can pay, and the number of months.',
        ur: 'چیز کی قیمت، گاہک کی قابلِ ادائیگی پیشگی رقم، اور مہینوں کی تعداد لکھیں۔' },
      { en: 'The monthly instalment and the total are shown immediately.',
        ur: 'ماہانہ قسط اور کل رقم فوراً سامنے آ جائے گی۔' },
      { en: 'Nothing here is saved - it is a scratch pad. Record the real terms in the Sales screen.',
        ur: 'یہاں کچھ محفوظ نہیں ہوتا - یہ صرف حساب کے لیے ہے۔ اصل شرائط فروخت کی سکرین میں درج کریں۔' },
    ],
  },

  // ==========================================================================
  reports: {
    purpose: {
      en: 'Sales, profit, collection and stock over any date range you choose.',
      ur: 'کسی بھی منتخب مدت کی فروخت، نفع، وصولی اور اسٹاک کی رپورٹ۔',
    },
    steps: [
      { en: 'Pick the report, then the date range.',
        ur: 'پہلے رپورٹ منتخب کریں، پھر تاریخوں کی مدت۔' },
      { en: 'Profit figures depend on cost prices being entered on your products.',
        ur: 'نفع کے اعداد و شمار کا درست ہونا مصنوعات میں خرید قیمت درج ہونے پر منحصر ہے۔' },
      { en: 'Export to a spreadsheet, or print, using the buttons above the table.',
        ur: 'ٹیبل کے اوپر موجود بٹنوں سے اسپریڈ شیٹ میں محفوظ کریں یا پرنٹ کریں۔' },
    ],
  },

  // ==========================================================================
  users: {
    purpose: {
      en: 'Who can sign in, and what each person is allowed to see and change.',
      ur: 'کون سافٹ ویئر میں داخل ہو سکتا ہے، اور ہر فرد کیا دیکھ اور تبدیل کر سکتا ہے۔',
    },
    steps: [
      { en: 'Press "Add user" and choose a role: Admin sees everything, Manager runs the shop, Salesman sells and collects.',
        ur: '"صارف شامل کریں" دبائیں اور عہدہ منتخب کریں: ایڈمن سب کچھ دیکھتا ہے، مینیجر دکان چلاتا ہے، سیلز مین فروخت اور وصولی کرتا ہے۔' },
      { en: 'Give each person their own account. Shared logins make it impossible to tell who entered what.',
        ur: 'ہر فرد کو اپنا الگ اکاؤنٹ دیں۔ مشترکہ اکاؤنٹ سے یہ معلوم نہیں ہو سکتا کہ اندراج کس نے کیا۔' },
      { en: 'Switch a user off instead of deleting them when someone leaves - their past entries stay readable.',
        ur: 'کسی کے جانے پر اُسے حذف کرنے کے بجائے غیر فعال کر دیں - اُس کے پرانے اندراجات پڑھے جا سکیں گے۔' },
    ],
  },

  // ==========================================================================
  settings: {
    purpose: {
      en: 'Your shop\'s name, logo and contact details, how documents print, and your own password.',
      ur: 'آپ کی دکان کا نام، لوگو اور رابطہ تفصیل، دستاویزات کی پرنٹنگ، اور آپ کا پاس ورڈ۔',
    },
    steps: [
      { en: 'Under Business, set the shop name, phone, address and logo. These appear on every invoice and agreement.',
        ur: 'کاروبار کے حصے میں دکان کا نام، فون، پتہ اور لوگو مقرر کریں۔ یہ ہر رسید اور معاہدے پر آتے ہیں۔' },
      { en: 'Upload the logo once - it is used on screen, on printed invoices and on the letterhead.',
        ur: 'لوگو ایک بار اپ لوڈ کریں - یہ سکرین پر، پرنٹ شدہ رسیدوں پر اور لیٹر ہیڈ پر استعمال ہوتا ہے۔' },
      { en: 'Changes are saved when you press Save, and appear across the app straight away.',
        ur: 'تبدیلیاں محفوظ کریں دبانے پر محفوظ ہوتی ہیں، اور فوراً پورے سافٹ ویئر میں نظر آتی ہیں۔' },
      { en: 'Change your own password under Account. Do it on the first day, not later.',
        ur: 'اکاؤنٹ کے حصے میں اپنا پاس ورڈ تبدیل کریں۔ یہ پہلے دن ہی کر لیں، بعد میں نہیں۔' },
    ],
  },
};

/**
 * Fetch the guide for a screen.
 * @param {string} id  Matches a NAV_GROUPS item id.
 * @returns {Guide|null}
 */
export const guideFor = (id) => GUIDES[id] || null;

export default GUIDES;
