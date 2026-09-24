/**
 * ============================================
 * PageHeader
 * ============================================
 * The title block at the top of every screen.
 *
 * On a phone the action buttons wrap below the title and stretch to fill the
 * row, so a primary action is never a small target squeezed into a corner.
 */

import { cn } from '../../utils/index.js';
import { Urdu } from './Bilingual.jsx';
import { urduForLabel } from '../../i18n/formLabels.js';

export default function PageHeader({
  title,
  /** Urdu title; looked up from the English one when not given. */
  titleUr,
  subtitle,
  icon: Icon,
  actions,
  badge,
  breadcrumb,
  className,
  compact = false,
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        compact ? 'mb-4' : 'mb-5 sm:mb-6',
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span
            className={cn(
              'flex items-center justify-center rounded-lg flex-shrink-0',
              'bg-ink-950 text-gold-400 shadow-glow ring-2 ring-gold-500/40 rounded-xl',
              compact ? 'w-9 h-9' : 'w-11 h-11 sm:w-12 sm:h-12'
            )}
            aria-hidden="true"
          >
            <Icon size={compact ? 17 : 22} />
          </span>
        )}

        <div className="min-w-0">
          {breadcrumb && (
            <nav className="text-2xs text-navy-400 mb-0.5 truncate" aria-label="Breadcrumb">
              {breadcrumb}
            </nav>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-ink-950 leading-tight gold-rule">{title}</h1>
            <Urdu className="text-lg text-gold-700">{titleUr ?? urduForLabel(title)}</Urdu>
            {badge}
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-ink-500 mt-2 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 no-print [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </header>
  );
}
