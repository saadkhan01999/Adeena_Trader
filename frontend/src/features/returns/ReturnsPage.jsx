/**
 * ============================================
 * Returns & Exchanges
 * ============================================
 * Goods coming back: a full return, a partial one, or an exchange for
 * something else.
 *
 * Recording a return puts the stock back and adjusts the customer's balance,
 * so the catalogue and the ledger stay in step without a manual correction.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCcw, Plus, Eye, Package, Banknote, ArrowLeftRight, Receipt, Trash2, Pencil,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import ReverseActions from '../../components/common/ReverseActions.jsx';
import EditDetailsModal from '../../components/modals/EditDetailsModal.jsx';
import { removeRow, replaceRow, prependRow } from '../../utils/rowMotion.js';
import { paymentMethodLabel } from '../../constants/index.js';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Select, Textarea, CurrencyInput, SearchSelect, RadioCards,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';

import { returnService, saleService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import { cn, formatCurrency, formatDate, parseNumber, toDateInput, sumBy } from '../../utils/index.js';
import { RETURN_TYPES, PAYMENT_METHODS } from '../../constants/index.js';

export default function ReturnsPage() {
  const toast = useToastStore();
  const { hasPermission } = useAuthStore();

  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  const table = useTableState({ initialSort: 'returnDate', initialFilters: { returnType: '' } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await returnService.list(table.params);
      setReturns(response.data.returns || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load returns.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      accessor: 'returnNumber',
      header: 'Return',
      sortable: true,
      primary: true,
      render: (item) => (
        <div>
          <p className="font-medium text-navy-950 tabular">{item.returnNumber}</p>
          <p className="text-2xs text-navy-500">{formatDate(item.returnDate)}</p>
        </div>
      ),
      exportValue: (item) => item.returnNumber,
    },
    {
      accessor: 'customerName',
      header: 'Customer',
      secondary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="text-sm text-navy-900 truncate">{item.customerName}</p>
          <p className="text-2xs text-navy-500 tabular">{item.invoiceNumber}</p>
        </div>
      ),
      exportValue: (item) => item.customerName,
    },
    {
      accessor: 'returnType',
      header: 'Type',
      render: (item) => (
        <Badge
          variant={item.returnType === 'exchange' ? 'info' : item.returnType === 'full' ? 'danger' : 'warning'}
          size="sm"
        >
          {item.returnType}
        </Badge>
      ),
      exportValue: (item) => item.returnType,
    },
    {
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (item) => (
        <span className="text-sm text-navy-700 line-clamp-1">
          {item.items?.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
        </span>
      ),
      exportValue: (item) => item.items?.map((i) => i.productName).join('; '),
    },
    {
      accessor: 'refundAmount',
      header: 'Refunded',
      align: 'right',
      sortable: true,
      render: (item) => <MoneyCell value={item.refundAmount} className="text-danger-600" showZero={false} />,
      exportValue: (item) => item.refundAmount,
    },
    {
      accessor: 'reason',
      header: 'Reason',
      hideOnMobile: true,
      render: (item) => <span className="text-sm text-navy-600 line-clamp-1">{item.reason}</span>,
      exportValue: (item) => item.reason,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Eye}
            label="View this return"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(item); }}
          />
          <ReverseActions
            record={item}
            label="return"
            cancelled={item.status === 'reversed'}
            onCancel={(id, reason) => returnService.reverse(id, reason)}
            onDelete={(id, reason, params) => returnService.delete(id, reason, params)}
            onDone={(action) => {
              if (action === 'delete') {
                removeRow(setReturns, item._id);
                setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
              } else {
                replaceRow(setReturns, { _id: item._id, status: 'reversed' });
              }
            }}
          />
          {hasPermission('returns') && item.status !== 'reversed' && (
            <IconButton
              icon={Pencil}
              label="Edit details"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); setEditing(item); }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="returns" />

      <PageHeader
        title="Returns & exchanges"
        subtitle={`${pagination.total.toLocaleString('en-PK')} return${pagination.total === 1 ? '' : 's'} recorded`}
        icon={RotateCcw}
        actions={
          hasPermission('returns') && (
            <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
              Record return
            </Button>
          )
        }
      />

      <StatGrid columns={3}>
        <StatCard
          label="Returns"
          value={pagination.total}
          icon={RotateCcw}
          variant="navy"
          isCurrency={false}
        />
        <StatCard
          label="Refunded (this page)"
          value={sumBy(returns, 'refundAmount')}
          icon={Banknote}
          variant="red"
          compact
        />
        <StatCard
          label="Exchanges"
          value={returns.filter((r) => r.returnType === 'exchange').length}
          icon={ArrowLeftRight}
          variant="blue"
          isCurrency={false}
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={returns}
        loading={loading}
        serverSide
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        searchValue={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search by return number, customer or invoice…"
        onRowClick={setViewing}
        exportFilename="returns"
        printable
        title="Returns"
        activeFilterCount={table.filters.returnType ? 1 : 0}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={2}>
            <Select
              label="Type"
              value={table.filters.returnType}
              onChange={(e) => table.setFilter('returnType', e.target.value)}
              placeholder="All types"
              options={RETURN_TYPES}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={RotateCcw}
            title="No returns yet"
            message="Returns and exchanges recorded against a sale will appear here."
            action={
              hasPermission('returns') ? (
                <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
                  Record a return
                </Button>
              ) : null
            }
          />
        }
      />

      <NewReturnModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={(created) => {
          setFormOpen(false);
          if (created?._id) {
            prependRow(setReturns, created);
            setPagination((p) => ({ ...p, total: p.total + 1 }));
          } else {
            load();
          }
        }}
      />

      <ReturnDetailModal
        returnRecord={viewing}
        onClose={() => setViewing(null)}
        onEdit={hasPermission('returns') ? (record) => { setViewing(null); setEditing(record); } : undefined}
      />

      <EditDetailsModal
        kind="return"
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => replaceRow(setReturns, saved)}
      />
    </div>
  );
}

/* ============================================================================
 * New return
 * ========================================================================== */

function NewReturnModal({ isOpen, onClose, onSuccess }) {
  const toast = useToastStore();

  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sale: '',
    returnType: 'partial',
    items: [],
    refundAmount: '',
    paymentMethod: 'cash',
    reason: '',
    returnDate: toDateInput(new Date()),
  });

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      sale: '', returnType: 'partial', items: [], refundAmount: '',
      paymentMethod: 'cash', reason: '', returnDate: toDateInput(new Date()),
    });
    setSelectedSale(null);

    // Only completed and ongoing sales can be returned against
    saleService
      .list({ limit: 200, sortBy: 'saleDate', sortOrder: 'desc' })
      .then((response) => {
        setSales((response.data.sales || []).filter((s) => s.status !== 'cancelled'));
      })
      .catch((error) => toast.apiError(error, 'Could not load sales.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const chooseSale = (saleId) => {
    const sale = sales.find((s) => s._id === saleId);
    setSelectedSale(sale);
    setForm((current) => ({
      ...current,
      sale: saleId,
      // Pre-populate with everything on the invoice; the user deselects what
      // is staying, which is faster than adding items one at a time.
      items: (sale?.items || []).map((item) => ({
        product: item.product?._id || item.product,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        selected: false,
      })),
    }));
  };

  const selectedItems = useMemo(() => form.items.filter((item) => item.selected), [form.items]);

  const suggestedRefund = useMemo(
    () => selectedItems.reduce((sum, item) => sum + parseNumber(item.price) * parseNumber(item.quantity), 0),
    [selectedItems]
  );

  // Keep the refund box in step with the selection until the user edits it
  useEffect(() => {
    setForm((current) => ({ ...current, refundAmount: String(suggestedRefund || '') }));
  }, [suggestedRefund]);

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.sale) { toast.warning('Choose the invoice being returned against.'); return; }
    if (selectedItems.length === 0) { toast.warning('Select at least one item.'); return; }
    if (!form.reason.trim()) { toast.warning('Give a reason for the return.'); return; }

    setSaving(true);
    try {
      const response = await returnService.create({
        sale: form.sale,
        returnType: form.returnType,
        items: selectedItems.map((item) => ({
          product: item.product,
          productName: item.productName,
          quantity: parseNumber(item.quantity),
          price: parseNumber(item.price),
        })),
        refundAmount: parseNumber(form.refundAmount),
        paymentMethod: form.paymentMethod,
        reason: form.reason,
        returnDate: form.returnDate,
      });

      toast.success('Return recorded and stock restored.');
      onSuccess?.(response.data?.return);
    } catch (error) {
      toast.apiError(error, 'Could not record the return.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record a return"
      subtitle="Stock goes back and the customer's balance is adjusted"
      icon={RotateCcw}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="gold"
            onClick={handleSubmit}
            isLoading={saving}
            loadingText="Recording…"
            disabled={selectedItems.length === 0}
          >
            Record return
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Which sale?" icon={Receipt}>
          <SearchSelect
            label="Invoice"
            required
            value={form.sale}
            onChange={chooseSale}
            options={sales.map((sale) => ({
              value: sale._id,
              label: sale.invoiceNumber,
              sublabel: sale.customerName,
              meta: formatCurrency(sale.grandTotal),
            }))}
            placeholder="Search by invoice number or customer"
            emptyMessage="No matching invoice."
          />

          {selectedSale && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-navy-50 border border-navy-100 p-3 animate-fade-in">
              <FieldDisplay label="Customer" value={selectedSale.customerName} />
              <FieldDisplay label="Sold on" value={formatDate(selectedSale.saleDate)} />
              <FieldDisplay label="Value" value={formatCurrency(selectedSale.grandTotal)} mono />
              <FieldDisplay label="Type" value={selectedSale.saleType} />
            </div>
          )}
        </FormSection>

        {selectedSale && (
          <>
            <FormSection title="What is coming back?" icon={Package}>
              <RadioCards
                label="Return type"
                options={RETURN_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                value={form.returnType}
                onChange={(value) => setForm({ ...form, returnType: value })}
                columns={3}
              />

              <ul className="space-y-2">
                {form.items.map((item, index) => (
                  <li
                    key={index}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      item.selected ? 'border-gold-300 bg-gold-50/40' : 'border-navy-200'
                    )}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: form.items.map((it, i) =>
                              i === index ? { ...it, selected: e.target.checked } : it
                            ),
                          })
                        }
                        className="checkbox mt-1"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-navy-950 truncate">
                              {item.productName}
                            </p>
                            <p className="text-2xs text-navy-500 tabular">
                              Sold: {item.quantity} × {formatCurrency(item.price)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-navy-950 tabular flex-shrink-0">
                            {formatCurrency(parseNumber(item.price) * parseNumber(item.quantity))}
                          </span>
                        </div>

                        {item.selected && (
                          <div className="mt-2.5 max-w-[150px]">
                            <Input
                              label="Quantity returned"
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={item.quantity}
                              onClick={(e) => e.preventDefault()}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  items: form.items.map((it, i) =>
                                    i === index
                                      ? { ...it, quantity: Math.min(parseNumber(e.target.value), it.quantity) }
                                      : it
                                  ),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </FormSection>

            <FormSection title="Refund" icon={Banknote}>
              <FormRow cols={2}>
                <CurrencyInput
                  label="Refund amount"
                  value={form.refundAmount}
                  onChange={(e) => setForm({ ...form, refundAmount: e.target.value })}
                  hint={
                    suggestedRefund > 0
                      ? `Value of the selected items: ${formatCurrency(suggestedRefund)}`
                      : undefined
                  }
                />
                <Select
                  label="Refunded by"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  options={PAYMENT_METHODS}
                />
              </FormRow>

              <FormRow cols={2}>
                <Input
                  label="Return date"
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                  max={toDateInput(new Date())}
                />
              </FormRow>

              <Textarea
                label="Reason"
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={2}
                placeholder="e.g. Faulty screen, customer changed their mind"
                maxLength={300}
              />
            </FormSection>
          </>
        )}

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function ReturnDetailModal({ returnRecord, onClose, onEdit }) {
  if (!returnRecord) return null;

  return (
    <Modal
      isOpen={Boolean(returnRecord)}
      onClose={onClose}
      title={returnRecord.returnNumber}
      subtitle={`${returnRecord.customerName} · ${formatDate(returnRecord.returnDate)}`}
      icon={RotateCcw}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {onEdit && returnRecord.status !== 'reversed' && (
            <Button variant="gold" icon={Pencil} onClick={() => onEdit(returnRecord)}>Edit details</Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Original invoice" value={returnRecord.invoiceNumber} mono />
          <FieldDisplay label="Type" value={returnRecord.returnType} />
          <FieldDisplay label="Refunded" value={formatCurrency(returnRecord.refundAmount)} mono />
          <FieldDisplay label="Method" value={paymentMethodLabel(returnRecord.paymentMethod)} />
        </div>

        <div>
          <p className="label">Items returned</p>
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden">
            {returnRecord.items?.map((item, index) => (
              <li key={index} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-navy-900 truncate">{item.productName}</p>
                  <p className="text-2xs text-navy-500 tabular">
                    {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>
                {item.exchangeProductName && (
                  <span className="text-2xs text-info-600">→ {item.exchangeProductName}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <FieldDisplay label="Reason" value={returnRecord.reason} />
      </div>
    </Modal>
  );
}
