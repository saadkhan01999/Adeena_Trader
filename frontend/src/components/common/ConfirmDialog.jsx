/**
 * ============================================
 * ConfirmDialog
 * ============================================
 * Confirmation before an action that cannot be undone.
 *
 * For the most destructive operations - erasing data, cancelling a signed
 * agreement - `requireTyping` makes the user type an exact phrase. A single
 * click is far too easy to make by accident when the consequence is permanent.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Info, ShieldAlert } from 'lucide-react';
import Modal, { ModalFooter } from './Modal.jsx';
import Button from './Button.jsx';
import { Input } from './Form.jsx';
import { cn } from '../../utils/index.js';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  detail,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon: Icon,
  isLoading = false,
  /** When set, the user must type this exact phrase before Confirm is enabled. */
  requireTyping,
  requireTypingLabel,
}) {
  const [typed, setTyped] = useState('');

  // Reset between openings, so a phrase typed last time does not carry over
  useEffect(() => {
    if (!isOpen) setTyped('');
  }, [isOpen]);

  const tones = {
    danger: { badge: 'bg-danger-50 text-danger-600 ring-danger-100', button: 'danger', icon: Trash2 },
    warning: { badge: 'bg-warning-50 text-warning-600 ring-warning-100', button: 'primary', icon: AlertTriangle },
    info: { badge: 'bg-info-50 text-info-600 ring-info-100', button: 'primary', icon: Info },
    critical: { badge: 'bg-danger-100 text-danger-700 ring-danger-200', button: 'danger', icon: ShieldAlert },
  }[variant] || {};

  const ResolvedIcon = Icon || tones.icon || AlertTriangle;
  const canConfirm = !requireTyping || typed.trim() === requireTyping;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" hideCloseButton>
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 pt-2">
        <span
          className={cn('flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ring-8', tones.badge)}
          aria-hidden="true"
        >
          <ResolvedIcon size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-display font-semibold text-navy-950">{title}</h3>
          <p className="mt-1.5 text-sm text-navy-600 leading-relaxed">{message}</p>

          {detail && (
            <div className="mt-3 rounded-lg bg-navy-50 border border-navy-100 px-3 py-2 text-xs text-navy-600 text-left">
              {detail}
            </div>
          )}

          {requireTyping && (
            <div className="mt-4 text-left">
              <Input
                label={requireTypingLabel || 'Type the phrase below to confirm'}
                hint={requireTyping}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireTyping}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>

      <ModalFooter className="mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={tones.button || 'danger'}
          onClick={onConfirm}
          isLoading={isLoading}
          disabled={!canConfirm}
          loadingText="Working…"
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
