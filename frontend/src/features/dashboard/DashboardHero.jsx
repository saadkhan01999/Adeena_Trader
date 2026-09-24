/**
 * The greeting card at the top of the dashboard, after the reference design:
 * the time-of-day greeting and the user's name in the theme's metallic accent,
 * the ownership lens as a chip, today's date, and the shop's motto on the right
 * - in Urdu when Urdu is switched on, in English otherwise.
 */

import { Sun, SunMedium, Moon, CalendarDays, Briefcase } from 'lucide-react';

import { useSettingsStore, useUrduEnabled } from '../../context/settingsStore.js';
import { OWNERSHIP_LABELS, APP_NAME } from '../../constants/index.js';
import { formatDate, getGreeting } from '../../utils/index.js';

/** Sun in the morning, softer sun in the afternoon, moon after dark. */
const greetingIcon = () => {
  const hour = new Date().getHours();
  if (hour < 12) return Sun;
  if (hour < 17) return SunMedium;
  return Moon;
};

export default function DashboardHero({ user, ownership }) {
  const business = useSettingsStore((s) => s.business);
  const urdu = useUrduEnabled();
  const Icon = greetingIcon();

  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink-950 text-white shadow-raised soft-in">
      {/* Metallic sweeps, top-right and bottom-right, as in the reference. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-sweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--gold-200))" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="rgb(var(--gold-500))" />
            <stop offset="1" stopColor="rgb(var(--gold-700))" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M250 0 C 320 30, 360 70, 400 60 L400 0 Z" fill="url(#hero-sweep)" opacity="0.18" />
        <path d="M230 160 C 300 120, 350 128, 400 96" stroke="url(#hero-sweep)" strokeWidth="2.2" fill="none" />
        <path d="M260 160 C 320 132, 360 136, 400 112" stroke="url(#hero-sweep)" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M300 0 C 330 20, 370 32, 400 26" stroke="url(#hero-sweep)" strokeWidth="1.4" fill="none" opacity="0.8" />
      </svg>

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 lg:p-7">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <Icon size={34} className="text-gold-400 flex-shrink-0 mt-0.5" strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-medium text-white/95">{getGreeting()},</p>
              <p className="text-2xl sm:text-3xl font-display font-extrabold bg-gold-sheen bg-clip-text text-transparent truncate">
                {user?.name || 'there'}
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gold-500/80 text-sm font-semibold text-gold-200">
              <Briefcase size={15} className="text-gold-400" />
              {OWNERSHIP_LABELS[ownership] || 'All Business'}
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-white/85">
              <CalendarDays size={16} className="text-white/70" />
              {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="hidden xs:flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
          {urdu ? (
            <p dir="rtl" lang="ur" className="urdu text-2xl sm:text-3xl text-gold-300 leading-none">
              اعتماد • معیار • ترقی
            </p>
          ) : (
            <p className="font-brand font-bold text-sm sm:text-base tracking-[0.2em] text-gold-300">
              TRUST • QUALITY • GROWTH
            </p>
          )}
          <p className="flex items-center gap-2 text-2xs sm:text-xs tracking-[0.24em] text-white/80 font-medium uppercase">
            <span className="w-5 h-px bg-gold-400" />
            {business?.name || APP_NAME}
            <span className="w-5 h-px bg-gold-400" />
          </p>
        </div>
      </div>
    </section>
  );
}
