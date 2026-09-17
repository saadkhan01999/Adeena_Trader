/**
 * ============================================
 * Document Template Service
 * ============================================
 * Seeds and resolves the wording of every document the business issues.
 *
 * The defaults below are drafted for a Pakistani retail installment business:
 * they name the parties, state the schedule, cover ownership of the goods until
 * final payment, the guarantor's undertaking, and dispute resolution. They are
 * a solid commercial starting point that the administrator is expected to
 * review with their own legal adviser and then edit in Settings - which is
 * exactly why the text lives in the database rather than in the code.
 */

import DocumentTemplate from '../models/DocumentTemplate.js';
import { DOCUMENT_TYPES } from '../constants/index.js';

// ============================================================================
// Default templates
// ============================================================================

const clause = (title, body, order) => ({ title, body, order, isActive: true, isCustom: false });
const signature = (label, caption, order) => ({ label, caption, order });

/**
 * Tokens available to each document type. Surfaced as clickable chips in the
 * Settings editor so an admin never has to guess the spelling of a placeholder.
 */
const TOKENS = {
  common: [
    'businessName', 'businessOwner', 'businessPhone', 'businessAddress',
    'businessNtn', 'date', 'todayDate',
  ],
  customer: [
    'customerName', 'customerCnic', 'customerPhone', 'customerAddress',
    'guarantorName', 'guarantorCnic', 'guarantorPhone',
  ],
  installment: [
    'invoiceNumber', 'agreementNumber', 'productDetails', 'totalPrice',
    'advanceAmount', 'financedAmount', 'planMonths', 'monthlyInstallment',
    'firstDueDate', 'lastDueDate',
  ],
  investor: [
    'agreementNumber', 'investorName', 'investorCnic', 'investorPhone',
    'investorAddress', 'investmentAmount', 'profitPercentage',
    'profitMethod', 'investmentDate', 'payoutFrequency',
  ],
  partner: [
    'agreementNumber', 'partnerName', 'partnerCnic', 'partnerPhone',
    'partnerAddress', 'ownershipPercent', 'capitalInvested', 'agreementDate',
  ],
};

const DEFAULT_TEMPLATES = [
  // --------------------------------------------------------------------
  // Sales invoice
  // --------------------------------------------------------------------
  {
    type: DOCUMENT_TYPES.INVOICE,
    title: 'SALES INVOICE',
    subtitle: '',
    introText: '',
    customText: '',
    footerText: 'Thank you for your business. We value your trust.',
    legalNote: 'This invoice is computer-generated and is valid without a physical signature.',
    clauses: [
      clause('', 'Goods once sold will not be taken back or exchanged after 7 days from the date of this invoice.', 1),
      clause('', 'Warranty, where applicable, is provided by the manufacturer and is subject to their terms and conditions.', 2),
      clause('', 'Any complaint regarding quantity or condition must be reported within 24 hours of delivery.', 3),
      clause('', 'For installment sales, the goods remain the property of the seller until the final installment is paid in full.', 4),
    ],
    signatures: [
      signature('Customer Signature', '', 1),
      signature('For ADEENA TRADERS', 'Authorised Signatory', 2),
    ],
    availableTokens: [...TOKENS.common, ...TOKENS.customer, ...TOKENS.installment],
  },

  // --------------------------------------------------------------------
  // Payment receipt
  // --------------------------------------------------------------------
  {
    type: DOCUMENT_TYPES.RECEIPT,
    title: 'PAYMENT RECEIPT',
    subtitle: '',
    introText: '',
    customText: '',
    footerText: 'Please retain this receipt as proof of payment.',
    legalNote: 'This is a computer-generated receipt.',
    clauses: [
      clause('', 'This receipt acknowledges the amount stated above only. It does not clear any remaining balance on the account.', 1),
      clause('', 'Please present this receipt for any query relating to this payment.', 2),
    ],
    signatures: [signature('Received By', 'For ADEENA TRADERS', 1)],
    availableTokens: [...TOKENS.common, ...TOKENS.customer, 'receiptNumber', 'paymentAmount', 'paymentMethod', 'remainingBalance'],
  },

  // --------------------------------------------------------------------
  // Installment agreement (the core legal document of this business)
  // --------------------------------------------------------------------
  {
    type: DOCUMENT_TYPES.INSTALLMENT_AGREEMENT,
    title: 'INSTALLMENT SALE AGREEMENT',
    subtitle: 'Qist Par Farokht Ka Muahida',
    introText:
      'This Installment Sale Agreement is made on {todayDate} at {businessAddress} between ' +
      '{businessName}, through its proprietor {businessOwner} (hereinafter the "Seller"), ' +
      'of the one part, and {customerName}, holder of CNIC {customerCnic}, resident of ' +
      '{customerAddress} (hereinafter the "Buyer"), of the other part.\n\n' +
      'WHEREAS the Buyer has agreed to purchase and the Seller has agreed to sell the goods ' +
      'described below on deferred payment terms, both parties agree as follows:',
    customText: '',
    footerText:
      'Both parties confirm that they have read and understood this agreement, and have signed it ' +
      'of their own free will, in the presence of the witnesses named above.',
    legalNote:
      'This agreement is executed under the laws of the Islamic Republic of Pakistan. ' +
      'The transaction is a deferred-payment sale (bai muajjal): the price is fixed at the time ' +
      'of sale and no interest accrues on the outstanding balance.',
    clauses: [
      clause(
        'Description and Price',
        'The Seller sells to the Buyer the goods described as {productDetails} for a total agreed price of {totalPrice}.',
        1
      ),
      clause(
        'Advance Payment',
        'The Buyer has paid an advance of {advanceAmount}, receipt of which the Seller acknowledges. The balance financed is {financedAmount}.',
        2
      ),
      clause(
        'Payment Schedule',
        'The balance shall be paid in {planMonths} equal monthly installments of {monthlyInstallment} each. ' +
        'The first installment falls due on {firstDueDate} and each subsequent installment on the corresponding date of every following month, until {lastDueDate}.',
        3
      ),
      clause(
        'No Interest',
        'The total price is fixed at the time of this agreement. No interest, mark-up or additional profit shall be charged on the outstanding balance for any reason.',
        4
      ),
      clause(
        'Ownership and Risk',
        'Ownership of the goods remains with the Seller until the final installment is received in full. ' +
        'Risk of loss or damage passes to the Buyer on delivery, and the Buyer shall keep the goods in good condition and shall not sell, pledge, mortgage or otherwise dispose of them before full payment.',
        5
      ),
      clause(
        'Default',
        'If any installment remains unpaid for thirty (30) days after its due date, the Seller may, after giving written notice, ' +
        'demand the entire outstanding balance immediately or repossess the goods. Amounts already paid shall be adjusted against the outstanding balance and reasonable recovery costs.',
        6
      ),
      clause(
        'Early Settlement',
        'The Buyer may settle the outstanding balance in full at any time before the final due date without any penalty or additional charge.',
        7
      ),
      clause(
        'Guarantor',
        '{guarantorName}, holder of CNIC {guarantorCnic}, stands as guarantor and undertakes jointly and severally to pay any amount that the Buyer fails to pay under this agreement.',
        8
      ),
      clause(
        'Warranty',
        'Any warranty on the goods is provided by the manufacturer under their own terms. The Seller shall assist the Buyer in pursuing a warranty claim but gives no separate warranty of its own.',
        9
      ),
      clause(
        'Change of Address',
        'The Buyer shall inform the Seller in writing within seven (7) days of any change of residential address or contact number.',
        10
      ),
      clause(
        'Dispute Resolution',
        'Both parties shall first attempt to resolve any dispute amicably. Failing that, the dispute shall be referred to the competent courts at Mardan, Khyber Pakhtunkhwa.',
        11
      ),
    ],
    signatures: [
      signature('Buyer', 'Name: ____________  CNIC: ____________', 1),
      signature('Guarantor', 'Name: ____________  CNIC: ____________', 2),
      signature('For the Seller', '{businessName}', 3),
    ],
    showWatermark: false,
    availableTokens: [...TOKENS.common, ...TOKENS.customer, ...TOKENS.installment],
  },

  // --------------------------------------------------------------------
  // Investor agreement
  // --------------------------------------------------------------------
  {
    type: DOCUMENT_TYPES.INVESTOR_AGREEMENT,
    title: 'INVESTMENT AGREEMENT',
    subtitle: 'Profit Participation - Mudarabah Basis',
    introText:
      'This Investment Agreement is made on {todayDate} at {businessAddress} between ' +
      '{businessName}, through its proprietor {businessOwner} (hereinafter the "Business" or "Mudarib"), ' +
      'of the one part, and {investorName}, holder of CNIC {investorCnic}, resident of {investorAddress} ' +
      '(hereinafter the "Investor" or "Rab-ul-Maal"), of the other part.\n\n' +
      'WHEREAS the Investor wishes to place capital with the Business for deployment in its lawful ' +
      'trading activities, and the Business wishes to accept that capital on the terms set out below, ' +
      'both parties agree as follows:',
    customText: '',
    footerText:
      'Both parties confirm that this agreement has been read over and explained to them, and that they ' +
      'have signed it of their own free will in the presence of the witnesses named above.',
    legalNote:
      'This agreement is structured on a profit-participation (Mudarabah) basis under the laws of the ' +
      'Islamic Republic of Pakistan. The Investor participates in profit and bears the risk of capital ' +
      'loss; no fixed return on capital is guaranteed.',
    clauses: [
      clause(
        'Capital Contribution',
        'The Investor contributes capital of {investmentAmount} to the Business on {investmentDate}. Receipt of this amount is acknowledged by the Business.',
        1
      ),
      clause(
        'Use of Capital',
        'The capital shall be applied solely to the lawful trading activities of the Business, including the purchase of stock for cash and installment sale. It shall not be used for any activity prohibited under Shariah.',
        2
      ),
      clause(
        'Profit Share',
        'The Investor shall be entitled to a profit share calculated on a {profitMethod} basis at the agreed rate of {profitPercentage}% of the applicable base.',
        3
      ),
      clause(
        'Profit Distribution',
        'Profit shall be computed and distributed on a {payoutFrequency} basis. Each distribution shall be recorded against a numbered payout receipt issued by the Business.',
        4
      ),
      clause(
        'Loss Sharing',
        'Where a loss arises other than through the negligence or wilful default of the Business, the loss shall be borne by the Investor to the extent of the capital contributed. The Business bears the loss of its own effort and management.',
        5
      ),
      clause(
        'Books and Inspection',
        'The Business shall maintain proper books of account for the deployment of the capital, and the Investor or their nominee may inspect the relevant records on reasonable prior notice during business hours.',
        6
      ),
      clause(
        'Withdrawal of Capital',
        'The Investor may withdraw the capital by giving thirty (30) days written notice. The capital shall be returned to the extent it is not committed to stock or outstanding installment receivables at that date, and the balance as those amounts are realised.',
        7
      ),
      clause(
        'Zakat',
        'Each party is responsible for the Zakat on their own wealth. The Business calculates and pays Zakat on the wealth of the proprietor and its partners only; the Investor is responsible for the Zakat on their own capital and profit share.',
        8
      ),
      clause(
        'No Management Role',
        'The Investor shall have no role in the day-to-day management of the Business, which shall remain with the proprietor, and shall incur no liability towards third parties beyond the capital contributed.',
        9
      ),
      clause(
        'Term and Termination',
        'This agreement remains in force until terminated by either party in writing. On termination, all outstanding profit due to the Investor shall be settled together with the returnable capital.',
        10
      ),
      clause(
        'Dispute Resolution',
        'Any dispute shall first be referred to amicable settlement between the parties, and failing that to the competent courts at Mardan, Khyber Pakhtunkhwa.',
        11
      ),
    ],
    signatures: [
      signature('Investor', 'Name: ____________  CNIC: ____________', 1),
      signature('For the Business', '{businessName}', 2),
    ],
    availableTokens: [...TOKENS.common, ...TOKENS.investor],
  },

  // --------------------------------------------------------------------
  // Partnership agreement
  // --------------------------------------------------------------------
  {
    type: DOCUMENT_TYPES.PARTNER_AGREEMENT,
    title: 'PARTNERSHIP AGREEMENT',
    subtitle: 'Shirkat-ul-Aqd',
    introText:
      'This Partnership Agreement is made on {todayDate} at {businessAddress} between ' +
      '{businessName}, through its proprietor {businessOwner} (hereinafter the "First Partner"), ' +
      'of the one part, and {partnerName}, holder of CNIC {partnerCnic}, resident of {partnerAddress} ' +
      '(hereinafter the "Second Partner"), of the other part.\n\n' +
      'WHEREAS the parties wish to carry on business together on the terms set out below, ' +
      'both parties agree as follows:',
    customText: '',
    footerText:
      'Both partners confirm that they have read and understood this agreement and have signed it of ' +
      'their own free will in the presence of the witnesses named above.',
    legalNote:
      'This agreement is executed under the laws of the Islamic Republic of Pakistan and is intended ' +
      'to be a partnership of contract (Shirkat-ul-Aqd) in which profit is shared as agreed and loss ' +
      'is borne in proportion to capital.',
    clauses: [
      clause(
        'Nature of Business',
        'The partnership shall carry on the business of trading in consumer goods on cash and installment terms, and any other lawful business the partners agree in writing.',
        1
      ),
      clause(
        'Capital',
        'The Second Partner contributes capital of {capitalInvested} to the partnership, and holds an ownership interest of {ownershipPercent}% with effect from {agreementDate}.',
        2
      ),
      clause(
        'Profit Sharing',
        'Net profit shall be shared in the agreed ratio, the Second Partner receiving {ownershipPercent}% and the First Partner the balance, after deduction of all business expenses.',
        3
      ),
      clause(
        'Loss Sharing',
        'In accordance with Shariah, any loss shall be borne by the partners strictly in proportion to their capital contributions, regardless of the profit-sharing ratio.',
        4
      ),
      clause(
        'Stock and Asset Ownership',
        'Stock and assets purchased from partnership funds shall be recorded in the books as jointly owned in the agreed ratio, and the system shall allocate each sale, collection and expense accordingly.',
        5
      ),
      clause(
        'Management',
        'Day-to-day management vests in the First Partner. Any single transaction exceeding an amount agreed between the partners requires the written consent of both.',
        6
      ),
      clause(
        'Drawings',
        'Neither partner shall draw against partnership funds beyond their entitled profit share without the written consent of the other.',
        7
      ),
      clause(
        'Accounts',
        'Proper books of account shall be maintained and shall be open to inspection by either partner at any time. Accounts shall be reconciled at least once every quarter.',
        8
      ),
      clause(
        'Zakat',
        'Each partner is responsible for the Zakat on their own share of the partnership wealth. The system computes each partner\'s zakatable assets - stock, receivables, cash and bank - in proportion to their ownership.',
        9
      ),
      clause(
        'Retirement and Dissolution',
        'A partner may retire on ninety (90) days written notice. On retirement or dissolution, assets shall be valued, liabilities settled, and the balance distributed in the agreed ratio.',
        10
      ),
      clause(
        'Dispute Resolution',
        'Any dispute shall first be referred to amicable settlement, and failing that to the competent courts at Mardan, Khyber Pakhtunkhwa.',
        11
      ),
    ],
    signatures: [
      signature('First Partner', '{businessOwner}', 1),
      signature('Second Partner', 'Name: ____________  CNIC: ____________', 2),
    ],
    availableTokens: [...TOKENS.common, ...TOKENS.partner],
  },
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Ensure a template row exists for every document type.
 * Idempotent: an existing template is never overwritten, so an admin's edits
 * survive every restart and every deployment.
 *
 * @returns {Promise<{created: string[], existing: string[]}>}
 */
export const seedDocumentTemplates = async () => {
  const created = [];
  const existing = [];

  for (const template of DEFAULT_TEMPLATES) {
    const found = await DocumentTemplate.findOne({ type: template.type });
    if (found) {
      existing.push(template.type);
      continue;
    }
    await DocumentTemplate.create(template);
    created.push(template.type);
  }

  return { created, existing };
};

/**
 * Fetch a template, creating it from the default if it is somehow missing.
 * Callers can rely on always receiving a usable document.
 */
export const getTemplate = async (type) => {
  let template = await DocumentTemplate.findOne({ type });
  if (!template) {
    const fallback = DEFAULT_TEMPLATES.find((t) => t.type === type);
    if (!fallback) return null;
    template = await DocumentTemplate.create(fallback);
  }
  return template;
};

/**
 * Restore one template to its shipped defaults.
 * The escape hatch for an admin who has edited the wording into a corner.
 */
export const resetTemplate = async (type) => {
  const fallback = DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!fallback) return null;

  await DocumentTemplate.deleteOne({ type });
  return DocumentTemplate.create(fallback);
};

/** Read-only access to the shipped defaults, for preview and diffing. */
export const getDefaultTemplate = (type) =>
  DEFAULT_TEMPLATES.find((t) => t.type === type) || null;
