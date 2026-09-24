/**
 * ============================================
 * BrandMark
 * ============================================
 * The ADEENA TRADERS logo, wherever it appears.
 *
 * One rule, in one place
 * ----------------------
 * A business that has uploaded its own logo under Settings sees that; everyone
 * else sees the bundled mark. That choice was previously repeated at five call
 * sites, each falling back to the letters "AT" in a gold square - so uploading
 * a logo changed the sidebar and the login screen but left the setup screen and
 * the printed documents showing initials.
 *
 * Two artworks, chosen by size
 * ----------------------------
 * The supplied logo is a full lockup - monogram, wordmark, product icons, the
 * owner's name and a phone number. That is right on a login card or a printed
 * letterhead and useless at 40px in the sidebar, where it collapses into a gold
 * smudge. Small sizes therefore render the AT monogram alone, which stays
 * legible down to a 16px browser tab.
 *
 * Why the artwork keeps its black ground
 * --------------------------------------
 * The mark is gold and silver drawn for a dark background: the word TRADERS and
 * the owner's name are near-white, and on cream they all but disappear. Knocking
 * the background out produces a logo that is unreadable on exactly the surfaces
 * that needed it. It is therefore framed as a badge on its own black ground,
 * which is also how the real stationery uses it - the invoice header, the
 * business card and the shop sign are all black.
 */

import { APP_LOGO, APP_LOGO_MARK, APP_NAME } from '../../constants/index.js';
import { resolveFileUrl } from '../../utils/index.js';
import { cn } from '../../utils/index.js';

const SIZES = {
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-10 h-10 rounded-lg',
  lg: 'w-14 h-14 rounded-xl',
  xl: 'w-20 h-20 rounded-2xl',
};

/**
 * @param {object} props
 * @param {string} [props.logo]   The business's uploaded logo, if it has one.
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {boolean} [props.ring]  Add a thin gold edge, for light surfaces.
 * @param {boolean} [props.full]  Force the full lockup even at a small size.
 */
export default function BrandMark({ logo, size = 'md', ring = false, full = false, className }) {
  // A business that uploaded its own logo gets that at every size - it is
  // theirs, and second-guessing which parts of it survive shrinking is not
  // something this component can do.
  // 56px (`lg`) is still too small for the wordmark to be read, so only `xl`
  // and an explicit `full` get the lockup.
  const bundled = full || size === 'xl' ? APP_LOGO : APP_LOGO_MARK;
  const src = logo ? resolveFileUrl(logo) : bundled;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden flex-shrink-0 bg-ink-950',
        SIZES[size] || SIZES.md,
        ring && 'ring-1 ring-gold-500/40',
        className
      )}
    >
      {/* `contain` rather than `cover`: the mark is square and must never be
          cropped, and the surrounding box is already black, so the letterboxing
          is invisible. */}
      <img src={src} alt={APP_NAME} className="w-full h-full object-contain" />
    </span>
  );
}

/**
 * The round emblem from the shop's reference screens: the AT mark in a black
 * disc inside a double metallic ring. Used where the logo leads - the sidebar,
 * the top bar, the dashboard - rather than the square BrandMark used in lists.
 */
export function BrandEmblem({ logo, size = 56, className }) {
  const src = logo ? resolveFileUrl(logo) : APP_LOGO_MARK;
  return (
    <span
      className={cn('inline-flex flex-shrink-0 rounded-full p-[2px] bg-gold-sheen shadow-glow', className)}
      style={{ width: size, height: size }}
    >
      <span className="flex w-full h-full rounded-full bg-ink-950 p-[2px]">
        <span className="flex w-full h-full rounded-full overflow-hidden ring-1 ring-gold-500/50 bg-ink-950">
          <img src={src} alt={APP_NAME} className="w-full h-full object-cover scale-[1.18]" />
        </span>
      </span>
    </span>
  );
}

/**
 * "ADEENA / TRADERS" in the engraved serif, filled with the theme's metallic
 * sweep, over the tagline - the lockup at the top of the reference sidebar.
 */
export function BrandWordmark({ name = APP_NAME, tagline = 'TRUST | QUALITY | GROWTH', size = 'lg', className }) {
  const [first, ...rest] = String(name).trim().split(/\s+/);
  const second = rest.join(' ');
  const big = size === 'lg';
  return (
    <span className={cn('flex flex-col min-w-0 leading-none', className)}>
      <span
        className={cn(
          'font-brand font-extrabold uppercase bg-gold-sheen bg-clip-text text-transparent truncate',
          big ? 'text-[23px] tracking-[0.02em]' : 'text-[15px] sm:text-lg tracking-[0.02em] sm:tracking-[0.05em]'
        )}
      >
        {first}
      </span>
      {second && (
        <span
          className={cn(
            'font-brand font-extrabold uppercase bg-gold-sheen bg-clip-text text-transparent truncate',
            big ? 'text-[23px] tracking-[0.02em] -mt-0.5' : 'text-[15px] sm:text-lg tracking-[0.02em] sm:tracking-[0.05em]'
          )}
        >
          {second}
        </span>
      )}
      {tagline && (
        <span className={cn('mt-1.5 text-white/85 font-medium whitespace-nowrap', big ? 'text-[9px] tracking-[0.16em]' : 'text-[9px] tracking-[0.2em]')}>
          {tagline}
        </span>
      )}
    </span>
  );
}
