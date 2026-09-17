/**
 * ============================================
 * Badge
 * ============================================
 * Compact status label. Variants map to the semantic colour scales, so the
 * same meaning always reads the same colour across every screen.
 */

import { cn } from '../../utils/index.js';

const variants = {
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-info-50 text-info-700 border-info-200',
  neutral: 'bg-navy-50 text-navy-600 border-navy-200',
  gold: 'bg-gold-50 text-gold-700 border-gold-200',
  solid: 'bg-navy-950 text-white border-navy-950',
  'solid-gold': 'bg-gold-500 text-navy-950 border-gold-500',
};

/**
 * @param {object} props
 * @param {keyof typeof variants} [props.variant='neutral']
 * @param {boolean} [props.dot]   Leading status dot.
 * @param {boolean} [props.pulse] Animates the dot - for live/urgent states.
 * @param {React.ElementType} [props.icon]
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  icon: Icon,
  className,
}) {
  return (
    <span
      className={cn(
        'badge',
        size === 'sm' && 'px-1.5 py-0 text-2xs',
        size === 'lg' && 'px-2.5 py-1 text-xs',
        variants[variant] || variants.neutral,
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          {pulse && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-pulse-ring" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon size={11} className="flex-shrink-0" />}
      {children}
    </span>
  );
}

/**
 * A count badge for a nav item or an icon button.
 * Counts above 99 render as "99+" so the pill keeps its size.
 */
export function CountBadge({ count, variant = 'danger', className }) {
  if (!count || count <= 0) return null;

  const tones = {
    danger: 'bg-danger-500 text-white',
    gold: 'bg-gold-500 text-navy-950',
    navy: 'bg-navy-950 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'rounded-full text-2xs font-bold leading-none tabular',
        tones[variant] || tones.danger,
        className
      )}
      aria-label={`${count} items`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
