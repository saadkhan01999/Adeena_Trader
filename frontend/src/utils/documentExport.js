/**
 * ============================================
 * Document Export
 * ============================================
 * Turns a rendered invoice, receipt, agreement or letterhead into a real file -
 * a PNG or a PDF - so it can be sent to a customer rather than described to
 * them.
 *
 * Why this exists
 * ---------------
 * Sharing previously sent only a line of text: "Invoice AT-1042". The customer
 * received a sentence, not their invoice. The shop's whole workflow is sending
 * the document itself over WhatsApp, so the share has to carry the document.
 *
 * Why an image is the default and PDF the alternative
 * ---------------------------------------------------
 * WhatsApp shows a PNG inline - the customer sees their invoice without
 * tapping anything, on a cheap phone, with no PDF reader. A PDF arrives as a
 * file to open, which is right for records and for emailing an agreement, and
 * wrong for a payment receipt someone wants to glance at. So both are offered
 * and the image leads.
 *
 * html2canvas is loaded on demand. It and jsPDF are together larger than the
 * rest of the app, and most sessions never export anything, so they are kept
 * out of the initial bundle and fetched the first time someone shares.
 */

/** A4 at 96dpi, in CSS pixels - the width every document is laid out to. */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/**
 * Paint a DOM node onto a canvas.
 *
 * scale: 2 renders at twice the CSS size, which is what keeps small print -
 * an IMEI, a CNIC - legible when the recipient zooms in. Higher than that
 * produces files too large to send over a weak connection.
 */
const renderToCanvas = async (node) => {
  const { default: html2canvas } = await import('html2canvas');

  return html2canvas(node, {
    scale: 2,
    useCORS: true,          // Uploaded photos are served from the API host
    backgroundColor: '#ffffff',
    logging: false,
    // The node is inside a scrolled, zoomed modal; without these the capture
    // is offset or clipped to whatever part happened to be visible.
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });
};

/** Canvas -> Blob, promisified. */
const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The document could not be converted.'))),
      type,
      quality
    );
  });

/**
 * Render a document node to a PNG file.
 *
 * @param {HTMLElement} node
 * @param {string} filename  Without extension.
 * @returns {Promise<File>}
 */
export const toPngFile = async (node, filename) => {
  const canvas = await renderToCanvas(node);
  const blob = await canvasToBlob(canvas, 'image/png');
  return new File([blob], `${filename}.png`, { type: 'image/png' });
};

/**
 * Render a document node to a PDF file, paginated to A4.
 *
 * A long instalment schedule runs past one page. Rather than shrinking the
 * whole document to fit - which makes the figures unreadable - the image is
 * placed at full width and the page window is moved down it, so page two
 * continues where page one stopped at the same size.
 *
 * @param {HTMLElement} node
 * @param {string} filename  Without extension.
 * @returns {Promise<File>}
 */
export const toPdfFile = async (node, filename) => {
  const { jsPDF } = await import('jspdf');

  const canvas = await renderToCanvas(node);
  const image = canvas.toDataURL('image/jpeg', 0.92);

  const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Scale the capture to the page width; its height follows from the aspect.
  const imageHeight = (canvas.height * pageWidth) / canvas.width;

  let remaining = imageHeight;
  let offset = 0;

  while (remaining > 0) {
    if (offset > 0) pdf.addPage();
    // A negative y slides the image up so the next slice lands on this page.
    pdf.addImage(image, 'JPEG', 0, -offset, pageWidth, imageHeight, undefined, 'FAST');
    remaining -= pageHeight;
    offset += pageHeight;
  }

  const blob = pdf.output('blob');
  return new File([blob], `${filename}.pdf`, { type: 'application/pdf' });
};

/** Trigger a browser download for a File or Blob. */
export const downloadFile = (file, filename) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || file.name || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously cancels the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Can this browser share this particular file?
 *
 * `canShare` must be asked about the actual file: a browser may support
 * sharing text and still refuse a PDF, and calling share() with an
 * unsupported file throws rather than degrading.
 */
export const canShareFile = (file) =>
  typeof navigator !== 'undefined' &&
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] });

/**
 * Share the document itself, with a graceful ladder of fallbacks.
 *
 * 1. The share sheet with the file attached - a phone, which is where this is
 *    used, and the only route that actually delivers the document.
 * 2. Download the file, then open WhatsApp with the message. Two steps, but
 *    the person has the file in hand and the chat open to attach it, which is
 *    what they would otherwise do manually anyway.
 * 3. Download alone.
 *
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export const shareDocument = async (file, { title, text, whatsappUrl } = {}) => {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (error) {
      // AbortError is the user closing the sheet - not a failure to report.
      if (error?.name === 'AbortError') return 'cancelled';
      // Anything else falls through to the download path below.
    }
  }

  downloadFile(file);
  if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener');
  return 'downloaded';
};

export { A4_WIDTH_PX, A4_HEIGHT_PX };
