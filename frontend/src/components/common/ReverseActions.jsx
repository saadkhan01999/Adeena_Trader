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
import { Ban, Trash2, Link2 } from 'lucide-react';

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
  /** The server's list of records attached to this one (HAS_LINKED_RECORDS). */
  const [linked, setLinked] = useState(null);

  const isAdmin = user?.role === 'admin';

  const close = () => { setMode(null); setReason(''); setLinked(null); };

  const run = async (params) => {
    setBusy(true);
    try {
      const action = mode === 'delete' ? onDelete : onCancel;
      const response = await action(record._id, reason.trim(), params);

      toast.success(response?.message || `${label} ${mode === 'delete' ? 'deleted' : 'cancelled'}.`);
      onDone?.(mode, record);
      close();
    } catch (error) {
      // A delete with records attached comes back as a list to confirm - for a
      // sale, the instalment payments made against it.
      if (mode === 'delete' && error?.code === 'HAS_LINKED_RECORDS' && error.errors) {
        setLinked({ message: error.message, ...error.errors });
        return;
      }
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
            {linked ? (
              <Button variant="danger" icon={Trash2} onClick={() => run({ force: true })} isLoading={busy} loadingText="Deleting…">
                Delete everything
              </Button>
            ) : (
              <Button
                variant={isDelete ? 'danger' : 'gold'}
                onClick={() => run()}
                isLoading={busy}
                loadingText="Working…"
              >
                {isDelete ? `Delete permanently` : `Cancel ${label}`}
              </Button>
            )}
          </ModalFooter>
        }
      >
        <div className="space-y-3.5" onClick={(e) => e.stopPropagation()}>
          {linked && (
            <div className="space-y-2 soft-in">
              <p className="text-sm font-medium text-navy-900">{linked.message}</p>
              <ul className="rounded-lg border border-danger-200 bg-danger-50/60 divide-y divide-danger-100">
                {(linked.links || []).map((link) => (
                  <li key={link.label} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 capitalize text-navy-700"><Link2 size={13} className="text-danger-500" />{link.label}</span>
                    <strong className="text-danger-700 tabular">{link.count}</strong>
                  </li>
                ))}
              </ul>
              {linked.consequence && <p className="text-xs text-navy-600">{linked.consequence}</p>}
            </div>
          )}
          <div className={linked ? 'hidden' : undefined}>
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
