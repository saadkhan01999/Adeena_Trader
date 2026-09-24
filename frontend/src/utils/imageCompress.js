/**
 * ============================================
 * Image compression before upload
 * ============================================
 * A phone photo is routinely 3-8 MB. Three reasons not to send that:
 *   - The API runs on Vercel, which refuses any request body over 4.5 MB
 *     outright - the upload simply fails.
 *   - Files are stored in the database (see backend models/StoredFile.js),
 *     where every megabyte is paid for.
 *   - On a shop's mobile connection an 8 MB upload takes a minute.
 *
 * So images are redrawn at no more than 1600px on the long side and saved as
 * JPEG at 0.82 quality - visually the same on any screen or printed invoice,
 * typically 150-400 KB. PDFs, and images already small enough, go untouched.
 * If the browser cannot decode the file, the original is sent as-is and the
 * server decides.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** Below this, recompressing costs more than it saves. */
const SMALL_ENOUGH = 350 * 1024;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (error) => { URL.revokeObjectURL(url); reject(error); };
    img.src = url;
  });

/**
 * @param {File} file
 * @returns {Promise<File>} The compressed image, or the original file.
 */
export async function compressImage(file) {
  if (!file || !/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;
  if (file.size <= SMALL_ENOUGH) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // A PNG logo with a transparent ground would turn black as a JPEG, so
    // transparent images keep PNG. Everything else becomes JPEG.
    const keepPng = file.type === 'image/png' && file.size < 2 * 1024 * 1024;
    if (!keepPng) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(img, 0, 0, width, height);

    const type = keepPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + (keepPng ? '.png' : '.jpg');
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Compress a list of files, keeping their order. */
export const compressImages = (files) => Promise.all(Array.from(files || []).map(compressImage));
