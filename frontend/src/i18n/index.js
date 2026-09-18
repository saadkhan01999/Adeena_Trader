/**
 * ============================================
 * i18n
 * ============================================
 * Bilingual labels and per-screen instructions.
 *
 * There is no language switch and no i18n library. The app shows English and
 * Urdu together (see labels.js for why), which is a lookup, not a locale - so
 * a dictionary and two helpers do the whole job.
 */

export {
  NAV_LABELS, GROUP_LABELS, ACTION_LABELS, FIELD_LABELS, STATUS_LABELS,
  term, urdu, english,
} from './labels.js';

export { GUIDES, guideFor } from './guides.js';
