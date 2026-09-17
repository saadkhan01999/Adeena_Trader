/**
 * ============================================
 * Shared Hooks
 * ============================================
 * Small, focused hooks that several screens need. Each one is documented with
 * the problem it exists to solve.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ============================================================================
// useDebouncedValue
// ============================================================================

/**
 * Follow `value`, but only after it has stopped changing for `delay` ms.
 *
 * Used for search boxes: typing "Muhammad" would otherwise fire eight requests.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debounced = useDebouncedValue(search, 350);
 * useEffect(() => { fetchRows(debounced); }, [debounced]);
 */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ============================================================================
// useMediaQuery
// ============================================================================

/**
 * Track a CSS media query from JavaScript.
 *
 * For anything purely visual, prefer a Tailwind breakpoint class. This is for
 * decisions that change behaviour rather than appearance - for example, whether
 * the sidebar is a drawer or a permanent rail.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    setMatches(media.matches); // Re-sync in case the query changed
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Below Tailwind's `lg` breakpoint - where the sidebar becomes a drawer. */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px)');

/** Phone-sized - where tables collapse into cards. */
export const useIsSmallScreen = () => useMediaQuery('(max-width: 767px)');

// ============================================================================
// useOnlineStatus
// ============================================================================

/**
 * Browser connectivity, plus an optional callback when the connection returns.
 *
 * `navigator.onLine` only reports whether the device has *a* network, not
 * whether the API is reachable - the store's `apiUnreachable` flag covers that
 * second case, set by the API client when a request gets no response.
 */
export function useOnlineStatus(onReconnect) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const callbackRef = useRef(onReconnect);
  callbackRef.current = onReconnect;

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      callbackRef.current?.();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// ============================================================================
// useKeyboardShortcut
// ============================================================================

/**
 * Bind a keyboard shortcut.
 *
 * Keystrokes typed into an input, textarea or contenteditable are ignored
 * unless `allowInInputs` is set, so pressing "n" while filling in a customer's
 * name does not open the New Sale dialog.
 *
 * @param {string} keys e.g. 'ctrl+k', 'meta+k', 'escape', '/'
 * @param {Function} handler
 * @param {{allowInInputs?:boolean, enabled?:boolean}} [options]
 */
export function useKeyboardShortcut(keys, handler, options = {}) {
  const { allowInInputs = false, enabled = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;

    const combo = keys.toLowerCase().split('+').map((k) => k.trim());
    const key = combo[combo.length - 1];
    const needsCtrl = combo.includes('ctrl');
    const needsMeta = combo.includes('meta') || combo.includes('cmd');
    const needsShift = combo.includes('shift');
    const needsAlt = combo.includes('alt');

    const onKeyDown = (event) => {
      if (!allowInInputs) {
        const el = event.target;
        const typing =
          el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' ||
          el?.tagName === 'SELECT' || el?.isContentEditable;
        if (typing) return;
      }

      if (event.key.toLowerCase() !== key) return;

      // Ctrl on Windows/Linux and Cmd on Mac are treated as the same intent
      const modifierOk =
        (needsCtrl || needsMeta ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey) &&
        (needsShift ? event.shiftKey : true) &&
        (needsAlt ? event.altKey : !event.altKey);

      if (!modifierOk) return;

      event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keys, allowInInputs, enabled]);
}

// ============================================================================
// useClickOutside
// ============================================================================

/**
 * Call `handler` when a click or touch lands outside the referenced element.
 * Used to dismiss dropdowns and popovers.
 */
export function useClickOutside(handler, enabled = true) {
  const ref = useRef(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handlerRef.current(event);
    };

    // `mousedown` rather than `click`: closing on press feels immediate, and it
    // avoids a race with buttons that unmount their own trigger.
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [enabled]);

  return ref;
}

// ============================================================================
// useLocalStorage
// ============================================================================

/**
 * `useState` that survives a reload.
 *
 * Every access is wrapped: localStorage throws in private browsing on some
 * browsers, and a saved preference is never worth crashing a screen over.
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = next instanceof Function ? next(current) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Quota exceeded or storage blocked - keep the in-memory value.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
}

// ============================================================================
// useAsync
// ============================================================================

/**
 * Run an async function and expose { data, loading, error, refetch }.
 *
 * Replaces the useState/useEffect/try/catch block every list screen would
 * otherwise repeat, and guards against setting state after unmount - which is
 * easy to hit when a user navigates away mid-request.
 *
 * @param {Function} asyncFn
 * @param {Array} deps        Re-runs when these change.
 * @param {{immediate?:boolean, onError?:Function}} [options]
 */
export function useAsync(asyncFn, deps = [], options = {}) {
  const { immediate = true, onError } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (mountedRef.current) setData(result);
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err);
      onErrorRef.current?.(err);
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: execute, setData };
}

// ============================================================================
// useTableState
// ============================================================================

/**
 * Search, sort, filter and pagination state for a list screen, in one hook.
 *
 * Changing the search term or a filter resets to page 1 - staying on page 4 of
 * a result set that now has two pages shows an empty table and looks broken.
 *
 * @param {{pageSize?:number, initialSort?:string, initialFilters?:object}} [options]
 */
export function useTableState(options = {}) {
  const { pageSize: initialPageSize = 20, initialSort = '', initialFilters = {} } = options;

  const [search, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortBy, setSortBy] = useState(initialSort);
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFiltersRaw] = useState(initialFilters);

  const debouncedSearch = useDebouncedValue(search, 350);

  const setSearch = useCallback((value) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key, value) => {
    setFiltersRaw((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const setFilters = useCallback((next) => {
    setFiltersRaw(next);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw(initialFilters);
    setSearchRaw('');
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Toggle direction when re-selecting the same column. */
  const toggleSort = useCallback((field) => {
    setSortBy((currentField) => {
      if (currentField === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
        return currentField;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  /** Query params, ready to pass straight to a list endpoint. */
  const params = useMemo(() => {
    const active = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined && value !== 'all') acc[key] = value;
      return acc;
    }, {});

    return {
      page,
      limit: pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(sortBy ? { sortBy, sortOrder } : {}),
      ...active,
    };
  }, [page, pageSize, debouncedSearch, sortBy, sortOrder, filters]);

  /** True when anything is narrowing the list - drives the "Clear" button. */
  const hasActiveFilters = useMemo(
    () =>
      Boolean(search) ||
      Object.values(filters).some((v) => v && v !== 'all' && v !== ''),
    [search, filters]
  );

  return {
    search, setSearch, debouncedSearch,
    page, setPage,
    pageSize, setPageSize,
    sortBy, sortOrder, toggleSort,
    filters, setFilter, setFilters, resetFilters,
    hasActiveFilters,
    params,
  };
}

// ============================================================================
// usePrevious
// ============================================================================

/** The value from the previous render. Useful for change detection. */
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

// ============================================================================
// useInterval
// ============================================================================

/**
 * A declarative `setInterval` that always calls the latest callback and
 * pauses when `delay` is null.
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null || delay === undefined) return undefined;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
