/**
 * ============================================
 * DeleteDialog
 * ============================================
 * The one permanent-delete confirmation every screen uses.
 *
 * Two steps, only when needed
 * ---------------------------
 * A record nothing else depends on is deleted on the first confirmation.
 *
 * A record other records point at - a customer with sales, a supplier with
 * purchases, a category with items in it - is refused by the server with a
 * list of what is attached and a plain sentence saying what a confirmed delete
 * will do to them (HAS_LINKED_RECORDS). This dialog then shows that list and
 * offers the second, stronger confirmation, which re-sends the delete with
 * `force=true`. The admin always deletes knowing exactly what goes with it.
 *
 * This replaced the old behaviour, where the server quietly archived such a
 * record and answered "deleted" - so the row vanished and then came back.
 *
 * @example
 * <DeleteDialog
 *   target={deleteTarget}
 *   onClose={() => setDeleteTarget(null)}
 *   title="Delete this customer?"
 *   describe={(c) => `"${c.name}" will be deleted permanently.`}
 *   onDelete={(c, params) => customerService.delete(c._id, params)}
 *   onDeleted={(c) => removeRow(c._id)}
 * />
 */

import { useState, useEffect } from 'react';
import { Trash2, Link2, ShieldAlert } from 'lucide-react';

import Modal, { ModalFooter } from './Modal.jsx';
import Button from './Button.jsx';
import { Urdu } from './Bilingual.jsx';
import { useToastStore } from '../../context/toastStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { cn } from '../../utils/index.js';

/**
 * @param {object} props
 * @param {object|null} props.target           The record to delete; null = closed.
 * @param {Function} props.onClose
 * @param {Function} props.onDelete            (record, params) => Promise<response>
 * @param {Function} [props.onDeleted]         (record, response) => void
 * @param {string}   [props.title]
 * @param {Function|string} [props.describe]   First-step message.
 * @param {Function} [props.renderExtra]       (record, { linked, setParams }) => node -
 *   extra controls for the linked step, e.g. "move the items to…" for a category.
 */
export default function DeleteDialog({
  target,
  onClose,
  onDelete,
  onDeleted,
  title = 'Delete permanently?',
  describe,
  renderExtra,
}) {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(null); // { message, links, consequence }
  const [params, setParams] = useState({});

  // Every opening starts at step one.
  useEffect(() => {
    if (target) {
      setLinked(null);
      setParams({});
      setBusy(false);
    }
  }, [target]);

  if (!target) return null;

  const isAdmin = user?.role === 'admin';
  const message =
    typeof describe === 'function'
      ? describe(target)
      : describe || 'This record will be deleted permanently. This cannot be undone.';

  const run = async (extraParams = {}) => {
    setBusy(true);
    try {
      const response = await onDelete(target, { ...params, ...extraParams });
      toast.success(response?.message || 'Deleted permanently.');
      onDeleted?.(target, response);
      onClose();
    } catch (error) {
      if (error?.code === 'HAS_LINKED_RECORDS' && error.errors) {
        setLinked({ message: error.message, ...error.errors });
      } else {
        toast.apiError(error, 'Could not delete this record.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Step two may be resolved another way than force - a category's items can
  // be moved instead - in which case the extra controls set `params` and the
  // plain delete is retried with them.
  const resolvedByParams = Object.values(params).some(Boolean);

  return (
    <Modal isOpen={Boolean(target)} onClose={busy ? undefined : onClose} size="sm" hideCloseButton>
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 pt-2 soft-in">
        <span
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ring-8',
            linked ? 'bg-danger-100 text-danger-700 ring-danger-50' : 'bg-danger-50 text-danger-600 ring-danger-50/60'
          )}
          aria-hidden="true"
        >
          {linked ? <ShieldAlert size={22} /> : <Trash2 size={22} />}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-display font-semibold text-navy-950">
            {linked ? 'This record is linked to others' : title}
          </h3>
          <Urdu className="block text-xs text-navy-500">
            {linked ? 'یہ ریکارڈ دوسرے ریکارڈز سے جڑا ہے' : 'مستقل طور پر حذف کریں؟'}
          </Urdu>

          {!linked && <p className="mt-1.5 text-sm text-navy-600 leading-relaxed">{message}</p>}

          {linked && (
            <div className="mt-2 space-y-3 text-left soft-in">
              <p className="text-sm text-navy-700">{linked.message}</p>

              <ul className="rounded-lg border border-danger-200 bg-danger-50/60 divide-y divide-danger-100">
                {(linked.links || []).map((link) => (
                  <li key={link.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-navy-700 capitalize">
                      <Link2 size={13} className="text-danger-500" />
                      {link.label}
                    </span>
                    <strong className="tabular text-danger-700">{link.count}</strong>
                  </li>
                ))}
              </ul>

              {linked.consequence && (
                <p className="text-xs text-navy-600 leading-relaxed">{linked.consequence}</p>
              )}

              {renderExtra?.(target, { linked, params, setParams })}

              {!isAdmin && (
                <p className="text-xs font-medium text-warning-700">
                  Only an administrator can delete a record together with its linked records.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalFooter className="mt-6">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep it
        </Button>

        {!linked && (
          <Button variant="danger" icon={Trash2} onClick={() => run()} isLoading={busy} loadingText="Deleting…">
            Delete permanently
          </Button>
        )}

        {linked && resolvedByParams && (
          <Button variant="gold" onClick={() => run()} isLoading={busy} loadingText="Working…">
            Continue
          </Button>
        )}

        {linked && isAdmin && linked.canForce !== false && !resolvedByParams && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => run({ force: true })}
            isLoading={busy}
            loadingText="Deleting…"
          >
            Delete everything
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
