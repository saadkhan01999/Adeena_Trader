/**
 * ============================================
 * Sidebar
 * ============================================
 * Primary navigation, laid out after the shop's reference design: the round AT
 * emblem and the ADEENA TRADERS wordmark at the top, a metallic rule, the
 * screens grouped under accent headings with a hairline running out to the
 * edge, the active screen as a lit accent bar, and the connection state and
 * signed-in user at the foot.
 *
 * Two behaviours, one component:
 *   - Below `lg` it is an off-canvas drawer opened from the top bar.
 *   - From `lg` up it is a permanent column that collapses to an icon rail from
 *     the toggle at the top of the panel.
 *
 * Every colour is a theme token, so the same panel is black-and-gold, navy-and-
 * blue or forest-and-emerald depending on the theme chosen in Settings.
 *
 * Groups can be folded by clicking their heading. They start open - the
 * reference shows every screen at a glance - and the group holding the current
 * screen always reopens itself, so the user never loses their place.
 */

import { useMemo, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  X, PanelLeftClose, PanelLeftOpen, LogOut, Wifi, WifiOff, ChevronDown, ChevronRight, User,
} from 'lucide-react';
import { getIcon } from '../common/Icon.jsx';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { NAV_GROUPS, APP_NAME, ROLE_META } from '../../constants/index.js';
import { NAV_LABELS, GROUP_LABELS } from '../../i18n/index.js';
import { Urdu } from '../common/Bilingual.jsx';
import { BrandEmblem, BrandWordmark } from '../common/BrandMark.jsx';
import { cn, resolveFileUrl } from '../../utils/index.js';

export default function Sidebar({ overdueCount = 0, lowStockCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const {
    sidebarCollapsed, sidebarOpen, collapsedGroups,
    toggleSidebar, setSidebarOpen, toggleGroup, openGroup, isOnline,
  } = useUIStore();

  const { user, hasPermission, logout } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  /** Hide what the user cannot open, and any group left empty by that. */
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.permission)),
      })).filter((group) => group.items.length > 0),
    [hasPermission]
  );

  const activeGroupId = useMemo(
    () => groups.find((g) => g.items.some((i) => pathname.startsWith(i.path)))?.id,
    [groups, pathname]
  );

  // Whatever happens, the group holding the current screen is open.
  useEffect(() => {
    if (activeGroupId) openGroup(activeGroupId);
  }, [activeGroupId, openGroup]);

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isRail = sidebarCollapsed;
  const badges = { overdue: overdueCount, lowStock: lowStockCount };

  return (
    <>
      {/* ---- Mobile backdrop ---- */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'fixed inset-0 z-overlay bg-ink-950/60 backdrop-blur-[2px] lg:hidden no-print',
          'transition-opacity duration-200',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-[100dvh] lg:h-screen flex flex-col flex-shrink-0 overflow-hidden',
          'z-overlay lg:z-sticky text-ink-100 no-print',
          'bg-ink-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(var(--gold-500)/0.10),transparent_60%)]',
          // The accent edge down the right-hand side, as in the reference.
          'border-r-2 border-gold-500/70 shadow-[4px_0_24px_-12px_rgb(var(--gold-500)/0.6)]',
          'transition-[width,transform] duration-300 ease-out-expo',
          'w-[300px] max-w-[88vw]',
          isRail ? 'lg:w-[84px]' : 'lg:w-[288px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* Decorative accent sweeps in the lower-left corner. */}
        <svg
          className="absolute -left-14 -bottom-6 w-40 h-40 pointer-events-none opacity-40"
          viewBox="0 0 160 160"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sidebar-sweep" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="rgb(var(--gold-700))" />
              <stop offset="0.5" stopColor="rgb(var(--gold-300))" />
              <stop offset="1" stopColor="rgb(var(--gold-600))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 150 L90 60 L98 60 L8 150 Z" fill="url(#sidebar-sweep)" />
          <path d="M0 125 L70 55 L74 55 L4 125 Z" fill="url(#sidebar-sweep)" opacity="0.6" />
          <path d="M18 160 L110 68 L116 68 L24 160 Z" fill="url(#sidebar-sweep)" opacity="0.8" />
        </svg>

        {/* ================================================================= */}
        {/* Brand                                                             */}
        {/* ================================================================= */}
        <div className={cn('relative flex-shrink-0 px-4 pt-5', isRail && 'lg:px-2 lg:pt-4')}>
          <div className={cn('flex items-center gap-3', isRail && 'lg:flex-col lg:gap-3')}>
            <button
              type="button"
              onClick={() => { navigate('/dashboard'); closeOnMobile(); }}
              className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl focus-visible:ring-2 focus-visible:ring-gold-500"
              aria-label="Go to dashboard"
            >
              <BrandEmblem logo={business?.logo} size={isRail ? 52 : 64} className={cn(isRail && 'lg:mx-auto')} />
              <BrandWordmark
                name={business?.name || APP_NAME}
                className={cn(isRail && 'lg:hidden')}
              />
            </button>

            {/* Mobile close */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="lg:hidden self-start p-1.5 rounded-lg text-gold-400 hover:bg-white/10 transition-colors"
            >
              <X size={24} />
            </button>

            {/* Desktop collapse - tucked into the corner so the wordmark keeps
                the full width */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isRail ? 'Expand the menu' : 'Collapse the menu'}
              title={isRail ? 'Expand menu' : 'Collapse menu'}
              className={cn(
                'hidden lg:flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0',
                'text-gold-400/80 hover:bg-white/[0.08] hover:text-gold-300 transition-colors',
                isRail ? 'lg:static' : 'absolute top-2 right-2'
              )}
            >
              {isRail ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Metallic rule with a centre diamond */}
          <div className="relative mt-4 h-px bg-gradient-to-r from-transparent via-gold-500/80 to-transparent" aria-hidden="true">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-gold-400 shadow-glow" />
          </div>
        </div>

        {/* ================================================================= */}
        {/* Navigation                                                        */}
        {/* ================================================================= */}
        <nav className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-none px-3 py-4 space-y-1">
          {groups.map((group, groupIndex) => {
            const groupLabel = GROUP_LABELS[group.id] || { en: group.label, ur: '' };
            // The first group (Dashboard, Reports) sits at the top without a
            // heading, as in the reference.
            const headed = groupIndex > 0;
            const folded = headed && !isRail && collapsedGroups.includes(group.id) && group.id !== activeGroupId;

            return (
              <div key={group.id} className={cn(headed && 'pt-3')}>
                {headed && !isRail && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!folded}
                    className="w-full flex items-center gap-3 px-3 pb-2 text-left group/heading"
                  >
                    <span className="flex items-baseline gap-1.5 flex-shrink-0">
                      <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-gold-400">
                        {groupLabel.en}
                      </span>
                      {groupLabel.ur && <Urdu className="text-2xs text-gold-300/70">{groupLabel.ur}</Urdu>}
                    </span>
                    <span className="flex-1 h-px bg-gradient-to-r from-gold-500/70 to-gold-500/10" />
                    <ChevronDown
                      size={13}
                      className={cn(
                        'text-gold-500/60 transition-transform duration-200 group-hover/heading:text-gold-300',
                        folded && '-rotate-90'
                      )}
                    />
                  </button>
                )}

                {headed && isRail && <div className="hidden lg:block mx-3 my-2 h-px bg-gold-500/25" />}

                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-out-expo',
                    folded ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                  )}
                >
                  <ul className="overflow-hidden space-y-1">
                    {group.items.map((item) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        isRail={isRail}
                        hidden={folded}
                        badge={badges[item.badge] || 0}
                        badgeTone={item.badge === 'lowStock' ? 'warning' : 'danger'}
                        onNavigate={closeOnMobile}
                      />
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>

        {/* ================================================================= */}
        {/* Connection + user                                                 */}
        {/* ================================================================= */}
        <div className="relative flex-shrink-0 px-3 pb-3 pt-3 space-y-2.5 safe-bottom">
          <div className="h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" aria-hidden="true" />

          <div
            className={cn(
              'flex items-center gap-2.5 px-3.5 py-2 rounded-full border text-sm font-semibold',
              isOnline
                ? 'border-success-500/50 bg-success-500/10 text-success-500'
                : 'border-danger-500/50 bg-danger-500/10 text-danger-500',
              isRail && 'lg:justify-center lg:px-0'
            )}
            title={isOnline ? 'Connected' : 'No internet connection'}
          >
            {isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
            <span className={cn('flex-1 flex items-baseline gap-1.5', isRail && 'lg:hidden')}>
              {isOnline ? 'Connected' : 'Offline'}
              <Urdu className="text-2xs opacity-80">{isOnline ? 'آن لائن' : 'آف لائن'}</Urdu>
            </span>
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isOnline ? 'bg-success-500 animate-pulse-ring' : 'bg-danger-500',
                isRail && 'lg:hidden'
              )}
            />
          </div>

          <div className={cn('flex items-center gap-3 px-1.5 py-1', isRail && 'lg:flex-col lg:gap-2')}>
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-accent-button text-on-accent flex-shrink-0 overflow-hidden ring-2 ring-gold-300/40 shadow-glow">
              {user?.photo ? (
                <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={24} />
              )}
            </span>

            <span className={cn('flex-1 min-w-0', isRail && 'lg:hidden')}>
              <span className="block text-[15px] font-semibold text-white truncate">{user?.name || 'User'}</span>
              <span className="block text-sm text-gold-400 truncate">
                {ROLE_META[user?.role]?.label || user?.role}
              </span>
            </span>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-lg text-white/80 hover:bg-danger-500/20 hover:text-danger-400 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/** One destination: icon, label (with Urdu when on), count badge, chevron. */
function NavItem({ item, isRail, hidden, badge, badgeTone, onNavigate }) {
  const Icon = getIcon(item.icon);
  const label = NAV_LABELS[item.id] || { en: item.label, ur: '' };

  return (
    <li>
      <NavLink
        to={item.path}
        onClick={onNavigate}
        title={isRail ? label.en : undefined}
        tabIndex={hidden ? -1 : 0}
        className={({ isActive }) =>
          cn(
            'group/item relative flex items-center gap-3.5 px-3.5 py-3 rounded-xl',
            'text-[15px] font-medium transition-all duration-200 ease-out-expo active:scale-[0.98]',
            isActive
              ? 'bg-accent-button text-on-accent font-semibold shadow-glow'
              : 'text-white/90 hover:bg-white/[0.06] hover:text-gold-200',
            isRail && 'lg:justify-center lg:px-0'
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.9} className="flex-shrink-0" aria-hidden="true" />

            <span className={cn('flex-1 min-w-0 flex items-baseline gap-1.5', isRail && 'lg:hidden')}>
              <span className="truncate">{label.en}</span>
              {label.ur && <Urdu className="text-2xs opacity-70 truncate">{label.ur}</Urdu>}
            </span>

            {badge > 0 && (
              <span
                className={cn(
                  'min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-2xs font-bold tabular',
                  badgeTone === 'warning' ? 'bg-warning-500 text-ink-950' : 'bg-danger-500 text-white',
                  isRail && 'lg:absolute lg:top-1 lg:right-2 lg:min-w-[18px] lg:h-[18px]'
                )}
                title={badgeTone === 'warning' ? `${badge} item(s) low or out of stock` : `${badge} overdue`}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}

            <ChevronRight
              size={18}
              className={cn(
                'flex-shrink-0 transition-transform duration-200 group-hover/item:translate-x-0.5',
                isActive ? 'opacity-90' : 'opacity-60',
                isRail && 'lg:hidden'
              )}
              aria-hidden="true"
            />

          </>
        )}
      </NavLink>
    </li>
  );
}
