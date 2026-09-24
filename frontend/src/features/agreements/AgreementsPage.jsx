/**
 * ============================================
 * Agreements
 * ============================================
 * Every legal document the business has issued: installment sale agreements,
 * investment agreements and partnership agreements.
 *
 * Lifecycle
 * ---------
 *   issued  → printed and given to the counterparty
 *   signed  → executed; the wording is frozen from this point
 *   active  → in force
 *   cancelled → superseded, with a recorded reason
 *
 * An unsigned agreement can be regenerated against the current template. A
 * signed one cannot: the words that were agreed must stay as they were.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileSignature, Eye, Printer, PenLine, RefreshCw, Ban, Paperclip,
  Users, BriefcaseBusiness, UsersRound, FileText, Check, Upload, Trash2,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import DeleteDialog from '../../components/common/DeleteDialog.jsx';
import { removeRow, replaceRow } from '../../utils/rowMotion.js';
import EmptyState from '../../components/common/EmptyState.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import { Input, Select, Textarea, FormRow, FieldDisplay } from '../../components/common/Form.jsx';
import DocumentPreviewModal from '../../components/modals/DocumentPreviewModal.jsx';

import { agreementService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import {
  cn, formatCurrency, formatDate, toDateInput, resolveFileUrl, isPdf,
} from '../../utils/index.js';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_META, AGREEMENT_STATUSES } from '../../constants/index.js';

const TYPE_ICONS = {
  [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: Users,
  [DOCUMENT_TYPES.INVESTOR_AGREEMENT]: BriefcaseBusiness,
  [DOCUMENT_TYPES.PARTNER_AGREEMENT]: UsersRound,
};

export default function AgreementsPage() {
  const toast = useToastStore();
  const { isManagerOrAbove, isAdmin } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  // The API restricts cancelling to admin and manager (agreement.routes.js);
  // isManagerOrAbove is exactly that test, and is already in scope.
  const canCancel = isManagerOrAbove();

  const [agreements, setAgreements] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [typeTab, setTypeTab] = useState('all');
  const [preview, setPreview] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [signTarget, setSignTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const table = useTableState({
    initialSort: 'agreementDate',
    initialFilters: { status: '', startDate: '', endDate: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await agreementService.list({
        ...table.params,
        ...(typeTab !== 'all' ? { type: typeTab } : {}),
      });
      setAgreements(response.data.agreements || []);
      setSummary(response.data.summary || {});
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load agreements.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params, typeTab]);

  useEffect(() => { load(); }, [load]);

  const openPreview = async (agreement) => {
    try {
      const response = await agreementService.get(agreement._id);
      setPreview(response.data);
    } catch (error) {
      toast.apiError(error, 'Could not open that agreement.');
    }
  };

  const handleRegenerate = async (agreement) => {
    try {
      const response = await agreementService.regenerate(agreement._id);
      toast.success('Agreement regenerated from the current template.');
      if (response.data?.agreement) replaceRow(setAgreements, response.data.agreement);
      else load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.warning('A reason is required when cancelling an agreement.');
      return;
    }
    try {
      await agreementService.cancel(cancelTarget._id, cancelReason);

      // Patch the row rather than reloading the page, matching every other
      // screen: the API has just told us what changed.
      replaceRow(setAgreements, { _id: cancelTarget._id, status: 'cancelled' });

      toast.success('Agreement cancelled.');
      setCancelTarget(null);
      setCancelReason('');
    } catch (error) {
      toast.apiError(error);
    }
  };

  const typeTabs = [
    { id: 'all', label: 'All', icon: FileSignature },
    ...Object.entries(DOCUMENT_TYPE_META)
      .filter(([type]) => type.endsWith('_agreement'))
      .map(([type, meta]) => ({
        id: type,
        label: meta.label.replace(' Agreement', ''),
        icon: TYPE_ICONS[type] || FileText,
        count: summary[type]?.count,
      })),
  ];

  const columns = [
    {
      accessor: 'agreementNumber',
      header: 'Agreement',
      sortable: true,
      primary: true,
      render: (agreement) => {
        const Icon = TYPE_ICONS[agreement.type] || FileText;
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-50 text-navy-600 flex-shrink-0">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-navy-950 tabular truncate">{agreement.agreementNumber}</p>
              <p className="text-2xs text-navy-500">{formatDate(agreement.agreementDate)}</p>
            </div>
          </div>
        );
      },
      exportValue: (agreement) => agreement.agreementNumber,
    },
    {
      accessor: 'partyName',
      header: 'Party',
      sortable: true,
      secondary: true,
      render: (agreement) => (
        <div className="min-w-0">
          <p className="text-sm text-navy-900 truncate">{agreement.partyName}</p>
          <p className="text-2xs text-navy-500 tabular">{agreement.partyCnic || agreement.partyPhone}</p>
        </div>
      ),
      exportValue: (agreement) => agreement.partyName,
    },
    {
      accessor: 'type',
      header: 'Type',
      hideOnMobile: true,
      render: (agreement) => (
        <span className="text-sm text-navy-700">
          {DOCUMENT_TYPE_META[agreement.type]?.label || agreement.type}
        </span>
      ),
      exportValue: (agreement) => DOCUMENT_TYPE_META[agreement.type]?.label,
    },
    {
      accessor: 'principalAmount',
      header: 'Value',
      align: 'right',
      sortable: true,
      render: (agreement) => <MoneyCell value={agreement.principalAmount} />,
      exportValue: (agreement) => agreement.principalAmount,
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (agreement) => (
        <Badge variant={AGREEMENT_STATUSES[agreement.status]?.color || 'neutral'} size="sm">
          {AGREEMENT_STATUSES[agreement.status]?.label || agreement.status}
        </Badge>
      ),
      exportValue: (agreement) => agreement.status,
    },
    {
      key: 'attachments',
      header: 'Signed copy',
      align: 'center',
      hideOnMobile: true,
      render: (agreement) =>
        agreement.attachments?.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-2xs text-success-700">
            <Paperclip size={11} /> {agreement.attachments.length}
          </span>
        ) : (
          <span className="text-navy-300">—</span>
        ),
      exportValue: (agreement) => agreement.attachments?.length || 0,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (agreement) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Printer}
            label="Preview and print"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); openPreview(agreement); }}
          />
          <IconButton
            icon={Eye}
            label="View details"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(agreement); }}
          />
          {agreement.status === 'issued' && (
            <IconButton
              icon={PenLine}
              label="Mark as signed"
              size="icon-sm"
              className="text-success-600 hover:bg-success-50"
              onClick={(e) => { e.stopPropagation(); setSignTarget(agreement); }}
            />
          )}

          {/* Cancelling is restricted to admin and manager by the API, so the
              button is hidden from everyone else rather than offered and then
              refused. An already-cancelled agreement has nothing to cancel. */}
          {canCancel && agreement.status !== 'cancelled' && (
            <IconButton
              icon={Ban}
              label="Cancel this agreement"
              size="icon-sm"
              className="text-danger-500 hover:bg-danger-50"
              onClick={(e) => { e.stopPropagation(); setCancelTarget(agreement); }}
            />
          )}

          {/* Permanent delete - for one issued by mistake. Administrators only;
              cancelling is the right choice for anything a customer has seen. */}
          {isAdmin() && (
            <IconButton
              icon={Trash2}
              label="Delete this agreement permanently"
              size="icon-sm"
              className="text-danger-600 hover:bg-danger-50"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(agreement); }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="agreements" />

      <PageHeader
        title="Agreements"
        subtitle="Installment, investment and partnership agreements issued by the business"
        icon={FileSignature}
      />

      <StatGrid columns={4}>
        <StatCard
          label="Total issued"
          value={pagination.total}
          icon={FileSignature}
          variant="navy"
          isCurrency={false}
        />
        {Object.entries(DOCUMENT_TYPE_META)
          .filter(([type]) => type.endsWith('_agreement'))
          .map(([type, meta]) => (
            <StatCard
              key={type}
              label={meta.label.replace(' Agreement', '')}
              value={summary[type]?.value || 0}
              icon={TYPE_ICONS[type] || FileText}
              variant={type === DOCUMENT_TYPES.INSTALLMENT_AGREEMENT ? 'gold' : 'blue'}
              compact
              subtitle={`${summary[type]?.count || 0} agreement(s)`}
            />
          ))}
      </StatGrid>

      <Tabs tabs={typeTabs} active={typeTab} onChange={setTypeTab} />

      <DataTable
        columns={columns}
        data={agreements}
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
        searchPlaceholder="Search by agreement number, party or CNIC…"
        onRowClick={setViewing}
        exportFilename="agreements"
        printable
        title="Agreements"
        activeFilterCount={Object.values(table.filters).filter(Boolean).length}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={3}>
            <Select
              label="Status"
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
              placeholder="All statuses"
              options={Object.entries(AGREEMENT_STATUSES).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
            <Input
              label="From"
              type="date"
              value={table.filters.startDate}
              onChange={(e) => table.setFilter('startDate', e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={table.filters.endDate}
              onChange={(e) => table.setFilter('endDate', e.target.value)}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={FileSignature}
            title="No agreements yet"
            message="Installment agreements are issued automatically with installment sales. Investment and partnership agreements are issued from their own screens."
          />
        }
      />

      <AgreementDetailModal
        agreement={viewing}
        onClose={() => setViewing(null)}
        onPrint={(agreement) => { setViewing(null); openPreview(agreement); }}
        onSign={(agreement) => { setViewing(null); setSignTarget(agreement); }}
        onRegenerate={handleRegenerate}
        onCancel={(agreement) => { setViewing(null); setCancelTarget(agreement); }}
        onAttached={load}
        canManage={isManagerOrAbove()}
      />

      <SignModal
        agreement={signTarget}
        onClose={() => setSignTarget(null)}
        onSuccess={(signed) => {
          setSignTarget(null);
          if (signed?._id) replaceRow(setAgreements, signed);
          else load();
        }}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this agreement permanently?"
        describe={(agreement) =>
          `Agreement ${agreement.agreementNumber} with ${agreement.partyName} will be removed completely, with its attached files. ` +
          'To keep a record of it instead, cancel it.'
        }
        onDelete={(agreement) => agreementService.deletePermanently(agreement._id)}
        onDeleted={(agreement) => {
          removeRow(setAgreements, agreement._id);
          setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
        }}
      />

      <DocumentPreviewModal
        isOpen={Boolean(preview)}
        onClose={() => setPreview(null)}
        type="agreement"
        data={preview?.agreement}
        business={preview?.business || business}
        sharePhone={preview?.agreement?.partyPhone}
        shareMessage={
          preview?.agreement
            ? `Agreement ${preview.agreement.agreementNumber} — ${preview.agreement.title}`
            : ''
        }
      />

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title="Cancel this agreement"
        subtitle={cancelTarget?.agreementNumber}
        icon={Ban}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
              Keep it
            </Button>
            <Button variant="danger" icon={Ban} onClick={handleCancel} disabled={!cancelReason.trim()}>
              Cancel agreement
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-navy-600 mb-3 leading-relaxed">
          The agreement stays on record with its reason, so the history is preserved. Issue a
          replacement afterwards if one is needed.
        </p>
        <Textarea
          label="Reason for cancelling"
          required
          autoFocus
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
          placeholder="e.g. Superseded by a revised plan agreed on 16 Sep 2026"
        />
      </Modal>
    </div>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function AgreementDetailModal({
  agreement, onClose, onPrint, onSign, onRegenerate, onCancel, onAttached, canManage,
}) {
  const toast = useToastStore();
  const [uploading, setUploading] = useState(false);

  if (!agreement) return null;

  const isSigned = ['signed', 'active', 'completed'].includes(agreement.status);

  const handleAttach = async (files) => {
    setUploading(true);
    try {
      await agreementService.addAttachments(agreement._id, files, 'Signed copy');
      toast.success('Signed copy attached.');
      onAttached?.();
      onClose?.();
    } catch (error) {
      toast.apiError(error, 'Could not attach that file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(agreement)}
      onClose={onClose}
      title={agreement.agreementNumber}
      subtitle={agreement.title}
      icon={FileSignature}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>

          {!isSigned && canManage && (
            <Button variant="secondary" icon={RefreshCw} onClick={() => onRegenerate(agreement)}>
              Regenerate
            </Button>
          )}

          {agreement.status === 'issued' && (
            <Button variant="success" icon={Check} onClick={() => onSign(agreement)}>
              Mark as signed
            </Button>
          )}

          <Button variant="gold" icon={Printer} onClick={() => onPrint(agreement)}>
            Print
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={AGREEMENT_STATUSES[agreement.status]?.color || 'neutral'}>
            {AGREEMENT_STATUSES[agreement.status]?.label}
          </Badge>
          <Badge variant="neutral">{DOCUMENT_TYPE_META[agreement.type]?.label}</Badge>
          {isSigned && (
            <span className="text-2xs text-navy-500">
              Wording is frozen — a signed agreement cannot be regenerated
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Party" value={agreement.partyName} />
          <FieldDisplay label="CNIC" value={agreement.partyCnic} mono />
          <FieldDisplay label="Phone" value={agreement.partyPhone} mono />
          <FieldDisplay label="Agreement date" value={formatDate(agreement.agreementDate)} />

          {agreement.type === DOCUMENT_TYPES.INSTALLMENT_AGREEMENT && (
            <>
              <FieldDisplay label="Sale value" value={formatCurrency(agreement.principalAmount)} mono />
              <FieldDisplay label="Advance" value={formatCurrency(agreement.advanceAmount)} mono />
              <FieldDisplay label="Plan" value={`${agreement.installmentPlan} months`} />
              <FieldDisplay
                label="Monthly"
                value={formatCurrency(agreement.monthlyInstallment)}
                mono
              />
              <FieldDisplay label="Guarantor" value={agreement.guarantorName} />
              <FieldDisplay label="First due" value={formatDate(agreement.firstDueDate)} />
            </>
          )}

          {agreement.type === DOCUMENT_TYPES.INVESTOR_AGREEMENT && (
            <>
              <FieldDisplay label="Capital" value={formatCurrency(agreement.principalAmount)} mono />
              <FieldDisplay label="Profit share" value={`${agreement.profitPercentage}%`} />
              <FieldDisplay
                label="Basis"
                value={agreement.profitCalculationMethod?.replace(/_/g, ' ')}
              />
            </>
          )}

          {agreement.type === DOCUMENT_TYPES.PARTNER_AGREEMENT && (
            <>
              <FieldDisplay label="Capital" value={formatCurrency(agreement.principalAmount)} mono />
              <FieldDisplay label="Ownership" value={`${agreement.ownershipPercentage}%`} />
            </>
          )}
        </div>

        {agreement.signedAt && (
          <div className="rounded-lg bg-success-50 border border-success-200 p-3">
            <p className="text-xs text-success-800">
              Signed on {formatDate(agreement.signedAt)}
              {agreement.signedBy ? ` by ${agreement.signedBy}` : ''}
            </p>
          </div>
        )}

        {agreement.status === 'cancelled' && (
          <div className="rounded-lg bg-danger-50 border border-danger-200 p-3">
            <p className="text-xs font-semibold text-danger-800">
              Cancelled on {formatDate(agreement.cancelledAt)}
            </p>
            <p className="text-2xs text-danger-700 mt-0.5">{agreement.cancellationReason}</p>
          </div>
        )}

        {/* Clauses */}
        {agreement.clauses?.length > 0 && (
          <div>
            <p className="label">Terms ({agreement.clauses.length} clauses)</p>
            <ol className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin rounded-lg border border-navy-200 p-3">
              {agreement.clauses.map((clause, index) => (
                <li key={index} className="flex gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    {clause.title && (
                      <p className="text-xs font-semibold text-navy-900">{clause.title}</p>
                    )}
                    <p className="text-2xs text-navy-600 leading-relaxed">{clause.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Attachments */}
        <div>
          <p className="label">Scanned signed copy</p>

          {agreement.attachments?.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {agreement.attachments.map((attachment, index) => (
                <a
                  key={index}
                  href={resolveFileUrl(attachment.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-navy-200 overflow-hidden hover:border-gold-400 transition-colors aspect-square flex flex-col items-center justify-center gap-1 p-2 bg-navy-50"
                >
                  {isPdf(attachment.url) ? (
                    <>
                      <FileText size={22} className="text-danger-500" />
                      <span className="text-2xs text-navy-600 text-center line-clamp-2 break-all">
                        {attachment.name || 'PDF'}
                      </span>
                    </>
                  ) : (
                    <img
                      src={resolveFileUrl(attachment.url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </a>
              ))}
            </div>
          )}

          <label className="btn-secondary btn w-full justify-center cursor-pointer">
            <Upload size={15} />
            {uploading ? 'Uploading…' : 'Attach the signed copy'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.length && handleAttach(e.target.files)}
            />
          </label>
        </div>

        {canManage && agreement.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => onCancel(agreement)}
            className="text-2xs font-medium text-danger-600 hover:text-danger-700 transition-colors"
          >
            Cancel this agreement
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================================
 * Sign
 * ========================================================================== */

function SignModal({ agreement, onClose, onSuccess }) {
  const toast = useToastStore();
  const [form, setForm] = useState({ signedAt: toDateInput(new Date()), signedBy: '', witnesses: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agreement) {
      setForm({
        signedAt: toDateInput(new Date()),
        signedBy: agreement.partyName || '',
        witnesses: agreement.witnesses?.length
          ? agreement.witnesses
          : [{ name: '', cnic: '', phone: '' }, { name: '', cnic: '', phone: '' }],
      });
    }
  }, [agreement]);

  if (!agreement) return null;

  const updateWitness = (index, patch) => {
    setForm((current) => ({
      ...current,
      witnesses: current.witnesses.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setSaving(true);
    try {
      const response = await agreementService.sign(agreement._id, {
        signedAt: form.signedAt,
        signedBy: form.signedBy,
        // Drop blank witness rows rather than storing empty objects
        witnesses: form.witnesses.filter((w) => w.name?.trim()),
      });
      toast.success('Agreement marked as signed.');
      onSuccess?.(response.data?.agreement);
    } catch (error) {
      toast.apiError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(agreement)}
      onClose={onClose}
      title="Mark as signed"
      subtitle={agreement.agreementNumber}
      icon={PenLine}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="success" icon={Check} onClick={handleSubmit} isLoading={saving}>
            Confirm signed
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600 leading-relaxed">
          Once signed, the wording of this agreement is frozen and can no longer be regenerated
          from the template.
        </p>

        <FormRow cols={2}>
          <Input
            label="Signed on"
            type="date"
            required
            value={form.signedAt}
            onChange={(e) => setForm({ ...form, signedAt: e.target.value })}
            max={toDateInput(new Date())}
          />
          <Input
            label="Signed by"
            value={form.signedBy}
            onChange={(e) => setForm({ ...form, signedBy: e.target.value })}
          />
        </FormRow>

        <div>
          <p className="label">Witnesses</p>
          <p className="text-2xs text-navy-500 mb-2">
            Two witnesses are normal practice for an agreement of this kind.
          </p>

          <div className="space-y-2.5">
            {form.witnesses.map((witness, index) => (
              <div key={index} className="rounded-lg border border-navy-200 p-2.5">
                <p className="text-2xs font-semibold text-navy-500 mb-2">Witness {index + 1}</p>
                <FormRow cols={3}>
                  <Input
                    label="Name"
                    value={witness.name}
                    onChange={(e) => updateWitness(index, { name: e.target.value })}
                  />
                  <Input
                    label="CNIC"
                    value={witness.cnic}
                    onChange={(e) => updateWitness(index, { cnic: e.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={witness.phone}
                    onChange={(e) => updateWitness(index, { phone: e.target.value })}
                  />
                </FormRow>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
