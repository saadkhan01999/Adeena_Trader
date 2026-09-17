/**
 * ============================================
 * Utility Functions
 * ============================================
 * Small, pure helpers used across the application. Anything that touches money
 * lives in financialEngine.js instead, so the formulas stay in one place.
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CURRENCY_SYMBOL, API_BASE_URL } from '../constants/index.js';

// ============================================================================
// Class names
// ============================================================================

/**
 * Merge Tailwind classes, resolving conflicts so the last one wins.
 * `cn('p-2', condition && 'p-4')` reliably yields `p-4`.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Numbers & currency
// ============================================================================

/** Coerce anything to a finite number, defaulting to 0. */
export function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return Number.isNaN(n) || !Number.isFinite(n) ? 0 : n;
}

/** Format as PKR, e.g. 135000 -> "Rs. 135,000". */
export function formatCurrency(amount, withSymbol = true) {
  const formatted = Math.round(parseNumber(amount)).toLocaleString('en-PK');
  return withSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
}

/** Thousand separators, no symbol. */
export function formatNumber(amount, decimals = 0) {
  return parseNumber(amount).toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Abbreviate a large figure for a chart axis or a tight tile.
 * 1_250_000 -> "12.5L" (lakh), which is how amounts are spoken in Pakistan.
 */
export function formatCompact(amount) {
  const n = parseNumber(amount);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}${abs}`;
}

/** Percentage with a fixed number of decimals. */
export function formatPercent(value, decimals = 1) {
  return `${parseNumber(value).toFixed(decimals)}%`;
}

// ============================================================================
// Dates
// ============================================================================

/** "16 Sep 2026". Returns "-" for anything unparseable. */
export function formatDate(value, options = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/** "16 Sep 2026, 14:30". */
export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `YYYY-MM-DD`, the value format an `<input type="date">` expects. */
export function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Offset by the timezone so a date near midnight does not shift a day
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Relative time, e.g. "3d ago". */
export function timeAgo(value) {
  if (!value) return '-';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';

  const units = [
    { limit: 3600, div: 60, suffix: 'm ago' },
    { limit: 86_400, div: 3600, suffix: 'h ago' },
    { limit: 2_592_000, div: 86_400, suffix: 'd ago' },
    { limit: 31_536_000, div: 2_592_000, suffix: 'mo ago' },
  ];

  for (const { limit, div, suffix } of units) {
    if (seconds < limit) return `${Math.floor(seconds / div)}${suffix}`;
  }
  return `${Math.floor(seconds / 31_536_000)}y ago`;
}

/** Whole days between two dates, ignoring the time of day. */
export function daysBetween(from, to = new Date()) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

/** Common report ranges, so every screen offers the same choices. */
export function dateRangePresets() {
  const today = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const minus = (days) => startOfDay(new Date(today.getTime() - days * 86_400_000));

  return [
    { id: 'today', label: 'Today', start: startOfDay(today), end: today },
    { id: '7d', label: 'Last 7 days', start: minus(6), end: today },
    { id: '30d', label: 'Last 30 days', start: minus(29), end: today },
    { id: '90d', label: 'Last 90 days', start: minus(89), end: today },
    {
      id: 'month',
      label: 'This month',
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    },
    {
      id: 'lastMonth',
      label: 'Last month',
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0),
    },
    { id: 'year', label: 'This year', start: new Date(today.getFullYear(), 0, 1), end: today },
  ];
}

/** Time-of-day greeting for the dashboard header. */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good evening';
}

// ============================================================================
// Text
// ============================================================================

/** Initials for an avatar: "Imran Ullah" -> "IU". */
export function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function truncate(text, maxLength = 50) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** "installment_agreement" -> "Installment Agreement". */
export function titleCase(text) {
  if (!text) return '';
  return String(text)
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Wait `delay` ms after the last call before running `fn`. */
export function debounce(fn, delay = 300) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

// ============================================================================
// Phone & messaging
// ============================================================================

/** "0310-009 1875" -> "923100091875" (WhatsApp's required format). */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (!digits.startsWith('92')) digits = `92${digits}`;
  return digits;
}

/** Click-to-chat URL with the message pre-filled. */
export function getWhatsAppURL(phone, message = '') {
  const number = normalizePhoneForWhatsApp(phone);
  if (!number) return '';
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** `tel:` link for a one-tap call on mobile. */
export function getTelURL(phone) {
  if (!phone) return '';
  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}

// ============================================================================
// Files
// ============================================================================

/**
 * Turn a stored file reference into something an <img> or <a> can use.
 * Handles absolute URLs, legacy base64 payloads and server-relative paths.
 */
export function resolveFileUrl(value) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http')) return value;

  // `/uploads/...` is served by the API host, not the SPA host
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
}

/** True when the reference points at a PDF rather than an image. */
export function isPdf(value) {
  if (!value) return false;
  return /\.pdf($|\?)/i.test(value) || value.startsWith('data:application/pdf');
}

/** "1536000" -> "1.5 MB". */
export function formatFileSize(bytes) {
  const n = parseNumber(bytes);
  if (n === 0) return '0 KB';
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

/** Read a File into a base64 data URL (used for instant local previews). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale an image in the browser before uploading.
 *
 * A phone camera produces 4-8 MB photos; a CNIC scan only needs to be legible.
 * Resizing client-side keeps uploads fast on a weak mobile connection and
 * keeps the server's disk usage sane. PDFs are passed through untouched.
 *
 * @returns {Promise<File>} A new JPEG File, or the original for non-images.
 */
export async function compressImageFile(file, maxWidth = 1400, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) return file;

  const dataUrl = await fileToBase64(file);

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      // White backing: a transparent PNG would otherwise flatten to black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file); // Fall back to the original
          const name = file.name.replace(/\.[^.]+$/, '') || 'image';
          resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };

    // A corrupt or unsupported image should not block the upload entirely
    img.onerror = () => resolve(file);
    img.src = dataUrl;
  });
}

/** Trigger a browser download for generated content. */
export function downloadFile(content, filename, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Give the browser a moment to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// Validation
// ============================================================================

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

/** Pakistani CNIC: 12345-1234567-1, or 13 digits unformatted. */
export function isValidCNIC(cnic) {
  const value = String(cnic || '');
  return /^\d{5}-\d{7}-\d$/.test(value) || /^\d{13}$/.test(value);
}

/** Insert CNIC hyphens as the user types. */
export function formatCNIC(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

/** Insert the Pakistani mobile hyphen as the user types: 0310-0091875. */
export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

// ============================================================================
// Misc
// ============================================================================

/** Stable colour for an avatar, derived from the name so it never changes. */
export function stringToColor(str) {
  const palette = [
    'bg-navy-800', 'bg-gold-600', 'bg-info-600',
    'bg-success-600', 'bg-danger-600', 'bg-violet-600',
  ];
  let hash = 0;
  for (let i = 0; i < String(str || '?').length; i += 1) {
    hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Copy to the clipboard, falling back for browsers without the async API. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

/** Sum a numeric field across a list. */
export function sumBy(items, key) {
  return (items || []).reduce(
    (total, item) => total + parseNumber(typeof key === 'function' ? key(item) : item[key]),
    0
  );
}

/** Group a list into a plain object keyed by a field or accessor. */
export function groupBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const bucket = typeof key === 'function' ? key(item) : item[key];
    (acc[bucket] ||= []).push(item);
    return acc;
  }, {});
}
