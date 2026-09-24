/**
 * ============================================
 * Categories
 * ============================================
 * The groups inventory sits in. Each category has a picture (uploaded) or an
 * icon, and the picture is what the Inventory screen shows in its category
 * chips and in the add-item picker - so a salesman picks "the one with the
 * solar panel" rather than reading a list.
 *
 * Deleting a category that still holds items asks what to do with them: move
 * them to another category, or delete them with it.
 */

import { useState } from 'react';
import { Tags, Pencil, Trash2, ImagePlus, ImageOff, Boxes, AlertTriangle } from 'lucide-react';
import { getIcon, CATEGORY_ICON_NAMES } from '../../components/common/Icon.jsx';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import { Input, Textarea, Select, FormRow, FieldDisplay } from '../../components/common/Form.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import { categoryService } from '../../services/entities.js';
import { useToastStore } from '../../context/toastStore.js';
import { cn, formatDate, formatCurrency, resolveFileUrl } from '../../utils/index.js';

/** The category's picture, or its icon on the accent tile. */
function CategoryArt({ category, preview, size = 'md' }) {
  const Icon = getIcon(category?.icon);
  const src = preview || (category?.image ? resolveFileUrl(category.image) : null);
  const box = { sm: 'w-10 h-10 rounded-lg', md: 'w-16 h-16 rounded-2xl', lg: 'w-24 h-24 rounded-2xl' }[size];
  return (
    <span className={cn('flex items-center justify-center flex-shrink-0 overflow-hidden bg-ink-950 text-gold-400 ring-2 ring-gold-500/30', box)}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Icon size={size === 'sm' ? 18 : size === 'lg' ? 40 : 28} />}
    </span>
  );
}

/** One category as a card: picture, name, item count and stock value. */
export function CategoryCard({ category, onView, onEdit, onDelete }) {
  const count = category.productCount ?? 0;
  const warn = (category.lowStockCount || 0) + (category.outOfStockCount || 0);

  return (
    <article
      onClick={onView}
      className={cn(
        'group relative flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl bg-white border border-ink-200',
        'hover:border-gold-400 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
        category.__leaving && 'row-leave',
        category.__fresh && 'row-flash'
      )}
    >
      <CategoryArt category={category} />

      <div className="min-w-0 w-full">
        <h3 className="text-sm font-bold text-ink-950 truncate">{category.name}</h3>
        <p className="text-2xs text-ink-500 mt-0.5">
          {count === 1 ? '1 item' : `${count} items`} · {(category.totalStock ?? 0).toLocaleString('en-PK')} units
        </p>
        <p className="text-xs font-semibold text-gold-700 mt-1 tabular">{formatCurrency(category.stockValue || 0)}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {category.status !== 'active' && <Badge variant="neutral" size="xs">Archived</Badge>}
        {warn > 0 && <Badge variant="warning" size="xs">{warn} low</Badge>}
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100 transition-opacity">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label={`Edit ${category.name}`}
            className="p-1.5 rounded-md bg-white/95 text-ink-600 hover:text-gold-700 shadow-xs border border-ink-100 transition-colors"
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete ${category.name}`}
            className="p-1.5 rounded-md bg-white/95 text-danger-500 shadow-xs border border-ink-100 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

/** Picture controls inside the detail view: upload, replace, remove. */
function PictureManager({ category, update, canManage }) {
  const toast = useToastStore();
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const response = await categoryService.uploadImage(category._id, file);
      update({ ...response.data.category, productCount: category.productCount, totalStock: category.totalStock, stockValue: category.stockValue });
      toast.success('Picture saved.');
    } catch (error) {
      toast.apiError(error, 'Could not upload the picture.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await categoryService.removeImage(category._id);
      update({ ...response.data.category, productCount: category.productCount, totalStock: category.totalStock, stockValue: category.stockValue });
      toast.success('Picture removed.');
    } catch (error) {
      toast.apiError(error);
    } finally {
      setBusy(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <label className={cn('btn-secondary btn cursor-pointer', busy && 'opacity-60 pointer-events-none')}>
        <ImagePlus size={15} />
        {busy ? 'Working…' : category.image ? 'Replace picture' : 'Upload picture'}
        <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {category.image && (
        <Button variant="secondary" icon={ImageOff} className="text-danger-600" onClick={remove} disabled={busy}>
          Remove picture
        </Button>
      )}
    </div>
  );
}

export default createListPage({
  guideId: 'categories',
  renderCard: (category, actions) => <CategoryCard key={category._id} category={category} {...actions} />,
  initialView: 'grid',
  entityName: 'Category',
  entityNamePlural: 'Categories',
  collectionKey: 'categories',
  icon: Tags,
  service: categoryService,
  permission: 'categories',
  searchPlaceholder: 'Search categories…',
  formSize: 'md',
  initialSort: 'displayOrder',

  getInitialForm: () => ({
    name: '',
    description: '',
    icon: 'Package',
    displayOrder: 0,
    status: 'active',
    // A picture chosen in the form; uploaded once the category exists.
    _imageFile: null,
  }),

  // The picture travels separately (multipart), never inside the JSON.
  toPayload: ({ _imageFile, ...form }) => form,

  afterSave: async (saved, form) => {
    if (!form._imageFile) return saved;
    const response = await categoryService.uploadImage(saved._id, form._imageFile);
    return { ...saved, ...response.data.category };
  },

  describeDelete: (category) =>
    category.productCount > 0
      ? `"${category.name}" holds ${category.productCount} item(s). You will be asked what to do with them.`
      : `"${category.name}" will be deleted permanently.`,

  // Step two of the delete: move the items somewhere instead of deleting them.
  renderDeleteExtra: (category, { params, setParams, records }) => {
    const others = records.filter((c) => c._id !== category._id && !c.__leaving);
    if (others.length === 0) {
      return (
        <p className="text-xs text-navy-600">
          There is no other category to move the items to. Add one first, or delete the items with this category.
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-gold-300 bg-gold-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-navy-800">Keep the items - move them to:</p>
        <Select
          value={params.moveTo || ''}
          onChange={(e) => setParams({ moveTo: e.target.value })}
          placeholder="Choose a category"
          options={others.map((c) => ({ value: c._id, label: `${c.name} (${c.productCount ?? 0} items)` }))}
        />
        <p className="text-2xs text-navy-500">Choose one and press Continue, or press Delete everything to delete the items too.</p>
      </div>
    );
  },

  renderForm: (form, setForm, { editing }) => {
    const PreviewIcon = getIcon(form.icon);
    const preview = form._imageFile ? URL.createObjectURL(form._imageFile) : null;

    return (
      <>
        <FormRow cols={2}>
          <Input
            label="Category name"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Solar Panels"
          />
          <Input
            label="Display order"
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
            hint="Lower numbers appear first"
          />
        </FormRow>

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What belongs in this category (optional)"
          rows={2}
          maxLength={200}
        />

        {/* Picture */}
        <div className="field">
          <span className="label">Picture</span>
          <div className="flex items-center gap-3">
            <CategoryArt category={{ ...editing, icon: form.icon }} preview={preview} />
            <div className="space-y-1.5">
              <label className="btn-secondary btn btn-sm cursor-pointer">
                <ImagePlus size={14} />
                {form._imageFile ? 'Choose another picture' : editing?.image ? 'Replace picture' : 'Choose a picture'}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => setForm({ ...form, _imageFile: e.target.files?.[0] || null })}
                />
              </label>
              <p className="text-2xs text-navy-500">
                Shown on Inventory and when adding an item. Without one, the icon below is used.
              </p>
            </div>
          </div>
        </div>

        {/* Icon picker with a live preview */}
        <div>
          <span className="label">Icon</span>
          <div className="flex items-center gap-3 mb-2.5">
            <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
              <PreviewIcon size={21} />
            </span>
            <span className="text-sm text-navy-600">{form.name || 'Your category'} uses this icon when it has no picture.</span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
            {CATEGORY_ICON_NAMES.map((name) => {
              const Icon = getIcon(name);
              const isSelected = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={isSelected}
                  onClick={() => setForm({ ...form, icon: name })}
                  className={cn(
                    'flex items-center justify-center aspect-square rounded-lg border transition-all duration-200 active:scale-95',
                    isSelected
                      ? 'border-gold-500 bg-gold-50 text-gold-700 ring-1 ring-gold-500'
                      : 'border-navy-200 text-navy-500 hover:border-navy-300 hover:bg-navy-50'
                  )}
                >
                  <Icon size={17} />
                </button>
              );
            })}
          </div>
        </div>

        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived - hidden when adding items' },
          ]}
        />
      </>
    );
  },

  columns: ({ onEdit, onDelete, canManage }) => [
    {
      accessor: 'name',
      header: 'Category',
      sortable: true,
      primary: true,
      render: (category) => (
        <div className="flex items-center gap-3 min-w-0">
          <CategoryArt category={category} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-navy-950 truncate">{category.name}</p>
            {category.description && <p className="text-2xs text-navy-500 truncate">{category.description}</p>}
          </div>
        </div>
      ),
      exportValue: (category) => category.name,
    },
    {
      accessor: 'productCount',
      header: 'Items',
      align: 'center',
      render: (category) => <span className="text-sm font-semibold tabular">{category.productCount ?? 0}</span>,
      exportValue: (category) => category.productCount,
    },
    {
      accessor: 'stockValue',
      header: 'Stock value',
      align: 'right',
      hideOnMobile: true,
      render: (category) => <span className="text-sm tabular">{formatCurrency(category.stockValue || 0)}</span>,
      exportValue: (category) => category.stockValue,
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (category) => (
        <Badge variant={category.status === 'active' ? 'success' : 'neutral'} size="sm">
          {category.status === 'active' ? 'Active' : 'Archived'}
        </Badge>
      ),
      exportValue: (category) => category.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (category) => <RowActions record={category} onEdit={onEdit} onDelete={onDelete} canManage={canManage} />,
    },
  ],

  renderDetail: (category, extras, { update, canManage }) => (
    <div className="space-y-4 soft-in">
      <div className="flex items-center gap-4">
        <CategoryArt category={category} size="lg" />
        <div className="min-w-0 space-y-2">
          <p className="font-display text-lg font-bold text-navy-950">{category.name}</p>
          <p className="text-xs text-navy-500">{category.description || 'No description'}</p>
          <PictureManager category={category} update={update} canManage={canManage} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Items', value: (category.productCount ?? 0).toLocaleString('en-PK'), icon: Boxes },
          { label: 'Units', value: (category.totalStock ?? 0).toLocaleString('en-PK'), icon: Boxes },
          { label: 'Stock value', value: formatCurrency(category.stockValue || 0), icon: Boxes },
        ].map((f) => (
          <div key={f.label} className="rounded-xl border border-gold-200 bg-gold-50 p-3 text-center">
            <p className="text-2xs text-navy-500">{f.label}</p>
            <p className="text-sm font-bold text-navy-950 tabular mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {(category.lowStockCount || 0) + (category.outOfStockCount || 0) > 0 && (
        <p className="flex items-center gap-2 text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} />
          {category.lowStockCount || 0} running low and {category.outOfStockCount || 0} out of stock in this category.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldDisplay label="Display order" value={category.displayOrder} />
        <FieldDisplay label="Status" value={category.status === 'active' ? 'Active' : 'Archived'} />
        <FieldDisplay label="Added" value={formatDate(category.createdAt)} />
        <FieldDisplay label="Last changed" value={formatDate(category.updatedAt)} />
      </div>
    </div>
  ),
});
