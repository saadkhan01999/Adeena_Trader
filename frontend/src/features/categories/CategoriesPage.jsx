/**
 * ============================================
 * Categories
 * ============================================
 * Product categories. Each one carries a Lucide icon name so the category
 * reads at a glance in pickers and on the dashboard's category mix.
 */

import { Tags, Package, Pencil, Trash2 } from 'lucide-react';
import { getIcon, CATEGORY_ICON_NAMES } from '../../components/common/Icon.jsx';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import { Input, Textarea, Select, FormRow, FieldDisplay } from '../../components/common/Form.jsx';
import Badge from '../../components/common/Badge.jsx';
import { categoryService } from '../../services/entities.js';
import { formatDate } from '../../utils/index.js';


/**
 * One category, as a card.
 *
 * A category is an icon and a name - there is almost nothing to tabulate, and
 * a six-row table of mostly empty columns reads as an oversight. As cards the
 * icons do the work, and the product count tells the owner at a glance which
 * categories are actually being used and which were created once and forgotten.
 */
export function CategoryCard({ category, onView, onEdit, onDelete }) {
  const Icon = getIcon(category.icon);
  const count = category.productCount ?? 0;

  return (
    <article
      onClick={onView}
      className="group relative flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-white border border-ink-200 hover:border-gold-400 hover:shadow-card-hover transition-[border-color,box-shadow] duration-200 cursor-pointer"
    >
      <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-ink-950 text-gold-400 flex-shrink-0">
        <Icon size={26} />
      </span>

      <div className="min-w-0 w-full">
        <h3 className="text-sm font-semibold text-ink-950 truncate">{category.name}</h3>
        <p className="text-2xs text-ink-500 mt-0.5">
          {count === 1 ? '1 product' : `${count} products`}
        </p>
      </div>

      {category.status !== 'active' && (
        <Badge variant="neutral" size="xs">{category.status}</Badge>
      )}

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100 transition-opacity">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label={`Edit ${category.name}`}
            className="p-1.5 rounded-md bg-white/95 text-ink-600 hover:text-gold-700 shadow-xs transition-colors"
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete ${category.name}`}
            className="p-1.5 rounded-md bg-white/95 text-danger-500 shadow-xs transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

export default createListPage({
  guideId: 'categories',

  /**
   * The card view.
   *
   * A category is an icon and a name - there is almost nothing to tabulate,
   * and a six-row table of mostly empty columns reads as an oversight. As
   * cards the icons do the work, and the product count tells the owner at a
   * glance which categories are actually being used and which were created
   * once and forgotten.
   */
  renderCard: (category, actions) => <CategoryCard key={category._id} category={category} {...actions} />,
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
  }),

  renderForm: (form, setForm) => {
    const PreviewIcon = getIcon(form.icon);

    return (
      <>
        <FormRow cols={2}>
          <Input
            label="Category name"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Mobile & Accessories"
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

        {/* Icon picker with a live preview, so the choice is visible rather
            than a name in a dropdown the user has to imagine. */}
        <div>
          <span className="label">Icon</span>

          <div className="flex items-center gap-3 mb-2.5">
            <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
              <PreviewIcon size={21} />
            </span>
            <span className="text-sm text-navy-600">
              {form.name || 'Your category'} will appear with this icon.
            </span>
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
                  className={`flex items-center justify-center aspect-square rounded-lg border transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? 'border-gold-500 bg-gold-50 text-gold-700 ring-1 ring-gold-500'
                      : 'border-navy-200 text-navy-500 hover:border-navy-300 hover:bg-navy-50'
                  }`}
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
            { value: 'archived', label: 'Archived — hidden from new products' },
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
      render: (category) => {
        const Icon = getIcon(category.icon);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-50 text-navy-600 flex-shrink-0">
              <Icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-navy-950 truncate">{category.name}</p>
              {category.description && (
                <p className="text-2xs text-navy-500 truncate">{category.description}</p>
              )}
            </div>
          </div>
        );
      },
      exportValue: (category) => category.name,
    },
    {
      accessor: 'displayOrder',
      header: 'Order',
      align: 'center',
      sortable: true,
      hideOnMobile: true,
      render: (category) => <span className="text-sm tabular text-navy-600">{category.displayOrder}</span>,
      exportValue: (category) => category.displayOrder,
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
      accessor: 'createdAt',
      header: 'Added',
      hideOnMobile: true,
      sortable: true,
      render: (category) => <span className="text-sm text-navy-600">{formatDate(category.createdAt)}</span>,
      exportValue: (category) => formatDate(category.createdAt),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (category) => (
        <RowActions record={category} onEdit={onEdit} onDelete={onDelete} canManage={canManage} />
      ),
    },
  ],

  renderDetail: (category) => {
    const Icon = getIcon(category.icon);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-navy-950 text-gold-500">
            <Icon size={22} />
          </span>
          <div>
            <p className="font-display font-semibold text-navy-950">{category.name}</p>
            <p className="text-xs text-navy-500">{category.description || 'No description'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Display order" value={category.displayOrder} />
          <FieldDisplay label="Status" value={category.status} />
          <FieldDisplay label="Slug" value={category.slug} />
          <FieldDisplay label="Added" value={formatDate(category.createdAt)} />
        </div>
      </div>
    );
  },
});
