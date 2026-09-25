/**
 * ============================================
 * Agreement Document
 * ============================================
 * The printable legal agreement, covering all three kinds:
 * installment sale, investment, and partnership.
 *
 * The clause text is read from the agreement record itself, not re-rendered
 * from the current template. An agreement is a legal artefact: if the admin
 * rewrites clause 6 next month, the copy the customer signed must still print
 * the words that were actually agreed.
 */

import { forwardRef } from 'react';
import {
  DocumentSheet, DocumentHeader, PartyBlock,
  SignatureBlock, DocumentFooter,
} from './DocumentShell.jsx';
import { formatCurrency, formatDate, cn } from '../../utils/index.js';
import { DOCUMENT_TYPES } from '../../constants/index.js';
import UrduLine from './UrduLine.jsx';
import { urduParagraphs, docUrdu } from '../../i18n/agreementUrdu.js';
import { useUrduEnabled } from '../../context/settingsStore.js';

/** A document label with its Urdu beside it, when Urdu is on. */
function BiLabel({ children, className }) {
  const urdu = useUrduEnabled();
  const text = docUrdu(children);
  return (
    <p className={cn('doc-label mb-1.5 flex items-baseline gap-2', className)}>
      {children}
      {urdu && text && <span dir="rtl" lang="ur" className="urdu normal-case tracking-normal text-xs font-normal text-ink-600">{text}</span>}
    </p>
  );
}

/** Commercial terms table, which differs per agreement type. */
function TermsTable({ agreement }) {
  const rows = {
    [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: [
      { label: 'Total sale price', value: formatCurrency(agreement.principalAmount) },
      { label: 'Advance paid', value: formatCurrency(agreement.advanceAmount) },
      { label: 'Balance financed', value: formatCurrency(agreement.payableAmount) },
      { label: 'Tenure', value: `${agreement.installmentPlan} months` },
      { label: 'Monthly installment', value: formatCurrency(agreement.monthlyInstallment), highlight: true },
      { label: 'First installment due', value: formatDate(agreement.firstDueDate) },
      { label: 'Final installment due', value: formatDate(agreement.effectiveTo) },
    ],
    [DOCUMENT_TYPES.INVESTOR_AGREEMENT]: [
      { label: 'Capital contributed', value: formatCurrency(agreement.principalAmount), highlight: true },
      { label: 'Profit share', value: `${agreement.profitPercentage}%` },
      {
        label: 'Calculation basis',
        value: {
          fixed_percent: 'Fixed percentage of capital',
          profit_sharing: 'Share of business profit',
          monthly_fixed: 'Fixed monthly amount',
        }[agreement.profitCalculationMethod] || agreement.profitCalculationMethod,
      },
      { label: 'Effective from', value: formatDate(agreement.effectiveFrom) },
    ],
    [DOCUMENT_TYPES.PARTNER_AGREEMENT]: [
      { label: 'Capital contributed', value: formatCurrency(agreement.principalAmount) },
      { label: 'Ownership share', value: `${agreement.ownershipPercentage}%`, highlight: true },
      { label: 'Profit share', value: `${agreement.ownershipPercentage}% of net profit` },
      { label: 'Loss share', value: 'In proportion to capital contributed' },
      { label: 'Effective from', value: formatDate(agreement.effectiveFrom) },
    ],
  }[agreement.type] || [];

  const visible = rows.filter((r) => r.value && !String(r.value).includes('Invalid'));
  if (visible.length === 0) return null;

  return (
    <section className="mt-4 avoid-break">
      <BiLabel>Commercial Terms</BiLabel>

      <table className="doc-table">
        <tbody>
          {visible.map((row) => (
            <tr key={row.label} className={cn(row.highlight && 'bg-gold-50')}>
              <td className="w-1/2 text-navy-600">
                {row.label}
                <UrduLabel label={row.label} />
              </td>
              <td
                className={cn(
                  'w-1/2 text-right tabular font-medium text-navy-950',
                  row.highlight && 'font-bold'
                )}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function UrduLabel({ label }) {
  const urdu = useUrduEnabled();
  const text = docUrdu(label);
  if (!urdu || !text) return null;
  return <span dir="rtl" lang="ur" className="urdu ml-2 inline-block whitespace-nowrap text-2xs text-ink-500">{text}</span>;
}

const AgreementDocument = forwardRef(function AgreementDocument(
  { agreement, business, className },
  ref
) {
  if (!agreement) return null;

  const accent = 'rgb(var(--ink-950))';
  const urdu = useUrduEnabled();
  const isCancelled = agreement.status === 'cancelled';
  const isDraft = agreement.status === 'draft';

  const partyHeading = {
    [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: 'The Buyer',
    [DOCUMENT_TYPES.INVESTOR_AGREEMENT]: 'The Investor',
    [DOCUMENT_TYPES.PARTNER_AGREEMENT]: 'The Second Partner',
  }[agreement.type] || 'Counterparty';

  const hasGuarantor = Boolean(agreement.guarantorName);

  return (
    <div ref={ref} className={cn('bg-white', className)}>
      <DocumentSheet watermark={isCancelled ? 'CANCELLED' : isDraft ? 'DRAFT' : null}>
        <DocumentHeader
          business={business}
          title={agreement.title || 'AGREEMENT'}
          subtitle={agreement.subtitle}
          reference={agreement.agreementNumber}
          referenceLabel="Agreement No."
          date={agreement.agreementDate}
        />

        {/* ---- Recitals ---- */}
        {agreement.introText && (
          <section className="mt-4">
            <p className="text-xs text-navy-800 leading-relaxed whitespace-pre-line text-justify">
              {agreement.introText}
            </p>
            {urdu &&
              urduParagraphs(agreement.introText).map((parts, index) => (
                <UrduLine key={index} parts={parts} className="mt-2 text-xs text-navy-800 leading-loose text-justify" />
              ))}
          </section>
        )}

        {/* ---- Parties ---- */}
        <section
          className={cn(
            'grid gap-3 mt-4',
            hasGuarantor ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
          )}
        >
          <PartyBlock
            heading="The Seller / Business"
            name={business?.name}
            fields={[
              { label: 'Proprietor', value: business?.owner },
              { label: 'CNIC', value: business?.ownerCnic },
              { label: 'Phone', value: business?.phone },
              { label: 'Address', value: business?.address },
            ]}
          />

          <PartyBlock
            heading={partyHeading}
            name={agreement.partyName}
            fields={[
              { label: 'CNIC', value: agreement.partyCnic },
              { label: 'Phone', value: agreement.partyPhone },
              { label: 'Address', value: agreement.partyAddress },
            ]}
          />

          {hasGuarantor && (
            <PartyBlock
              heading="The Guarantor"
              name={agreement.guarantorName}
              fields={[
                { label: 'CNIC', value: agreement.guarantorCnic },
                { label: 'Phone', value: agreement.guarantorPhone },
                { label: 'Address', value: agreement.guarantorAddress },
              ]}
            />
          )}
        </section>

        <TermsTable agreement={agreement} />

        {/* ---- Clauses ---- */}
        {agreement.clauses?.length > 0 && (
          <section className="mt-5">
            <BiLabel className="mb-2">Terms Agreed Between The Parties</BiLabel>

            <ol className="space-y-2.5">
              {agreement.clauses.map((clause, index) => (
                <li key={index} className="flex gap-2.5 avoid-break">
                  <span
                    className="flex items-center justify-center w-5 h-5 rounded-full text-white text-2xs font-bold flex-shrink-0 mt-px"
                    style={{ backgroundColor: accent }}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    {clause.title && (
                      <p className="text-xs font-semibold text-navy-950 leading-snug flex flex-wrap items-baseline gap-x-2">
                        {clause.title}
                        <UrduLine english={clause.title} as="span" className="text-xs font-semibold text-navy-800" />
                      </p>
                    )}
                    <p className="text-xs text-navy-700 leading-relaxed text-justify">
                      {clause.body}
                    </p>
                    {/* The same clause in Urdu, directly under the English, so
                        a reader of either language finds every term in order. */}
                    <UrduLine english={clause.body} className="text-xs text-navy-800 leading-loose text-justify mt-0.5" />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---- Admin's own wording ---- */}
        {agreement.customText && (
          <section className="mt-4 rounded border border-navy-200 bg-navy-50/60 p-3 avoid-break">
            <BiLabel className="mb-1">Additional Terms</BiLabel>
            <p className="text-xs text-navy-800 leading-relaxed whitespace-pre-line text-justify">
              {agreement.customText}
            </p>
          </section>
        )}

        {/* ---- Witnesses ---- */}
        {agreement.witnesses?.length > 0 && (
          <section className="mt-5 avoid-break">
            <BiLabel>Witnesses</BiLabel>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agreement.witnesses.map((witness, index) => (
                <div key={index} className="rounded border border-navy-200 p-2.5">
                  <p className="text-2xs text-navy-500">Witness {index + 1}</p>
                  <p className="text-xs font-semibold text-navy-950 mt-0.5">
                    {witness.name || '________________________'}
                  </p>
                  <p className="text-2xs text-navy-600 mt-0.5">
                    CNIC: {witness.cnic || '________________'}
                  </p>
                  {witness.phone && (
                    <p className="text-2xs text-navy-600">Phone: {witness.phone}</p>
                  )}
                  <div className="mt-5 pt-1 border-t border-navy-300">
                    <p className="text-2xs text-navy-400 text-center">Signature</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {agreement.notes && (
          <section className="mt-3">
            <p className="doc-label mb-0.5">Notes</p>
            <p className="text-2xs text-navy-700 whitespace-pre-line">{agreement.notes}</p>
          </section>
        )}

        <SignatureBlock
          stamp={business?.stamp}
          signatures={
            hasGuarantor
              ? [
                  { label: partyHeading, caption: `${agreement.partyName}  ·  CNIC: ${agreement.partyCnic || '____________'}` },
                  { label: 'Guarantor', caption: `${agreement.guarantorName}  ·  CNIC: ${agreement.guarantorCnic || '____________'}` },
                  { label: 'For the Business', caption: business?.name },
                ]
              : [
                  { label: partyHeading, caption: `${agreement.partyName}  ·  CNIC: ${agreement.partyCnic || '____________'}` },
                  { label: 'For the Business', caption: business?.owner || business?.name },
                ]
          }
        />

        {/* Execution record, printed once the agreement has been signed */}
        {agreement.signedAt && (
          <p className="mt-4 text-center text-2xs text-navy-500">
            Signed on {formatDate(agreement.signedAt)}
            {agreement.signedBy ? ` by ${agreement.signedBy}` : ''}
          </p>
        )}

        <DocumentFooter
          business={business}
          footerText={agreement.footerText}
          legalNote={agreement.legalNote || business?.registrationNumber
            ? `${agreement.legalNote || ''}${business?.registrationNumber ? `  Registration: ${business.registrationNumber}` : ''}`
            : undefined}
        />
      </DocumentSheet>
    </div>
  );
});

export default AgreementDocument;
