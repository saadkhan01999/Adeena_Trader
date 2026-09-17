/**
 * ============================================
 * Agreement Service
 * ============================================
 * Turns a template plus a business record into a concrete, issued agreement.
 *
 * The rendered clause text is FROZEN onto the agreement at issue time. An
 * agreement is a legal artefact: if the admin later rewrites clause 6, the
 * document the customer signed must not silently change with it. Historical
 * agreements therefore keep the words that were actually agreed.
 */

import Agreement from '../models/Agreement.js';
import Customer from '../models/Customer.js';
import Investor from '../models/Investor.js';
import Partner from '../models/Partner.js';
import Sale from '../models/Sale.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';
import { getTemplate } from './template.service.js';
import { generateAgreementNumber } from './financial.service.js';
import { DOCUMENT_TYPES } from '../constants/index.js';
import { formatPKR, addMonthsClamped, parseNumber } from '../utils/financialEngine.js';
import { BadRequestError, NotFoundError } from '../utils/AppError.js';

// ============================================================================
// Token rendering
// ============================================================================

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '____________';

/**
 * Substitute {tokens}. A token with no value renders as a blank rule, so the
 * printed agreement has a line to fill in by hand rather than an empty gap or
 * a stray `{guarantorCnic}`.
 */
const render = (text, tokens) =>
  String(text || '').replace(/\{(\w+)\}/g, (match, key) => {
    const value = tokens[key];
    if (value === undefined || value === null || value === '') return '____________';
    return String(value);
  });

/**
 * Compose the business address for a document.
 *
 * The city is appended only when the address does not already contain it -
 * many shops type "Mardan, Pakistan" as their full address, and blindly
 * appending the city produces "Mardan, Pakistan, Mardan" on a legal document.
 */
const composeAddress = (business) => {
  const address = (business.address || '').trim();
  const city = (business.city || '').trim();

  if (!city) return address;
  if (!address) return city;
  if (address.toLowerCase().includes(city.toLowerCase())) return address;

  return `${address}, ${city}`;
};

/** Tokens every document shares. */
const businessTokens = (business) => ({
  businessName: business.name,
  businessOwner: business.owner,
  businessPhone: business.phone,
  businessAddress: composeAddress(business),
  businessNtn: business.ntn,
  todayDate: formatDate(new Date()),
  date: formatDate(new Date()),
});

/**
 * Apply the token map across a whole template and return the parts an
 * Agreement document stores.
 */
const renderTemplate = (template, tokens) => ({
  title: render(template.title, tokens),
  introText: render(template.introText, tokens),
  clauses: template.activeClauses().map((c) => ({
    title: render(c.title, tokens),
    body: render(c.body, tokens),
  })),
  customText: render(template.customText, tokens),
  footerText: render(template.footerText, tokens),
});

// ============================================================================
// Installment agreement
// ============================================================================

/**
 * Issue the installment agreement for a sale.
 *
 * Called automatically after an installment sale when
 * `Settings.installment.autoGenerateAgreement` is on, and manually from the
 * Sales screen otherwise.
 *
 * @param {string} saleId
 * @param {object} user
 * @returns {Promise<import('mongoose').Document>}
 */
export const createInstallmentAgreement = async (saleId, user) => {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new NotFoundError('Sale');
  if (sale.saleType !== 'installment') {
    throw new BadRequestError('Only installment sales require an installment agreement.');
  }

  // One agreement per sale - return the existing one rather than duplicating
  const existing = await Agreement.findOne({
    sale: sale._id,
    type: DOCUMENT_TYPES.INSTALLMENT_AGREEMENT,
    status: { $ne: 'cancelled' },
  });
  if (existing) return existing;

  const [customer, business, template] = await Promise.all([
    Customer.findById(sale.customer),
    BusinessProfile.getSingleton(),
    getTemplate(DOCUMENT_TYPES.INSTALLMENT_AGREEMENT),
  ]);
  if (!customer) throw new NotFoundError('Customer');

  const firstDue = sale.installments?.[0]?.dueDate || addMonthsClamped(sale.saleDate, 1);
  const lastDue =
    sale.installments?.[sale.installments.length - 1]?.dueDate ||
    addMonthsClamped(sale.saleDate, sale.installmentPlan || 6);

  const productDetails = sale.items
    .map((i) => {
      const identifiers = [i.imei1, i.serialNumber].filter(Boolean).join(' / ');
      return `${i.quantity} x ${i.productName}${identifiers ? ` (${identifiers})` : ''}`;
    })
    .join('; ');

  const tokens = {
    ...businessTokens(business),
    customerName: customer.name,
    customerCnic: customer.cnic,
    customerPhone: customer.mobile1,
    customerAddress: customer.address,
    guarantorName: customer.guarantorName,
    guarantorCnic: customer.guarantorCnic,
    guarantorPhone: customer.guarantorPhone,
    invoiceNumber: sale.invoiceNumber,
    productDetails,
    totalPrice: formatPKR(sale.grandTotal),
    advanceAmount: formatPKR(sale.advance),
    financedAmount: formatPKR(sale.remainingBalance + (sale.installments || []).reduce((s, i) => s + parseNumber(i.paid), 0)),
    planMonths: sale.installmentPlan,
    monthlyInstallment: formatPKR(sale.monthlyInstallment),
    firstDueDate: formatDate(firstDue),
    lastDueDate: formatDate(lastDue),
  };

  const agreementNumber = await generateAgreementNumber('INS');
  tokens.agreementNumber = agreementNumber;

  return Agreement.create({
    agreementNumber,
    type: DOCUMENT_TYPES.INSTALLMENT_AGREEMENT,
    partyModel: 'Customer',
    party: customer._id,
    partyName: customer.name,
    partyCnic: customer.cnic,
    partyPhone: customer.mobile1,
    partyAddress: customer.address,
    sale: sale._id,

    principalAmount: sale.grandTotal,
    advanceAmount: sale.advance,
    payableAmount: sale.remainingBalance,
    installmentPlan: sale.installmentPlan,
    monthlyInstallment: sale.monthlyInstallment,
    firstDueDate: firstDue,

    agreementDate: sale.saleDate,
    effectiveFrom: sale.saleDate,
    effectiveTo: lastDue,

    ...renderTemplate(template, tokens),

    guarantorName: customer.guarantorName,
    guarantorCnic: customer.guarantorCnic,
    guarantorPhone: customer.guarantorPhone,
    guarantorAddress: customer.guarantorAddress,

    status: 'issued',
    createdBy: user?.id || null,
  });
};

// ============================================================================
// Investor agreement
// ============================================================================

/**
 * Issue an investment agreement for an investor (optionally tied to one
 * specific investment record).
 */
export const createInvestorAgreement = async (investorId, user, { investmentId = null, overrides = {} } = {}) => {
  const [investor, business, template, settings] = await Promise.all([
    Investor.findById(investorId),
    BusinessProfile.getSingleton(),
    getTemplate(DOCUMENT_TYPES.INVESTOR_AGREEMENT),
    Settings.getSingleton(),
  ]);
  if (!investor) throw new NotFoundError('Investor');

  const methodLabels = {
    fixed_percent: 'fixed percentage of capital',
    profit_sharing: 'share of business profit',
    monthly_fixed: 'fixed monthly amount',
  };

  const amount = overrides.investmentAmount ?? investor.totalInvestment;
  const percentage = overrides.profitPercentage ?? investor.profitPercentage;
  const method = overrides.profitCalculationMethod ?? investor.profitCalculationMethod;

  const tokens = {
    ...businessTokens(business),
    investorName: investor.name,
    investorCnic: investor.cnic,
    investorPhone: investor.phone,
    investorAddress: investor.address,
    investmentAmount: formatPKR(amount),
    profitPercentage: percentage,
    profitMethod: methodLabels[method] || method,
    investmentDate: formatDate(overrides.investmentDate || investor.investmentDate || new Date()),
    payoutFrequency: (settings.investor.payoutFrequency || 'monthly').replace(/_/g, '-'),
  };

  const agreementNumber = await generateAgreementNumber('INV');
  tokens.agreementNumber = agreementNumber;

  return Agreement.create({
    agreementNumber,
    type: DOCUMENT_TYPES.INVESTOR_AGREEMENT,
    partyModel: 'Investor',
    party: investor._id,
    partyName: investor.name,
    partyCnic: investor.cnic,
    partyPhone: investor.phone,
    partyAddress: investor.address,
    investment: investmentId,

    principalAmount: amount,
    profitPercentage: percentage,
    profitCalculationMethod: method,

    agreementDate: overrides.agreementDate || new Date(),
    effectiveFrom: overrides.investmentDate || investor.investmentDate || new Date(),

    ...renderTemplate(template, tokens),

    witnesses: overrides.witnesses || investor.witnesses || [],
    status: 'issued',
    notes: overrides.notes || '',
    createdBy: user?.id || null,
  });
};

// ============================================================================
// Partnership agreement
// ============================================================================

/** Issue a partnership agreement for a partner. */
export const createPartnerAgreement = async (partnerId, user, { overrides = {} } = {}) => {
  const [partner, business, template] = await Promise.all([
    Partner.findById(partnerId),
    BusinessProfile.getSingleton(),
    getTemplate(DOCUMENT_TYPES.PARTNER_AGREEMENT),
  ]);
  if (!partner) throw new NotFoundError('Partner');

  const tokens = {
    ...businessTokens(business),
    partnerName: partner.name,
    partnerCnic: partner.cnic,
    partnerPhone: partner.phone,
    partnerAddress: partner.address,
    ownershipPercent: partner.ownershipPercent,
    capitalInvested: formatPKR(partner.capitalInvested),
    agreementDate: formatDate(overrides.agreementDate || partner.agreementDate || new Date()),
  };

  const agreementNumber = await generateAgreementNumber('PTR');
  tokens.agreementNumber = agreementNumber;

  return Agreement.create({
    agreementNumber,
    type: DOCUMENT_TYPES.PARTNER_AGREEMENT,
    partyModel: 'Partner',
    party: partner._id,
    partyName: partner.name,
    partyCnic: partner.cnic,
    partyPhone: partner.phone,
    partyAddress: partner.address,

    principalAmount: partner.capitalInvested,
    ownershipPercentage: partner.ownershipPercent,

    agreementDate: overrides.agreementDate || new Date(),
    effectiveFrom: overrides.agreementDate || partner.agreementDate || new Date(),

    ...renderTemplate(template, tokens),

    witnesses: overrides.witnesses || [],
    status: 'issued',
    notes: overrides.notes || '',
    createdBy: user?.id || null,
  });
};

/**
 * Re-render an existing agreement against the CURRENT template.
 *
 * Deliberately explicit, never automatic: an admin must choose to reissue,
 * because doing so replaces the wording that was previously agreed. Only
 * permitted while the agreement is still a draft or merely issued - once it is
 * signed, the text is final.
 */
export const regenerateAgreement = async (agreementId, user) => {
  const agreement = await Agreement.findById(agreementId);
  if (!agreement) throw new NotFoundError('Agreement');

  if (['signed', 'active', 'completed'].includes(agreement.status)) {
    throw new BadRequestError(
      'A signed agreement cannot be regenerated. Cancel it and issue a new one instead.'
    );
  }

  const [business, template] = await Promise.all([
    BusinessProfile.getSingleton(),
    getTemplate(agreement.type),
  ]);

  const tokens = {
    ...businessTokens(business),
    agreementNumber: agreement.agreementNumber,
    customerName: agreement.partyName,
    customerCnic: agreement.partyCnic,
    customerPhone: agreement.partyPhone,
    customerAddress: agreement.partyAddress,
    investorName: agreement.partyName,
    investorCnic: agreement.partyCnic,
    partnerName: agreement.partyName,
    partnerCnic: agreement.partyCnic,
    guarantorName: agreement.guarantorName,
    guarantorCnic: agreement.guarantorCnic,
    guarantorPhone: agreement.guarantorPhone,
    totalPrice: formatPKR(agreement.principalAmount),
    advanceAmount: formatPKR(agreement.advanceAmount),
    financedAmount: formatPKR(agreement.payableAmount),
    planMonths: agreement.installmentPlan,
    monthlyInstallment: formatPKR(agreement.monthlyInstallment),
    firstDueDate: formatDate(agreement.firstDueDate),
    investmentAmount: formatPKR(agreement.principalAmount),
    profitPercentage: agreement.profitPercentage,
    ownershipPercent: agreement.ownershipPercentage,
    capitalInvested: formatPKR(agreement.principalAmount),
    agreementDate: formatDate(agreement.agreementDate),
  };

  Object.assign(agreement, renderTemplate(template, tokens), { updatedBy: user?.id || null });
  await agreement.save();
  return agreement;
};
