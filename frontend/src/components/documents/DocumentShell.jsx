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
import { APP_LOGO, APP_LOGO_WATERMARK } from '../../constants/index.js';

/**
 * Letterhead: logo, business identity, registration numbers and the document's
 * own title and reference.
 */
export function DocumentHeader({
  business, title, subtitle, reference, referenceLabel = 'No.',
  date, dateLabel = 'Date', extraRows = [],
}) {
  // Falls back to the bundled mark, so an invoice printed before anyone has
  // uploaded a logo still carries the shop's identity rather than two letters.
  const logo = business?.logo ? resolveFileUrl(business.logo) : APP_LOGO;

  return (
    <header className="avoid-break -mx-5 sm:-mx-7 -mt-5 sm:-mt-7 mb-5">
      {/* The black band is the strongest thing on the printed stationery and
          the thing that makes an invoice recognisably theirs across a counter.
          It bleeds to the sheet edge, which is why the negative margins above
          cancel the sheet's own padding. */}
      <div className="bg-ink-950 text-white px-5 sm:px-7 py-4 print-exact">
        <div className="flex items-start justify-between gap-5">
          {/* Identity */}
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex items-center justify-center w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black print-exact">
              <img src={logo} alt="" className="w-full h-full object-contain" />
            </span>

            <div className="min-w-0 pt-0.5">
              <h1 className="font-display font-bold text-lg sm:text-xl leading-tight tracking-wide text-white">
                {business?.name || 'ADEENA TRADERS'}
              </h1>
              <p className="text-[9px] uppercase tracking-[0.3em] mt-0.5" style={{ color: '#d4af37' }}>
                {business?.tagline || 'Trust | Quality | Growth'}
              </p>
            </div>
          </div>

          {/* Document identity */}
          <div className="text-right flex-shrink-0">
            <h2 className="doc-title text-white">{title}</h2>
            {subtitle && <p className="text-2xs italic" style={{ color: '#d4af37' }}>{subtitle}</p>}

            <table className="ml-auto mt-2 text-2xs">
              <tbody>
                {reference && (
                  <tr>
                    <td className="pr-3 text-left" style={{ color: '#b0b0b7' }}>{referenceLabel}</td>
                    <td className="font-semibold text-right tabular" style={{ color: '#f4e3a2' }}>
                      {reference}
                    </td>
                  </tr>
                )}
                {date && (
                  <tr>
                    <td className="pr-3 text-left" style={{ color: '#b0b0b7' }}>{dateLabel}</td>
                    <td className="font-medium text-right text-white">{formatDate(date)}</td>
                  </tr>
                )}
                {extraRows.filter((r) => r.value).map((row) => (
                  <tr key={row.label}>
                    <td className="pr-3 text-left" style={{ color: '#b0b0b7' }}>{row.label}</td>
                    <td className="font-medium text-right text-white">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gold hairline: the band's edge on the printed sheet. */}
      <div className="doc-rule-gold" />

      {/* Contact details sit under the band rather than inside it, so the band
          stays a clean identity block and the small print does not compete
          with the document's own title. */}
      <div className="px-5 sm:px-7 pt-2 text-2xs text-ink-600 leading-relaxed flex flex-wrap gap-x-4 gap-y-0.5">
        {business?.address && <span>{business.address}</span>}
        {[business?.phone, business?.alternatePhone].filter(Boolean).length > 0 && (
          <span className="tabular">
            {[business?.phone, business?.alternatePhone].filter(Boolean).join(' · ')}
          </span>
        )}
        {business?.email && <span>{business.email}</span>}
        {(business?.ntn || business?.strn) && (
          <span>
            {business.ntn && `NTN: ${business.ntn}`}
            {business.ntn && business.strn && '  ·  '}
            {business.strn && `STRN: ${business.strn}`}
          </span>
        )}
      </div>
    </header>
  );
}

/**
 * A section tab - white on black, as printed above BILL TO and Notes.
 */
export function DocSection({ label, gold = false, children, className }) {
  return (
    <section className={cn('min-w-0', className)}>
      <span className={gold ? 'doc-pill-gold' : 'doc-pill'}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/**
 * A bordered block describing one party (customer, guarantor, investor).
 * `fields` is a list of { label, value } so callers control what appears.
 */
export function PartyBlock({ heading, name, fields = [], className }) {
  return (
    <div className={cn('rounded-lg border border-ink-200 p-3 min-w-0', className)}>
      <span className="doc-pill">{heading}</span>
      {name && <p className="mt-2 text-sm font-semibold text-ink-950 leading-tight">{name}</p>}

      <dl className="mt-1 space-y-0.5">
        {fields.filter((f) => f.value).map((field) => (
          <div key={field.label} className="flex gap-1.5 text-2xs leading-snug">
            <dt className="text-ink-500 flex-shrink-0">{field.label}:</dt>
            <dd className="text-ink-900 font-medium break-words min-w-0">{field.value}</dd>
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
export function TotalsBlock({ rows = [], grandTotal, grandTotalLabel = 'Total', className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn('border-b border-ink-100', row.muted && 'text-ink-500')}>
              <td className="py-1.5 pr-4 text-left uppercase text-2xs tracking-wide text-ink-600">
                {row.label}
              </td>
              <td
                className={cn(
                  'py-1.5 text-right tabular whitespace-nowrap',
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
          className="flex items-center justify-between gap-4 mt-0 px-3 py-2.5 text-ink-950 print-exact"
          style={{ background: 'linear-gradient(135deg, #f4e3a2 0%, #d4af37 55%, #b8901f 100%)' }}
        >
          <span className="text-2xs font-bold uppercase tracking-wider">{grandTotalLabel}</span>
          <span className="text-base font-display font-bold tabular whitespace-nowrap">
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

/**
 * Terms, the thank-you line and the black contact bar that closes the sheet.
 */
export function DocumentFooter({ terms, footerText, legalNote, business, className }) {
  const contacts = [business?.phone, business?.email, business?.address].filter(Boolean);

  return (
    <footer className={cn('mt-6 avoid-break', className)}>
      {terms && (
        <div className="mb-4">
          <span className="doc-pill">Terms &amp; Conditions</span>
          <div className="mt-1.5 text-2xs text-ink-600 leading-relaxed whitespace-pre-line">
            {terms}
          </div>
        </div>
      )}

      {footerText && (
        <p
          className="text-center font-display font-semibold italic text-sm mb-3"
          style={{ color: '#b8901f' }}
        >
          {footerText}
        </p>
      )}

      {legalNote && (
        <p className="mb-3 text-2xs text-center text-ink-400 leading-snug">{legalNote}</p>
      )}

      {/* Black contact bar, matching the strip that closes the printed sheet.
          Bleeds to the edges for the same reason the header band does. */}
      {contacts.length > 0 && (
        <div className="-mx-5 sm:-mx-7 -mb-5 sm:-mb-7 mt-4">
          <div className="doc-rule-gold" />
          <div className="bg-ink-950 text-white px-5 sm:px-7 py-2.5 print-exact">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-2xs">
              {contacts.map((c) => (
                <span key={c} className="tabular" style={{ color: '#e9e2d4' }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
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
      {/* The mark, printed very faintly behind the item table exactly as on the
          stationery. It is decoration and must never fight the figures over it,
          hence 4% opacity - visible on paper, invisible to a reader scanning
          the amounts. */}
      <span
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <img src={APP_LOGO_WATERMARK} alt="" className="w-[52%] max-w-[280px] opacity-[0.06]" />
      </span>

      {/* A word stamped across the sheet - DRAFT, CANCELLED - so a superseded
          copy cannot be mistaken for a live one. */}
      {watermark && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <span className="font-display font-black text-[72px] sm:text-[110px] text-danger-600/[0.10] rotate-[-28deg] tracking-widest whitespace-nowrap">
            {watermark}
          </span>
        </span>
      )}

      <div className="relative">{children}</div>
    </article>
  );
}
