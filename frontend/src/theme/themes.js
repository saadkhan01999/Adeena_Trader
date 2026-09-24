/**
 * ============================================
 * Themes
 * ============================================
 * The five colour themes offered in Settings > Appearance.
 *
 * The colours themselves live in ./themes.css as CSS variables; this file is
 * what the Settings screen shows (name, swatches) and what applyTheme() uses.
 * Royal Gold is the shop's own identity and the default.
 *
 * The theme is applied to <html data-theme="..."> and remembered in
 * localStorage, so the next visit paints in the right colours before the
 * settings request has even been sent - no gold flash before a blue theme.
 */

export const THEMES = [
  {
    id: 'gold',
    label: 'Royal Gold',
    labelUr: 'شاہی سنہری',
    /** Sidebar, accent, soft accent, page - for the preview card. */
    swatches: ['#0a0a0c', '#d4af37', '#f4e3a2', '#fdfcfa'],
    /** Browser / phone status-bar colour. */
    metaColor: '#0a0a0c',
  },
  {
    id: 'blue',
    label: 'Ocean Blue',
    labelUr: 'سمندری نیلا',
    /** Sidebar, accent, soft accent, page - for the preview card. */
    swatches: ['#0a1428', '#3b82f6', '#bfdbfe', '#fbfcfe'],
    /** Browser / phone status-bar colour. */
    metaColor: '#0a1428',
  },
  {
    id: 'green',
    label: 'Emerald Green',
    labelUr: 'زمردی سبز',
    /** Sidebar, accent, soft accent, page - for the preview card. */
    swatches: ['#07120c', '#10b981', '#a7f3d0', '#fbfdfc'],
    /** Browser / phone status-bar colour. */
    metaColor: '#07120c',
  },
  {
    id: 'red',
    label: 'Crimson Red',
    labelUr: 'قرمزی سرخ',
    /** Sidebar, accent, soft accent, page - for the preview card. */
    swatches: ['#140a0b', '#e11d48', '#fecdd3', '#fefcfc'],
    /** Browser / phone status-bar colour. */
    metaColor: '#140a0b',
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    labelUr: 'شاہی جامنی',
    /** Sidebar, accent, soft accent, page - for the preview card. */
    swatches: ['#0d0a14', '#8b5cf6', '#ddd6fe', '#fcfbfe'],
    /** Browser / phone status-bar colour. */
    metaColor: '#0d0a14',
  },
];

export const DEFAULT_THEME = 'gold';
const STORAGE_KEY = 'at_theme';

export const isTheme = (id) => THEMES.some((theme) => theme.id === id);

/** Put a theme on the page and remember it for the next visit. */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  const root = document.documentElement;
  if (root.dataset.theme !== theme.id) root.dataset.theme = theme.id;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.metaColor);

  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  return theme.id;
}

/** The theme remembered from the last visit, for first paint. */
export function rememberedTheme() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return isTheme(id) ? id : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Read a theme colour at runtime, for the few places that need a literal
 * colour string rather than a class - chart strokes, canvas exports.
 * @param {string} name e.g. 'gold-500'
 * @param {number} [alpha=1]
 */
export function themeColor(name, alpha = 1) {
  if (typeof window === 'undefined') return '#d4af37';
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!value) return '#d4af37';
  return alpha === 1 ? `rgb(${value})` : `rgb(${value} / ${alpha})`;
}
