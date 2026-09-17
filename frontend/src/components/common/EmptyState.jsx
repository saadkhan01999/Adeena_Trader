/**
 * ============================================
 * EmptyState
 * ============================================
 * Shown when a list has nothing in it.
 *
 * An empty state should tell the user WHY it is empty and WHAT to do next.
 * "No records found" alone leaves them guessing whether the filter is wrong or
 * the data has not been entered yet - so `message` and `action` both matter.
 */

import { cn } from '../../utils/index.js';

export default function EmptyState({
  icon: Icon,
  title = 'Nothing here yet',
  message,
  action,
  size = 'md',
  className,
}) {
  const scale = {
    sm: { wrap: 'py-6', icon: 'w-11 h-11', iconSize: 20, title: 'text-sm' },
    md: { wrap: 'py-10', icon: 'w-14 h-14', iconSize: 26, title: 'text-base' },
    lg: { wrap: 'py-16', icon: 'w-16 h-16', iconSize: 30, title: 'text-lg' },
  }[size];

  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center px-4', scale.wrap, className)}
      role="status"
    >
      {Icon && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full mb-3',
            'bg-navy-50 text-navy-300 ring-8 ring-navy-50/50',
            scale.icon
          )}
          aria-hidden="true"
        >
          <Icon size={scale.iconSize} />
        </span>
      )}

      <h3 className={cn('font-semibold text-navy-800', scale.title)}>{title}</h3>

      {message && (
        <p className="mt-1 text-sm text-navy-500 max-w-sm leading-relaxed">{message}</p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * An error state. Visually distinct from an empty one, because "something went
 * wrong" and "there is nothing here" call for different responses.
 */
export function ErrorState({ title = 'Could not load this', message, action, icon: Icon, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-10', className)} role="alert">
      {Icon && (
        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-danger-50 text-danger-500 ring-8 ring-danger-50/50 mb-3">
          <Icon size={26} />
        </span>
      )}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-navy-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
