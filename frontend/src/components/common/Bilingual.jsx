/**
 * ============================================
 * Bilingual Text
 * ============================================
 * Renders a term in English with its Urdu underneath (or beside it).
 *
 * Urdu needs three things to render correctly, and all three are easy to forget
 * at a call site, which is exactly why they live here instead:
 *   - dir="rtl", or the punctuation and digits land on the wrong side;
 *   - lang="ur", so the browser picks an Urdu-capable font (Noto Nastaliq) and
 *     screen readers switch voice;
 *   - extra line-height, because Nastaliq script is tall and clips otherwise.
 */

import { term } from '../../i18n/index.js';
import { cn } from '../../utils/index.js';

/**
 * A run of Urdu text, correctly marked up.
 *
 * @param {object} props
 * @param {string} props.children
 */
export function Urdu({ children, className }) {
  if (!children) return null;

  return (
    <span dir="rtl" lang="ur" className={cn('urdu', className)}>
      {children}
    </span>
  );
}

/**
 * A form field label in both languages.
 *
 * Inline by default: the Urdu sits immediately beside the English, so the pair
 * reads as one label - "Name  نام". Stacking them put the Urdu at the far right
 * of a full-width label, which read as an unrelated word floating across the
 * form rather than a translation of the field in front of it.
 *
 * `stacked` remains available for narrow columns where the pair will not fit on
 * one line.
 *
 * @param {object} props
 * @param {string} props.name      Key into FIELD_LABELS, e.g. "phone".
 * @param {boolean} [props.required]
 * @param {'inline'|'stacked'} [props.layout='inline']
 * @param {string} [props.htmlFor]
 */
export function FieldLabel({ name, required = false, layout = 'inline', htmlFor, className }) {
  const { en, ur } = term(name);

  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'text-sm font-medium text-ink-800',
        layout === 'inline' ? 'flex items-baseline gap-2 flex-wrap' : 'block',
        className
      )}
    >
      <span>
        {en}
        {required && <span className="text-danger-500 ms-0.5" aria-hidden="true">*</span>}
      </span>

      {ur && (
        <Urdu
          className={cn(
            'text-ink-500 font-normal text-xs',
            layout === 'stacked' && 'block mt-0.5'
          )}
        >
          {ur}
        </Urdu>
      )}
    </label>
  );
}

/**
 * A heading, button caption or table header in both languages, side by side.
 *
 * Inline rather than stacked, because a table header row that doubled in height
 * would cost more rows of data than the translation is worth.
 *
 * @param {object} props
 * @param {string} props.name  Key into the label dictionary.
 */
export function BiText({ name, className, urduClassName }) {
  const { en, ur } = term(name);

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span>{en}</span>
      {ur && <Urdu className={cn('text-[0.85em] opacity-70', urduClassName)}>{ur}</Urdu>}
    </span>
  );
}

export default BiText;
