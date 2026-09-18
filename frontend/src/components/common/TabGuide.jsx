/**
 * ============================================
 * TabGuide
 * ============================================
 * The "How to use" panel for a screen, in English and Urdu.
 *
 * Why a panel and not a tooltip or a separate help page
 * ----------------------------------------------------
 * The question ("what do I put here?") is asked with a customer standing at the
 * counter. A tooltip is too small for four steps; a help page loses the screen
 * the question was about. A panel that opens above the content answers in place
 * and closes again.
 *
 * It is collapsed by default once the person has opened it on that screen: the
 * first visit shows it open so it is discovered at all, and afterwards it stays
 * out of the way. That preference is per screen and lives in localStorage -
 * losing it is harmless, which is why a storage failure is ignored rather than
 * handled.
 */

import { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, AlertTriangle } from 'lucide-react';

import { guideFor, ACTION_LABELS } from '../../i18n/index.js';
import { Urdu } from './Bilingual.jsx';
import { cn } from '../../utils/index.js';
import { useSettingsStore } from '../../context/settingsStore.js';

const SEEN_KEY = 'at_guide_seen';

/** Screens whose guide the user has already opened at least once. */
const readSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
};

const markSeen = (id) => {
  try {
    const seen = readSeen();
    if (!seen.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    /* A lost preference just means the panel opens again. Not worth handling. */
  }
};

/**
 * @param {object} props
 * @param {string} props.id  Screen id, matching a key in GUIDES.
 */
export default function TabGuide({ id, className }) {
  const guide = guideFor(id);

  // Turned off for the whole shop under Settings > Language & help, once the
  // staff no longer need it.
  const enabled = useSettingsStore((state) => state.settings?.display?.screenGuides !== false);

  // The Urdu switch governs ALL Urdu, the guide included. An English-only shop
  // that turned Urdu off should not still meet it in the instructions - the
  // two switches answer different questions: "is this shop bilingual?" and
  // "do the staff still need the instructions?".
  const showUrdu = useSettingsStore((state) => state.settings?.display?.urduLabels !== false);

  // Open on first visit so it is found; closed on every visit after that.
  const [open, setOpen] = useState(() => Boolean(guide) && !readSeen().includes(id));

  useEffect(() => {
    if (open && guide) markSeen(id);
  }, [open, guide, id]);

  if (!guide || !enabled) return null;

  return (
    <section
      className={cn(
        'rounded-lg border border-gold-300/70 bg-gold-50/60 overflow-hidden',
        className
      )}
    >
      {/* ---- Header / toggle ---- */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left',
          'hover:bg-gold-100/60 transition-colors duration-150'
        )}
      >
        <HelpCircle className="w-4 h-4 text-gold-700 flex-shrink-0" aria-hidden="true" />

        <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-ink-900">{ACTION_LABELS.help.en}</span>
          {showUrdu && <Urdu className="text-xs text-ink-600">{ACTION_LABELS.help.ur}</Urdu>}
        </span>

        <ChevronDown
          className={cn(
            'w-4 h-4 text-gold-700 flex-shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {/* ---- Body ----
          Rendered only when open. A CSS height transition on content of unknown
          length either clips it or needs a measured height; for a panel opened
          deliberately, appearing at once is the honest behaviour. */}
      {open && (
        <div className="px-3.5 pb-3.5 pt-0.5 border-t border-gold-300/50 space-y-3">
          {/* Purpose */}
          <div className="pt-2.5">
            <p className="text-sm text-ink-800">{guide.purpose.en}</p>
            {showUrdu && (
              <Urdu className="block text-sm text-ink-700 mt-1">{guide.purpose.ur}</Urdu>
            )}
          </div>

          {/* Steps */}
          <ol className="space-y-2.5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full bg-gold-500 text-ink-950',
                    'text-2xs font-bold flex items-center justify-center mt-0.5 tabular'
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-ink-800">{step.en}</span>
                  {showUrdu && (
                    <Urdu className="block text-sm text-ink-600 mt-0.5">{step.ur}</Urdu>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {/* Caution - only where an action cannot be undone */}
          {guide.caution && (
            <div className="flex gap-2.5 rounded-md bg-warning-100/70 border border-warning-200 p-2.5">
              <AlertTriangle
                className="w-4 h-4 text-warning-700 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-warning-900">
                  {guide.caution.en}
                </span>
                {showUrdu && (
                  <Urdu className="block text-sm text-warning-800 mt-0.5">{guide.caution.ur}</Urdu>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
