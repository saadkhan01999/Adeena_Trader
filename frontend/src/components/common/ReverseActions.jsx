/**
 * ============================================
 * ReverseActions
 * ============================================
 * The cancel / delete pair for a financial record - a sale, payment, purchase
 * or return.
 *
 * Two operations, not one
 * -----------------------
 * Cancelling reverses the record's effects (stock, balances, ledgers) and
 * leaves it in history marked cancelled. Deleting does the same reversal and
 * then removes the record outright, and is offered only to an admin.
 *
 * Both are shown because both are wanted for different reasons. A sale entered
 * against the wrong customer should be cancelled - the invoice number was
 * issued, the customer may hold a printed copy, and the history should say what
 * happened. A duplicate entered twice by a slow double-click should be deleted,
 * because there is nothing meaningful to keep. Offering only one forces the
 * wrong answer in half of all cases.
 *
 * The confirmation asks for a reason. It is optional, but it is the only thing
 * that will explain a reversal to whoever reads the books in six months.
 */

import { useState } from 'react';
import { Ban, Trash2 } from 'lucide-react';

import { IconButton } from './Button.jsx';
import Modal, { ModalFooter } from './Modal.jsx';
import Button from './Button.jsx';
import { Urdu } from './Bilingual.jsx';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';

/**
 * @param {object} props
 * @param {object} props.record        The row.
 * @param {string} props.label         What it is called, e.g. "sale".
 * @param {{en:string,ur:string}} [props.labelUr]
 * @param {Function} props.onCancel    (id, reason) => Promise
 * @param {Function} props.onDelete    (id, reason) => Promise
 * @param {Function} props.onDone      (action, record) => void - update the list
 * @param {boolean} [props.cancelled]  Already reversed: hide cancel, keep delete.
 */
export default function ReverseActions({
  record, label, onCancel, onDelete, onDone, cancelled = false,
}) {
  const { user } = useAuthStore();
  const toast = useToastStore();

  const [mode, setMode] = useState(null); // 'cancel' | 'delete'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'admin';

  const close = () => { setMode(null); setReason(''); };

  const run = async () => {
    setBusy(true);
    try {
      const action = mode === 'delete' ? onDelete : onCancel;
      const response = await action(record._id, reason.trim());

      toast.success(response?.message || `${label} ${mode === 'delete' ? 'deleted' : 'cancelled'}.`);
      onDone?.(mode, record);
      close();
    } catch (error) {
      // The server refuses a sale that still has payments against it, and says
      // which ones. That message is far more useful than anything generic.
      toast.apiError(error, `Could not ${mode} this ${label}.`);
    } finally {
      setBusy(false);
    }
  };

  const isDelete = mode === 'delete';

  return (
    <>
      {!cancelled && (
        <IconButton
          icon={Ban}
          label={`Cancel this ${label}`}
          size="icon-sm"
          className="text-warning-600 hover:bg-warning-50"
          onClick={(e) => { e.stopPropagation(); setMode('cancel'); }}
        />
      )}

      {isAdmin && (
        <IconButton
          icon={Trash2}
          label={`Delete this ${label} permanently`}
          size="icon-sm"
          className="text-danger-500 hover:bg-danger-50"
          onClick={(e) => { e.stopPropagation(); setMode('delete'); }}
        />
      )}

      <Modal
        isOpen={Boolean(mode)}
        onClose={close}
        size="md"
        title={isDelete ? `Delete this ${label}?` : `Cancel this ${label}?`}
        icon={isDelete ? Trash2 : Ban}
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Keep it
            </Button>
            <Button
              variant={isDelete ? 'danger' : 'gold'}
              onClick={run}
              isLoading={busy}
              loadingText="Working…"
            >
              {isDelete ? `Delete permanently` : `Cancel ${label}`}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-sm text-ink-800">
              {isDelete
                ? `The ${label} will be reversed and then removed completely. Stock, balances and ledgers are corrected first, but the record itself will be gone and cannot be recovered.`
                : `The ${label} will be reversed - stock, balances and ledgers are corrected - and kept in history marked cancelled.`}
            </p>
            <Urdu className="block text-sm text-ink-600 mt-1.5">
              {isDelete
                ? 'ریکارڈ کا اثر واپس ہو جائے گا اور پھر ریکارڈ مکمل طور پر مٹا دیا جائے گا۔ اسٹاک اور حساب درست ہو جائے گا، مگر ریکارڈ واپس نہیں آ سکے گا۔'
                : 'اس کا اثر واپس ہو جائے گا - اسٹاک اور حساب درست ہو جائے گا - اور ریکارڈ تاریخ میں "منسوخ" کے طور پر محفوظ رہے گا۔'}
            </Urdu>
          </div>

          <label className="block">
            <span className="flex items-baseline gap-2 text-sm font-medium text-ink-800">
              Reason <Urdu className="text-xs text-ink-500">وجہ</Urdu>
              <span className="text-xs font-normal text-ink-400">(optional)</span>
            </span>
            <input
              className="input mt-1 w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Entered twice by mistake"
              autoFocus
            />
          </label>
        </div>
      </Modal>
    </>
  );
}
