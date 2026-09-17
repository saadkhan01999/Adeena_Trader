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

export default function PageHeader({
  title,
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
              'bg-navy-950 text-gold-500 shadow-xs',
              compact ? 'w-9 h-9' : 'w-10 h-10 sm:w-11 sm:h-11'
            )}
            aria-hidden="true"
          >
            <Icon size={compact ? 17 : 20} />
          </span>
        )}

        <div className="min-w-0">
          {breadcrumb && (
            <nav className="text-2xs text-navy-400 mb-0.5 truncate" aria-label="Breadcrumb">
              {breadcrumb}
            </nav>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-navy-950 leading-tight">{title}</h1>
            {badge}
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-navy-500 mt-0.5 leading-relaxed">{subtitle}</p>
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
