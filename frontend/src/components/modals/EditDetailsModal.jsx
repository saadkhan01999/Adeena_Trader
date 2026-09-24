/**
 * ============================================
 * EditDetailsModal
 * ============================================
 * Correct the details of a posted sale, payment, purchase or return.
 *
 * Only the things that change no figure are editable - the payment method, a
 * reference number, an IMEI, a note. Amounts are deliberately not here: stock,
 * balances, the ledger and the wallet were all worked out from them, and the
 * honest way to fix a wrong amount is to cancel the record and enter it again.
 * The dialog says so, so nobody hunts for a field that is not there.
 */

import { useState, useEffect } from 'react';
import { Pencil, Save, Info } from 'lucide-react';

import Modal, { ModalFooter } from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input, Select, Textarea, FormRow } from '../common/Form.jsx';
import { saleService, paymentService, purchaseService, returnService } from '../../services/entities.js';
import { useToastStore } from '../../context/toastStore.js';
import { PAYMENT_METHODS } from '../../constants/index.js';

const KINDS = {
  sale: {
    service: saleService,
    key: 'sale',
    title: (r) => `Edit sale ${r.invoiceNumber || ''}`,
    fields: ['paymentMethod', 'notes'],
    items: true,
  },
  payment: {
    service: paymentService,
    key: 'payment',
    title: (r) => `Edit receipt ${r.receiptNumber || ''}`,
    fields: ['paymentMethod', 'referenceNumber', 'notes'],
  },
  purchase: {
    service: purchaseService,
    key: 'purchase',
    title: (r) => `Edit purchase ${r.invoiceNumber || ''}`,
    fields: ['paymentMethod', 'sourceName', 'sourcePhone', 'sourceLocation', 'notes'],
  },
  return: {
    service: returnService,
    key: 'return',
    title: (r) => `Edit return ${r.returnNumber || ''}`,
    fields: ['paymentMethod', 'reason'],
  },
};

const LABELS = {
  paymentMethod: 'Payment method',
  referenceNumber: 'Reference',
  notes: 'Notes',
  reason: 'Reason',
  sourceName: 'Bought from',
  sourcePhone: 'Phone',
  sourceLocation: 'Location',
};

/**
 * @param {object} props
 * @param {'sale'|'payment'|'purchase'|'return'} props.kind
 * @param {object|null} props.record  null = closed.
 * @param {Function} props.onClose
 * @param {Function} props.onSaved    (savedRecord) => void
 */
export default function EditDetailsModal({ kind, record, onClose, onSaved }) {
  const toast = useToastStore();
  const config = KINDS[kind];
  const [form, setForm] = useState({});
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setForm(Object.fromEntries(config.fields.map((f) => [f, record[f] ?? ''])));
    setItems(
      (record.items || []).map((item) => ({
        name: item.productName,
        imei1: item.imei1 || '',
        imei2: item.imei2 || '',
        serialNumber: item.serialNumber || '',
        warranty: item.warranty || '',
      }))
    );
  }, [record, config]);

  if (!record || !config) return null;

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, ...(config.items ? { items: items.map(({ name, ...rest }) => rest) } : {}) };
      const response = await config.service.update(record._id, payload);
      toast.success(response.message || 'Saved.');
      onSaved?.(response.data?.[config.key] || { ...record, ...form });
      onClose();
    } catch (error) {
      toast.apiError(error, 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(record)}
      onClose={onClose}
      title={config.title(record)}
      subtitle="Details only - amounts stay as recorded"
      icon={Pencil}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" icon={Save} onClick={save} isLoading={saving} loadingText="Saving…">
            Save changes
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <p className="flex gap-2 rounded-lg bg-info-50 border border-info-200 px-3 py-2 text-xs text-info-800">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          To change an amount, quantity or item, cancel this record and enter it again - that keeps stock and
          every balance correct.
        </p>

        {config.fields.map((field) =>
          field === 'paymentMethod' ? (
            <Select
              key={field}
              label={LABELS[field]}
              value={form[field] || 'cash'}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              options={PAYMENT_METHODS}
            />
          ) : field === 'notes' || field === 'reason' ? (
            <Textarea
              key={field}
              label={LABELS[field]}
              value={form[field] || ''}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              rows={2}
            />
          ) : (
            <Input
              key={field}
              label={LABELS[field]}
              value={form[field] || ''}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          )
        )}

        {config.items && items.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">Items - serial details</p>
            {items.map((item, index) => (
              <div key={index} className="rounded-xl border border-navy-100 p-3 space-y-2">
                <p className="text-sm font-semibold text-navy-900">{item.name}</p>
                <FormRow cols={2}>
                  <Input label="IMEI 1" value={item.imei1} onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, imei1: e.target.value } : it)))} />
                  <Input label="IMEI 2" value={item.imei2} onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, imei2: e.target.value } : it)))} />
                </FormRow>
                <FormRow cols={2}>
                  <Input label="Serial number" value={item.serialNumber} onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, serialNumber: e.target.value } : it)))} />
                  <Input label="Warranty" value={item.warranty} onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, warranty: e.target.value } : it)))} />
                </FormRow>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
