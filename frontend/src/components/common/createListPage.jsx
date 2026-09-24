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
import { Plus, Pencil, Trash2, Eye, LayoutGrid, List } from 'lucide-react';

import PageHeader from './PageHeader.jsx';
import Button, { IconButton } from './Button.jsx';
import Modal, { ModalFooter } from './Modal.jsx';
import DeleteDialog from './DeleteDialog.jsx';
import EmptyState from './EmptyState.jsx';
import DataTable from './DataTable.jsx';
import TabGuide from './TabGuide.jsx';
import { useToastStore } from '../../context/toastStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useTableState, useCreateFromQuery } from '../../hooks/index.js';
import { cn } from '../../utils/index.js';
import { cacheKey, readList, writeList, clearList } from '../../utils/listCache.js';
import { removeRow, replaceRow, prependRow } from '../../utils/rowMotion.js';

/**
 * Pull the saved record out of a create/update response.
 *
 * The API answers with a singular key that varies by endpoint - { category },
 * { supplier }, { expense } - so rather than making every screen declare its
 * own, this finds the first value that looks like a saved document. A record
 * always carries an `_id`; nothing else in these payloads does.
 *
 * Returns null when there is nothing recognisable, which is the signal to fall
 * back to a reload rather than guess.
 */
const pickRecord = (response, explicitKey) => {
  const data = response?.data;
  if (!data || typeof data !== 'object') return null;

  if (explicitKey) return data[explicitKey] || null;

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value._id) return value;
  }
  return null;
};

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
 * @param {Function} [config.renderCard]  (record, actions) => ReactNode. When
 *   given, the screen offers a card grid alongside the table.
 * @param {string}   [config.guideId]   Key into GUIDES for the how-to panel.
 * @param {string}   [config.recordKey] Singular response key, if auto-detection fails.
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
    guideId,
    recordKey,
    renderCard,
    /** (record) => string - the first-step delete message. */
    describeDelete,
    /** Extra controls for the linked-records step - see DeleteDialog. */
    renderDeleteExtra,
    /** (record, context) => node - extra actions in the detail modal footer. */
    renderDetailActions,
    /** Called after any create/update/delete, e.g. to refresh summary cards. */
    onChanged,
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

    // Card view is offered only where the screen supplies a card. It is not
    // persisted per screen: these lists are short, and a remembered preference
    // on a screen visited once a month is a surprise rather than a convenience.
    const [view, setView] = useState('table');
    const [deleteTarget, setDeleteTarget] = useState(null);

    const table = useTableState({ initialSort, initialFilters });

    const canManage = !permission || hasPermission(permission);

    // ---- Load ---------------------------------------------------------
    const load = useCallback(async () => {
      const key = cacheKey(collectionKey, table.params);

      // Paint whatever this screen showed last, in the same frame it mounts,
      // then refresh behind it. Returning to a tab previously meant a skeleton
      // and a wait for a request whose answer had not changed.
      const cached = readList(key);
      if (cached) {
        setRecords(cached.records);
        setPagination(cached.pagination);
        setSummary(cached.summary);
      }

      // `loading` still goes true - the table shows a hairline over existing
      // rows rather than a skeleton, so this is a progress hint, not a blank.
      setLoading(true);
      try {
        const response = await service.list(table.params);
        const records = response.data[collectionKey] || response.data.items || [];
        const pagination = response.data.pagination || { page: 1, totalPages: 1, total: 0 };
        const summary = response.data.summary || null;

        setRecords(records);
        setPagination(pagination);
        setSummary(summary);
        writeList(key, { records, pagination, summary });
      } catch (error) {
        // With rows already on screen from the cache, a failed refresh is a
        // quiet warning rather than an error that replaces what is being read.
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

    // The top bar's quick-create menu arrives with ?new=1.
    useCreateFromQuery(canManage ? openCreate : null);

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
          const response = await service.update(editing._id, payload);
          const saved = pickRecord(response, recordKey);

          // Patch the row in place. Refetching the whole page here is what made
          // the table blank and rebuild after every edit - the "refreshing"
          // the shop staff complained about. The server has just told us
          // exactly what the record now looks like, so there is nothing left
          // to go and ask it.
          replaceRow(setRecords, { ...(saved || payload), _id: editing._id });
          toast.success(`${entityName} updated.`);
        } else {
          const response = await service.create(payload);
          const created = pickRecord(response, recordKey);

          if (created) {
            // Newest first, matching the default sort.
            prependRow(setRecords, created);
            setPagination((p) => ({ ...p, total: p.total + 1 }));
          } else {
            // The response shape was not recognisable - reloading is the only
            // way to stay truthful about what was actually saved.
            load();
          }
          toast.success(`${entityName} added.`);
        }

        clearList(collectionKey);
        setFormOpen(false);
        onChanged?.({ reload: load, setSummary });
      } catch (error) {
        toast.apiError(error, `Could not save this ${entityName.toLowerCase()}.`);
      } finally {
        setSaving(false);
      }
    };

    // ---- Delete --------------------------------------------------------
    // The row slides out in place; nothing reloads. A record with linked
    // records gets DeleteDialog's second step before anything is removed.
    const handleDeleted = (record) => {
      removeRow(setRecords, record._id);
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
      clearList(collectionKey);
      onChanged?.({ reload: load, setSummary });
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
        {guideId && <TabGuide id={guideId} />}

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
            <>
              {renderCard && (
                <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
                  {[
                    { id: 'table', icon: List, label: 'Table view' },
                    { id: 'grid', icon: LayoutGrid, label: 'Card view' },
                  ].map(({ id, icon: ViewIcon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setView(id)}
                      title={label}
                      aria-label={label}
                      aria-pressed={view === id}
                      className={cn(
                        'p-2 transition-colors',
                        view === id
                          ? 'bg-ink-950 text-gold-400'
                          : 'bg-white text-ink-500 hover:bg-ink-50'
                      )}
                    >
                      <ViewIcon size={16} />
                    </button>
                  ))}
                </div>
              )}

              {canManage && (
                <Button variant="gold" icon={Plus} onClick={openCreate}>
                  Add {entityName.toLowerCase()}
                </Button>
              )}
            </>
          }
        />

        {renderSummary && summary && renderSummary(summary, { records, pagination })}

        {renderCard && view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {records.map((record) =>
              renderCard(record, {
                onView: renderDetail ? () => setViewing(record) : undefined,
                onEdit: canManage ? () => openEdit(record) : undefined,
                onDelete: canManage ? () => setDeleteTarget(record) : undefined,
              })
            )}
          </div>
        ) : (
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
        )}

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
                {viewing && renderDetailActions?.(viewing, { close: () => setViewing(null), reload: load, setRecords })}
                {canManage && (
                  <Button
                    variant="secondary"
                    icon={Trash2}
                    className="text-danger-600"
                    onClick={() => { const record = viewing; setViewing(null); setDeleteTarget(record); }}
                  >
                    Delete
                  </Button>
                )}
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
        <DeleteDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={`Delete this ${entityName.toLowerCase()}?`}
          describe={
            describeDelete ||
            ((record) =>
              record?.name
                ? `"${record.name}" will be deleted permanently. This cannot be undone.`
                : 'This record will be deleted permanently. This cannot be undone.')
          }
          onDelete={(record, params) => service.delete(record._id, params)}
          onDeleted={handleDeleted}
          renderExtra={renderDeleteExtra ? (record, ctx) => renderDeleteExtra(record, { ...ctx, records, extras }) : undefined}
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
