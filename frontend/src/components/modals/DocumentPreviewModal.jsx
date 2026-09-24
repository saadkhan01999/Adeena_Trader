/**
 * ============================================
 * DocumentPreviewModal
 * ============================================
 * Previews an invoice, receipt or agreement, and prints or saves it as PDF.
 *
 * The preview IS the printed output - the same component renders both, and the
 * print stylesheet simply hides everything outside `.print-area`. That removes
 * the usual class of bug where the PDF looks nothing like the preview.
 *
 * On a phone the sheet is horizontally scrollable at A4 width rather than
 * reflowed, because a customer comparing the printed copy to the screen needs
 * to see the same layout.
 */

import { useState, useRef } from 'react';
import { Printer, FileDown, ImageDown, Share2, X, Check, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

import Modal from '../common/Modal.jsx';
import Button, { IconButton } from '../common/Button.jsx';
import InvoiceDocument from '../documents/InvoiceDocument.jsx';
import ReceiptDocument from '../documents/ReceiptDocument.jsx';
import AgreementDocument from '../documents/AgreementDocument.jsx';
import ThermalDocument from '../documents/ThermalDocument.jsx';
import { useSettingsStore } from '../../context/settingsStore.js';
import { PAPER_SIZES, paperFor, paperById, applyPrintPage } from '../../utils/printPage.js';
import { printCurrentView, buildFilename } from '../../utils/export.js';
import { useToastStore } from '../../context/toastStore.js';
import { cn, getWhatsAppURL, copyToClipboard } from '../../utils/index.js';
import { DOCUMENT_TYPES } from '../../constants/index.js';
import { toPngFile, toPdfFile, downloadFile, shareDocument } from '../../utils/documentExport.js';

/**
 * @param {object} props
 * @param {'invoice'|'receipt'|'agreement'} props.type
 * @param {object} props.data      sale | payment | agreement
 * @param {object} props.business
 * @param {object} [props.template]
 * @param {string} [props.shareMessage] Text used by the WhatsApp share button.
 * @param {string} [props.sharePhone]
 */
export default function DocumentPreviewModal({
  isOpen,
  onClose,
  type = 'invoice',
  data,
  business,
  template,
  shareMessage,
  sharePhone,
  title,
}) {
  const toast = useToastStore();
  const [printing, setPrinting] = useState(false);
  /** 'image' | 'pdf' | null - which export is being built. */
  const [busy, setBusy] = useState(null);
  const sheetRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const print = useSettingsStore((state) => state.settings?.print) || {};
  // The paper comes from Settings > Printing & paper, and can be switched for
  // this one print from the footer - without changing the saved choice.
  const [paperOverride, setPaperOverride] = useState(null);

  if (!data) return null;

  const paper = paperOverride ? paperById(paperOverride) : paperFor(type, print);
  const thermal = paper.thermal && (type === 'invoice' || type === 'receipt');
  const copies = Math.min(5, Math.max(1, Number(print.copies) || 1));
  const paperOptions = PAPER_SIZES.filter((p) => type !== 'agreement' || !p.thermal);

  const meta = {
    invoice: {
      label: 'Invoice',
      reference: data.invoiceNumber,
      Component: InvoiceDocument,
      propName: 'sale',
    },
    receipt: {
      label: 'Receipt',
      reference: data.receiptNumber,
      Component: ReceiptDocument,
      propName: 'payment',
    },
    agreement: {
      label: 'Agreement',
      reference: data.agreementNumber,
      Component: AgreementDocument,
      propName: 'agreement',
    },
  }[type];

  const DocComponent = meta.Component;
  const filename = buildFilename(type, meta.reference);

  const handlePrint = () => {
    setPrinting(true);
    // The paper's @page rules exist only for this print, then go again.
    const cleanup = applyPrintPage(paper, { orientation: print.orientation, colorMode: print.colorMode });
    printCurrentView(filename, cleanup);
    // The dialog is modal to the browser, so this only needs to outlast the
    // moment it takes to open.
    setTimeout(() => setPrinting(false), 1200);
  };

  /**
   * Build the file, with the work reported and failures surfaced.
   *
   * Rendering a full page to a canvas takes a second or two on a cheap phone,
   * which is long enough that an unlabelled pause reads as the button not
   * having worked.
   */
  const buildFile = async (kind) => {
    const node = sheetRef.current;
    if (!node) {
      toast.error('The document is not ready yet.');
      return null;
    }

    setBusy(kind);
    try {
      return kind === 'pdf'
        ? await toPdfFile(node, filename, paper, print.orientation)
        : await toPngFile(node, filename);
    } catch (error) {
      toast.error(`Could not prepare the ${kind === 'pdf' ? 'PDF' : 'image'}. ${error.message}`);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleSavePdf = async () => {
    const file = await buildFile('pdf');
    if (file) {
      downloadFile(file);
      toast.success(`${meta.label} saved as PDF.`);
    }
  };

  const handleSaveImage = async () => {
    const file = await buildFile('image');
    if (file) {
      downloadFile(file);
      toast.success(`${meta.label} saved as an image.`);
    }
  };

  /**
   * Send the document itself, not a sentence about it.
   *
   * An image rather than a PDF: WhatsApp shows a PNG inline, so the customer
   * sees their invoice without tapping anything, on a cheap phone with no PDF
   * reader. The PDF button is there for records and for emailing an agreement.
   */
  const handleShare = async () => {
    const file = await buildFile('image');
    if (!file) return;

    const message = shareMessage || `${meta.label} ${meta.reference || ''}`.trim();

    const result = await shareDocument(file, {
      title: `${meta.label} ${meta.reference || ''}`.trim(),
      text: message,
      whatsappUrl: sharePhone ? getWhatsAppURL(sharePhone, message) : undefined,
    });

    if (result === 'downloaded') {
      toast.info(
        sharePhone
          ? 'Image saved — attach it in the WhatsApp chat that just opened.'
          : 'Image saved to your downloads. Attach it to your message.',
        7000
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      printable
      title={title || `${meta.label} ${meta.reference || ''}`}
      subtitle={`Preview exactly as it will print · ${paper.label}`}
      bodyClassName="bg-navy-100/60 p-0"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Paper for this print, and zoom */}
          <div className="flex items-center gap-2">
          <select
            value={paper.id}
            onChange={(e) => setPaperOverride(e.target.value)}
            aria-label="Paper size"
            className="input input-sm w-auto"
            title="Paper for this print (the default is set in Settings > Printing & paper)"
          >
            {paperOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <div className="hidden sm:flex items-center gap-1">
            <IconButton
              icon={ZoomOut}
              label="Zoom out"
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              disabled={zoom <= 0.6}
            />
            <span className="w-11 text-center text-2xs text-navy-500 tabular">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              icon={ZoomIn}
              label="Zoom in"
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              disabled={zoom >= 1.4}
            />
          </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
            <Button variant="secondary" onClick={onClose} icon={X}>
              Close
            </Button>

            <Button
              variant="secondary"
              onClick={handleShare}
              icon={Share2}
              isLoading={busy === 'image'}
              loadingText="Preparing…"
            >
              Share
            </Button>

            <Button
              variant="secondary"
              onClick={handleSaveImage}
              icon={ImageDown}
              isLoading={busy === 'image'}
            >
              Image
            </Button>

            <Button
              variant="secondary"
              onClick={handleSavePdf}
              icon={FileDown}
              isLoading={busy === 'pdf'}
              loadingText="Building…"
            >
              PDF
            </Button>

            <Button
              variant="gold"
              onClick={handlePrint}
              icon={printing ? Loader2 : Printer}
              isLoading={printing}
              loadingText="Opening…"
            >
              Print
            </Button>
          </div>
        </div>
      }
    >
      {/* The scroll container is separate from the sheet so zoom does not fight
          the modal's own scrolling. */}
      <div className="overflow-auto p-3 sm:p-6 scrollbar-thin">
        <div
          className="doc-zoom mx-auto bg-white shadow-raised origin-top transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, width: 'fit-content', minWidth: '100%' }}
        >
          {/* The ref sits on the sheet, inside the zoom wrapper: capturing the
              wrapper would bake the current zoom into the exported file, so a
              document viewed at 60% would be sent at 60%. */}
          <div ref={sheetRef} className={cn(thermal && 'py-4 bg-white')}>
            {thermal ? (
              <ThermalDocument kind={type} {...{ [meta.propName]: data }} business={business} paper={paper} />
            ) : (
              <DocComponent
                {...{ [meta.propName]: data }}
                business={business}
                template={template}
              />
            )}
          </div>
          {/* Extra copies (Settings > Printing & paper) print one after
              another; they never show on screen. */}
          {Array.from({ length: copies - 1 }).map((_, index) => (
            <div key={index} className="print-only page-break">
              {thermal ? (
                <ThermalDocument kind={type} {...{ [meta.propName]: data }} business={business} paper={paper} />
              ) : (
                <DocComponent {...{ [meta.propName]: data }} business={business} template={template} />
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
