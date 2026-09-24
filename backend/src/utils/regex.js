/**
 * Escape user-typed text before it is used inside a MongoDB $regex.
 *
 * Without this, searching for "Tecno (8GB)" or "C++" is an invalid pattern and
 * the list request fails with a server error instead of finding the item.
 */
export const escapeRegex = (text) => String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A case-insensitive "contains" match for a search box. */
export const containsText = (text) => ({ $regex: escapeRegex(text), $options: 'i' });

/**
 * The last moment of the day a "to" date names. `new Date('2026-09-24')` is
 * midnight at the START of the 24th, so a filter "to 24 Sep" compared against
 * it silently dropped everything recorded on the 24th itself.
 */
export const endOfDay = (value) => {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return end;
};
