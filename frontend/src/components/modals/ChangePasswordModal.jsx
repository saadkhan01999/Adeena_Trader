/**
 * ============================================
 * ChangePasswordModal
 * ============================================
 * Used both from Settings and as a forced prompt when an administrator has
 * reset someone's password.
 *
 * When `forced` is set the dialog cannot be dismissed: a bootstrap password
 * that lives in a .env file must not remain the live credential simply because
 * the user pressed Escape.
 */

import { useState, useEffect, useMemo } from 'react';
import { KeyRound, ShieldCheck, Check, X } from 'lucide-react';

import Modal, { ModalFooter } from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { PasswordInput } from '../common/Form.jsx';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { cn } from '../../utils/index.js';

/**
 * Score a password out of 4 and describe what is still missing.
 * Shown as a live meter, so the requirements are visible while typing rather
 * than surfacing as an error after submitting.
 */
function assessPassword(password, minLength) {
  const checks = [
    { id: 'length', label: `At least ${minLength} characters`, passed: password.length >= minLength },
    { id: 'letter', label: 'Contains a letter', passed: /[a-zA-Z]/.test(password) },
    { id: 'number', label: 'Contains a number', passed: /[0-9]/.test(password) },
    { id: 'symbol', label: 'Contains a symbol (recommended)', passed: /[^a-zA-Z0-9]/.test(password), optional: true },
  ];

  const score = checks.filter((c) => c.passed).length;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const tones = ['bg-navy-200', 'bg-danger-500', 'bg-warning-500', 'bg-success-500', 'bg-success-600'];

  return { checks, score, label: labels[score], tone: tones[score] };
}

export default function ChangePasswordModal({ isOpen, onClose, forced = false }) {
  const toast = useToastStore();
  const { changePassword } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);

  const minLength = settings?.security?.minPasswordLength || 8;
  const requireStrong = settings?.security?.requireStrongPassword ?? true;

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Clear the form whenever the dialog closes, so credentials are not left in
  // component state for the rest of the session.
  useEffect(() => {
    if (!isOpen) {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setError(null);
    }
  }, [isOpen]);

  const strength = useMemo(
    () => assessPassword(form.newPassword, minLength),
    [form.newPassword, minLength]
  );

  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  const canSubmit =
    form.currentPassword.length > 0 &&
    form.newPassword.length >= minLength &&
    !mismatch &&
    (!requireStrong || (/[a-zA-Z]/.test(form.newPassword) && /[0-9]/.test(form.newPassword)));

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setError(null);

    if (form.newPassword === form.currentPassword) {
      setError('Your new password must be different from your current one.');
      return;
    }

    setSaving(true);
    const result = await changePassword(form);
    setSaving(false);

    if (result.success) {
      toast.success(result.message || 'Password changed successfully.');
      onClose?.();
    } else {
      setError(result.error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={forced ? undefined : onClose}
      closeOnOverlay={!forced}
      closeOnEscape={!forced}
      hideCloseButton={forced}
      title={forced ? 'Choose a new password' : 'Change password'}
      subtitle={
        forced
          ? 'Your account is using a temporary password. Set your own before continuing.'
          : 'Other devices will be signed out for your security.'
      }
      icon={KeyRound}
      size="sm"
      footer={
        <ModalFooter>
          {!forced && (
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button
            variant="gold"
            onClick={handleSubmit}
            isLoading={saving}
            disabled={!canSubmit}
            loadingText="Saving…"
            icon={ShieldCheck}
          >
            Update password
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-700">
            <X size={16} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <PasswordInput
          label="Current password"
          required
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
        />

        <PasswordInput
          label="New password"
          required
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />

        {/* Strength meter + live checklist */}
        {form.newPassword && (
          <div className="rounded-lg bg-navy-50 border border-navy-100 p-3 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 flex-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      i < strength.score ? strength.tone : 'bg-navy-200'
                    )}
                  />
                ))}
              </div>
              <span className="text-2xs font-semibold text-navy-600 w-14 text-right">
                {strength.label}
              </span>
            </div>

            <ul className="space-y-1">
              {strength.checks.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    'flex items-center gap-1.5 text-2xs',
                    check.passed ? 'text-success-700' : check.optional ? 'text-navy-400' : 'text-navy-500'
                  )}
                >
                  {check.passed ? (
                    <Check size={11} className="flex-shrink-0" />
                  ) : (
                    <span className="w-[11px] h-[11px] rounded-full border border-current flex-shrink-0" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PasswordInput
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={mismatch ? 'The two passwords do not match.' : undefined}
        />

        {/* A hidden submit lets Enter submit the form from any field */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
