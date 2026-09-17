/**
 * ============================================
 * FileUpload
 * ============================================
 * Drag-and-drop uploader for photos and PDF documents.
 *
 * How it works
 * ------------
 * Files are sent to the server's upload endpoint and the component hands back
 * a short public URL to store on the record - not a base64 blob. Images are
 * downscaled in the browser first, because a phone camera produces 4-8 MB files
 * and a CNIC scan only needs to be legible.
 *
 * Accepted: JPG, JPEG, PNG, WEBP and PDF.
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, Loader2, Eye, Star, ImageIcon } from 'lucide-react';
import {
  cn, compressImageFile, resolveFileUrl, isPdf, formatFileSize,
} from '../../utils/index.js';
import { uploadService } from '../../services/entities.js';
import {
  ACCEPTED_IMAGE_TYPES, ACCEPTED_DOC_TYPES,
  ACCEPTED_IMAGE_EXT, ACCEPTED_DOC_EXT, MAX_UPLOAD_MB,
} from '../../constants/index.js';

/**
 * @param {object} props
 * @param {string|Array} props.value       A URL, or an array of URLs / file objects.
 * @param {Function} props.onChange        Receives the new value.
 * @param {boolean} [props.multiple]
 * @param {number}  [props.maxFiles=10]
 * @param {boolean} [props.allowPdf]       Accept PDFs as well as images.
 * @param {string}  [props.folder='misc']  Server-side bucket.
 * @param {'square'|'wide'|'portrait'|'auto'} [props.aspect='square']
 * @param {Function} [props.onPrimaryChange] Enables the "set as cover" control.
 */
export default function FileUpload({
  label,
  hint,
  value,
  onChange,
  multiple = false,
  maxFiles = 10,
  allowPdf = false,
  folder = 'misc',
  aspect = 'square',
  required,
  disabled,
  error: externalError,
  onPrimaryChange,
  primaryIndex = 0,
  className,
  compact = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const acceptTypes = allowPdf ? ACCEPTED_DOC_TYPES : ACCEPTED_IMAGE_TYPES;
  const acceptExt = allowPdf ? ACCEPTED_DOC_EXT : ACCEPTED_IMAGE_EXT;

  /** Normalise `value` into a list of { url, name, size } for rendering. */
  const items = (() => {
    if (!value) return [];
    const list = multiple ? (Array.isArray(value) ? value : []) : [value];
    return list.filter(Boolean).map((entry) =>
      typeof entry === 'string' ? { url: entry } : entry
    );
  })();

  const handleFiles = useCallback(
    async (fileList) => {
      setError(null);
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      // ---- Validate before touching the network ----
      const badType = files.find((f) => !acceptTypes.includes(f.type));
      if (badType) {
        setError(
          allowPdf
            ? 'Only JPG, PNG, WEBP and PDF files can be uploaded.'
            : 'Only JPG, PNG and WEBP images can be uploaded.'
        );
        return;
      }

      const tooLarge = files.find((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
      if (tooLarge) {
        setError(`"${tooLarge.name}" is ${formatFileSize(tooLarge.size)}. The limit is ${MAX_UPLOAD_MB} MB.`);
        return;
      }

      if (multiple && items.length + files.length > maxFiles) {
        setError(`You can attach at most ${maxFiles} files. ${items.length} are already attached.`);
        return;
      }

      setUploading(true);
      setProgress(10);

      try {
        // Shrink images client-side; PDFs pass through untouched
        const prepared = await Promise.all(files.map((file) => compressImageFile(file)));
        setProgress(45);

        const response = multiple
          ? await uploadService.uploadMany(prepared, folder)
          : await uploadService.upload(prepared[0], folder);

        setProgress(100);

        if (multiple) {
          const uploaded = response.data.files;
          onChange?.([...items, ...uploaded]);
        } else {
          onChange?.(response.data.file.url, response.data.file);
        }
      } catch (err) {
        setError(err.message || 'The upload failed. Please check your connection and try again.');
      } finally {
        setUploading(false);
        // Clear the input so selecting the same file twice still fires onChange
        if (inputRef.current) inputRef.current.value = '';
        setTimeout(() => setProgress(0), 400);
      }
    },
    [items, multiple, maxFiles, folder, onChange, acceptTypes, allowPdf]
  );

  /** Remove an attachment, and delete the file from the server. */
  const handleRemove = useCallback(
    async (index) => {
      const target = items[index];

      if (multiple) {
        onChange?.(items.filter((_, i) => i !== index));
      } else {
        onChange?.(null);
      }

      // Best effort: the reference is already gone from the record, so a failed
      // cleanup should not surface as an error to the user.
      if (target?.url?.startsWith('/uploads')) {
        uploadService.remove(target.url).catch(() => {});
      }
    },
    [items, multiple, onChange]
  );

  const aspectClass = {
    square: 'aspect-square',
    wide: 'aspect-[16/10]',
    portrait: 'aspect-[3/4]',
    auto: 'min-h-[92px]',
  }[aspect];

  const canAddMore = multiple ? items.length < maxFiles : items.length === 0;

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className={cn('label', required && 'label-required')}>
          {label}
          {multiple && items.length > 0 && (
            <span className="ml-1.5 font-normal text-navy-400">
              ({items.length}/{maxFiles})
            </span>
          )}
        </label>
      )}

      {/* ---- Drop zone ---- */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={label || 'Upload a file'}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            'relative rounded-lg border-2 border-dashed text-center cursor-pointer overflow-hidden',
            'transition-all duration-200 ease-out-expo',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
            compact ? 'p-3' : 'p-4 sm:p-5',
            isDragging
              ? 'border-gold-500 bg-gold-50 scale-[1.01]'
              : 'border-navy-200 hover:border-gold-400 hover:bg-gold-50/40',
            (disabled || uploading) && 'pointer-events-none opacity-70',
            externalError && 'border-danger-300'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptExt}
            multiple={multiple}
            disabled={disabled}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <Loader2 size={22} className="text-gold-500 animate-spin" />
              <p className="text-sm font-medium text-navy-700">Uploading…</p>
              <div className="w-full max-w-[180px] h-1 rounded-full bg-navy-100 overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className={cn('flex items-center justify-center gap-3', compact ? 'flex-row' : 'flex-col gap-2')}>
              <span
                className={cn(
                  'flex items-center justify-center rounded-full bg-navy-50 text-navy-400 flex-shrink-0',
                  compact ? 'w-8 h-8' : 'w-11 h-11'
                )}
              >
                <Upload size={compact ? 15 : 19} />
              </span>

              <div className={cn(compact && 'text-left')}>
                <p className="text-sm text-navy-700">
                  <span className="font-semibold text-gold-600">Click to upload</span>
                  <span className="hidden sm:inline"> or drag a file here</span>
                </p>
                <p className="text-2xs text-navy-400 mt-0.5">
                  {allowPdf ? 'JPG, PNG, WEBP or PDF' : 'JPG, PNG or WEBP'} · up to {MAX_UPLOAD_MB} MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Errors ---- */}
      {(error || externalError) && (
        <p className="form-error" role="alert">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error || externalError}
        </p>
      )}
      {!error && !externalError && hint && <p className="form-hint">{hint}</p>}

      {/* ---- Previews ---- */}
      {items.length > 0 && (
        <div
          className={cn(
            'mt-3 grid gap-2',
            multiple ? 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-4' : 'grid-cols-1 max-w-[220px]'
          )}
        >
          {items.map((item, index) => {
            const url = resolveFileUrl(item.url);
            const pdf = isPdf(item.url) || item.mimetype === 'application/pdf';
            const isPrimary = onPrimaryChange && index === primaryIndex;

            return (
              <figure
                key={item.url || index}
                className={cn(
                  'relative group rounded-lg overflow-hidden border bg-navy-50',
                  aspectClass,
                  isPrimary ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-navy-200'
                )}
              >
                {pdf ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center h-full gap-1.5 p-2 hover:bg-navy-100 transition-colors"
                  >
                    <FileText size={26} className="text-danger-500" />
                    <span className="text-2xs text-navy-600 text-center line-clamp-2 break-all">
                      {item.name || 'Document.pdf'}
                    </span>
                  </a>
                ) : (
                  <img
                    src={url}
                    alt={item.name || `Attachment ${index + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Hover/tap actions. On touch devices there is no hover, so the
                    overlay is always faintly visible and fully opaque on focus. */}
                <figcaption
                  className={cn(
                    'absolute inset-x-0 top-0 flex items-center justify-end gap-1 p-1.5',
                    'bg-gradient-to-b from-navy-950/70 to-transparent',
                    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    'md:opacity-0 max-md:opacity-100',
                    'transition-opacity duration-200'
                  )}
                >
                  {onPrimaryChange && !pdf && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onPrimaryChange(index); }}
                      title={isPrimary ? 'This is the cover image' : 'Use as cover image'}
                      aria-label="Set as cover image"
                      className={cn(
                        'p-1 rounded-md transition-colors',
                        isPrimary ? 'bg-gold-500 text-navy-950' : 'bg-white/90 text-navy-600 hover:bg-white'
                      )}
                    >
                      <Star size={12} fill={isPrimary ? 'currentColor' : 'none'} />
                    </button>
                  )}

                  {!pdf && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="View full size"
                      aria-label="View full size"
                      className="p-1 rounded-md bg-white/90 text-navy-600 hover:bg-white transition-colors"
                    >
                      <Eye size={12} />
                    </a>
                  )}

                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                      title="Remove"
                      aria-label="Remove attachment"
                      className="p-1 rounded-md bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </figcaption>

                {isPrimary && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-gold-500 text-navy-950 text-2xs font-bold">
                    COVER
                  </span>
                )}
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A compact single-image picker for an avatar or logo.
 * Shows a round preview with a camera overlay rather than a drop zone.
 */
export function AvatarUpload({ value, onChange, label, folder = 'users', size = 'md', disabled }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const dimensions = { sm: 'w-14 h-14', md: 'w-20 h-20', lg: 'w-24 h-24' }[size];

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await compressImageFile(file, 600, 0.85);
      const response = await uploadService.upload(prepared, folder);
      onChange?.(response.data.file.url);
    } catch {
      // The parent surfaces upload errors through its own toast
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative rounded-full overflow-hidden border-2 border-navy-200 bg-navy-50 flex-shrink-0',
          'hover:border-gold-400 transition-all duration-200 active:scale-95 group',
          dimensions
        )}
        aria-label={label || 'Upload a photo'}
      >
        {value ? (
          <img src={resolveFileUrl(value)} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center w-full h-full text-navy-300">
            <ImageIcon size={20} />
          </span>
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-navy-950/60 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Upload size={16} className="text-white" />
          )}
        </span>
      </button>

      <div className="min-w-0">
        {label && <p className="text-sm font-medium text-navy-800">{label}</p>}
        <p className="text-2xs text-navy-400">JPG, PNG or WEBP · up to {MAX_UPLOAD_MB} MB</p>

        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="mt-1 text-2xs font-medium text-danger-600 hover:text-danger-700 transition-colors"
          >
            Remove photo
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_EXT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
