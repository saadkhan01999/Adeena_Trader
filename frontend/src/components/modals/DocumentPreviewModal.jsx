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

import { useState } from 'react';
import { Printer, FileDown, Share2, X, Check, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

import Modal from '../common/Modal.jsx';
import Button, { IconButton } from '../common/Button.jsx';
import InvoiceDocument from '../documents/InvoiceDocument.jsx';
import ReceiptDocument from '../documents/ReceiptDocument.jsx';
import AgreementDocument from '../documents/AgreementDocument.jsx';
import { printCurrentView, buildFilename } from '../../utils/export.js';
import { useToastStore } from '../../context/toastStore.js';
import { cn, getWhatsAppURL, copyToClipboard } from '../../utils/index.js';
import { DOCUMENT_TYPES } from '../../constants/index.js';

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
  const [zoom, setZoom] = useState(1);

  if (!data) return null;

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
    printCurrentView(filename);
    // The dialog is modal to the browser, so this only needs to outlast the
    // moment it takes to open.
    setTimeout(() => setPrinting(false), 1200);
  };

  const handleSavePdf = () => {
    printCurrentView(filename);
    toast.info('Choose "Save as PDF" as the destination in the print dialog.', 6000);
  };

  const handleShare = async () => {
    // The Web Share API is the natural route on a phone; fall back to WhatsApp
    // where it is unavailable, which is how this shop sends documents anyway.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${meta.label} ${meta.reference}`,
          text: shareMessage || `${meta.label} ${meta.reference}`,
        });
        return;
      } catch {
        // The user dismissed the share sheet - not an error worth reporting
      }
    }

    if (sharePhone) {
      window.open(getWhatsAppURL(sharePhone, shareMessage || `${meta.label} ${meta.reference}`), '_blank');
      return;
    }

    const copied = await copyToClipboard(shareMessage || meta.reference);
    toast[copied ? 'success' : 'error'](
      copied ? 'Details copied to the clipboard.' : 'Could not copy to the clipboard.'
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      printable
      title={title || `${meta.label} ${meta.reference || ''}`}
      subtitle="Preview exactly as it will print"
      bodyClassName="bg-navy-100/60 p-0"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Zoom - desktop only, where the sheet fits but may be small */}
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

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
            <Button variant="secondary" onClick={onClose} icon={X}>
              Close
            </Button>

            <Button variant="secondary" onClick={handleShare} icon={Share2}>
              Share
            </Button>

            <Button variant="secondary" onClick={handleSavePdf} icon={FileDown}>
              Save as PDF
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
          className="mx-auto bg-white shadow-raised origin-top transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, width: 'fit-content', minWidth: '100%' }}
        >
          <DocComponent
            {...{ [meta.propName]: data }}
            business={business}
            template={template}
          />
        </div>
      </div>
    </Modal>
  );
}
