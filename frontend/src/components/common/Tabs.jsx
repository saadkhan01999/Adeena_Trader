/**
 * ============================================
 * Tabs
 * ============================================
 * A horizontal tab strip for in-page sections (the Zakat calculator/history,
 * the Installments buckets, the Settings sections on mobile).
 *
 * The strip scrolls horizontally rather than wrapping. Wrapping six tabs onto
 * three lines on a phone eats the screen and breaks the "one row of tabs"
 * mental model; a scrollable rail keeps the height fixed and stays familiar.
 */

import { cn } from '../../utils/index.js';
import { CountBadge } from './Badge.jsx';

/**
 * @param {object} props
 * @param {Array<{id:string,label:string,icon?:React.ElementType,count?:number,disabled?:boolean}>} props.tabs
 * @param {string} props.active
 * @param {Function} props.onChange
 * @param {'pill'|'underline'} [props.variant='pill']
 * @param {boolean} [props.fullWidth] Distribute tabs evenly across the row.
 */
export default function Tabs({
  tabs = [],
  active,
  onChange,
  variant = 'pill',
  fullWidth = false,
  className,
}) {
  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        className={cn(
          'flex items-center gap-1 border-b border-navy-100 overflow-x-auto scrollbar-none touch-scroll',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange?.(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-3 sm:px-4 py-2.5 whitespace-nowrap',
                'text-xs sm:text-sm font-medium transition-colors duration-200',
                'border-b-2 -mb-px',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-inset',
                isActive
                  ? 'border-gold-500 text-navy-950'
                  : 'border-transparent text-navy-500 hover:text-navy-900 hover:border-navy-200',
                tab.disabled && 'opacity-40 cursor-not-allowed',
                fullWidth && 'flex-1 justify-center'
              )}
            >
              {Icon && <Icon size={15} className="flex-shrink-0" />}
              {tab.label}
              {tab.count > 0 && <CountBadge count={tab.count} variant={isActive ? 'gold' : 'navy'} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={cn('tab-bar touch-scroll', fullWidth && '[&>*]:flex-1', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.id)}
            className={cn(
              'tab',
              isActive && 'tab-active',
              tab.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {Icon && <Icon size={15} className="flex-shrink-0" />}
            <span className="truncate">{tab.label}</span>
            {tab.count > 0 && <CountBadge count={tab.count} variant={isActive ? 'danger' : 'navy'} />}
          </button>
        );
      })}
    </div>
  );
}

/** Renders its children only when `id` is the active tab. */
export function TabPanel({ id, active, children, className }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" className={cn('animate-fade-in', className)}>
      {children}
    </div>
  );
}
