/**
 * Escape user-typed text before it is used inside a MongoDB $regex.
 *
 * Without this, searching for "Tecno (8GB)" or "C++" is an invalid pattern and
 * the list request fails with a server error instead of finding the item.
 */
export const escapeRegex = (text) => String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A case-insensitive "contains" match for a search box. */
export const containsText = (text) => ({ $regex: escapeRegex(text), $options: 'i' });
