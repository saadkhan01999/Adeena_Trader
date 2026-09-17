/**
 * ============================================
 * ImageUpload (compatibility wrapper)
 * ============================================
 * Image-only uploading now lives in FileUpload, which also handles PDFs,
 * server-side storage and client-side downscaling.
 *
 * This module is kept so existing imports keep working, and because
 * "images only" is a genuinely useful constraint for product photos and
 * branding, where a PDF would make no sense.
 *
 * New code should import FileUpload directly.
 */

import FileUpload, { AvatarUpload } from './FileUpload.jsx';

/**
 * @param {object} props
 * @param {string|Array} props.value
 * @param {Function} props.onChange
 * @param {boolean} [props.multiple]
 * @param {number}  [props.maxImages=10]
 * @param {'square'|'video'|'portrait'|'wide'} [props.aspectRatio='square']
 */
export default function ImageUpload({
  value,
  onChange,
  multiple = false,
  maxImages = 10,
  label = 'Upload image',
  aspectRatio = 'square',
  folder = 'misc',
  hint,
  required,
  disabled,
  error,
  className,
}) {
  // The old component used `video` where FileUpload calls the same shape `wide`
  const aspect = aspectRatio === 'video' ? 'wide' : aspectRatio;

  return (
    <FileUpload
      label={label}
      hint={hint}
      value={value}
      onChange={onChange}
      multiple={multiple}
      maxFiles={maxImages}
      allowPdf={false}
      folder={folder}
      aspect={aspect}
      required={required}
      disabled={disabled}
      error={error}
      className={className}
    />
  );
}

export { AvatarUpload };
