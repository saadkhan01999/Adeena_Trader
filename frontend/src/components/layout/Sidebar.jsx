/**
 * ============================================
 * Sidebar
 * ============================================
 * Primary navigation, in English and Urdu.
 *
 * Two behaviours, one component:
 *   - Below `lg` it is an off-canvas drawer opened from the header.
 *   - From `lg` up it is a permanent column that collapses to a 72px icon rail
 *     from the toggle at the TOP of the panel, beside the logo.
 *
 * Groups are dropdowns
 * --------------------
 * Nineteen destinations in one open list means reading every label to find one.
 * Collapsed into six named groups, finding something is two short scans: pick
 * the group, pick the item. Groups start closed; the one holding the current
 * route opens itself, so the user can always see where they are.
 *
 * On the collapsed icon rail the dropdowns are dropped entirely - there is no
 * room for a group heading, and an icon that must be clicked twice to reach a
 * destination is worse than one that is always visible. The rail shows a flat
 * list of icons with hover tooltips, separated by hairlines.
 *
 * Motion is CSS only. An expanding group animates via grid-template-rows, which
 * transitions smoothly without JavaScript having to measure anything, and the
 * drawer slides on a transform. Nothing here bounces or springs.
 */

import { useMemo, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  X, PanelLeftClose, PanelLeftOpen, LogOut, Wifi, WifiOff, ChevronDown,
} from 'lucide-react';
import { getIcon } from '../common/Icon.jsx';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { NAV_GROUPS, APP_NAME, ROLE_META } from '../../constants/index.js';
import { NAV_LABELS, GROUP_LABELS } from '../../i18n/index.js';
import { Urdu } from '../common/Bilingual.jsx';
import BrandMark from '../common/BrandMark.jsx';
import { cn, getInitials, resolveFileUrl } from '../../utils/index.js';
import { CountBadge } from '../common/Badge.jsx';

export default function Sidebar({ overdueCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const {
    sidebarCollapsed, sidebarOpen, expandedGroups,
    toggleSidebar, setSidebarOpen, toggleGroup, openGroup, isOnline,
  } = useUIStore();

  const { user, hasPermission, logout } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  /**
   * Drop any group the user cannot see into, so a salesman is not shown an
   * empty "System" heading with nothing under it.
   */
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.permission)),
      })).filter((group) => group.items.length > 0),
    [hasPermission]
  );

  /** The group holding the route currently open. */
  const activeGroupId = useMemo(
    () => groups.find((g) => g.items.some((i) => pathname.startsWith(i.path)))?.id,
    [groups, pathname]
  );

  // Reveal where the user is. Runs on navigation too, so arriving from the
  // command palette or a dashboard link also opens the right group.
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

  const businessName = business?.name || APP_NAME;

  /** On the icon rail every item is shown flat; otherwise groups gate them. */
  const isRail = sidebarCollapsed;

  return (
    <>
      {/* ---- Mobile backdrop (CSS fade, no animation library) ---- */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'fixed inset-0 z-overlay bg-ink-950/60 lg:hidden no-print',
          'transition-opacity duration-200',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-[100dvh] lg:h-screen flex flex-col flex-shrink-0',
          'z-overlay lg:z-sticky bg-ink-950 text-ink-100 no-print',
          'transition-[width,transform] duration-250 ease-out',
          'w-[264px]',
          isRail ? 'lg:w-[72px]' : 'lg:w-[264px]',
          sidebarOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* ================================================================= */}
        {/* Brand + collapse toggle                                           */}
        {/* ================================================================= */}
        <div
          className={cn(
            'flex items-center h-16 flex-shrink-0 border-b border-gold-500/20',
            isRail ? 'lg:flex-col lg:h-auto lg:py-3 lg:gap-2 px-4 gap-3' : 'px-3 gap-2'
          )}
        >
          <button
            type="button"
            onClick={() => { navigate('/dashboard'); closeOnMobile(); }}
            className="flex items-center gap-2.5 min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg"
            aria-label="Go to dashboard"
          >
            <BrandMark logo={business?.logo} size="md" ring className="shadow-xs" />

            {!isRail && (
              <span className="min-w-0 text-left">
                <span className="block font-display font-bold text-white text-sm truncate">
                  {businessName}
                </span>
                <span className="block text-2xs text-gold-500/80 truncate tracking-wide">
                  TRUST | QUALITY | GROWTH
                </span>
              </span>
            )}
          </button>

          {/* Collapse toggle - desktop, at the top as requested */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isRail ? 'Expand the menu' : 'Collapse the menu'}
            title={isRail ? 'Expand menu' : 'Collapse menu'}
            className={cn(
              'hidden lg:flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
              'text-ink-400 hover:bg-white/[0.08] hover:text-gold-400',
              'transition-colors duration-150'
            )}
          >
            {isRail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-lg text-ink-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* ================================================================= */}
        {/* Navigation                                                        */}
        {/* ================================================================= */}
        <nav className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2.5 py-3">
          {groups.map((group, groupIndex) => {
            const expanded = isRail || expandedGroups.includes(group.id);
            const groupLabel = GROUP_LABELS[group.id] || { en: group.label, ur: '' };
            const hasActive = group.id === activeGroupId;

            return (
              <div key={group.id} className="mb-1">
                {/* ---- Group header (hidden on the rail) ---- */}
                {!isRail && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={expanded}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg',
                      'text-left transition-colors duration-150',
                      'hover:bg-white/[0.06]',
                      hasActive ? 'text-gold-400' : 'text-ink-400'
                    )}
                  >
                    {/* The English truncates before the Urdu does: a clipped
                        Nastaliq word is unreadable, whereas a clipped Latin one
                        can still be recognised from its opening letters. */}
                    <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                      <span className="text-2xs font-semibold uppercase tracking-wide truncate">
                        {groupLabel.en}
                      </span>
                      {groupLabel.ur && (
                        <Urdu className="text-2xs opacity-60 flex-shrink-0">{groupLabel.ur}</Urdu>
                      )}
                    </span>

                    {/* A dot marks the group holding the current page while it
                        is closed, so collapsing everything never hides where
                        you are. */}
                    {!expanded && hasActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                    )}

                    <ChevronDown
                      size={14}
                      className={cn(
                        'flex-shrink-0 transition-transform duration-200',
                        expanded && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}

                {/* A hairline stands in for the heading on the rail. */}
                {isRail && groupIndex > 0 && (
                  <div className="hidden lg:block mx-3 my-2 border-t border-white/[0.07]" />
                )}

                {/* ---- Items ----
                    grid-template-rows 0fr -> 1fr animates a block of unknown
                    height with no measuring and no layout thrash. */}
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <ul className={cn('overflow-hidden space-y-0.5', !isRail && 'ps-1.5')}>
                    {group.items.map((item) => {
                      const Icon = getIcon(item.icon);
                      const badgeCount = item.badge === 'overdue' ? overdueCount : 0;
                      const label = NAV_LABELS[item.id] || { en: item.label, ur: '' };

                      return (
                        <li key={item.id}>
                          <NavLink
                            to={item.path}
                            onClick={closeOnMobile}
                            title={isRail ? label.en : undefined}
                            tabIndex={expanded ? 0 : -1}
                            className={({ isActive }) =>
                              cn(
                                'nav-item group/item',
                                isActive && 'nav-item-active',
                                isRail && 'lg:justify-center lg:px-0'
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && isRail && (
                                  <span className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gold-500" />
                                )}

                                <Icon size={18} className="flex-shrink-0" aria-hidden="true" />

                                {!isRail && (
                                  <>
                                    <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                                      <span className="truncate text-sm">{label.en}</span>
                                      {label.ur && (
                                        <Urdu className="text-2xs opacity-55 truncate">
                                          {label.ur}
                                        </Urdu>
                                      )}
                                    </span>
                                    {badgeCount > 0 && <CountBadge count={badgeCount} />}
                                  </>
                                )}

                                {isRail && badgeCount > 0 && (
                                  <span className="hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-ink-950" />
                                )}

                                {/* Collapsed rail: the label as a tooltip, in
                                    both languages so the rail stays usable for
                                    an Urdu reader too. */}
                                {isRail && (
                                  <span
                                    className={cn(
                                      'hidden lg:flex flex-col absolute left-full ml-2 px-2.5 py-1.5 rounded-lg',
                                      'bg-ink-900 border border-gold-500/25 text-white text-xs font-medium',
                                      'whitespace-nowrap shadow-raised',
                                      'opacity-0 pointer-events-none',
                                      'group-hover/item:opacity-100',
                                      'transition-opacity duration-150 z-dropdown'
                                    )}
                                    role="tooltip"
                                  >
                                    <span>
                                      {label.en}
                                      {badgeCount > 0 && (
                                        <span className="ml-1.5 text-danger-400 font-semibold">
                                          {badgeCount}
                                        </span>
                                      )}
                                    </span>
                                    {label.ur && (
                                      <Urdu className="text-2xs text-gold-400/90">{label.ur}</Urdu>
                                    )}
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>

        {/* ================================================================= */}
        {/* Footer: connection + user                                         */}
        {/* ================================================================= */}
        <div className="flex-shrink-0 border-t border-gold-500/20 p-2.5 space-y-2 safe-bottom">
          {/* A shop with patchy internet needs this visible at all times. */}
          <div
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-2xs font-medium',
              isRail && 'lg:justify-center lg:px-0',
              isOnline ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/15 text-danger-400'
            )}
            title={isOnline ? 'Connected' : 'No internet connection'}
          >
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {!isRail && (
              <span className="flex flex-col leading-tight">
                <span>{isOnline ? 'Connected' : 'Offline'}</span>
                <Urdu className="text-2xs opacity-80">{isOnline ? 'آن لائن' : 'آف لائن'}</Urdu>
              </span>
            )}
          </div>

          {/* User */}
          <div
            className={cn(
              'flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.04]',
              isRail && 'lg:justify-center lg:bg-transparent lg:p-1'
            )}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gold-gradient text-ink-950 font-semibold text-xs flex-shrink-0 overflow-hidden">
              {user?.photo ? (
                <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.name)
              )}
            </span>

            {!isRail && (
              <>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-white truncate">
                    {user?.name || 'User'}
                  </span>
                  <span className="block text-2xs text-gold-500/90 truncate">
                    {ROLE_META[user?.role]?.label || user?.role}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded-md text-ink-400 hover:bg-danger-500/20 hover:text-danger-400 transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
