/**
 * ============================================
 * Command Palette (Ctrl+K)
 * ============================================
 * Search everything and jump anywhere from the keyboard.
 *
 * Two kinds of result share one list:
 *   - Navigation: every screen the user is permitted to open, matched locally
 *     so it responds with no round trip.
 *   - Records: customers, products, invoices, receipts, suppliers, investors
 *     and partners, matched by the server (which also enforces permissions).
 *
 * Record search is debounced at 300ms - a shop counter PC on a slow connection
 * should not fire a query per keystroke.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Loader2, X } from 'lucide-react';
import { getIcon } from '../common/Icon.jsx';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { systemService } from '../../services/entities.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { NAV_ITEMS } from '../../constants/index.js';
import { cn } from '../../utils/index.js';

export default function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { hasPermission } = useAuthStore();

  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  // ---- Reset each time it opens ----------------------------------------
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setRecords([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [commandPaletteOpen]);

  // ---- Server-side record search ---------------------------------------
  useEffect(() => {
    if (!commandPaletteOpen) return undefined;

    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setRecords([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);

    systemService
      .search(term, 4)
      .then((response) => {
        // Ignore a response that arrived after a newer keystroke
        if (!cancelled) setRecords(response.data.results || []);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, commandPaletteOpen]);

  // ---- Local navigation matches ----------------------------------------
  const pages = useMemo(() => {
    const permitted = NAV_ITEMS.filter((item) => hasPermission(item.permission));
    const term = query.trim().toLowerCase();
    if (!term) return permitted.slice(0, 7);
    return permitted.filter((item) => item.label.toLowerCase().includes(term)).slice(0, 6);
  }, [query, hasPermission]);

  /** One flat list so arrow keys move through every result in visual order. */
  const flatResults = useMemo(
    () => [
      ...pages.map((p) => ({ kind: 'page', id: p.id, title: p.label, icon: p.icon, path: p.path })),
      ...records.map((r) => ({ kind: 'record', ...r })),
    ],
    [pages, records]
  );

  const groupedRecords = useMemo(() => {
    return records.reduce((acc, record) => {
      (acc[record.group] ||= []).push(record);
      return acc;
    }, {});
  }, [records]);

  const select = useCallback(
    (result) => {
      if (!result) return;
      setCommandPaletteOpen(false);
      navigate(result.path);
    },
    [navigate, setCommandPaletteOpen]
  );

  // ---- Keyboard navigation ---------------------------------------------
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(flatResults.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % Math.max(flatResults.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(flatResults[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCommandPaletteOpen(false);
    }
  };

  // Keep the highlighted row scrolled into view as the arrows move
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Clamp when the result set shrinks under the cursor
  useEffect(() => {
    if (activeIndex >= flatResults.length) setActiveIndex(0);
  }, [flatResults.length, activeIndex]);

  if (typeof document === 'undefined') return null;

  let runningIndex = -1;

  return createPortal(
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[12vh] sm:pt-[15vh] no-print">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setCommandPaletteOpen(false)}
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Search field */}
            <div className="flex items-center gap-3 px-4 border-b border-navy-100 flex-shrink-0">
              {searching ? (
                <Loader2 size={18} className="text-gold-500 animate-spin flex-shrink-0" />
              ) : (
                <Search size={18} className="text-navy-400 flex-shrink-0" />
              )}

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search customers, products, invoices, or jump to a screen…"
                aria-label="Search"
                className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-navy-400"
              />

              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                aria-label="Close search"
                className="p-1.5 rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin py-2">
              {flatResults.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Search size={26} className="mx-auto text-navy-200 mb-2" />
                  <p className="text-sm text-navy-500">
                    {query.trim().length === 1
                      ? 'Type at least two characters to search records.'
                      : query
                        ? `Nothing found for "${query}".`
                        : 'Start typing to search.'}
                  </p>
                </div>
              ) : (
                <>
                  {pages.length > 0 && (
                    <section>
                      <p className="px-4 pt-1 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-navy-400">
                        Go to
                      </p>
                      {pages.map((page) => {
                        runningIndex += 1;
                        const index = runningIndex;
                        const Icon = getIcon(page.icon);

                        return (
                          <button
                            key={page.id}
                            data-index={index}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => select({ path: page.path })}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              index === activeIndex ? 'bg-gold-50' : 'hover:bg-navy-50'
                            )}
                          >
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
                              <Icon size={15} />
                            </span>
                            <span className="text-sm font-medium text-navy-900">{page.label}</span>
                            {index === activeIndex && (
                              <CornerDownLeft size={13} className="ml-auto text-navy-300" />
                            )}
                          </button>
                        );
                      })}
                    </section>
                  )}

                  {Object.entries(groupedRecords).map(([group, rows]) => (
                    <section key={group}>
                      <p className="px-4 pt-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-navy-400">
                        {group}
                      </p>
                      {rows.map((record) => {
                        runningIndex += 1;
                        const index = runningIndex;

                        return (
                          <button
                            key={`${group}-${record.id}`}
                            data-index={index}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => select(record)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              index === activeIndex ? 'bg-gold-50' : 'hover:bg-navy-50'
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-navy-900 truncate">
                                {record.title}
                              </span>
                              {record.subtitle && (
                                <span className="block text-xs text-navy-500 truncate">
                                  {record.subtitle}
                                </span>
                              )}
                            </span>

                            {record.meta && (
                              <span className="text-xs text-navy-500 flex-shrink-0 tabular">
                                {record.meta}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </section>
                  ))}
                </>
              )}
            </div>

            {/* Keyboard legend - desktop only, where a keyboard exists */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-navy-100 bg-navy-50/60 text-2xs text-navy-500 flex-shrink-0">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-navy-200 bg-white"><ArrowUp size={9} /></kbd>
                <kbd className="px-1.5 py-0.5 rounded border border-navy-200 bg-white"><ArrowDown size={9} /></kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-navy-200 bg-white"><CornerDownLeft size={9} /></kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-navy-200 bg-white font-sans">Esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
