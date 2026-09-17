/**
 * ============================================
 * ReminderModal
 * ============================================
 * Review and send payment reminders.
 *
 * How sending works
 * -----------------
 * The server composes every message from the admin's template, so the wording
 * is identical whoever presses the button. This dialog shows the exact text,
 * lets the user deselect anyone they do not want to chase, then opens WhatsApp
 * for each selected customer and records what was sent.
 *
 * Generating and logging are deliberately separate steps: a message that was
 * previewed but not sent must not appear in the audit trail as sent.
 *
 * Browsers block a burst of `window.open` calls, so sends are staggered and the
 * dialog explains what is happening rather than silently dropping most of them.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle, Send, AlertTriangle, CheckCircle2, Clock,
  Loader2, Copy, Check, Users, Phone,
} from 'lucide-react';

import Modal, { ModalFooter } from '../common/Modal.jsx';
import Button, { IconButton } from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { ListSkeleton } from '../common/Skeleton.jsx';
import { Checkbox } from '../common/Form.jsx';
import Tabs from '../common/Tabs.jsx';

import { reminderService } from '../../services/entities.js';
import { useToastStore } from '../../context/toastStore.js';
import { cn, formatCurrency, formatDate, copyToClipboard, getTelURL } from '../../utils/index.js';

/** Delay between opening WhatsApp tabs, to stay under popup-blocker limits. */
const SEND_STAGGER_MS = 700;

export default function ReminderModal({ isOpen, onClose, initialScope = 'overdue', customerId = null }) {
  const toast = useToastStore();

  const [scope, setScope] = useState(initialScope);
  const [reminders, setReminders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // ---- Load previews ----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setSentCount(0);

    reminderService
      .preview({ scope, ...(customerId ? { customerId } : {}) })
      .then((response) => {
        if (cancelled) return;
        const list = response.data.reminders || [];
        setReminders(list);
        // Everything is pre-selected: the common case is "chase them all"
        setSelected(new Set(list.map((_, i) => i)));
      })
      .catch((error) => {
        if (!cancelled) toast.apiError(error, 'Could not prepare the reminders.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scope, customerId]);

  const selectedReminders = useMemo(
    () => reminders.filter((_, index) => selected.has(index)),
    [reminders, selected]
  );

  const totalSelected = useMemo(
    () => selectedReminders.reduce((sum, r) => sum + (r.amount || 0), 0),
    [selectedReminders]
  );

  const toggle = (index) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) =>
      current.size === reminders.length ? new Set() : new Set(reminders.map((_, i) => i))
    );
  };

  const handleCopy = async (reminder, index) => {
    const ok = await copyToClipboard(reminder.message);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } else {
      toast.error('Could not copy the message.');
    }
  };

  // ---- Send -------------------------------------------------------------
  const handleSend = async () => {
    if (selectedReminders.length === 0) return;

    setSending(true);
    let opened = 0;

    for (const reminder of selectedReminders) {
      if (!reminder.whatsappUrl) continue;

      window.open(reminder.whatsappUrl, '_blank', 'noopener');
      opened += 1;
      setSentCount(opened);

      // Stagger: opening ten tabs at once trips every popup blocker
      if (opened < selectedReminders.length) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, SEND_STAGGER_MS));
      }
    }

    // Record what was actually opened
    try {
      await reminderService.log(selectedReminders, 'whatsapp');
      toast.success(
        `${opened} reminder${opened === 1 ? '' : 's'} opened in WhatsApp and recorded.`
      );
    } catch (error) {
      toast.warning('Reminders were opened, but they could not be recorded in the log.');
    } finally {
      setSending(false);
      onClose?.();
    }
  };

  const scopeTabs = [
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
    { id: 'due_today', label: 'Due today', icon: Clock },
    { id: 'upcoming', label: 'Upcoming', icon: CheckCircle2 },
    { id: 'all', label: 'All', icon: Users },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={sending ? undefined : onClose}
      closeOnOverlay={!sending}
      title="Send payment reminders"
      subtitle="Review the wording before anything reaches a customer"
      icon={MessageCircle}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="whatsapp"
            icon={Send}
            onClick={handleSend}
            isLoading={sending}
            loadingText={`Opening ${sentCount} of ${selectedReminders.length}…`}
            disabled={selectedReminders.length === 0}
          >
            Send {selectedReminders.length > 0 ? selectedReminders.length : ''} via WhatsApp
          </Button>
        </ModalFooter>
      }
    >
      {/* Scope - hidden when the dialog was opened for one customer */}
      {!customerId && (
        <Tabs tabs={scopeTabs} active={scope} onChange={setScope} className="mb-4" />
      )}

      {/* Summary */}
      {!loading && reminders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-3 py-2.5 rounded-lg bg-navy-50 border border-navy-100">
          <Checkbox
            label={`${selected.size} of ${reminders.length} selected`}
            checked={selected.size === reminders.length && reminders.length > 0}
            onChange={toggleAll}
          />
          <span className="text-sm">
            <span className="text-navy-500">Total being chased: </span>
            <span className="font-semibold text-navy-950 tabular">{formatCurrency(totalSelected)}</span>
          </span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <ListSkeleton items={4} />
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nobody to chase"
          message={
            scope === 'overdue'
              ? 'No installments are overdue right now.'
              : 'There is nothing in this category at the moment.'
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {reminders.map((reminder, index) => {
            const isSelected = selected.has(index);

            return (
              <li
                key={`${reminder.saleId}-${reminder.installmentNumber}`}
                className={cn(
                  'rounded-lg border p-3 transition-all duration-200',
                  isSelected ? 'border-gold-300 bg-gold-50/40' : 'border-navy-200 bg-white opacity-70'
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(index)}
                    className="checkbox mt-1 flex-shrink-0"
                    aria-label={`Include ${reminder.customerName}`}
                  />

                  <div className="min-w-0 flex-1">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-navy-950">
                        {reminder.customerName}
                      </span>

                      {reminder.daysOverdue > 0 ? (
                        <Badge variant="danger" size="sm">
                          {reminder.daysOverdue} day{reminder.daysOverdue === 1 ? '' : 's'} overdue
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Due {formatDate(reminder.dueDate)}
                        </Badge>
                      )}

                      <span className="ml-auto text-sm font-bold text-danger-600 tabular">
                        {formatCurrency(reminder.amount)}
                      </span>
                    </div>

                    <p className="text-2xs text-navy-500 mt-0.5">
                      {reminder.invoiceNumber} · Installment #{reminder.installmentNumber} ·{' '}
                      {reminder.phone || 'no phone on file'}
                    </p>

                    {/* The exact message that will be sent */}
                    <div className="relative mt-2">
                      <p className="text-xs text-navy-700 leading-relaxed bg-white border border-navy-200 rounded-lg p-2.5 pr-9 whitespace-pre-line">
                        {reminder.message}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleCopy(reminder, index)}
                        title="Copy this message"
                        aria-label="Copy this message"
                        className="absolute top-2 right-2 p-1.5 rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors"
                      >
                        {copiedIndex === index ? (
                          <Check size={13} className="text-success-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    {/* A phone call is still the fallback when WhatsApp fails */}
                    {reminder.phone && (
                      <a
                        href={getTelURL(reminder.phone)}
                        className="inline-flex items-center gap-1 mt-1.5 text-2xs font-medium text-info-600 hover:text-info-700 transition-colors"
                      >
                        <Phone size={11} /> Call instead
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Explain the staggering, so the delay does not look like a fault */}
      {reminders.length > 1 && (
        <p className="mt-4 text-2xs text-navy-500 leading-relaxed">
          WhatsApp opens in a new tab for each customer, about one every second, so your browser
          does not block them. Press send in each tab to deliver the message.
        </p>
      )}
    </Modal>
  );
}
