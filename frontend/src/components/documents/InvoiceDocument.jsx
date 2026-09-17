/**
 * ============================================
 * Invoice Document
 * ============================================
 * The printable sales invoice.
 *
 * For an installment sale it also prints the full payment schedule, with each
 * row's status and a blank "Received / Signature" column the shop can tick off
 * by hand. The customer's copy then doubles as their payment card, which is how
 * these shops actually work.
 */

import { forwardRef } from 'react';
import {
  DocumentSheet, DocumentHeader, PartyBlock, TotalsBlock,
  SignatureBlock, DocumentFooter,
} from './DocumentShell.jsx';
import { formatCurrency, formatDate, cn } from '../../utils/index.js';
import { INSTALLMENT_STATUSES } from '../../constants/index.js';

/**
 * @param {object} props
 * @param {object} props.sale
 * @param {object} props.business
 * @param {object} [props.template] Wording from Settings > Documents.
 */
const InvoiceDocument = forwardRef(function InvoiceDocument(
  { sale, business, template, className },
  ref
) {
  if (!sale) return null;

  const isInstallment = sale.saleType === 'installment';
  const accent = template?.accentColor || '#0b192c';

  const isCancelled = sale.status === 'cancelled';
  const isReturned = sale.status === 'returned';

  return (
    <div ref={ref} className={cn('bg-white', className)}>
      <DocumentSheet watermark={isCancelled ? 'CANCELLED' : isReturned ? 'RETURNED' : null}>
        <DocumentHeader
          business={business}
          title={template?.title || 'SALES INVOICE'}
          subtitle={isInstallment ? `Installment Sale — ${sale.installmentPlan} Months` : 'Cash Sale'}
          reference={sale.invoiceNumber}
          referenceLabel="Invoice No."
          date={sale.saleDate}
          accentColor={accent}
        />

        {/* ---- Parties ---- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <PartyBlock
            heading="Billed To"
            name={sale.customerName}
            fields={[
              { label: 'CNIC', value: sale.customerCnic || sale.customer?.cnic },
              { label: 'Mobile', value: sale.customerPhone || sale.customer?.mobile1 },
              { label: 'Address', value: sale.customer?.address },
            ]}
          />

          <div className="rounded border border-navy-200 p-2.5">
            <p className="doc-label mb-1">Sale Details</p>
            <dl className="space-y-0.5">
              {[
                { label: 'Type', value: isInstallment ? `Installment (${sale.installmentPlan} months)` : 'Cash' },
                { label: 'Payment', value: sale.paymentMethod },
                { label: 'Sold by', value: sale.createdBy?.name },
                { label: 'Ownership', value: sale.ownership },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <div key={field.label} className="flex gap-1.5 text-2xs leading-snug">
                    <dt className="text-navy-500 flex-shrink-0">{field.label}:</dt>
                    <dd className="text-navy-900 font-medium capitalize">{field.value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>

        {/* ---- Line items ---- */}
        <section className="mt-4">
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '45%' }}>Description</th>
                <th style={{ width: '10%' }} className="text-center">Qty</th>
                <th style={{ width: '20%' }} className="text-right">Rate</th>
                <th style={{ width: '20%' }} className="text-right">Amount</th>
              </tr>
            </thead>

            <tbody>
              {sale.items?.map((item, index) => {
                // Serial numbers belong on the invoice: they are what a warranty
                // claim is checked against months later.
                const identifiers = [
                  item.imei1 && `IMEI: ${item.imei1}`,
                  item.imei2 && `IMEI 2: ${item.imei2}`,
                  item.serialNumber && `S/N: ${item.serialNumber}`,
                  item.warranty && `Warranty: ${item.warranty}`,
                ].filter(Boolean);

                return (
                  <tr key={index}>
                    <td className="text-navy-500 tabular">{index + 1}</td>
                    <td>
                      <span className="font-medium text-navy-950">{item.productName}</span>
                      {item.product?.brand && (
                        <span className="text-navy-500"> — {item.product.brand}</span>
                      )}
                      {identifiers.length > 0 && (
                        <span className="block text-2xs text-navy-500 mt-0.5 leading-snug">
                          {identifiers.join('  ·  ')}
                        </span>
                      )}
                    </td>
                    <td className="text-center tabular">{item.quantity}</td>
                    <td className="text-right tabular">{formatCurrency(item.price)}</td>
                    <td className="text-right tabular font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ---- Totals ---- */}
        <section className="flex justify-end mt-4">
          <div className="w-full sm:w-[280px]">
            <TotalsBlock
              accentColor={accent}
              rows={[
                { label: 'Subtotal', value: sale.subtotal },
                ...(sale.discount > 0 ? [{ label: 'Discount', value: sale.discount, negative: true }] : []),
                ...(isInstallment
                  ? [
                      { label: 'Advance received', value: sale.advance, bold: true },
                      { label: 'Balance financed', value: sale.grandTotal - sale.advance },
                      { label: `Monthly × ${sale.installmentPlan}`, value: sale.monthlyInstallment, bold: true },
                    ]
                  : [
                      { label: 'Amount received', value: sale.amountReceived || sale.grandTotal },
                      ...(sale.change > 0 ? [{ label: 'Change returned', value: sale.change }] : []),
                    ]),
              ]}
              grandTotal={sale.grandTotal}
              grandTotalLabel={isInstallment ? 'Total Price' : 'Total Paid'}
            />
          </div>
        </section>

        {/* ---- Installment schedule ---- */}
        {isInstallment && sale.installments?.length > 0 && (
          <section className="mt-5 avoid-break">
            <p className="doc-label mb-1.5">
              Payment Schedule — {sale.installmentPlan} monthly installments of{' '}
              {formatCurrency(sale.monthlyInstallment)}
            </p>

            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: '8%' }} className="text-center">#</th>
                  <th style={{ width: '22%' }}>Due Date</th>
                  <th style={{ width: '20%' }} className="text-right">Amount</th>
                  <th style={{ width: '18%' }} className="text-right">Paid</th>
                  <th style={{ width: '14%' }} className="text-center">Status</th>
                  {/* Left blank on purpose - the shop signs this column by hand */}
                  <th style={{ width: '18%' }} className="text-center">Received</th>
                </tr>
              </thead>

              <tbody>
                {sale.installments.map((installment) => (
                  <tr key={installment.number}>
                    <td className="text-center tabular font-medium">{installment.number}</td>
                    <td className="tabular">{formatDate(installment.dueDate)}</td>
                    <td className="text-right tabular">{formatCurrency(installment.expected)}</td>
                    <td className="text-right tabular">
                      {installment.paid > 0 ? formatCurrency(installment.paid) : '—'}
                    </td>
                    <td className="text-center text-2xs">
                      {INSTALLMENT_STATUSES[installment.status]?.label || installment.status}
                    </td>
                    <td className="border-b border-navy-300" />
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className="text-right pr-2">Total</td>
                  <td className="text-right tabular">
                    {formatCurrency(sale.grandTotal - sale.advance)}
                  </td>
                  <td className="text-right tabular">
                    {formatCurrency(sale.grandTotal - sale.advance - sale.remainingBalance)}
                  </td>
                  <td colSpan={2} className="text-right pr-2 text-danger-600">
                    Balance {formatCurrency(sale.remainingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {/* ---- Bank details, when transfers are accepted ---- */}
        {business?.bankAccountNumber && (
          <section className="mt-4 rounded border border-navy-200 p-2.5 avoid-break">
            <p className="doc-label mb-1">Bank Transfer Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
              {[
                { label: 'Bank', value: business.bankName },
                { label: 'Title', value: business.bankAccountTitle },
                { label: 'Account', value: business.bankAccountNumber },
                { label: 'IBAN', value: business.bankIban },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <div key={field.label}>
                    <span className="block text-navy-500">{field.label}</span>
                    <span className="block font-medium text-navy-900 break-all">{field.value}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {sale.notes && (
          <section className="mt-3">
            <p className="doc-label mb-0.5">Notes</p>
            <p className="text-2xs text-navy-700 whitespace-pre-line">{sale.notes}</p>
          </section>
        )}

        {/* ---- Signatures ---- */}
        <SignatureBlock
          stamp={business?.stamp}
          signatures={
            template?.signatures?.length
              ? template.signatures.map((s) => ({
                  label: s.label,
                  caption: s.caption?.replace('{businessName}', business?.name || ''),
                }))
              : [
                  { label: 'Customer Signature', caption: sale.customerName },
                  { label: 'For ' + (business?.name || 'the Seller'), caption: 'Authorised Signatory' },
                ]
          }
        />

        <DocumentFooter
          terms={
            template?.clauses?.length
              ? template.clauses
                  .filter((c) => c.isActive !== false)
                  .map((c, i) => `${i + 1}. ${c.body}`)
                  .join('\n')
              : business?.termsAndConditions
          }
          footerText={template?.footerText || business?.invoiceFooter}
          legalNote={template?.legalNote}
        />
      </DocumentSheet>
    </div>
  );
});

export default InvoiceDocument;
