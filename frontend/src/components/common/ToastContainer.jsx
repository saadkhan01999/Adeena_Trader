/**
 * ============================================
 * ToastContainer
 * ============================================
 * Transient feedback for actions that succeeded or failed.
 *
 * Positioning: bottom-centre on phones, top-right on larger screens. A toast
 * pinned to the top-right of a phone collides with the status bar and the
 * notification shade, and is out of reach of the thumb that just tapped.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore } from '../../context/toastStore.js';
import { cn } from '../../utils/index.js';

const toneFor = {
  success: { icon: CheckCircle2, accent: 'bg-success-500', text: 'text-success-600', ring: 'border-success-200' },
  error: { icon: XCircle, accent: 'bg-danger-500', text: 'text-danger-600', ring: 'border-danger-200' },
  warning: { icon: AlertTriangle, accent: 'bg-warning-500', text: 'text-warning-600', ring: 'border-warning-200' },
  info: { icon: Info, accent: 'bg-info-500', text: 'text-info-600', ring: 'border-info-200' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className={cn(
        'fixed z-toast flex flex-col gap-2 pointer-events-none no-print',
        // Bottom-centre on mobile, top-right from `sm` up
        'bottom-4 left-4 right-4 items-center safe-bottom',
        'sm:bottom-auto sm:left-auto sm:top-4 sm:right-4 sm:items-end sm:w-full sm:max-w-sm'
      )}
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = toneFor[toast.type] || toneFor.info;
          const Icon = tone.icon;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'relative w-full sm:max-w-sm overflow-hidden pointer-events-auto',
                'flex items-start gap-3 pl-4 pr-2 py-3',
                'bg-white rounded-lg border shadow-raised',
                tone.ring
              )}
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              {/* Colour accent, so the type registers before the text is read */}
              <span className={cn('absolute left-0 top-0 bottom-0 w-1', tone.accent)} aria-hidden="true" />

              <Icon size={18} className={cn('flex-shrink-0 mt-0.5', tone.text)} aria-hidden="true" />

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="text-sm font-semibold text-navy-950 leading-snug">{toast.title}</p>
                )}
                <p className={cn('text-sm text-navy-700 leading-snug', toast.title && 'mt-0.5 text-xs')}>
                  {toast.message}
                </p>

                {toast.action && (
                  <button
                    type="button"
                    onClick={() => { toast.action.onClick(); removeToast(toast.id); }}
                    className="mt-1.5 text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
                className="flex-shrink-0 p-1 rounded-md text-navy-300 hover:text-navy-600 hover:bg-navy-50 transition-colors"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
