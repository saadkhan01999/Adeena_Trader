/**
 * ============================================
 * Paper sizes and the print page
 * ============================================
 * Which paper a document prints on is a Settings choice per document type
 * (Settings > Printing & paper). This module turns that choice into the CSS
 * the browser's print engine needs, just before printing, and back again
 * after - so a thermal receipt and an A4 agreement can both print correctly
 * from the same app without a static stylesheet guessing.
 *
 * Full-page sizes share the A4 layout. Letter and Legal are A4's width, so
 * the layout simply sits on a taller page; A5 is scaled down to 70.5%, which
 * keeps every column and total exactly where A4 puts them. Thermal rolls get a
 * layout of their own (components/documents/ThermalDocument.jsx) - an A4
 * invoice shrunk to 80 mm is unreadable.
 */

export const PAPER_SIZES = [
  { id: 'a4', label: 'A4 (210 × 297 mm)', css: 'A4', widthMm: 210, heightMm: 297, description: 'Standard office paper' },
  { id: 'a5', label: 'A5 (148 × 210 mm) - half A4', css: 'A5', widthMm: 148, heightMm: 210, description: 'Half an A4 sheet', scale: 148 / 210 },
  { id: 'letter', label: 'Letter (8.5 × 11 in)', css: 'letter', widthMm: 216, heightMm: 279, description: 'US Letter' },
  { id: 'legal', label: 'Legal (8.5 × 14 in)', css: 'legal', widthMm: 216, heightMm: 356, description: 'US Legal - long agreements' },
  { id: 'thermal80', label: 'Thermal roll 80 mm', css: '80mm auto', widthMm: 80, heightMm: 0, thermal: true, printableMm: 72, description: 'Counter receipt printer' },
  { id: 'thermal58', label: 'Thermal roll 58 mm', css: '58mm auto', widthMm: 58, heightMm: 0, thermal: true, printableMm: 48, description: 'Small / handheld printer' },
];

export const paperById = (id) => PAPER_SIZES.find((p) => p.id === id) || PAPER_SIZES[0];

/** The paper chosen for a document type ('invoice' | 'receipt' | 'agreement' | 'report'). */
export function paperFor(type, printSettings = {}) {
  const key = { invoice: 'invoiceSize', receipt: 'receiptSize', agreement: 'agreementSize', report: 'reportSize' }[type];
  const paper = paperById(printSettings?.[key] || 'a4');
  // Agreements and reports are full pages by nature, whatever was saved.
  if (paper.thermal && (type === 'agreement' || type === 'report')) return PAPER_SIZES[0];
  return paper;
}

const STYLE_ID = 'at-print-page';

/**
 * Write the @page rules for one print job. Returns a function that removes
 * them again, so the next job starts from the stylesheet's A4 default.
 *
 * @param {object} paper   An entry of PAPER_SIZES.
 * @param {object} [options]
 * @param {'portrait'|'landscape'} [options.orientation]
 * @param {'color'|'grayscale'} [options.colorMode]
 */
export function applyPrintPage(paper, { orientation = 'portrait', colorMode = 'color' } = {}) {
  let css;

  if (paper.thermal) {
    css = `
      @page { size: ${paper.widthMm}mm auto; margin: 0; }
      @page :first { margin: 0; }
      .thermal-sheet { width: ${paper.printableMm}mm !important; margin: 0 auto !important; }
      .print-area { width: ${paper.widthMm}mm !important; }
    `;
  } else {
    const landscape = orientation === 'landscape';
    const size = `${paper.css} ${landscape ? 'landscape' : 'portrait'}`;
    const scale = paper.scale || 1;
    css = `
      @page { size: ${size}; margin: 12mm 0; }
      @page :first { margin: 0; }
      .doc-sheet {
        width: ${landscape ? Math.max(paper.heightMm, 210) : 210}mm !important;
        min-height: ${landscape ? paper.widthMm : paper.heightMm}mm !important;
        ${scale !== 1 ? `zoom: ${scale};` : ''}
      }
    `;
  }

  if (colorMode === 'grayscale') css += '\n.print-area { filter: grayscale(1); }';

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@media print { ${css} }`;

  return () => {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
  };
}
