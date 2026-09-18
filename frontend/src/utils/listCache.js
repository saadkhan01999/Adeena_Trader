/**
 * ============================================
 * List Cache
 * ============================================
 * Remembers the last result each list screen showed, so returning to a tab
 * paints immediately instead of starting from an empty skeleton.
 *
 * Why in memory and not the service worker
 * ----------------------------------------
 * The service worker already caches API responses, but going through it is
 * still a fetch: a promise, a tick, a re-render. The tab is blank for that
 * whole time, which is exactly the flicker this removes. Holding the parsed
 * result in memory means the rows are on screen in the same frame the screen
 * mounts.
 *
 * Stale on purpose
 * ----------------
 * What is shown from here may be seconds or minutes old, and the screen
 * refetches immediately behind it. That is the right trade for a list: seeing
 * yesterday's row for 300ms while today's loads is far better than seeing
 * nothing. It is NOT the right trade for anything someone acts on directly,
 * which is why this holds list pages only - never a single record being
 * edited, a balance being paid, or a form being submitted.
 *
 * Cleared on sign-out so the next user never sees the previous one's data.
 */

/** Keyed by screen + query. @type {Map<string, {value: unknown, at: number}>} */
const cache = new Map();

/** Beyond this the entry is dropped rather than shown; a stale list is fine, a forgotten one is not. */
const MAX_AGE_MS = 5 * 60 * 1000;

/** Bounded so a long session paging through records cannot grow without limit. */
const MAX_ENTRIES = 40;

/** Build a stable key from the screen name and its query parameters. */
export const cacheKey = (screen, params = {}) => {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');
  return `${screen}?${sorted}`;
};

/**
 * The remembered result, or undefined when there is none or it is too old.
 * @param {string} key
 */
export const readList = (key) => {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.at > MAX_AGE_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
};

/**
 * Remember a result.
 * @param {string} key
 * @param {unknown} value
 */
export const writeList = (key, value) => {
  // Oldest out first. Map preserves insertion order, so the first key is the
  // least recently written.
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, at: Date.now() });
};

/**
 * Forget everything, or every entry for one screen.
 *
 * Called on sign-out, and after a write that could have changed rows the user
 * is not currently looking at - deleting a customer changes the sales list
 * too, and showing the old one afterwards would be a bug rather than a
 * harmless staleness.
 *
 * @param {string} [screen] Omit to clear the lot.
 */
export const clearList = (screen) => {
  if (!screen) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${screen}?`)) cache.delete(key);
  }
};

export default { cacheKey, readList, writeList, clearList };
