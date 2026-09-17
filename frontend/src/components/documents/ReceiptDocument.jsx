/**
 * ============================================
 * Receipt Document
 * ============================================
 * The printable payment receipt.
 *
 * Sized for A5 rather than A4: a receipt is handed over the counter, and a full
 * A4 sheet for one line of information wastes paper. It still prints cleanly on
 * A4 - the browser simply leaves more margin.
 *
 * The allocation table matters: a customer paying Rs. 20,000 against three
 * overdue installments needs to see exactly which ones it cleared, or the next
 * conversation starts with an argument.
 */

import { forwardRef } from 'react';
import { DocumentSheet, DocumentHeader, SignatureBlock, DocumentFooter } from './DocumentShell.jsx';
import { formatCurrency, formatDate, formatDateTime, cn } from '../../utils/index.js';

const ReceiptDocument = forwardRef(function ReceiptDocument(
  { payment, business, template, className },
  ref
) {
  if (!payment) return null;

  const accent = template?.accentColor || '#0b192c';
  const isReversed = payment.status === 'reversed';

  // installmentNumber 0 marks the advance taken at the time of sale
  const allocations = payment.allocations || [];

  return (
    <div ref={ref} className={cn('bg-white', className)}>
      <DocumentSheet
        watermark={isReversed ? 'REVERSED' : null}
        className="max-w-[148mm]"
      >
        <DocumentHeader
          business={business}
          title={template?.title || 'PAYMENT RECEIPT'}
          reference={payment.receiptNumber}
          referenceLabel="Receipt No."
          date={payment.paymentDate}
          accentColor={accent}
        />

        {/* ---- Received from ---- */}
        <section className="mt-4 rounded border border-navy-200 p-3">
          <p className="doc-label mb-1">Received With Thanks From</p>
          <p className="text-base font-display font-semibold text-navy-950">
            {payment.customerName}
          </p>

          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-2xs">
            {[
              { label: 'Mobile', value: payment.customerPhone || payment.customer?.mobile1 },
              { label: 'CNIC', value: payment.customer?.cnic },
              { label: 'Method', value: payment.paymentMethod },
              { label: 'Reference', value: payment.referenceNumber },
            ]
              .filter((f) => f.value)
              .map((field) => (
                <div key={field.label} className="flex gap-1.5">
                  <span className="text-navy-500 flex-shrink-0">{field.label}:</span>
                  <span className="text-navy-900 font-medium capitalize truncate">{field.value}</span>
                </div>
              ))}
          </div>
        </section>

        {/* ---- Amount ---- */}
        <section className="mt-4">
          <div
            className="flex items-center justify-between gap-4 px-4 py-3.5 rounded text-white"
            style={{ backgroundColor: accent }}
          >
            <span className="text-2xs font-semibold uppercase tracking-widest">Amount Received</span>
            <span className="text-2xl font-display font-bold tabular">
              {formatCurrency(payment.paymentAmount)}
            </span>
          </div>

          {/* Amount in words: still expected on a hand-over receipt in Pakistan */}
          <p className="mt-1.5 text-2xs text-navy-600 italic text-center">
            Rupees {numberToWords(payment.paymentAmount)} only
          </p>
        </section>

        {/* ---- Allocation ---- */}
        {allocations.length > 0 && (
          <section className="mt-4 avoid-break">
            <p className="doc-label mb-1.5">Applied To</p>

            <table className="doc-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th className="text-center">Installment</th>
                  <th className="text-right">Applied</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation, index) => (
                  <tr key={index}>
                    <td className="tabular">
                      {allocation.sale?.invoiceNumber || '—'}
                    </td>
                    <td className="text-center tabular">
                      {allocation.installmentNumber === 0
                        ? 'Advance'
                        : `#${allocation.installmentNumber}`}
                    </td>
                    <td className="text-right tabular font-medium">
                      {formatCurrency(allocation.allocatedAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ---- Balance ---- */}
        <section className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Previous Balance', value: payment.previousBalance, tone: 'text-navy-700' },
            { label: 'This Payment', value: payment.paymentAmount, tone: 'text-success-700' },
            { label: 'Balance Now', value: payment.remainingBalance, tone: 'text-danger-600' },
          ].map((item) => (
            <div key={item.label} className="rounded border border-navy-200 py-2 px-1.5">
              <span className="block text-2xs text-navy-500 leading-tight">{item.label}</span>
              <span className={cn('block text-sm font-semibold tabular mt-0.5', item.tone)}>
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </section>

        {payment.nextDueDate && payment.remainingBalance > 0 && (
          <p className="mt-2.5 text-center text-2xs text-navy-600">
            Next installment due on{' '}
            <strong className="text-navy-950">{formatDate(payment.nextDueDate)}</strong>
          </p>
        )}

        {payment.notes && (
          <p className="mt-2 text-2xs text-navy-600 whitespace-pre-line">{payment.notes}</p>
        )}

        <SignatureBlock
          stamp={business?.stamp}
          signatures={[
            { label: 'Received By', caption: payment.createdBy?.name || business?.name },
          ]}
        />

        <DocumentFooter
          footerText={template?.footerText || business?.receiptFooter}
          legalNote={`Issued ${formatDateTime(payment.createdAt || payment.paymentDate)}`}
        />
      </DocumentSheet>
    </div>
  );
});

export default ReceiptDocument;

/**
 * Spell a rupee amount in the Indian/Pakistani numbering system
 * (crore, lakh, thousand) - not the Western short scale.
 *
 * Handwritten receipts here always carry the amount in words as a guard
 * against a digit being altered afterwards, and a printed receipt is expected
 * to do the same.
 */
function numberToWords(amount) {
  const value = Math.round(Number(amount) || 0);
  if (value === 0) return 'Zero';
  if (value < 0) return `Minus ${numberToWords(-value)}`;

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  /** Handles 0-99. */
  const underHundred = (n) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
  };

  /** Handles 0-999. */
  const underThousand = (n) => {
    if (n < 100) return underHundred(n);
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${underHundred(n % 100)}` : ''}`;
  };

  const parts = [];
  let remaining = value;

  const crore = Math.floor(remaining / 10_000_000);
  if (crore > 0) {
    parts.push(`${underThousand(crore)} Crore`);
    remaining %= 10_000_000;
  }

  const lakh = Math.floor(remaining / 100_000);
  if (lakh > 0) {
    parts.push(`${underThousand(lakh)} Lakh`);
    remaining %= 100_000;
  }

  const thousand = Math.floor(remaining / 1_000);
  if (thousand > 0) {
    parts.push(`${underThousand(thousand)} Thousand`);
    remaining %= 1_000;
  }

  if (remaining > 0) parts.push(underThousand(remaining));

  return parts.join(' ');
}

export { numberToWords };
