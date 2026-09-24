/**
 * ============================================
 * Agreement and document terms in Urdu
 * ============================================
 * The Urdu for every clause, recital and closing line that ships in the
 * default templates (backend/src/services/template.service.js), so an
 * agreement prints its terms in both languages when Urdu is switched on.
 *
 * Why patterns, not a lookup table
 * --------------------------------
 * An issued agreement stores its clauses with the details already filled in -
 * "...the goods described as Tecno Spark 20 for a total agreed price of
 * Rs. 33,600." - so the stored English never equals the template's English.
 * Each entry's English is therefore turned into a pattern in which every
 * {token} matches anything; a stored clause that fits the pattern yields the
 * filled-in values, which are placed into the Urdu at the same tokens. That is
 * what lets agreements issued BEFORE this translation existed print in Urdu
 * too, with no change to the stored record.
 *
 * A clause the admin rewrote in Settings no longer fits any pattern, and
 * simply prints in English only - never a wrong translation.
 */

const ENTRIES = [
  // ---------------------------------------------------------------- invoice
  ['Goods once sold will not be taken back or exchanged after 7 days from the date of this invoice.',
    'فروخت شدہ سامان اس بل کی تاریخ سے ۷ دن کے بعد واپس یا تبدیل نہیں کیا جائے گا۔'],
  ['Warranty, where applicable, is provided by the manufacturer and is subject to their terms and conditions.',
    'وارنٹی، جہاں لاگو ہو، بنانے والی کمپنی دیتی ہے اور اس کی اپنی شرائط و ضوابط کے تابع ہے۔'],
  ['Any complaint regarding quantity or condition must be reported within 24 hours of delivery.',
    'تعداد یا حالت سے متعلق کوئی بھی شکایت سامان ملنے کے ۲۴ گھنٹے کے اندر بتائی جائے۔'],
  ['For installment sales, the goods remain the property of the seller until the final installment is paid in full.',
    'قسطوں پر فروخت کی صورت میں آخری قسط کی مکمل ادائیگی تک سامان فروخت کنندہ کی ملکیت رہے گا۔'],
  ['Thank you for your business. We value your trust.',
    'آپ کے کاروبار کا شکریہ۔ ہم آپ کے اعتماد کی قدر کرتے ہیں۔'],
  ['Thank you for your business!', 'آپ کے کاروبار کا شکریہ!'],

  // The shop's standing invoice terms (InvoiceDocument DEFAULT_TERMS)
  ['All goods once sold will not be taken back.', 'فروخت شدہ سامان واپس نہیں لیا جائے گا۔'],
  ['Please check the goods before delivery.', 'براہِ کرم سامان وصول کرنے سے پہلے چیک کر لیں۔'],
  ['Payment must be made within the due date.', 'ادائیگی مقررہ تاریخ کے اندر کرنا لازمی ہے۔'],
  ['We are not responsible for any breakage or damage after delivery.', 'سامان حوالے کرنے کے بعد ٹوٹ پھوٹ یا نقصان کی ذمہ داری ہماری نہیں ہوگی۔'],
  ['This invoice is computer-generated and is valid without a physical signature.', 'یہ بل کمپیوٹر سے تیار شدہ ہے اور دستخط کے بغیر بھی درست ہے۔'],
  ['This is a computer-generated receipt.', 'یہ کمپیوٹر سے تیار شدہ رسید ہے۔'],

  // ---------------------------------------------------------------- receipt
  ['This receipt acknowledges the amount stated above only. It does not clear any remaining balance on the account.',
    'یہ رسید صرف اوپر درج رقم کی وصولی کی تصدیق کرتی ہے۔ اس سے کھاتے کی باقی رقم ختم نہیں ہوتی۔'],
  ['Please present this receipt for any query relating to this payment.',
    'اس ادائیگی سے متعلق کسی بھی سوال کے لیے یہ رسید ساتھ لائیں۔'],
  ['Please retain this receipt as proof of payment.',
    'ادائیگی کے ثبوت کے طور پر یہ رسید سنبھال کر رکھیں۔'],

  // ------------------------------------------------- installment agreement
  ['This Installment Sale Agreement is made on {todayDate} at {businessAddress} between {businessName}, through its proprietor {businessOwner} (hereinafter the "Seller"), of the one part, and {customerName}, holder of CNIC {customerCnic}, resident of {customerAddress} (hereinafter the "Buyer"), of the other part.',
    'یہ قسطوں پر فروخت کا معاہدہ آج بتاریخ {todayDate} بمقام {businessAddress}، ایک فریق {businessName} بذریعہ مالک {businessOwner} (آئندہ "فروخت کنندہ")، اور دوسرے فریق {customerName}، شناختی کارڈ نمبر {customerCnic}، ساکن {customerAddress} (آئندہ "خریدار") کے درمیان طے پایا۔'],
  ['WHEREAS the Buyer has agreed to purchase and the Seller has agreed to sell the goods described below on deferred payment terms, both parties agree as follows:',
    'چونکہ خریدار نیچے بیان کردہ سامان مؤجل ادائیگی کی شرائط پر خریدنے اور فروخت کنندہ بیچنے پر رضامند ہیں، لہٰذا دونوں فریق درج ذیل پر متفق ہیں:'],
  ['Description and Price', 'سامان اور قیمت'],
  ['The Seller sells to the Buyer the goods described as {productDetails} for a total agreed price of {totalPrice}.',
    'فروخت کنندہ خریدار کو {productDetails} کے نام سے بیان کردہ سامان کل طے شدہ قیمت {totalPrice} پر فروخت کرتا ہے۔'],
  ['Advance Payment', 'پیشگی ادائیگی'],
  ['The Buyer has paid an advance of {advanceAmount}, receipt of which the Seller acknowledges. The balance financed is {financedAmount}.',
    'خریدار نے {advanceAmount} پیشگی ادا کیے ہیں جن کی وصولی فروخت کنندہ تسلیم کرتا ہے۔ باقی واجب الادا رقم {financedAmount} ہے۔'],
  ['Payment Schedule', 'ادائیگی کا شیڈول'],
  ['The balance shall be paid in {planMonths} equal monthly installments of {monthlyInstallment} each. The first installment falls due on {firstDueDate} and each subsequent installment on the corresponding date of every following month, until {lastDueDate}.',
    'باقی رقم {planMonths} برابر ماہانہ قسطوں میں ادا ہوگی، ہر قسط {monthlyInstallment} کی۔ پہلی قسط {firstDueDate} کو واجب ہوگی اور ہر اگلی قسط ہر آنے والے مہینے کی اسی تاریخ کو، {lastDueDate} تک۔'],
  ['No Interest', 'سود نہیں'],
  ['The total price is fixed at the time of this agreement. No interest, mark-up or additional profit shall be charged on the outstanding balance for any reason.',
    'کل قیمت اس معاہدے کے وقت طے ہو چکی ہے۔ باقی رقم پر کسی بھی وجہ سے کوئی سود، مارک اپ یا اضافی منافع نہیں لیا جائے گا۔'],
  ['Ownership and Risk', 'ملکیت اور ذمہ داری'],
  ['Ownership of the goods remains with the Seller until the final installment is received in full. Risk of loss or damage passes to the Buyer on delivery, and the Buyer shall keep the goods in good condition and shall not sell, pledge, mortgage or otherwise dispose of them before full payment.',
    'آخری قسط کی مکمل وصولی تک سامان کی ملکیت فروخت کنندہ کے پاس رہے گی۔ سامان حوالے ہوتے ہی نقصان یا ٹوٹ پھوٹ کی ذمہ داری خریدار پر ہوگی، اور خریدار سامان کو اچھی حالت میں رکھے گا اور مکمل ادائیگی سے پہلے اسے نہ بیچے گا، نہ گروی رکھے گا اور نہ کسی اور طرح منتقل کرے گا۔'],
  ['Default', 'نادہندگی'],
  ['If any installment remains unpaid for thirty (30) days after its due date, the Seller may, after giving written notice, demand the entire outstanding balance immediately or repossess the goods. Amounts already paid shall be adjusted against the outstanding balance and reasonable recovery costs.',
    'اگر کوئی قسط اپنی مقررہ تاریخ کے تیس (۳۰) دن بعد تک ادا نہ ہو تو فروخت کنندہ تحریری نوٹس دے کر پوری باقی رقم فوری طلب کر سکتا ہے یا سامان واپس لے سکتا ہے۔ ادا شدہ رقم باقی رقم اور وصولی کے مناسب اخراجات میں منہا کی جائے گی۔'],
  ['Early Settlement', 'قبل از وقت ادائیگی'],
  ['The Buyer may settle the outstanding balance in full at any time before the final due date without any penalty or additional charge.',
    'خریدار آخری تاریخ سے پہلے کسی بھی وقت بغیر کسی جرمانے یا اضافی رقم کے پوری باقی رقم ادا کر سکتا ہے۔'],
  ['Guarantor', 'ضامن'],
  ['{guarantorName}, holder of CNIC {guarantorCnic}, stands as guarantor and undertakes jointly and severally to pay any amount that the Buyer fails to pay under this agreement.',
    '{guarantorName}، شناختی کارڈ نمبر {guarantorCnic}، ضامن ہیں اور اس بات کی انفرادی و مشترکہ ذمہ داری لیتے ہیں کہ خریدار اس معاہدے کے تحت جو رقم ادا نہ کرے وہ ادا کریں گے۔'],
  ['Warranty', 'وارنٹی'],
  ['Any warranty on the goods is provided by the manufacturer under their own terms. The Seller shall assist the Buyer in pursuing a warranty claim but gives no separate warranty of its own.',
    'سامان کی وارنٹی بنانے والی کمپنی اپنی شرائط پر دیتی ہے۔ فروخت کنندہ وارنٹی کے دعوے میں خریدار کی مدد کرے گا مگر اپنی طرف سے کوئی الگ وارنٹی نہیں دیتا۔'],
  ['Change of Address', 'پتے کی تبدیلی'],
  ['The Buyer shall inform the Seller in writing within seven (7) days of any change of residential address or contact number.',
    'خریدار رہائشی پتے یا فون نمبر کی کسی بھی تبدیلی کی اطلاع سات (۷) دن کے اندر فروخت کنندہ کو تحریری طور پر دے گا۔'],
  ['Dispute Resolution', 'تنازعے کا حل'],
  ['Both parties shall first attempt to resolve any dispute amicably. Failing that, the dispute shall be referred to the competent courts at Mardan, Khyber Pakhtunkhwa.',
    'دونوں فریق پہلے کسی بھی تنازعے کو باہمی رضامندی سے حل کرنے کی کوشش کریں گے۔ ایسا نہ ہونے پر تنازعہ مردان، خیبر پختونخوا کی مجاز عدالتوں میں پیش ہوگا۔'],
  ['Both parties confirm that they have read and understood this agreement, and have signed it of their own free will, in the presence of the witnesses named above.',
    'دونوں فریق تصدیق کرتے ہیں کہ انہوں نے یہ معاہدہ پڑھ اور سمجھ لیا ہے اور اوپر درج گواہوں کی موجودگی میں اپنی مرضی سے دستخط کیے ہیں۔'],
  ['This agreement is executed under the laws of the Islamic Republic of Pakistan. The transaction is a deferred-payment sale (bai muajjal): the price is fixed at the time of sale and no interest accrues on the outstanding balance.',
    'یہ معاہدہ اسلامی جمہوریہ پاکستان کے قوانین کے تحت طے پایا ہے۔ یہ سودا بیع مؤجل ہے: قیمت فروخت کے وقت طے ہو جاتی ہے اور باقی رقم پر کوئی سود نہیں لگتا۔'],

  // ---------------------------------------------------- investor agreement
  ['This Investment Agreement is made on {todayDate} at {businessAddress} between {businessName}, through its proprietor {businessOwner} (hereinafter the "Business" or "Mudarib"), of the one part, and {investorName}, holder of CNIC {investorCnic}, resident of {investorAddress} (hereinafter the "Investor" or "Rab-ul-Maal"), of the other part.',
    'یہ سرمایہ کاری کا معاہدہ آج بتاریخ {todayDate} بمقام {businessAddress}، ایک فریق {businessName} بذریعہ مالک {businessOwner} (آئندہ "کاروبار" یا "مضارب")، اور دوسرے فریق {investorName}، شناختی کارڈ نمبر {investorCnic}، ساکن {investorAddress} (آئندہ "سرمایہ کار" یا "رب المال") کے درمیان طے پایا۔'],
  ['WHEREAS the Investor wishes to place capital with the Business for deployment in its lawful trading activities, and the Business wishes to accept that capital on the terms set out below, both parties agree as follows:',
    'چونکہ سرمایہ کار کاروبار کی جائز تجارتی سرگرمیوں کے لیے سرمایہ لگانا چاہتا ہے اور کاروبار نیچے دی گئی شرائط پر یہ سرمایہ قبول کرنا چاہتا ہے، لہٰذا دونوں فریق درج ذیل پر متفق ہیں:'],
  ['Capital Contribution', 'سرمایہ'],
  ['The Investor contributes capital of {investmentAmount} to the Business on {investmentDate}. Receipt of this amount is acknowledged by the Business.',
    'سرمایہ کار نے {investmentDate} کو کاروبار میں {investmentAmount} کا سرمایہ لگایا۔ کاروبار اس رقم کی وصولی تسلیم کرتا ہے۔'],
  ['Use of Capital', 'سرمائے کا استعمال'],
  ['The capital shall be applied solely to the lawful trading activities of the Business, including the purchase of stock for cash and installment sale. It shall not be used for any activity prohibited under Shariah.',
    'سرمایہ صرف کاروبار کی جائز تجارتی سرگرمیوں میں استعمال ہوگا، بشمول نقد اور قسطوں پر فروخت کے لیے مال کی خریداری۔ اسے کسی ایسی سرگرمی میں استعمال نہیں کیا جائے گا جو شریعت میں ممنوع ہو۔'],
  ['Profit Share', 'منافع میں حصہ'],
  ['The Investor shall be entitled to a profit share calculated on a {profitMethod} basis at the agreed rate of {profitPercentage}% of the applicable base.',
    'سرمایہ کار {profitMethod} کی بنیاد پر، طے شدہ شرح {profitPercentage}% کے مطابق منافع میں حصے کا حقدار ہوگا۔'],
  ['Profit Distribution', 'منافع کی تقسیم'],
  ['Profit shall be computed and distributed on a {payoutFrequency} basis. Each distribution shall be recorded against a numbered payout receipt issued by the Business.',
    'منافع کا حساب اور تقسیم {payoutFrequency} بنیاد پر ہوگی۔ ہر ادائیگی کاروبار کی جاری کردہ نمبر شدہ رسید پر درج ہوگی۔'],
  ['Loss Sharing', 'نقصان میں شراکت'],
  ['Where a loss arises other than through the negligence or wilful default of the Business, the loss shall be borne by the Investor to the extent of the capital contributed. The Business bears the loss of its own effort and management.',
    'اگر کاروبار کی غفلت یا جان بوجھ کر کوتاہی کے بغیر نقصان ہو تو لگائے گئے سرمائے کی حد تک نقصان سرمایہ کار برداشت کرے گا۔ کاروبار اپنی محنت اور انتظام کا نقصان خود برداشت کرے گا۔'],
  ['Books and Inspection', 'حسابات اور معائنہ'],
  ['The Business shall maintain proper books of account for the deployment of the capital, and the Investor or their nominee may inspect the relevant records on reasonable prior notice during business hours.',
    'کاروبار سرمائے کے استعمال کا باقاعدہ حساب رکھے گا، اور سرمایہ کار یا اس کا نمائندہ مناسب پیشگی اطلاع پر کاروباری اوقات میں متعلقہ ریکارڈ دیکھ سکتا ہے۔'],
  ['Withdrawal of Capital', 'سرمائے کی واپسی'],
  ['The Investor may withdraw the capital by giving thirty (30) days written notice. The capital shall be returned to the extent it is not committed to stock or outstanding installment receivables at that date, and the balance as those amounts are realised.',
    'سرمایہ کار تیس (۳۰) دن کا تحریری نوٹس دے کر سرمایہ واپس لے سکتا ہے۔ اس تاریخ تک جو سرمایہ مال یا باقی قسطوں میں نہ لگا ہو وہ واپس ہوگا، اور باقی رقم وصولی کے ساتھ ساتھ ادا ہوگی۔'],
  ['Zakat', 'زکوٰۃ'],
  ['Each party is responsible for the Zakat on their own wealth. The Business calculates and pays Zakat on the wealth of the proprietor and its partners only; the Investor is responsible for the Zakat on their own capital and profit share.',
    'ہر فریق اپنے مال کی زکوٰۃ کا خود ذمہ دار ہے۔ کاروبار صرف مالک اور شراکت داروں کے مال کی زکوٰۃ کا حساب اور ادائیگی کرتا ہے؛ سرمایہ کار اپنے سرمائے اور منافع کی زکوٰۃ کا خود ذمہ دار ہے۔'],
  ['No Management Role', 'انتظام میں کوئی کردار نہیں'],
  ['The Investor shall have no role in the day-to-day management of the Business, which shall remain with the proprietor, and shall incur no liability towards third parties beyond the capital contributed.',
    'سرمایہ کار کا کاروبار کے روزمرہ انتظام میں کوئی کردار نہیں ہوگا جو مالک کے پاس رہے گا، اور لگائے گئے سرمائے سے زیادہ تیسرے فریق کے لیے اس کی کوئی ذمہ داری نہیں ہوگی۔'],
  ['Term and Termination', 'مدت اور اختتام'],
  ['This agreement remains in force until terminated by either party in writing. On termination, all outstanding profit due to the Investor shall be settled together with the returnable capital.',
    'یہ معاہدہ اس وقت تک نافذ رہے گا جب تک کوئی فریق تحریری طور پر اسے ختم نہ کرے۔ اختتام پر سرمایہ کار کا تمام واجب منافع قابلِ واپسی سرمائے کے ساتھ ادا کیا جائے گا۔'],
  ['Any dispute shall first be referred to amicable settlement between the parties, and failing that to the competent courts at Mardan, Khyber Pakhtunkhwa.',
    'کوئی بھی تنازعہ پہلے فریقین کے درمیان باہمی تصفیے کے لیے پیش ہوگا، اور ایسا نہ ہونے پر مردان، خیبر پختونخوا کی مجاز عدالتوں میں۔'],
  ['Both parties confirm that this agreement has been read over and explained to them, and that they have signed it of their own free will in the presence of the witnesses named above.',
    'دونوں فریق تصدیق کرتے ہیں کہ یہ معاہدہ انہیں پڑھ کر سنایا اور سمجھایا گیا ہے اور انہوں نے اوپر درج گواہوں کی موجودگی میں اپنی مرضی سے دستخط کیے ہیں۔'],
  ['This agreement is structured on a profit-participation (Mudarabah) basis under the laws of the Islamic Republic of Pakistan. The Investor participates in profit and bears the risk of capital loss; no fixed return on capital is guaranteed.',
    'یہ معاہدہ اسلامی جمہوریہ پاکستان کے قوانین کے تحت منافع میں شراکت (مضاربہ) کی بنیاد پر ہے۔ سرمایہ کار منافع میں شریک ہے اور سرمائے کے نقصان کا خطرہ اٹھاتا ہے؛ سرمائے پر کسی مقررہ منافع کی ضمانت نہیں۔'],

  // ----------------------------------------------------- partner agreement
  ['This Partnership Agreement is made on {todayDate} at {businessAddress} between {businessName}, through its proprietor {businessOwner} (hereinafter the "First Partner"), of the one part, and {partnerName}, holder of CNIC {partnerCnic}, resident of {partnerAddress} (hereinafter the "Second Partner"), of the other part.',
    'یہ شراکت داری کا معاہدہ آج بتاریخ {todayDate} بمقام {businessAddress}، ایک فریق {businessName} بذریعہ مالک {businessOwner} (آئندہ "پہلا شراکت دار")، اور دوسرے فریق {partnerName}، شناختی کارڈ نمبر {partnerCnic}، ساکن {partnerAddress} (آئندہ "دوسرا شراکت دار") کے درمیان طے پایا۔'],
  ['WHEREAS the parties wish to carry on business together on the terms set out below, both parties agree as follows:',
    'چونکہ فریقین نیچے دی گئی شرائط پر مل کر کاروبار کرنا چاہتے ہیں، لہٰذا دونوں فریق درج ذیل پر متفق ہیں:'],
  ['Nature of Business', 'کاروبار کی نوعیت'],
  ['The partnership shall carry on the business of trading in consumer goods on cash and installment terms, and any other lawful business the partners agree in writing.',
    'شراکت نقد اور قسطوں پر صارفین کے سامان کی تجارت کا کاروبار کرے گی، اور کوئی بھی دوسرا جائز کاروبار جس پر شراکت دار تحریری طور پر متفق ہوں۔'],
  ['Capital', 'سرمایہ'],
  ['The Second Partner contributes capital of {capitalInvested} to the partnership, and holds an ownership interest of {ownershipPercent}% with effect from {agreementDate}.',
    'دوسرا شراکت دار شراکت میں {capitalInvested} کا سرمایہ لگاتا ہے اور {agreementDate} سے {ownershipPercent}% ملکیت کا حقدار ہے۔'],
  ['Profit Sharing', 'منافع کی تقسیم'],
  ['Net profit shall be shared in the agreed ratio, the Second Partner receiving {ownershipPercent}% and the First Partner the balance, after deduction of all business expenses.',
    'تمام کاروباری اخراجات منہا کرنے کے بعد خالص منافع طے شدہ تناسب سے تقسیم ہوگا: دوسرے شراکت دار کو {ownershipPercent}% اور پہلے شراکت دار کو باقی۔'],
  ['In accordance with Shariah, any loss shall be borne by the partners strictly in proportion to their capital contributions, regardless of the profit-sharing ratio.',
    'شریعت کے مطابق کوئی بھی نقصان منافع کے تناسب سے قطع نظر، شراکت داروں کے لگائے گئے سرمائے کے تناسب سے ہی برداشت کیا جائے گا۔'],
  ['Stock and Asset Ownership', 'مال اور اثاثوں کی ملکیت'],
  ['Stock and assets purchased from partnership funds shall be recorded in the books as jointly owned in the agreed ratio, and the system shall allocate each sale, collection and expense accordingly.',
    'شراکت کے فنڈ سے خریدا گیا مال اور اثاثے طے شدہ تناسب سے مشترکہ ملکیت کے طور پر درج ہوں گے، اور سسٹم ہر فروخت، وصولی اور خرچ اسی کے مطابق تقسیم کرے گا۔'],
  ['Management', 'انتظام'],
  ['Day-to-day management vests in the First Partner. Any single transaction exceeding an amount agreed between the partners requires the written consent of both.',
    'روزمرہ انتظام پہلے شراکت دار کے پاس ہوگا۔ شراکت داروں کی طے کردہ رقم سے بڑے کسی بھی لین دین کے لیے دونوں کی تحریری رضامندی ضروری ہے۔'],
  ['Drawings', 'رقم نکالنا'],
  ['Neither partner shall draw against partnership funds beyond their entitled profit share without the written consent of the other.',
    'کوئی شراکت دار دوسرے کی تحریری رضامندی کے بغیر اپنے حصے کے منافع سے زیادہ رقم شراکت کے فنڈ سے نہیں نکالے گا۔'],
  ['Accounts', 'حسابات'],
  ['Proper books of account shall be maintained and shall be open to inspection by either partner at any time. Accounts shall be reconciled at least once every quarter.',
    'باقاعدہ حسابات رکھے جائیں گے جو کسی بھی وقت کوئی بھی شراکت دار دیکھ سکتا ہے۔ ہر سہ ماہی میں کم از کم ایک بار حسابات کا ملان ہوگا۔'],
  ['Each partner is responsible for the Zakat on their own share of the partnership wealth. The system computes each partner\'s zakatable assets - stock, receivables, cash and bank - in proportion to their ownership.',
    'ہر شراکت دار شراکت کے مال میں اپنے حصے کی زکوٰۃ کا خود ذمہ دار ہے۔ سسٹم ہر شراکت دار کے قابلِ زکوٰۃ اثاثے - مال، وصولیاں، نقد اور بینک - اس کی ملکیت کے تناسب سے شمار کرتا ہے۔'],
  ['Retirement and Dissolution', 'علیحدگی اور خاتمہ'],
  ['A partner may retire on ninety (90) days written notice. On retirement or dissolution, assets shall be valued, liabilities settled, and the balance distributed in the agreed ratio.',
    'کوئی شراکت دار نوے (۹۰) دن کے تحریری نوٹس پر الگ ہو سکتا ہے۔ علیحدگی یا خاتمے پر اثاثوں کی قیمت لگائی جائے گی، واجبات ادا ہوں گے اور باقی طے شدہ تناسب سے تقسیم ہوگا۔'],
  ['Any dispute shall first be referred to amicable settlement, and failing that to the competent courts at Mardan, Khyber Pakhtunkhwa.',
    'کوئی بھی تنازعہ پہلے باہمی تصفیے کے لیے پیش ہوگا، اور ایسا نہ ہونے پر مردان، خیبر پختونخوا کی مجاز عدالتوں میں۔'],
  ['Both partners confirm that they have read and understood this agreement and have signed it of their own free will in the presence of the witnesses named above.',
    'دونوں شراکت دار تصدیق کرتے ہیں کہ انہوں نے یہ معاہدہ پڑھ اور سمجھ لیا ہے اور اوپر درج گواہوں کی موجودگی میں اپنی مرضی سے دستخط کیے ہیں۔'],
  ['This agreement is executed under the laws of the Islamic Republic of Pakistan and is intended to be a partnership of contract (Shirkat-ul-Aqd) in which profit is shared as agreed and loss is borne in proportion to capital.',
    'یہ معاہدہ اسلامی جمہوریہ پاکستان کے قوانین کے تحت شرکتِ عقد کی صورت میں ہے جس میں منافع طے شدہ طریقے سے تقسیم ہوتا ہے اور نقصان سرمائے کے تناسب سے برداشت کیا جاتا ہے۔'],
];

/** Headings, table labels and fixed wording printed on documents. */
export const DOC_URDU = {
  'Terms Agreed Between The Parties': 'فریقین کے درمیان طے شدہ شرائط',
  'Commercial Terms': 'تجارتی شرائط',
  'Additional Terms': 'اضافی شرائط',
  'Witnesses': 'گواہان',
  'Terms & Conditions': 'شرائط و ضوابط',
  'The Seller / Business': 'فروخت کنندہ / کاروبار',
  'The Buyer': 'خریدار',
  'The Investor': 'سرمایہ کار',
  'The Second Partner': 'دوسرا شراکت دار',
  'The Guarantor': 'ضامن',
  'Total sale price': 'کل قیمتِ فروخت',
  'Advance paid': 'پیشگی ادائیگی',
  'Balance financed': 'باقی رقم',
  'Tenure': 'مدت',
  'Monthly installment': 'ماہانہ قسط',
  'First installment due': 'پہلی قسط کی تاریخ',
  'Final installment due': 'آخری قسط کی تاریخ',
  'Capital contributed': 'لگایا گیا سرمایہ',
  'Profit share': 'منافع میں حصہ',
  'Calculation basis': 'حساب کی بنیاد',
  'Effective from': 'نافذ از',
  'Ownership share': 'ملکیت کا حصہ',
  'Loss share': 'نقصان میں حصہ',
  'INSTALLMENT SALE AGREEMENT': 'قسطوں پر فروخت کا معاہدہ',
  'INVESTMENT AGREEMENT': 'سرمایہ کاری کا معاہدہ',
  'PARTNERSHIP AGREEMENT': 'شراکت داری کا معاہدہ',
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const normalise = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compile each English entry into a pattern with a capture per {token}. */
const COMPILED = ENTRIES.map(([en, ur]) => {
  const english = normalise(en);
  const tokens = [];
  const source = english
    .split(/(\{[a-zA-Z]+\})/)
    .map((part) => {
      const token = part.match(/^\{([a-zA-Z]+)\}$/);
      if (token) {
        tokens.push(token[1]);
        return '(.+?)';
      }
      return escape(part);
    })
    .join('');
  return { pattern: new RegExp(`^${source}$`, 's'), tokens, ur };
});

/**
 * The Urdu for one piece of stored English, as parts: plain strings and
 * `{ value }` objects for the filled-in details (names, amounts, dates),
 * which the caller wraps so they stay left-to-right inside the Urdu.
 * Returns null when there is no translation.
 *
 * @param {string} english
 * @returns {Array<string|{value:string}>|null}
 */
export function urduParts(english) {
  const text = normalise(english);
  if (!text) return null;

  for (const { pattern, tokens, ur } of COMPILED) {
    const match = text.match(pattern);
    if (!match) continue;
    const values = Object.fromEntries(tokens.map((t, i) => [t, match[i + 1]]));
    return ur
      .split(/(\{[a-zA-Z]+\})/)
      .filter(Boolean)
      .map((part) => {
        const token = part.match(/^\{([a-zA-Z]+)\}$/);
        return token ? { value: values[token[1]] ?? '' } : part;
      });
  }
  return null;
}

/**
 * A paragraph that may hold several sentences separated by blank lines (the
 * recitals). Each paragraph is translated on its own.
 */
export function urduParagraphs(english) {
  return String(english || '')
    .split(/\n\s*\n/)
    .map((para) => urduParts(para))
    .filter(Boolean);
}

/** Urdu for a fixed heading or label, or ''. */
export const docUrdu = (label) => DOC_URDU[label] || '';
