/**
 * ============================================
 * createListPage
 * ============================================
 * Builds a complete CRUD screen from a declarative config: list with search,
 * filters, sorting, pagination, CSV export and print, plus create, edit, view
 * and delete dialogs.
 *
 * Why a factory
 * -------------
 * Categories, Suppliers and Expenses are the same screen with different fields.
 * Writing each one by hand produces three subtly different search boxes, three
 * slightly different delete confirmations and three places to fix a bug.
 *
 * Screens with real behaviour of their own - Sales, Customers, Products,
 * Investors - are written directly instead, because forcing them through a
 * factory costs more than it saves.
 *
 * @example
 * export default createListPage({
 *   entityName: 'Supplier',
 *   entityNamePlural: 'Suppliers',
 *   collectionKey: 'suppliers',
 *   icon: Truck,
 *   service: supplierService,
 *   getInitialForm: () => ({ name: '', phone: '' }),
 *   renderForm: (form, setForm) => (<Input ... />),
 *   columns: ({ onEdit, onDelete }) => ([ ... ]),
 * });
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';

import PageHeader from './PageHeader.jsx';
import Button, { IconButton } from './Button.jsx';
import Modal, { ModalFooter } from './Modal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import EmptyState from './EmptyState.jsx';
import DataTable from './DataTable.jsx';
import { useToastStore } from '../../context/toastStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useTableState } from '../../hooks/index.js';

/**
 * @param {object} config
 * @param {string} config.entityName        Singular, e.g. "Supplier".
 * @param {string} config.entityNamePlural  Plural, e.g. "Suppliers".
 * @param {string} config.collectionKey     Key the API returns, e.g. "suppliers".
 * @param {React.ElementType} config.icon
 * @param {object} config.service           Must expose list/create/update/delete.
 * @param {Function} config.getInitialForm
 * @param {Function} config.renderForm      (form, setForm, context) => ReactNode
 * @param {Function} config.columns         ({ onEdit, onDelete, onView }) => Column[]
 * @param {Function} [config.renderDetail]  (record) => ReactNode
 * @param {Function} [config.renderSummary] (records, meta) => ReactNode
 * @param {Function} [config.renderFilters] (table) => ReactNode
 * @param {Function} [config.toPayload]     (form) => payload sent to the API
 * @param {string}   [config.permission]    Required to create/edit/delete.
 * @param {string}   [config.subtitle]
 * @param {string}   [config.searchPlaceholder]
 * @param {'md'|'lg'|'xl'} [config.formSize='lg']
 */
export function createListPage(config) {
  const {
    entityName,
    entityNamePlural,
    collectionKey,
    icon: Icon,
    service,
    getInitialForm,
    renderForm,
    columns: buildColumns,
    renderDetail,
    renderSummary,
    renderFilters,
    toPayload = (form) => form,
    permission,
    subtitle,
    searchPlaceholder,
    formSize = 'lg',
    initialFilters = {},
    initialSort = 'createdAt',
    onLoadExtras,
  } = config;

  return function GeneratedListPage() {
    const toast = useToastStore();
    const { hasPermission } = useAuthStore();

    const [records, setRecords] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [summary, setSummary] = useState(null);
    const [extras, setExtras] = useState({});
    const [loading, setLoading] = useState(true);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(getInitialForm());
    const [saving, setSaving] = useState(false);

    const [viewing, setViewing] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const table = useTableState({ initialSort, initialFilters });

    const canManage = !permission || hasPermission(permission);

    // ---- Load ---------------------------------------------------------
    const load = useCallback(async () => {
      setLoading(true);
      try {
        const response = await service.list(table.params);
        setRecords(response.data[collectionKey] || response.data.items || []);
        setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
        setSummary(response.data.summary || null);
      } catch (error) {
        toast.apiError(error, `Could not load ${entityNamePlural.toLowerCase()}.`);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table.params]);

    useEffect(() => { load(); }, [load]);

    // Supporting lists a form may need (partners for an expense, say)
    useEffect(() => {
      if (!onLoadExtras) return;
      onLoadExtras()
        .then(setExtras)
        .catch(() => setExtras({}));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Create / edit -------------------------------------------------
    const openCreate = () => {
      setEditing(null);
      setForm(getInitialForm());
      setFormOpen(true);
    };

    const openEdit = (record) => {
      setEditing(record);

      // Copy only the keys the form actually owns, so server-managed fields
      // (running totals, timestamps) are never posted back.
      const blank = getInitialForm();
      const populated = Object.keys(blank).reduce((acc, key) => {
        acc[key] = record[key] ?? blank[key];
        return acc;
      }, {});

      setForm(populated);
      setFormOpen(true);
    };

    const handleSubmit = async (event) => {
      event?.preventDefault();
      setSaving(true);

      try {
        const payload = toPayload(form);

        if (editing) {
          await service.update(editing._id, payload);
          toast.success(`${entityName} updated.`);
        } else {
          await service.create(payload);
          toast.success(`${entityName} added.`);
        }

        setFormOpen(false);
        load();
      } catch (error) {
        toast.apiError(error, `Could not save this ${entityName.toLowerCase()}.`);
      } finally {
        setSaving(false);
      }
    };

    // ---- Delete --------------------------------------------------------
    const handleDelete = async () => {
      setDeleting(true);
      try {
        const response = await service.delete(deleteTarget._id);
        // The API may soft-delete instead, and says so in its message
        toast.success(response?.message || `${entityName} deleted.`);
        setDeleteTarget(null);
        load();
      } catch (error) {
        toast.apiError(error, `Could not delete this ${entityName.toLowerCase()}.`);
      } finally {
        setDeleting(false);
      }
    };

    const columns = buildColumns({
      onEdit: openEdit,
      onDelete: setDeleteTarget,
      onView: setViewing,
      canManage,
      extras,
    });

    return (
      <div className="space-y-5">
        <PageHeader
          title={entityNamePlural}
          subtitle={
            subtitle ||
            `${pagination.total.toLocaleString('en-PK')} ${
              pagination.total === 1 ? entityName.toLowerCase() : entityNamePlural.toLowerCase()
            }`
          }
          icon={Icon}
          actions={
            canManage && (
              <Button variant="gold" icon={Plus} onClick={openCreate}>
                Add {entityName.toLowerCase()}
              </Button>
            )
          }
        />

        {renderSummary && summary && renderSummary(summary, { records, pagination })}

        <DataTable
          columns={columns}
          data={records}
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
          searchPlaceholder={searchPlaceholder || `Search ${entityNamePlural.toLowerCase()}…`}
          onRowClick={renderDetail ? setViewing : undefined}
          exportFilename={entityNamePlural.toLowerCase()}
          printable
          title={entityNamePlural}
          filters={renderFilters ? renderFilters(table, extras) : undefined}
          activeFilterCount={Object.values(table.filters).filter((v) => v && v !== 'all').length}
          onClearFilters={table.resetFilters}
          emptyState={
            <EmptyState
              icon={Icon}
              title={
                table.hasActiveFilters
                  ? `No matching ${entityNamePlural.toLowerCase()}`
                  : `No ${entityNamePlural.toLowerCase()} yet`
              }
              message={
                table.hasActiveFilters
                  ? 'Try clearing your search or filters.'
                  : `Add your first ${entityName.toLowerCase()} to get started.`
              }
              action={
                canManage && !table.hasActiveFilters ? (
                  <Button variant="gold" icon={Plus} onClick={openCreate}>
                    Add {entityName.toLowerCase()}
                  </Button>
                ) : null
              }
            />
          }
        />

        {/* ---- Create / edit ---- */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? `Edit ${entityName.toLowerCase()}` : `Add ${entityName.toLowerCase()}`}
          subtitle={editing?.name}
          icon={Icon}
          size={formSize}
          footer={
            <ModalFooter>
              <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="gold"
                onClick={handleSubmit}
                isLoading={saving}
                loadingText="Saving…"
              >
                {editing ? 'Save changes' : `Add ${entityName.toLowerCase()}`}
              </Button>
            </ModalFooter>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderForm(form, setForm, { editing, extras })}
            {/* Lets Enter submit from any field */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        </Modal>

        {/* ---- Detail ---- */}
        {renderDetail && (
          <Modal
            isOpen={Boolean(viewing)}
            onClose={() => setViewing(null)}
            title={viewing?.name || `${entityName} details`}
            icon={Icon}
            size="md"
            footer={
              <ModalFooter>
                <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
                {canManage && (
                  <Button
                    variant="gold"
                    icon={Pencil}
                    onClick={() => { const record = viewing; setViewing(null); openEdit(record); }}
                  >
                    Edit
                  </Button>
                )}
              </ModalFooter>
            }
          >
            {viewing && renderDetail(viewing, extras)}
          </Modal>
        )}

        {/* ---- Delete ---- */}
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isLoading={deleting}
          title={`Delete this ${entityName.toLowerCase()}?`}
          message={
            deleteTarget?.name
              ? `"${deleteTarget.name}" will be removed. Records that already reference it are kept.`
              : 'This record will be removed.'
          }
          confirmText="Delete"
        />
      </div>
    );
  };
}

/**
 * The standard edit/delete button pair for a row's action column.
 * Kept here so every generated screen shows the same controls in the same place.
 */
export function RowActions({ record, onEdit, onDelete, onView, canManage = true, extraActions }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {extraActions}

      {onView && (
        <IconButton
          icon={Eye}
          label="View details"
          size="icon-sm"
          onClick={(e) => { e.stopPropagation(); onView(record); }}
        />
      )}

      {canManage && onEdit && (
        <IconButton
          icon={Pencil}
          label="Edit"
          size="icon-sm"
          onClick={(e) => { e.stopPropagation(); onEdit(record); }}
        />
      )}

      {canManage && onDelete && (
        <IconButton
          icon={Trash2}
          label="Delete"
          size="icon-sm"
          className="text-danger-500 hover:bg-danger-50"
          onClick={(e) => { e.stopPropagation(); onDelete(record); }}
        />
      )}
    </div>
  );
}

export default createListPage;
