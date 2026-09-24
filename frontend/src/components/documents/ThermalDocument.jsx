/**
 * ============================================
 * ThermalDocument
 * ============================================
 * An invoice or receipt laid out for a thermal roll printer - 80 mm or 58 mm
 * paper, one narrow column, black on white.
 *
 * Why its own layout
 * ------------------
 * The A4 invoice has a black header band, a six-column item table and a
 * signature row. Shrunk to 72 mm of printable width it becomes 4pt text and a
 * solid black block that burns through thermal paper. A roll receipt is read
 * top to bottom, in one column, so that is how this is built: shop, document,
 * customer, one block per item, totals, then the instalment plan or the
 * payment's effect on the balance.
 *
 * Thermal heads print dots, not greys, so everything is pure black on white
 * and the separators are dashed rules - the look customers recognise from any
 * shop counter.
 */

import { forwardRef } from 'react';
import { APP_LOGO_MARK } from '../../constants/index.js';
import { formatCurrency, formatDate, resolveFileUrl, cn, parseNumber } from '../../utils/index.js';
import { paymentMethodLabel } from '../../constants/index.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import UrduLine from './UrduLine.jsx';

const Rule = () => <div className="my-1.5 border-t border-dashed border-black" aria-hidden="true" />;

const Row = ({ label, value, bold, big }) => (
  <div className={cn('flex justify-between gap-2', bold && 'font-bold', big && 'text-[1.15em]')}>
    <span className="min-w-0">{label}</span>
    <span className="tabular text-right whitespace-nowrap">{value}</span>
  </div>
);

/**
 * @param {object} props
 * @param {'invoice'|'receipt'} props.kind
 * @param {object} [props.sale]
 * @param {object} [props.payment]
 * @param {object} props.business
 * @param {object} props.paper   Entry of PAPER_SIZES (thermal80 / thermal58).
 */
const ThermalDocument = forwardRef(function ThermalDocument({ kind, sale, payment, business, paper }, ref) {
  const print = useSettingsStore((state) => state.settings?.print) || {};
  const narrow = paper?.id === 'thermal58';
  const logo = business?.logo ? resolveFileUrl(business.logo) : APP_LOGO_MARK;
  const record = kind === 'invoice' ? sale : payment;
  if (!record) return null;

  const footer = print.footerNote || (kind === 'invoice' ? business?.invoiceFooter : business?.receiptFooter) || 'Thank you!';

  return (
    <div
      ref={ref}
      className={cn(
        'thermal-sheet bg-white text-black mx-auto px-2 py-3 font-mono leading-snug',
        narrow ? 'text-[10px] w-[48mm]' : 'text-[11.5px] w-[72mm]'
      )}
    >
      {/* ---- Shop ---- */}
      <div className="text-center">
        {print.showLogo !== false && (
          <img src={logo} alt="" className={cn('mx-auto mb-1 rounded-full object-cover grayscale', narrow ? 'w-10 h-10' : 'w-12 h-12')} />
        )}
        <p className="font-bold text-[1.25em] tracking-wide uppercase">{business?.name || 'ADEENA TRADERS'}</p>
        {business?.address && <p>{business.address}</p>}
        {(business?.phone || business?.alternatePhone) && (
          <p>{[business?.phone, business?.alternatePhone].filter(Boolean).join(' / ')}</p>
        )}
      </div>

      <Rule />

      <p className="text-center font-bold uppercase tracking-widest">
        {kind === 'invoice' ? (sale.saleType === 'installment' ? 'Installment Invoice' : 'Cash Invoice') : 'Payment Receipt'}
      </p>
      <Row
        label={kind === 'invoice' ? 'Invoice' : 'Receipt'}
        value={kind === 'invoice' ? sale.invoiceNumber : payment.receiptNumber}
      />
      <Row label="Date" value={formatDate(kind === 'invoice' ? sale.saleDate : payment.paymentDate)} />
      <Row label="Customer" value={record.customerName || '—'} />
      {record.customerPhone && <Row label="Phone" value={record.customerPhone} />}

      <Rule />

      {kind === 'invoice' ? (
        <>
          {/* ---- Items: name on its own line, then qty x rate = amount ---- */}
          {(sale.items || []).map((item, index) => {
            const total = parseNumber(item.total) || parseNumber(item.price) * parseNumber(item.quantity) - parseNumber(item.discount);
            return (
              <div key={index} className="mb-1">
                <p className="font-semibold break-words">{item.productName}</p>
                {(item.imei1 || item.serialNumber) && (
                  <p className="text-[0.9em]">{item.imei1 ? `IMEI ${item.imei1}` : `S/N ${item.serialNumber}`}</p>
                )}
                <Row
                  label={`${item.quantity} x ${formatCurrency(item.price)}${parseNumber(item.discount) ? ` - ${formatCurrency(item.discount)}` : ''}`}
                  value={formatCurrency(total)}
                />
              </div>
            );
          })}

          <Rule />
          <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
          {parseNumber(sale.discount) > 0 && <Row label="Discount" value={`- ${formatCurrency(sale.discount)}`} />}
          <Row label="TOTAL" value={formatCurrency(sale.grandTotal)} bold big />

          {sale.saleType === 'installment' ? (
            <>
              <Row label="Advance paid" value={formatCurrency(sale.advance)} />
              <Row label="Balance" value={formatCurrency(sale.remainingBalance)} bold />
              <Rule />
              <p className="text-center font-bold">INSTALMENT PLAN</p>
              <Row label="Plan" value={`${sale.installmentPlan} months`} />
              <Row label="Monthly" value={formatCurrency(sale.monthlyInstallment)} bold />
              {sale.installments?.[0]?.dueDate && <Row label="First due" value={formatDate(sale.installments[0].dueDate)} />}
              {!narrow && (sale.installments || []).length > 0 && (
                <div className="mt-1">
                  {sale.installments.map((inst) => (
                    <Row key={inst.number} label={`#${inst.number} ${formatDate(inst.dueDate)}`} value={formatCurrency(inst.expected ?? inst.amount)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Row label={`Paid (${paymentMethodLabel(sale.paymentMethod)})`} value={formatCurrency(Math.max(sale.amountReceived || 0, sale.grandTotal))} />
              {parseNumber(sale.amountReceived) > parseNumber(sale.grandTotal) && (
                <Row label="Change" value={formatCurrency(sale.amountReceived - sale.grandTotal)} />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <Row label="AMOUNT RECEIVED" value={formatCurrency(payment.paymentAmount)} bold big />
          <Row label="Method" value={paymentMethodLabel(payment.paymentMethod)} />
          {payment.referenceNumber && <Row label="Reference" value={payment.referenceNumber} />}
          {(payment.allocations || []).filter((a) => a.installmentNumber > 0).length > 0 && (
            <>
              <Rule />
              <p className="font-semibold">Applied to</p>
              {payment.allocations
                .filter((a) => a.installmentNumber > 0)
                .map((a, index) => (
                  <Row key={index} label={`Instalment #${a.installmentNumber}`} value={formatCurrency(a.allocatedAmount)} />
                ))}
            </>
          )}
          <Rule />
          <Row label="Previous balance" value={formatCurrency(payment.previousBalance)} />
          <Row label="Balance now" value={formatCurrency(payment.remainingBalance)} bold />
          {payment.nextDueDate && <Row label="Next due" value={formatDate(payment.nextDueDate)} />}
        </>
      )}

      <Rule />
      <p className="text-center font-semibold">{footer}</p>
      <UrduLine english={footer} className="text-center text-[1.05em]" />
      <p className="text-center text-[0.85em] mt-1">Printed {formatDate(new Date(), { hour: '2-digit', minute: '2-digit' })}</p>
      {/* Blank feed so the cutter does not slice through the last line. */}
      <div className="h-6" aria-hidden="true" />
    </div>
  );
});

export default ThermalDocument;
