/**
 * ============================================
 * Document Shell
 * ============================================
 * The shared chrome for every printed document: letterhead, party blocks,
 * totals, signatures and footer.
 *
 * One printed layout, two uses
 * ----------------------------
 * The same markup is what the user sees on screen inside the preview dialog and
 * what the printer receives. The print stylesheet in index.css hides everything
 * outside `.print-area`, so "Print" and "Save as PDF" both produce exactly the
 * document that was previewed - no second rendering path to drift out of sync.
 *
 * Sized to A4 at 210mm, with a fluid fallback so the preview is still readable
 * on a phone.
 */

import { cn, formatCurrency, formatDate, resolveFileUrl } from '../../utils/index.js';

/**
 * Letterhead: logo, business identity, registration numbers and the document's
 * own title and reference.
 */
export function DocumentHeader({ business, title, subtitle, reference, referenceLabel = 'No.', date, dateLabel = 'Date', accentColor = '#0b192c' }) {
  const logo = business?.logo ? resolveFileUrl(business.logo) : null;

  return (
    <header className="avoid-break">
      <div className="flex items-start justify-between gap-4 pb-3">
        {/* Business identity */}
        <div className="flex items-start gap-3 min-w-0">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="w-14 h-14 object-contain flex-shrink-0 rounded"
            />
          ) : (
            <span
              className="flex items-center justify-center w-14 h-14 rounded font-display font-bold text-xl text-white flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(business?.name || 'AT').slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <h1 className="font-display font-bold text-base sm:text-lg leading-tight" style={{ color: accentColor }}>
              {business?.name || 'ADEENA TRADERS'}
            </h1>
            {business?.tagline && (
              <p className="text-2xs text-navy-500 leading-snug">{business.tagline}</p>
            )}

            <div className="mt-1 text-2xs text-navy-600 leading-relaxed">
              {business?.address && <span className="block">{business.address}</span>}
              <span className="block">
                {[business?.phone, business?.alternatePhone].filter(Boolean).join(' · ')}
              </span>
              {business?.email && <span className="block">{business.email}</span>}
              {(business?.ntn || business?.strn) && (
                <span className="block">
                  {business.ntn && `NTN: ${business.ntn}`}
                  {business.ntn && business.strn && '  ·  '}
                  {business.strn && `STRN: ${business.strn}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Document identity */}
        <div className="text-right flex-shrink-0">
          <h2 className="doc-title" style={{ color: accentColor }}>{title}</h2>
          {subtitle && <p className="text-2xs text-navy-500 italic">{subtitle}</p>}

          <table className="ml-auto mt-2 text-2xs">
            <tbody>
              {reference && (
                <tr>
                  <td className="pr-2 text-navy-500 text-left">{referenceLabel}</td>
                  <td className="font-semibold text-navy-950 text-right tabular">{reference}</td>
                </tr>
              )}
              {date && (
                <tr>
                  <td className="pr-2 text-navy-500 text-left">{dateLabel}</td>
                  <td className="font-medium text-navy-900 text-right">{formatDate(date)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-[3px] rounded-full" style={{ backgroundColor: accentColor }} />
    </header>
  );
}

/**
 * A bordered block describing one party (customer, guarantor, investor).
 * `fields` is a list of { label, value } so callers control what appears.
 */
export function PartyBlock({ heading, name, fields = [], className }) {
  return (
    <div className={cn('rounded border border-navy-200 p-2.5 min-w-0', className)}>
      <p className="doc-label mb-1">{heading}</p>
      {name && <p className="text-sm font-semibold text-navy-950 leading-tight">{name}</p>}

      <dl className="mt-1 space-y-0.5">
        {fields.filter((f) => f.value).map((field) => (
          <div key={field.label} className="flex gap-1.5 text-2xs leading-snug">
            <dt className="text-navy-500 flex-shrink-0">{field.label}:</dt>
            <dd className="text-navy-900 font-medium break-words min-w-0">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The totals block: a list of rows with one emphasised grand total.
 * `rows` is [{ label, value, bold?, negative?, muted? }].
 */
export function TotalsBlock({ rows = [], grandTotal, grandTotalLabel = 'Grand Total', accentColor = '#0b192c', className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn(row.muted && 'text-navy-500')}>
              <td className="py-1 pr-4 text-left">{row.label}</td>
              <td
                className={cn(
                  'py-1 text-right tabular whitespace-nowrap',
                  row.bold && 'font-semibold',
                  row.negative && 'text-danger-600'
                )}
              >
                {row.negative ? '-' : ''}
                {typeof row.value === 'number' ? formatCurrency(row.value) : row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {grandTotal !== undefined && (
        <div
          className="flex items-center justify-between gap-4 mt-1.5 px-2.5 py-2 rounded text-white"
          style={{ backgroundColor: accentColor }}
        >
          <span className="text-2xs font-semibold uppercase tracking-wider">{grandTotalLabel}</span>
          <span className="text-sm font-display font-bold tabular whitespace-nowrap">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Signature lines.
 *
 * `break-inside: avoid` on `.doc-signature` keeps a signature block from being
 * split across two printed pages, which would leave someone signing a page with
 * no terms on it.
 */
export function SignatureBlock({ signatures = [], stamp, className }) {
  if (signatures.length === 0) return null;

  const columns = Math.min(signatures.length, 3);
  const columnClass = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[columns];

  return (
    <div className={cn('relative grid gap-6 mt-8', columnClass, className)}>
      {/* Company stamp, offset so it overlaps the last signature as a real
          rubber stamp would */}
      {stamp && (
        <img
          src={resolveFileUrl(stamp)}
          alt=""
          className="absolute right-0 -top-6 w-20 h-20 object-contain opacity-70 pointer-events-none"
        />
      )}

      {signatures.map((signature) => (
        <div key={signature.label} className="doc-signature">
          <p className="font-semibold text-navy-900">{signature.label}</p>
          {signature.caption && (
            <p className="text-navy-500 mt-0.5 leading-snug">{signature.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Terms, footer text and the computer-generated note. */
export function DocumentFooter({ terms, footerText, legalNote, className }) {
  return (
    <footer className={cn('mt-6 pt-3 border-t border-navy-200 avoid-break', className)}>
      {terms && (
        <div className="mb-3">
          <p className="doc-label mb-1">Terms &amp; Conditions</p>
          <div className="text-2xs text-navy-600 leading-relaxed whitespace-pre-line">{terms}</div>
        </div>
      )}

      {footerText && (
        <p className="text-xs text-center font-medium text-navy-800">{footerText}</p>
      )}

      {legalNote && (
        <p className="mt-2 text-2xs text-center text-navy-400 leading-snug">{legalNote}</p>
      )}
    </footer>
  );
}

/**
 * The A4 sheet every document is rendered inside.
 * `watermark` prints diagonally behind the content - used for drafts and
 * cancelled documents, so a superseded copy cannot be mistaken for a live one.
 */
export function DocumentSheet({ children, watermark, className }) {
  return (
    <article className={cn('doc-sheet relative p-5 sm:p-7', className)}>
      {watermark && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <span className="font-display font-black text-[72px] sm:text-[110px] text-navy-950/[0.06] rotate-[-28deg] tracking-widest whitespace-nowrap">
            {watermark}
          </span>
        </span>
      )}

      <div className="relative">{children}</div>
    </article>
  );
}
