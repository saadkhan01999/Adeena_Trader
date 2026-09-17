/**
 * ============================================
 * Modal
 * ============================================
 * Responsive dialog: a bottom sheet on phones, a centred panel from `sm` up.
 *
 * Behaviour that has to be right for a dialog to feel solid:
 *   - Escape closes it, and only the topmost one.
 *   - The page behind does not scroll while it is open.
 *   - Focus moves into the dialog and Tab stays inside it.
 *   - Focus returns to whatever opened it on close.
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/index.js';

const sizes = {
  xs: 'sm:max-w-sm',
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
  '3xl': 'sm:max-w-6xl',
  full: 'sm:max-w-[95vw]',
};

/** Tracks nesting so Escape only closes the dialog on top. */
let openModalCount = 0;

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  hideCloseButton = false,
  className,
  bodyClassName,
  /** Adds `.print-area` to the panel so Ctrl+P prints only this content. */
  printable = false,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const depthRef = useRef(0);

  // ---- Scroll lock + focus management -----------------------------------
  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement;
    openModalCount += 1;
    depthRef.current = openModalCount;

    // Compensate for the scrollbar's width so the page behind does not shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Move focus into the dialog for keyboard and screen-reader users
    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
      );
      (target || panelRef.current)?.focus?.();
    }, 60);

    return () => {
      clearTimeout(focusTimer);
      openModalCount = Math.max(0, openModalCount - 1);

      // Only the last dialog restores the page's scroll
      if (openModalCount === 0) {
        document.body.style.overflow = overflow;
        document.body.style.paddingRight = paddingRight;
      }
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // ---- Escape and focus trap --------------------------------------------
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        // Ignore when a nested dialog is on top of this one
        if (depthRef.current !== openModalCount) return;
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Wrap around instead of letting focus escape to the page behind
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeOnEscape, onClose]
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-4"
          onKeyDown={handleKeyDown}
          role="presentation"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnOverlay ? onClose : undefined}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm no-print"
            aria-hidden="true"
          />

          {/* Panel: slides up on mobile, scales in on desktop */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full bg-white shadow-modal flex flex-col outline-none',
              'rounded-t-2xl sm:rounded-xl',
              'max-h-[92dvh] sm:max-h-[88vh]',
              sizes[size] || sizes.md,
              printable && 'print-area',
              className
            )}
          >
            {/* Drag affordance - signals the sheet can be dismissed */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 no-print">
              <span className="h-1 w-10 rounded-full bg-navy-200" />
            </div>

            {(title || !hideCloseButton) && (
              <header className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-navy-100 no-print">
                <div className="flex items-start gap-3 min-w-0">
                  {Icon && (
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
                      <Icon size={18} />
                    </span>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-base sm:text-lg font-display font-semibold text-navy-950 leading-tight">
                        {title}
                      </h3>
                    )}
                    {subtitle && <p className="text-xs sm:text-sm text-navy-500 mt-0.5">{subtitle}</p>}
                  </div>
                </div>

                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className={cn(
                      'p-1.5 rounded-lg text-navy-400 flex-shrink-0',
                      'hover:bg-navy-100 hover:text-navy-700 active:scale-95',
                      'transition-all duration-150'
                    )}
                  >
                    <X size={19} />
                  </button>
                )}
              </header>
            )}

            <div
              className={cn(
                'flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-4 sm:px-5 py-4',
                bodyClassName
              )}
            >
              {children}
            </div>

            {footer && (
              <footer className="px-4 sm:px-5 py-3 sm:py-4 border-t border-navy-100 bg-navy-50/60 rounded-b-2xl sm:rounded-b-xl no-print safe-bottom">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * The standard Cancel / Confirm pair for a modal footer.
 * On a phone the buttons stack and fill the width, so neither is a small target.
 */
export function ModalFooter({ children, className }) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)}>
      {children}
    </div>
  );
}
