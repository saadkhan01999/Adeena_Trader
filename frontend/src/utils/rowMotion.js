/**
 * ============================================
 * Row motion helpers
 * ============================================
 * Updating a list in place, with the small animations DataTable understands
 * (see "Row motion" there), instead of refetching the whole list - which is
 * what made every add, edit and delete blank the table and rebuild it.
 *
 * All three take the screen's own `setRecords` state setter.
 */

/** How long the slide-out runs before the row is dropped. Matches .row-leave. */
const LEAVE_MS = 280;
/** How long an edited row keeps its glow flag. Matches .row-flash. */
const FLASH_MS = 1400;

const idOf = (record) => record?._id || record?.id;

/** Slide a row out, then remove it. */
export function removeRow(setRecords, id) {
  setRecords((rows) => rows.map((row) => (idOf(row) === id ? { ...row, __leaving: true } : row)));
  setTimeout(() => {
    setRecords((rows) => rows.filter((row) => idOf(row) !== id));
  }, LEAVE_MS);
}

/** Put a saved record in place of its old row, and let it glow once. */
export function replaceRow(setRecords, saved, fallbackId) {
  const id = idOf(saved) || fallbackId;
  setRecords((rows) => rows.map((row) => (idOf(row) === id ? { ...row, ...saved, __fresh: true } : row)));
  setTimeout(() => {
    setRecords((rows) =>
      rows.map((row) => {
        if (idOf(row) !== id || !row.__fresh) return row;
        const { __fresh, ...rest } = row;
        return rest;
      })
    );
  }, FLASH_MS);
}

/** Add a new record at the top; DataTable slides it in on its own. */
export function prependRow(setRecords, created) {
  setRecords((rows) => [created, ...rows.filter((row) => idOf(row) !== idOf(created))]);
}
