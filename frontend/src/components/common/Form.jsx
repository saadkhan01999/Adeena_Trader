/**
 * ============================================
 * Form Controls
 * ============================================
 * Every input in the app comes from here, so labels, error styling, focus
 * rings, hint text and touch sizing stay consistent.
 *
 * Mobile note: `.input` is forced to 16px below the `sm` breakpoint (see
 * index.css). Anything smaller makes iOS Safari zoom the page when a field is
 * focused, which then leaves the layout scrolled sideways.
 */

import { forwardRef, useState, useId, useMemo } from 'react';
import { Eye, EyeOff, AlertCircle, Search, ChevronDown, Check, X } from 'lucide-react';
import { cn, formatCNIC, formatPhone, formatCurrency, parseNumber } from '../../utils/index.js';
import { urduForLabel } from '../../i18n/formLabels.js';
import { useUrduEnabled } from '../../context/settingsStore.js';
import { Urdu } from './Bilingual.jsx';

// ============================================================================
// Field shell - label, control, hint and error, in one consistent frame
// ============================================================================
function Field({ id, label, required, error, hint, children, className }) {
  // Urdu is looked up from the English label the screen already passes, so
  // every form in the app is bilingual without a single screen being edited -
  // and none can be forgotten. A label with no translation renders in English
  // exactly as before. See i18n/formLabels.js for why it is keyed this way.
  //
  // The admin can turn this off for the whole shop under Settings > Language
  // & help. Subscribing to the one boolean rather than the settings object
  // means a field re-renders when that switch changes and not when anything
  // else in settings does.
  const urduEnabled = useUrduEnabled();
  const urdu = urduEnabled ? urduForLabel(label) : '';

  return (
    <div className={cn('field w-full min-w-0', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn('label', required && 'label-required', urdu && 'flex items-baseline gap-1.5 flex-wrap')}
        >
          {label}
          {urdu && (
            <span dir="rtl" lang="ur" className="urdu text-2xs font-normal text-ink-400">
              {urdu}
            </span>
          )}
        </label>
      )}

      {children}

      {/* Error replaces the hint rather than stacking, so the field never jumps */}
      {error ? (
        <p className="form-error" role="alert">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </p>
      ) : (
        hint && <p className="form-hint">{hint}</p>
      )}
    </div>
  );
}

// ============================================================================
// Text input
// ============================================================================
export const Input = forwardRef(function Input(
  { label, error, hint, required, className, icon, suffix, wrapperClassName, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <div className="relative">
        {icon && (
          <span className="field-icon absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none transition-colors">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          className={cn('input', icon && 'pl-10', suffix && 'pr-12', error && 'input-error', className)}
          // A placeholder is always present - even a blank one - because the
          // "this field is filled" styling keys off :placeholder-shown.
          placeholder=" "
          {...props}
        />

        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
});

// ============================================================================
// Password input with a show/hide toggle
// ============================================================================
export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, hint, required, className, icon, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        {icon && (
          <span className="field-icon absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none transition-colors">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          placeholder=" "
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error) || undefined}
          className={cn('input pr-11', icon && 'pl-10', error && 'input-error', className)}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Excluded from tab order: it is a convenience, and tabbing from the
          // password field should reach the submit button.
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md',
            'text-navy-400 hover:text-navy-700 hover:bg-navy-100',
            'transition-colors duration-150'
          )}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </Field>
  );
});

// ============================================================================
// Select
// ============================================================================
export const Select = forwardRef(function Select(
  { label, error, hint, required, className, children, placeholder, options, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          data-filled={props.value !== undefined && props.value !== null && props.value !== '' ? 'true' : undefined}
          className={cn(
            'input cursor-pointer appearance-none pr-9',
            error && 'input-error',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {/* Either pass `options` for the common case, or children for markup */}
          {options
            ? options.map((opt) => (
                <option key={opt.value ?? opt} value={opt.value ?? opt}>
                  {opt.label ?? opt}
                </option>
              ))
            : children}
        </select>

        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"
        />
      </div>
    </Field>
  );
});

// ============================================================================
// Textarea
// ============================================================================
export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className, rows = 3, maxLength, value, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          maxLength={maxLength}
          value={value}
          aria-invalid={Boolean(error) || undefined}
          className={cn('input resize-y min-h-[76px]', error && 'input-error', className)}
          placeholder=" "
          {...props}
        />

        {/* A live counter only when there is a limit to count towards */}
        {maxLength && (
          <span className="absolute bottom-2 right-3 text-2xs text-navy-400 pointer-events-none">
            {String(value || '').length}/{maxLength}
          </span>
        )}
      </div>
    </Field>
  );
});

// ============================================================================
// Currency input
// ============================================================================

/**
 * A numeric field that shows the formatted amount underneath as you type.
 * `inputMode="decimal"` brings up the number pad on a phone.
 */
export const CurrencyInput = forwardRef(function CurrencyInput(
  { label, error, hint, required, className, value, onChange, showPreview = true, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;
  const numeric = parseNumber(value);

  return (
    <Field
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint || (showPreview && numeric > 0 ? formatCurrency(numeric) : undefined)}
    >
      <div className="relative">
        <span className="field-icon absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-navy-400 pointer-events-none transition-colors">
          Rs.
        </span>
        <input
          ref={ref}
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          value={value ?? ''}
          onChange={onChange}
          aria-invalid={Boolean(error) || undefined}
          className={cn('input pl-11 tabular', error && 'input-error', className)}
          placeholder=" "
          {...props}
        />
      </div>
    </Field>
  );
});

// ============================================================================
// Pakistani-format inputs
// ============================================================================

/** CNIC field that inserts hyphens as the user types: 12345-1234567-1. */
export const CNICInput = forwardRef(function CNICInput({ value, onChange, ...props }, ref) {
  const handleChange = (event) => {
    const formatted = formatCNIC(event.target.value);
    onChange?.({ ...event, target: { ...event.target, value: formatted, name: event.target.name } });
  };

  return (
    <Input
      ref={ref}
      value={value || ''}
      onChange={handleChange}
      placeholder="12345-1234567-1"
      inputMode="numeric"
      maxLength={15}
      {...props}
    />
  );
});

/** Mobile field that inserts the hyphen as the user types: 0310-0091875. */
export const PhoneInput = forwardRef(function PhoneInput({ value, onChange, ...props }, ref) {
  const handleChange = (event) => {
    const formatted = formatPhone(event.target.value);
    onChange?.({ ...event, target: { ...event.target, value: formatted, name: event.target.name } });
  };

  return (
    <Input
      ref={ref}
      value={value || ''}
      onChange={handleChange}
      placeholder="0300-0000000"
      inputMode="tel"
      type="tel"
      maxLength={12}
      {...props}
    />
  );
});

// ============================================================================
// Checkbox & switch
// ============================================================================
export const Checkbox = forwardRef(function Checkbox(
  { label, description, error, className, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={cn(
          'flex items-start gap-2.5 cursor-pointer select-none group',
          props.disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <input ref={ref} id={id} type="checkbox" className={cn('checkbox mt-0.5', className)} {...props} />
        {(label || description) && (
          <span className="min-w-0">
            {label && (
              <span className="block text-sm text-navy-800 group-hover:text-navy-950 transition-colors">
                {label}
              </span>
            )}
            {description && <span className="block text-xs text-navy-500 mt-0.5">{description}</span>}
          </span>
        )}
      </label>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
});

/**
 * An on/off switch. Used instead of a checkbox where the setting takes effect
 * immediately rather than on save - the sliding motion conveys that.
 */
export function Switch({ checked, onChange, label, description, disabled, id: providedId, className }) {
  const generatedId = useId();
  const id = providedId || generatedId;

  return (
    <div className={cn('flex items-start justify-between gap-4 w-full', className)}>
      {(label || description) && (
        <label htmlFor={id} className={cn('min-w-0 cursor-pointer', disabled && 'cursor-not-allowed opacity-60')}>
          {label && <span className="block text-sm font-medium text-navy-800">{label}</span>}
          {description && <span className="block text-xs text-navy-500 mt-0.5">{description}</span>}
        </label>
      )}

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full',
          'transition-colors duration-200 ease-out-expo',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
          checked ? 'bg-gold-500' : 'bg-navy-200',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span
          className={cn(
            'inline-block h-4.5 w-4.5 h-[18px] w-[18px] transform rounded-full bg-white shadow-sm',
            'transition-transform duration-200 ease-out-expo',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
          )}
        />
      </button>
    </div>
  );
}

// ============================================================================
// Radio cards
// ============================================================================

/**
 * A set of large, tappable option cards.
 *
 * Preferred over a dropdown for short, important choices - cash vs installment,
 * 6 vs 12 months - because the options stay visible and are easy to hit on a
 * phone, where a native select opens a full-screen picker.
 */
export function RadioCards({ label, options, value, onChange, columns = 2, required, error, hint, name }) {
  const groupName = useId();

  const columnClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-1 xs:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[columns] || 'grid-cols-2';

  return (
    <div className="w-full">
      {label && <span className={cn('label', required && 'label-required')}>{label}</span>}

      <div className={cn('grid gap-2', columnClass)} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isSelected = String(value) === String(option.value);
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              name={name || groupName}
              disabled={option.disabled}
              onClick={() => onChange?.(option.value)}
              className={cn(
                'relative flex flex-col items-start gap-1 p-3 rounded-lg border text-left',
                'transition-all duration-200 ease-out-expo active:scale-[0.98]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
                isSelected
                  ? 'border-gold-500 bg-gold-50 ring-1 ring-gold-500'
                  : 'border-navy-200 bg-white hover:border-navy-300 hover:bg-navy-50',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="flex items-center gap-2 w-full">
                {Icon && (
                  <Icon size={16} className={isSelected ? 'text-gold-600' : 'text-navy-400'} />
                )}
                <span
                  className={cn(
                    'text-sm font-medium truncate',
                    isSelected ? 'text-navy-950' : 'text-navy-700'
                  )}
                >
                  {option.label}
                </span>
                {isSelected && <Check size={15} className="ml-auto text-gold-600 flex-shrink-0" />}
              </span>

              {option.hint && (
                <span className="text-2xs text-navy-500 leading-snug">{option.hint}</span>
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="form-error"><AlertCircle size={12} />{error}</p>
      ) : (
        hint && <p className="form-hint">{hint}</p>
      )}
    </div>
  );
}

// ============================================================================
// Searchable select
// ============================================================================

/**
 * A combobox for long lists - customers, products, suppliers.
 *
 * A native `<select>` with 900 customers is unusable; this filters as you type
 * and shows a secondary line per option so two people with the same name can be
 * told apart by their phone number.
 *
 * @param {Array<{value:string,label:string,sublabel?:string,meta?:string}>} options
 */
export function SearchSelect({
  label, options = [], value, onChange, placeholder = 'Search and select…',
  required, error, hint, disabled, emptyMessage = 'No matches found',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const id = useId();

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 60); // Cap the initial render
    const needle = query.toLowerCase();
    return options
      .filter(
        (o) =>
          o.label?.toLowerCase().includes(needle) ||
          o.sublabel?.toLowerCase().includes(needle) ||
          o.meta?.toLowerCase().includes(needle)
      )
      .slice(0, 60);
  }, [options, query]);

  const choose = (option) => {
    onChange?.(option.value, option);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        {/* Trigger shows the selection; the input appears once opened */}
        {!isOpen ? (
          <button
            id={id}
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(true)}
            data-filled={selected ? 'true' : undefined}
            className={cn(
              'input flex items-center justify-between gap-2 text-left',
              !selected && 'text-navy-400',
              error && 'input-error'
            )}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder}
              {selected?.sublabel && (
                <span className="text-navy-400 font-normal"> · {selected.sublabel}</span>
              )}
            </span>
            <ChevronDown size={16} className="text-navy-400 flex-shrink-0" />
          </button>
        ) : (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setIsOpen(false), 150)}
              placeholder="Type to search…"
              className={cn('input pl-10 pr-9')}
            />
            <button
              type="button"
              onClick={() => { setIsOpen(false); setQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-navy-400 hover:text-navy-700"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {isOpen && (
          <ul
            className={cn(
              'absolute z-dropdown mt-1 w-full max-h-64 overflow-y-auto scrollbar-thin',
              'bg-white border border-navy-200 rounded-lg shadow-raised animate-scale-in'
            )}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-navy-400">{emptyMessage}</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(option.value) === String(value)}
                    // onMouseDown fires before the input's onBlur, so the click
                    // is not swallowed by the dropdown closing first.
                    onMouseDown={(e) => { e.preventDefault(); choose(option); }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-left',
                      'transition-colors duration-100 hover:bg-gold-50',
                      String(option.value) === String(value) && 'bg-gold-50'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-navy-900 truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="block text-xs text-navy-500 truncate">{option.sublabel}</span>
                      )}
                    </span>
                    {option.meta && (
                      <span className="text-xs text-navy-500 flex-shrink-0 tabular">{option.meta}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </Field>
  );
}

// ============================================================================
// Layout helpers
// ============================================================================

/**
 * A responsive field grid.
 * Always one column on a phone - two half-width fields side by side at 360px
 * leaves neither readable.
 */
export function FormRow({ children, cols = 2, className }) {
  const columnClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols] || 'grid-cols-1 sm:grid-cols-2';

  return <div className={cn('grid gap-3 sm:gap-4', columnClass, className)}>{children}</div>;
}

/** A titled group of fields inside a long form. */
export function FormSection({ title, description, icon: Icon, children, className, action }) {
  return (
    <section className={cn('space-y-3 sm:space-y-4', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-navy-100">
          <div className="flex items-start gap-2.5 min-w-0">
            {Icon && (
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-100 text-gold-700 flex-shrink-0">
                <Icon size={16} />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h4 className="text-sm font-semibold text-navy-900 flex items-baseline gap-2">
                  {title}
                  <Urdu className="text-xs font-normal text-navy-500">{urduForLabel(title)}</Urdu>
                </h4>
              )}
              {description && <p className="text-xs text-navy-500 mt-0.5">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A read-only label/value pair, for detail panels. */
export function FieldDisplay({ label, value, icon: Icon, className, mono }) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="block text-2xs font-semibold uppercase tracking-wider text-navy-500">
        {label}
      </span>
      <span className={cn('flex items-center gap-1.5 text-sm text-navy-900 mt-0.5', mono && 'tabular')}>
        {Icon && <Icon size={14} className="text-navy-400 flex-shrink-0" />}
        <span className="truncate">{value || '-'}</span>
      </span>
    </div>
  );
}
