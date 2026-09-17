/**
 * ============================================
 * Export & Print Helpers
 * ============================================
 * One implementation of CSV export, print and PDF, shared by every screen, so
 * the Export button behaves identically everywhere.
 *
 * On PDF
 * ------
 * The browser's own print dialog is used with "Save as PDF" rather than a
 * bundled PDF library. That choice is deliberate: the printed document is the
 * exact HTML that was on screen, it needs no extra megabytes of JavaScript, and
 * it prints correctly from a phone as well as a desktop. The print stylesheet
 * in index.css (`.print-area`) does the layout work.
 */

import { downloadFile, formatDate, titleCase } from './index.js';

// ============================================================================
// CSV
// ============================================================================

/**
 * Escape one CSV cell.
 *
 * A value starting with =, +, - or @ is prefixed with a single quote, because
 * Excel would otherwise evaluate it as a formula. That is a real injection
 * route whenever a cell contains a customer-supplied name or note.
 */
const escapeCell = (value) => {
  if (value === null || value === undefined) return '';

  let str = value instanceof Date ? formatDate(value) : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;

  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/**
 * Build CSV text from rows.
 *
 * @param {Array<object>} rows
 * @param {Array<{key:string,label?:string,format?:Function}>|Array<string>} [columns]
 *        Defaults to the keys of the first row.
 * @returns {string}
 */
export function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return '';

  const cols = (columns || Object.keys(rows[0])).map((col) =>
    typeof col === 'string' ? { key: col, label: titleCase(col) } : { label: titleCase(col.key), ...col }
  );

  const lines = [
    cols.map((c) => escapeCell(c.label)).join(','),
    ...rows.map((row) =>
      cols.map((c) => escapeCell(c.format ? c.format(row[c.key], row) : row[c.key])).join(',')
    ),
  ];

  return lines.join('\r\n');
}

/**
 * Download rows as a CSV file.
 *
 * The UTF-8 BOM matters: without it Excel misreads non-ASCII characters, which
 * mangles Urdu names and the "Rs." symbol.
 */
export function exportToCSV(rows, filename, columns) {
  if (!rows || rows.length === 0) return false;

  const csv = toCSV(rows, columns);
  const stamped = filename.endsWith('.csv')
    ? filename
    : `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;

  downloadFile(`﻿${csv}`, stamped, 'text/csv;charset=utf-8;');
  return true;
}

/** Download rows as formatted JSON (used for backups and debugging). */
export function exportToJSON(data, filename) {
  const stamped = filename.endsWith('.json')
    ? filename
    : `${filename}-${new Date().toISOString().slice(0, 10)}.json`;

  downloadFile(JSON.stringify(data, null, 2), stamped, 'application/json');
  return true;
}

// ============================================================================
// Print
// ============================================================================

/**
 * Print whatever is currently marked `.print-area`.
 *
 * The document to print is already rendered inside the open modal, so this only
 * has to set the title (browsers use it as the default PDF filename) and hand
 * over to the print dialog.
 *
 * @param {string} [documentTitle] Becomes the suggested PDF filename.
 */
export function printCurrentView(documentTitle) {
  const previousTitle = document.title;
  if (documentTitle) document.title = documentTitle;

  // Restore the title once printing finishes, whether the user printed or
  // cancelled. `afterprint` covers both in every current browser.
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);

  // One frame of delay lets React commit any last-moment DOM change
  requestAnimationFrame(() => window.print());
}

/**
 * Print an arbitrary element by temporarily marking it as the print area.
 * Used where the printable content is not already inside a modal.
 *
 * @param {HTMLElement} element
 * @param {string} [documentTitle]
 */
export function printElement(element, documentTitle) {
  if (!element) return;

  const hadClass = element.classList.contains('print-area');
  if (!hadClass) element.classList.add('print-area');

  const cleanup = () => {
    if (!hadClass) element.classList.remove('print-area');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  printCurrentView(documentTitle);
}

/**
 * Save the current print area as a PDF.
 *
 * Mechanically the same as printing - the browser's print dialog offers
 * "Save as PDF" as a destination - but named separately so the UI can present
 * two obvious buttons. A short hint is returned for the caller to show.
 */
export function saveAsPDF(documentTitle) {
  printCurrentView(documentTitle);
  return 'Choose "Save as PDF" as the destination in the print dialog.';
}

// ============================================================================
// Filenames
// ============================================================================

/**
 * Build a safe, descriptive filename.
 * `buildFilename('invoice', 'INV-1042')` -> "invoice-INV-1042-2026-09-16"
 */
export function buildFilename(...parts) {
  return [...parts, new Date().toISOString().slice(0, 10)]
    .filter(Boolean)
    .map((p) => String(p).replace(/[^\w.-]+/g, '-'))
    .join('-')
    .replace(/-+/g, '-');
}
