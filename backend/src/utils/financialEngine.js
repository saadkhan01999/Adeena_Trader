/**
 * ============================================
 * Financial Calculation Engine
 * ============================================
 * Pure, dependency-free functions for every money calculation in the system.
 *
 * This file is deliberately mirrored at frontend/src/utils/financialEngine.js.
 * Keeping the formulas identical on both sides means the installment breakdown
 * a salesman previews on screen is arithmetically the same one the server
 * stores - no "the screen said 17,500 but the invoice says 17,499" surprises.
 *
 * Business rules encoded here
 * ---------------------------
 * - Installment plans are 6 or 12 months only, and carry no interest.
 * - Rounding differences always land on the LAST installment, so the schedule
 *   sums exactly to the amount financed.
 * - Payments allocate oldest-due-first.
 * - Zakat is 2.5% of net zakatable assets, and applies to Owner and Partner
 *   only - never to Investors.
 */

// ============================================================================
// Primitives
// ============================================================================

/**
 * Coerce anything to a finite number, defaulting to 0.
 * Guards every formula below: one `undefined` reaching an arithmetic operator
 * turns a whole invoice into NaN, which then persists to the database.
 *
 * @param {*} val
 * @returns {number}
 */
export const parseNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(val);
  return Number.isNaN(n) || !Number.isFinite(n) ? 0 : n;
};

/**
 * Round to whole rupees. Pakistani retail does not transact in paisa, and
 * keeping every stored figure an integer avoids floating-point drift when
 * twelve installments are summed back up.
 */
export const roundPKR = (val) => Math.round(parseNumber(val));

/** Format as a PKR string, e.g. 135000 -> "Rs. 135,000". */
export const formatPKR = (n) => `Rs. ${roundPKR(n).toLocaleString('en-PK')}`;

/** Clamp a number into a range. */
export const clamp = (val, min, max) => Math.min(Math.max(parseNumber(val), min), max);

/** Midnight of the given date, so date comparisons ignore the clock. */
export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export const daysBetween = (from, to) => {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
};

// ============================================================================
// Installments
// ============================================================================

/** Only these plans are offered. Anything else falls back to 6. */
const normalisePlan = (planMonths) => (parseNumber(planMonths) === 12 ? 12 : 6);

/**
 * Break a sale down into its installment terms.
 *
 * There is no interest: the customer pays the agreed price, split evenly after
 * the advance. `monthlyInstallment` is the headline figure quoted in the shop.
 *
 * @param {number} totalPrice Sale value.
 * @param {number} advance    Down payment taken today.
 * @param {6|12}   planMonths Tenure.
 * @returns {{totalPrice:number, advance:number, remaining:number, planMonths:number,
 *           monthlyInstallment:number, totalPayable:number, advancePercent:number}}
 *
 * @example
 * calculateInstallment(135000, 30000, 6)
 * // { remaining: 105000, monthlyInstallment: 17500, totalPayable: 135000, ... }
 */
export const calculateInstallment = (totalPrice, advance, planMonths = 6) => {
  const total = roundPKR(totalPrice);
  const adv = clamp(roundPKR(advance), 0, total); // Advance can never exceed the price
  const plan = normalisePlan(planMonths);
  const remaining = Math.max(0, total - adv);

  return {
    totalPrice: total,
    advance: adv,
    remaining,
    planMonths: plan,
    monthlyInstallment: Math.round(remaining / plan),
    totalPayable: total,
    advancePercent: total > 0 ? Math.round((adv / total) * 100) : 0,
  };
};

/**
 * Work out what an installment's status should be right now.
 *
 * Status is a function of (due date, amount paid, today, grace period) and
 * nothing else, so it is computed rather than stored-and-hoped. A grace period
 * of N days means the row only turns `overdue` once it is more than N days past
 * due; inside the window it is `late`, which the UI shows in amber, not red.
 *
 * @param {object} params
 * @param {Date|string} params.dueDate
 * @param {number} params.expected
 * @param {number} params.paid
 * @param {number} [params.gracePeriodDays=0]
 * @param {Date}   [params.today=new Date()]
 * @returns {'paid'|'overdue'|'late'|'due_today'|'partially_paid'|'upcoming'}
 */
export const resolveInstallmentStatus = ({
  dueDate,
  expected,
  paid,
  gracePeriodDays = 0,
  today = new Date(),
}) => {
  const exp = parseNumber(expected);
  const pd = parseNumber(paid);

  if (pd >= exp && exp > 0) return 'paid';

  // Negative = the due date has passed
  const daysUntilDue = daysBetween(today, dueDate);

  if (daysUntilDue < 0) {
    const daysLate = Math.abs(daysUntilDue);
    return daysLate > parseNumber(gracePeriodDays) ? 'overdue' : 'late';
  }

  if (daysUntilDue === 0) return 'due_today';
  return pd > 0 ? 'partially_paid' : 'upcoming';
};

/**
 * Build the full installment schedule for a sale.
 *
 * The first installment falls one month after the sale date. Every row carries
 * the same base amount except the last, which absorbs the rounding remainder -
 * this is what guarantees `sum(expected) === remainingAmount` exactly.
 *
 * @param {Date|string} startDate       Sale date.
 * @param {6|12} planMonths
 * @param {number} remainingAmount      Amount being financed (after advance).
 * @param {{gracePeriodDays?: number}} [options]
 * @returns {Array<{number:number, dueDate:string, expected:number, paid:number,
 *                  remaining:number, status:string, paidDate:null}>}
 */
export const generateInstallmentSchedule = (
  startDate,
  planMonths,
  remainingAmount,
  options = {}
) => {
  const remaining = roundPKR(remainingAmount);
  const plan = normalisePlan(planMonths);
  const { gracePeriodDays = 0 } = options;

  const base = Math.floor(remaining / plan);
  const remainder = remaining - base * plan; // Always lands on the final row

  const start = new Date(startDate || Date.now());
  const schedule = [];

  for (let i = 0; i < plan; i += 1) {
    const dueDate = addMonthsClamped(start, i + 1);
    const expected = i === plan - 1 ? base + remainder : base;

    schedule.push({
      number: i + 1,
      dueDate: dueDate.toISOString(),
      expected,
      paid: 0,
      remaining: expected,
      status: resolveInstallmentStatus({ dueDate, expected, paid: 0, gracePeriodDays }),
      paidDate: null,
    });
  }

  return schedule;
};

/**
 * Add whole months to a date, clamping the day so month-end never overflows.
 *
 * Plain `setMonth` turns 31 Jan + 1 month into 3 March, which would silently
 * shift a customer's due date. Clamping gives 28/29 February instead, matching
 * how the shop actually writes the date on the agreement.
 */
export const addMonthsClamped = (date, months) => {
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDayOfTarget));
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Apply a payment to a single installment.
 * @returns {{newPaidTotal:number, remainingDue:number, status:string, allocated:number}}
 */
export const allocatePaymentToInstallment = (expected, alreadyPaid, newPayment) => {
  const exp = parseNumber(expected);
  const paid = parseNumber(alreadyPaid);
  const due = Math.max(0, exp - paid);
  const allocated = Math.min(due, parseNumber(newPayment));
  const newPaidTotal = paid + allocated;

  return {
    allocated,
    newPaidTotal,
    remainingDue: Math.max(0, exp - newPaidTotal),
    status: newPaidTotal >= exp ? 'paid' : newPaidTotal > 0 ? 'partially_paid' : 'upcoming',
  };
};

/**
 * Distribute a payment across many installments, oldest due date first.
 * Pure: returns new objects rather than mutating the input.
 *
 * @returns {{updatedInstallments:Array, totalAllocated:number, remainingPayment:number}}
 */
export const allocatePaymentAcrossInstallments = (installments, paymentAmount) => {
  let pool = parseNumber(paymentAmount);

  const ordered = [...installments].sort(
    (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
  );

  const updated = ordered.map((inst) => {
    if (pool <= 0) return { ...inst };

    const { allocated, newPaidTotal, remainingDue, status } = allocatePaymentToInstallment(
      inst.expected,
      inst.paid,
      pool
    );
    if (allocated <= 0) return { ...inst };

    pool -= allocated;

    return {
      ...inst,
      paid: newPaidTotal,
      remaining: remainingDue,
      status,
      paidDate: status === 'paid' ? new Date().toISOString() : inst.paidDate ?? null,
    };
  });

  return {
    updatedInstallments: updated,
    totalAllocated: parseNumber(paymentAmount) - pool,
    remainingPayment: Math.max(0, pool),
  };
};

// ============================================================================
// Ownership (owner vs partner)
// ============================================================================

/**
 * Split an amount between the owner and a partner.
 *
 * @param {number} amount
 * @param {'owner'|'partner'|'shared'} ownership
 * @param {number} [partnerSharePercent=40]
 * @returns {{ownerAmount:number, partnerAmount:number, ownerPercent:number, partnerPercent:number}}
 *
 * @example calculateOwnershipShare(100000, 'shared', 40)
 * // { ownerAmount: 60000, partnerAmount: 40000, ownerPercent: 60, partnerPercent: 40 }
 */
export const calculateOwnershipShare = (amount, ownership, partnerSharePercent = 40) => {
  const amt = roundPKR(amount);
  const partnerPct = clamp(partnerSharePercent, 0, 100);
  const ownerPct = 100 - partnerPct;

  if (ownership === 'owner') {
    return { ownerAmount: amt, partnerAmount: 0, ownerPercent: 100, partnerPercent: 0 };
  }
  if (ownership === 'partner') {
    return { ownerAmount: 0, partnerAmount: amt, ownerPercent: 0, partnerPercent: 100 };
  }

  const partnerAmount = Math.round((amt * partnerPct) / 100);
  return {
    ownerAmount: amt - partnerAmount, // Subtract so the two halves always sum to `amt`
    partnerAmount,
    ownerPercent: ownerPct,
    partnerPercent: partnerPct,
  };
};

// ============================================================================
// Investors
// ============================================================================

/**
 * Work out an investor's profit entitlement.
 *
 * Three models are supported, matching how the agreements are actually written:
 *   fixed_percent  - a flat % of the capital, per period
 *   profit_sharing - a % of the business profit the capital generated
 *   monthly_fixed  - an agreed rupee amount per month
 *
 * @param {object} params
 * @param {number} params.investmentAmount
 * @param {number} params.profitPercentage
 * @param {string} params.method
 * @param {number} [params.businessProfit=0] Required for profit_sharing.
 * @param {number} [params.months=1]         Periods elapsed.
 * @param {number} [params.monthlyFixedAmount=0]
 * @returns {{calculatedProfit:number, method:string, basis:string}}
 */
export const calculateInvestorProfit = ({
  investmentAmount,
  profitPercentage,
  method = 'fixed_percent',
  businessProfit = 0,
  months = 1,
  monthlyFixedAmount = 0,
}) => {
  const capital = roundPKR(investmentAmount);
  const pct = clamp(profitPercentage, 0, 100);
  const periods = Math.max(1, parseNumber(months));

  switch (method) {
    case 'profit_sharing':
      return {
        calculatedProfit: Math.round((roundPKR(businessProfit) * pct) / 100),
        method,
        basis: `${pct}% of business profit`,
      };

    case 'monthly_fixed':
      return {
        calculatedProfit: roundPKR(monthlyFixedAmount) * periods,
        method,
        basis: `${formatPKR(monthlyFixedAmount)} x ${periods} month(s)`,
      };

    case 'fixed_percent':
    default:
      return {
        calculatedProfit: Math.round((capital * pct) / 100),
        method: 'fixed_percent',
        basis: `${pct}% of ${formatPKR(capital)} capital`,
      };
  }
};

// ============================================================================
// Zakat
// ============================================================================

/** Shariah-fixed nisab weights. These never change; only their price does. */
export const NISAB_GOLD_GRAMS = 87.48;    // 7.5 tola
export const NISAB_SILVER_GRAMS = 612.36; // 52.5 tola

/**
 * Convert a metal rate into the rupee nisab threshold.
 *
 * Where a person holds a mixture of asset types - which a trading business
 * always does - the lower SILVER threshold applies, because it brings more
 * people into the obligation and is the cautious position.
 *
 * @param {object} params
 * @param {'gold'|'silver'|'manual'} params.basis
 * @param {number} [params.goldRatePerGram]
 * @param {number} [params.silverRatePerGram]
 * @param {number} [params.manualNisab]
 * @returns {{nisab:number, basis:string, explanation:string}}
 */
export const calculateNisab = ({
  basis = 'silver',
  goldRatePerGram = 0,
  silverRatePerGram = 0,
  manualNisab = 0,
}) => {
  if (basis === 'gold') {
    const nisab = Math.round(parseNumber(goldRatePerGram) * NISAB_GOLD_GRAMS);
    return {
      nisab,
      basis,
      explanation: `${NISAB_GOLD_GRAMS} g gold (7.5 tola) x ${formatPKR(goldRatePerGram)}/g`,
    };
  }

  if (basis === 'silver') {
    const nisab = Math.round(parseNumber(silverRatePerGram) * NISAB_SILVER_GRAMS);
    return {
      nisab,
      basis,
      explanation: `${NISAB_SILVER_GRAMS} g silver (52.5 tola) x ${formatPKR(silverRatePerGram)}/g`,
    };
  }

  return {
    nisab: roundPKR(manualNisab),
    basis: 'manual',
    explanation: 'Threshold entered manually by the administrator',
  };
};

/**
 * Calculate Zakat on business wealth.
 *
 * BUSINESS RULE: applies to the Owner and to Partners only. Investor capital is
 * excluded entirely - it is a liability of the business towards the investor,
 * not the owner's wealth, and the investor purifies their own share.
 *
 *   net    = (stock at market value + receivables + cash + bank + other)
 *            - (supplier payables + other immediate liabilities)
 *   zakat  = net >= nisab ? net * 2.5% : 0
 *
 * @param {object} params
 * @returns {object} Full breakdown, safe to persist as an audit record.
 */
export const calculateZakat = ({
  eligibleStock = 0,
  receivables = 0,
  cash = 0,
  bankBalance = 0,
  otherAssets = 0,
  supplierPayables = 0,
  otherLiabilities = 0,
  deductions = null, // When supplied, overrides the two liability lines
  nisab = 0,
  rate = 0.025,
  eligibleAssets = null,   // Optional per-class on/off switches
  eligibleDeductions = null,
}) => {
  // Honour the admin's per-class toggles; default every class to "counts".
  const include = {
    stock: eligibleAssets?.stock ?? true,
    receivables: eligibleAssets?.receivables ?? true,
    cash: eligibleAssets?.cash ?? true,
    bankBalance: eligibleAssets?.bankBalance ?? true,
    otherAssets: eligibleAssets?.otherAssets ?? true,
  };
  const deduct = {
    supplierPayables: eligibleDeductions?.supplierPayables ?? true,
    otherLiabilities: eligibleDeductions?.otherLiabilities ?? true,
  };

  const stock = include.stock ? roundPKR(eligibleStock) : 0;
  const rec = include.receivables ? roundPKR(receivables) : 0;
  const cashVal = include.cash ? roundPKR(cash) : 0;
  const bank = include.bankBalance ? roundPKR(bankBalance) : 0;
  const other = include.otherAssets ? roundPKR(otherAssets) : 0;

  const payables = deduct.supplierPayables ? roundPKR(supplierPayables) : 0;
  const liabilities = deduct.otherLiabilities ? roundPKR(otherLiabilities) : 0;

  const totalDeductions = deductions !== null && deductions !== undefined
    ? roundPKR(deductions)
    : payables + liabilities;

  const grossAssets = stock + rec + cashVal + bank + other;
  const netAssets = Math.max(0, grossAssets - totalDeductions);

  const nisabVal = roundPKR(nisab);
  const rateVal = parseNumber(rate) || 0.025;

  // A nisab of 0 means the admin has not entered a metal rate yet. Treating
  // that as "everyone qualifies" would overstate the obligation, so we require
  // a positive threshold before declaring Zakat due.
  const isAboveNisab = nisabVal > 0 && netAssets >= nisabVal;

  return {
    eligibleStock: stock,
    receivables: rec,
    cash: cashVal,
    bankBalance: bank,
    otherAssets: other,
    grossAssets,
    supplierPayables: payables,
    otherLiabilities: liabilities,
    deductions: totalDeductions,
    netAssets,
    nisab: nisabVal,
    rate: rateVal,
    isAboveNisab,
    zakatAmount: isAboveNisab ? Math.round(netAssets * rateVal) : 0,
    shortfallToNisab: isAboveNisab ? 0 : Math.max(0, nisabVal - netAssets),
  };
};

/**
 * Hawl progress: how far through the lunar year the wealth has been held.
 * A lunar year is ~354 days; Zakat only falls due once a full hawl elapses.
 *
 * @returns {{daysElapsed:number, daysRemaining:number, percent:number, dueDate:Date|null, isComplete:boolean}}
 */
export const calculateHawlProgress = (hawlStartDate, today = new Date()) => {
  const HAWL_DAYS = 354;
  if (!hawlStartDate) {
    return { daysElapsed: 0, daysRemaining: HAWL_DAYS, percent: 0, dueDate: null, isComplete: false };
  }

  const daysElapsed = Math.max(0, daysBetween(hawlStartDate, today));
  const daysRemaining = Math.max(0, HAWL_DAYS - daysElapsed);
  const dueDate = new Date(startOfDay(hawlStartDate).getTime() + HAWL_DAYS * 86_400_000);

  return {
    daysElapsed,
    daysRemaining,
    percent: Math.min(100, Math.round((daysElapsed / HAWL_DAYS) * 100)),
    dueDate,
    isComplete: daysElapsed >= HAWL_DAYS,
  };
};

// ============================================================================
// Pricing & profit
// ============================================================================

/** Apply a percentage discount. */
export const calculateDiscount = (originalPrice, discountPercentage) => {
  const original = roundPKR(originalPrice);
  const pct = clamp(discountPercentage, 0, 100);
  const discountAmount = Math.round((original * pct) / 100);
  return { originalPrice: original, discountPercentage: pct, discountAmount, finalPrice: original - discountAmount };
};

/** Gross profit on a line item. */
export const calculateProfit = (purchasePrice, salePrice, quantity = 1) => {
  const qty = Math.max(0, parseNumber(quantity));
  const totalCost = roundPKR(purchasePrice) * qty;
  const totalRevenue = roundPKR(salePrice) * qty;
  const profit = totalRevenue - totalCost;

  return {
    quantity: qty,
    totalCost,
    totalRevenue,
    profit,
    profitPercentage: totalCost > 0 ? Math.round((profit / totalCost) * 10000) / 100 : 0,
    marginPercentage: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0,
  };
};

/** Selling price from cost plus a markup percentage. */
export const calculateMarkup = (cost, markupPercentage) => {
  const c = roundPKR(cost);
  const pct = clamp(markupPercentage, 0, 1000);
  const markupAmount = Math.round((c * pct) / 100);
  return { cost: c, markupPercentage: pct, markupAmount, sellingPrice: c + markupAmount };
};

/**
 * Suggest an installment price from the cash price.
 * Installment selling carries collection risk and tied-up capital, so the shop
 * quotes a higher price for it; this keeps that markup consistent.
 */
export const suggestInstallmentPrice = (cashPrice, markupPercent = 20) =>
  calculateMarkup(cashPrice, markupPercent).sellingPrice;
