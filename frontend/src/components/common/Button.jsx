/**
 * ============================================
 * Button
 * ============================================
 * The single button primitive for the whole app.
 *
 * Motion is built in rather than left to each caller: a 200ms ease and a
 * `scale(0.97)` press. That press feedback is what makes a tap feel
 * acknowledged on a touch device, where there is no hover state to rely on.
 */

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/index.js';

const variants = {
  primary:
    'bg-navy-950 text-white shadow-xs hover:bg-navy-900 hover:shadow-card-hover focus-visible:ring-navy-900',
  gold:
    'bg-gold-500 text-navy-950 font-semibold shadow-xs hover:bg-gold-400 hover:shadow-card-hover focus-visible:ring-gold-500',
  secondary:
    'bg-white text-navy-700 border border-navy-200 hover:bg-navy-50 hover:border-navy-300 focus-visible:ring-navy-400',
  outline:
    'bg-transparent text-navy-700 border border-navy-300 hover:bg-navy-50 focus-visible:ring-navy-400',
  ghost:
    'bg-transparent text-navy-600 hover:bg-navy-100 hover:text-navy-950 focus-visible:ring-navy-400',
  danger:
    'bg-danger-600 text-white shadow-xs hover:bg-danger-700 focus-visible:ring-danger-500',
  'danger-soft':
    'bg-danger-50 text-danger-700 border border-danger-200 hover:bg-danger-100 focus-visible:ring-danger-400',
  success:
    'bg-success-600 text-white shadow-xs hover:bg-success-700 focus-visible:ring-success-500',
  'success-soft':
    'bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 focus-visible:ring-success-400',
  whatsapp:
    'bg-[#25D366] text-white shadow-xs hover:bg-[#1FBA57] focus-visible:ring-[#25D366]',
};

const sizes = {
  xs: 'px-2.5 py-1 text-2xs gap-1 rounded-md',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm sm:text-base gap-2',
  xl: 'px-6 py-3 text-base gap-2.5',
  icon: 'p-2',
  'icon-sm': 'p-1.5 rounded-md',
};

/**
 * @param {object} props
 * @param {keyof typeof variants} [props.variant='primary']
 * @param {keyof typeof sizes} [props.size='md']
 * @param {boolean} [props.isLoading]   Shows a spinner and blocks interaction.
 * @param {string}  [props.loadingText] Replaces the label while loading.
 * @param {React.ElementType} [props.icon]      Rendered before the label.
 * @param {React.ElementType} [props.iconRight] Rendered after the label.
 * @param {boolean} [props.fullWidth]
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    className,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;
  const iconSize = size === 'xs' || size === 'sm' || size === 'icon-sm' ? 14 : 16;

  return (
    <button
      ref={ref}
      // Defaults to "button": an unlabelled <button> inside a <form> submits it,
      // which is a classic source of accidental double-submits.
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap select-none',
        'transition-all duration-200 ease-out-expo active:scale-[0.97]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin flex-shrink-0" aria-hidden="true" />
      ) : (
        Icon && <Icon size={iconSize} className="flex-shrink-0" aria-hidden="true" />
      )}

      {isLoading && loadingText ? loadingText : children}

      {!isLoading && IconRight && (
        <IconRight size={iconSize} className="flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
});

export default Button;

/**
 * A square icon-only button.
 * `label` is required: an icon with no text is invisible to a screen reader,
 * so it becomes both the tooltip and the accessible name.
 */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'icon', className, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      title={label}
      aria-label={label}
      className={cn('flex-shrink-0', className)}
      {...props}
    >
      <Icon size={size === 'icon-sm' ? 15 : 17} aria-hidden="true" />
    </Button>
  );
});

/**
 * Groups buttons into a single segmented control with shared borders.
 */
export function ButtonGroup({ children, className }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg overflow-hidden border border-navy-200 bg-white',
        '[&>*]:rounded-none [&>*]:border-0 [&>*:not(:last-child)]:border-r [&>*]:border-navy-200',
        className
      )}
      role="group"
    >
      {children}
    </div>
  );
}
