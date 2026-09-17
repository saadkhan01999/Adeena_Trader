/**
 * ============================================
 * Sidebar
 * ============================================
 * Primary navigation.
 *
 * Two distinct behaviours, one component:
 *   - Below `lg` it is an off-canvas drawer with a dimmed backdrop, opened from
 *     the header's menu button and closed on navigation.
 *   - From `lg` up it is a permanent column that can collapse to a 72px icon
 *     rail. Collapsed items keep their meaning through a hover tooltip.
 *
 * Items are grouped (Overview, Sales & Collection, Stock, …). Eighteen
 * destinations in one flat list forces the eye to read every label to find one;
 * grouped, it becomes six short scans.
 */

import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import { getIcon } from '../common/Icon.jsx';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { NAV_GROUPS, APP_NAME, APP_SHORT, ROLE_META } from '../../constants/index.js';
import { cn, getInitials, resolveFileUrl } from '../../utils/index.js';
import { CountBadge } from '../common/Badge.jsx';

export default function Sidebar({ overdueCount = 0 }) {
  const navigate = useNavigate();
  const { sidebarCollapsed, sidebarOpen, toggleSidebar, setSidebarOpen, isOnline } = useUIStore();
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

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const logoUrl = business?.logo ? resolveFileUrl(business.logo) : null;
  const businessName = business?.name || APP_NAME;

  return (
    <>
      {/* ---- Mobile backdrop ---- */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-overlay bg-navy-950/60 backdrop-blur-sm lg:hidden no-print"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-[100dvh] lg:h-screen flex flex-col flex-shrink-0',
          'z-overlay lg:z-sticky bg-navy-950 text-navy-100 no-print',
          'transition-[width,transform] duration-300 ease-out-expo',
          'w-[264px]',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[264px]',
          sidebarOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* ================================================================= */}
        {/* Brand                                                             */}
        {/* ================================================================= */}
        <div
          className={cn(
            'flex items-center gap-3 h-16 flex-shrink-0 border-b border-white/[0.07]',
            sidebarCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'
          )}
        >
          <button
            type="button"
            onClick={() => { navigate('/dashboard'); closeOnMobile(); }}
            className="flex items-center gap-3 min-w-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg"
            aria-label="Go to dashboard"
          >
            <span
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden',
                'bg-gold-500 text-navy-950 shadow-xs',
                'transition-transform duration-300 ease-out-expo group-hover:scale-105'
              )}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display font-bold text-lg">{APP_SHORT}</span>
              )}
            </span>

            {!sidebarCollapsed && (
              <span className="min-w-0 text-left">
                <span className="block font-display font-bold text-white text-sm truncate">
                  {businessName}
                </span>
                <span className="block text-2xs text-navy-400 truncate">Business Management</span>
              </span>
            )}
          </button>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="lg:hidden ml-auto p-1.5 rounded-lg text-navy-400 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* ================================================================= */}
        {/* Navigation                                                        */}
        {/* ================================================================= */}
        <nav className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2.5 py-3">
          {groups.map((group) => (
            <div key={group.id} className="mb-1">
              {!sidebarCollapsed && <p className="nav-section-label">{group.label}</p>}

              {/* A hairline stands in for the heading when collapsed, so the
                  grouping is still legible on the icon rail. */}
              {sidebarCollapsed && group.id !== groups[0].id && (
                <div className="hidden lg:block mx-3 my-2 border-t border-white/[0.07]" />
              )}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = getIcon(item.icon);
                  const badgeCount = item.badge === 'overdue' ? overdueCount : 0;

                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        onClick={closeOnMobile}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'nav-item group/item',
                            isActive && 'nav-item-active',
                            sidebarCollapsed && 'lg:justify-center lg:px-0'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active marker on the rail, visible when collapsed */}
                            {isActive && sidebarCollapsed && (
                              <span className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gold-500" />
                            )}

                            <Icon size={19} className="flex-shrink-0" aria-hidden="true" />

                            {!sidebarCollapsed && (
                              <>
                                <span className="truncate flex-1">{item.label}</span>
                                {badgeCount > 0 && <CountBadge count={badgeCount} />}
                              </>
                            )}

                            {/* Collapsed: a dot rather than a number, and the
                                label appears as a tooltip on hover */}
                            {sidebarCollapsed && badgeCount > 0 && (
                              <span className="hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-navy-950" />
                            )}

                            {sidebarCollapsed && (
                              <span
                                className={cn(
                                  'hidden lg:block absolute left-full ml-2 px-2.5 py-1.5 rounded-lg',
                                  'bg-navy-900 text-white text-xs font-medium whitespace-nowrap shadow-raised',
                                  'opacity-0 pointer-events-none translate-x-1',
                                  'group-hover/item:opacity-100 group-hover/item:translate-x-0',
                                  'transition-all duration-200 ease-out-expo z-dropdown'
                                )}
                                role="tooltip"
                              >
                                {item.label}
                                {badgeCount > 0 && (
                                  <span className="ml-1.5 text-danger-400 font-semibold">{badgeCount}</span>
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
          ))}
        </nav>

        {/* ================================================================= */}
        {/* Footer: connection, user, collapse                                */}
        {/* ================================================================= */}
        <div className="flex-shrink-0 border-t border-white/[0.07] p-2.5 space-y-2 safe-bottom">
          {/* Connection status - a shop with patchy internet needs this visible */}
          <div
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-2xs font-medium',
              sidebarCollapsed && 'lg:justify-center lg:px-0',
              isOnline ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/15 text-danger-400'
            )}
            title={isOnline ? 'Connected' : 'No internet connection'}
          >
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {!sidebarCollapsed && (isOnline ? 'Connected' : 'Offline — changes will not save')}
          </div>

          {/* User */}
          <div
            className={cn(
              'flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.04]',
              sidebarCollapsed && 'lg:justify-center lg:bg-transparent lg:p-1'
            )}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gold-500 text-navy-950 font-semibold text-xs flex-shrink-0 overflow-hidden">
              {user?.photo ? (
                <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.name)
              )}
            </span>

            {!sidebarCollapsed && (
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
                  className="p-1.5 rounded-md text-navy-400 hover:bg-danger-500/20 hover:text-danger-400 transition-colors active:scale-95"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>

          {/* Collapse toggle - desktop only */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand the menu' : 'Collapse the menu'}
            title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            className={cn(
              'hidden lg:flex items-center gap-2 w-full px-2.5 py-2 rounded-lg',
              'text-2xs font-medium text-navy-400',
              'hover:bg-white/[0.07] hover:text-white transition-colors active:scale-[0.98]',
              sidebarCollapsed && 'justify-center px-0'
            )}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!sidebarCollapsed && 'Collapse menu'}
          </button>
        </div>
      </aside>
    </>
  );
}
