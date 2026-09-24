/**
 * ============================================
 * Header
 * ============================================
 * The top bar, after the shop's reference design: a band in the theme's dark
 * with a metallic swoosh along its lower edge, the menu button, the emblem and
 * wordmark with "Business Made Easier", and on the right a quick-create menu,
 * the notification bell and the account button.
 *
 * On a laptop the sidebar already carries the brand, so the wordmark gives way
 * to the search field; it returns when the sidebar is folded to its icon rail.
 * The ownership lens and calculator appear as the width allows.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Search, Calculator, User, Settings as SettingsIcon, LogOut,
  ChevronDown, Building2, KeyRound, FilePlus2, ShoppingCart, WalletCards,
  UserPlus, PackagePlus, ShoppingBag, ReceiptText,
} from 'lucide-react';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useKeyboardShortcut, useClickOutside, useOnlineStatus } from '../../hooks/index.js';
import { OWNERSHIP_OPTIONS, ROLE_META, APP_NAME } from '../../constants/index.js';
import { cn, getInitials, resolveFileUrl } from '../../utils/index.js';
import { BrandEmblem, BrandWordmark } from '../common/BrandMark.jsx';
import NotificationPanel from './NotificationPanel.jsx';

/** The quick-create menu: the six things a shop starts most often. */
const QUICK_ACTIONS = [
  { label: 'New sale', icon: ShoppingCart, path: '/sales?new=1', permission: 'sales' },
  { label: 'Receive a payment', icon: WalletCards, path: '/installments', permission: 'installments' },
  { label: 'Add customer', icon: UserPlus, path: '/customers?new=1', permission: 'customers' },
  { label: 'Add inventory item', icon: PackagePlus, path: '/inventory?new=1', permission: 'products' },
  { label: 'New purchase', icon: ShoppingBag, path: '/purchases?new=1', permission: 'purchases' },
  { label: 'Add expense', icon: ReceiptText, path: '/expenses?new=1', permission: 'expenses' },
];

export default function Header() {
  const navigate = useNavigate();
  const {
    sidebarOpen, setSidebarOpen, sidebarCollapsed, ownership, setOwnership,
    toggleCalculator, setCommandPaletteOpen, setOnline,
  } = useUIStore();
  const { user, logout, hasPermission } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  // Keep the store's connectivity flag in step with the browser
  useOnlineStatus();
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [setOnline]);

  // ---- Global shortcuts -------------------------------------------------
  useKeyboardShortcut('ctrl+k', () => setCommandPaletteOpen(true), { allowInInputs: true });
  useKeyboardShortcut('/', () => setCommandPaletteOpen(true));
  useKeyboardShortcut('ctrl+shift+c', () => toggleCalculator(), { allowInInputs: true });

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const currentOwnership = OWNERSHIP_OPTIONS.find((o) => o.value === ownership) || OWNERSHIP_OPTIONS[0];
  const quickActions = QUICK_ACTIONS.filter((a) => hasPermission(a.permission));

  return (
    <header className="sticky top-0 z-sticky no-print">
      <div className="relative bg-ink-950 overflow-visible">
        {/* Metallic swoosh along the lower edge. */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full h-7 pointer-events-none"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="header-swoosh" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgb(var(--gold-700))" stopOpacity="0" />
              <stop offset="0.35" stopColor="rgb(var(--gold-400))" />
              <stop offset="0.65" stopColor="rgb(var(--gold-200))" />
              <stop offset="1" stopColor="rgb(var(--gold-600))" />
            </linearGradient>
          </defs>
          <path d="M0 38 C 300 38, 600 30, 1200 4" stroke="url(#header-swoosh)" strokeWidth="2.5" fill="none" />
          <path d="M0 40 C 380 40, 700 34, 1200 16" stroke="url(#header-swoosh)" strokeWidth="1.2" fill="none" opacity="0.6" />
        </svg>

        <div className="relative flex items-center gap-1.5 sm:gap-3 h-[72px] sm:h-[76px] px-2 sm:px-4 lg:px-6">
          {/* ---- Menu (phones and tablets) ---- */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Open the menu"
            className="lg:hidden p-1.5 rounded-xl text-gold-400 hover:bg-white/10 active:scale-95 transition-all flex-shrink-0"
          >
            <Menu size={26} />
          </button>

          {/* ---- Brand (hidden on a laptop while the full sidebar shows it) ---- */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={cn(
              'flex items-center gap-2.5 min-w-0 text-left',
              !sidebarCollapsed && 'lg:hidden'
            )}
            aria-label="Go to dashboard"
          >
            <BrandEmblem logo={business?.logo} size={50} className="hidden min-[350px]:inline-flex" />
            <span className="flex flex-col min-w-0">
              <BrandWordmark name={business?.name || APP_NAME} size="sm" tagline={null} />
              <span className="flex items-center gap-1.5 mt-1 text-[9.5px] sm:text-2xs text-white/85 font-medium whitespace-nowrap">
                <span className="hidden sm:block w-5 h-px bg-gold-400/80" />
                Business Made Easier
                <span className="hidden sm:block w-5 h-px bg-gold-400/80" />
              </span>
            </span>
          </button>

          {/* ---- Search ---- */}
          <div className="flex-1 flex justify-center min-w-0 px-1">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className={cn(
                'hidden lg:flex items-center gap-2.5 w-full max-w-md px-4 py-2.5 rounded-xl',
                'text-sm text-white/60 bg-white/[0.06] border border-gold-500/25',
                'hover:bg-white/[0.1] hover:border-gold-400/50 transition-all duration-200'
              )}
              aria-label="Search"
            >
              <Search size={17} className="flex-shrink-0 text-gold-400" />
              <span className="truncate">Search customers, inventory, invoices…</span>
              <kbd className="ml-auto hidden xl:inline-flex items-center px-1.5 py-0.5 rounded border border-white/15 text-2xs font-sans text-white/50 flex-shrink-0">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* ---- Right-hand actions ---- */}
          <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Search"
              className="lg:hidden hidden sm:block p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <Search size={21} />
            </button>

            <OwnershipSelector value={ownership} onChange={setOwnership} current={currentOwnership} />

            <button
              type="button"
              onClick={toggleCalculator}
              title="Installment calculator (Ctrl+Shift+C)"
              aria-label="Open the installment calculator"
              className="hidden md:block p-2.5 rounded-xl text-white hover:bg-white/10 hover:text-gold-200 active:scale-95 transition-all"
            >
              <Calculator size={21} />
            </button>

            {quickActions.length > 0 && (
              <QuickCreate actions={quickActions} onNavigate={(path) => navigate(path)} />
            )}

            <NotificationPanel />

            <ProfileMenu
              user={user}
              business={business}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

/** The document-and-chevron button from the reference: start something new. */
function QuickCreate({ actions, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Create something new"
        aria-expanded={open}
        title="Create new"
        className={cn(
          'flex items-center gap-0.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl border-2 border-gold-500/80 text-gold-300',
          'hover:bg-gold-500/10 hover:border-gold-400 active:scale-95 transition-all',
          open && 'bg-gold-500/10'
        )}
      >
        <FilePlus2 size={20} />
        <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden z-dropdown py-1"
            role="menu"
          >
            <p className="px-3.5 pt-2 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-navy-400">
              Create new
            </p>
            {actions.map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onNavigate(path); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-navy-700 hover:bg-gold-50 hover:text-navy-950 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-100 text-gold-700">
                  <Icon size={16} />
                </span>
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The owner / partner / all-business lens.
 *
 * A custom dropdown rather than a native `<select>` so each option can carry an
 * explanatory line - "Only your portion of every record".
 */
function OwnershipSelector({ value, onChange, current }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Viewing: ${current.label}`}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border',
          'border-gold-500/60 text-gold-200 hover:bg-gold-500/10 transition-all duration-200 active:scale-95'
        )}
        title={`Viewing: ${current.label}`}
      >
        <Building2 size={14} className="flex-shrink-0 text-gold-400" />
        <span className="hidden md:inline truncate max-w-[110px]">{current.label}</span>
        <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden z-dropdown"
            role="listbox"
          >
            <p className="px-3 pt-2.5 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-navy-400">
              View figures for
            </p>

            {OWNERSHIP_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                  option.value === value ? 'bg-gold-50' : 'hover:bg-navy-50'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    option.value === value ? 'bg-gold-500' : 'bg-navy-200'
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-900">{option.label}</span>
                  <span className="block text-2xs text-navy-500 leading-snug mt-0.5">{option.hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Account button and menu: profile, password, settings, sign out. */
function ProfileMenu({ user, business, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  const go = (path) => { setOpen(false); onNavigate(path); };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your account"
        aria-expanded={open}
        className="flex items-center gap-2 p-0.5 rounded-full hover:bg-white/10 active:scale-95 transition-all"
      >
        <span className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-gold-500 text-gold-300 font-brand font-bold text-lg flex-shrink-0 overflow-hidden">
          {user?.photo ? (
            <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(user?.name).slice(0, 1) || 'A'
          )}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden z-dropdown"
          >
            <div className="px-4 py-3.5 bg-ink-950 text-white">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-2xs text-white/60 truncate">{user?.email}</p>
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-accent-button text-on-accent text-2xs font-semibold">
                {ROLE_META[user?.role]?.label || user?.role}
              </span>
            </div>

            <div className="py-1">
              <MenuItem icon={User} label="My profile" onClick={() => go('/settings?section=profile')} />
              <MenuItem icon={KeyRound} label="Change password" onClick={() => go('/settings?section=password')} />
              <MenuItem icon={SettingsIcon} label="Settings" onClick={() => go('/settings')} />
            </div>

            <div className="py-1 border-t border-navy-100">
              <MenuItem icon={LogOut} label="Sign out" onClick={onLogout} danger />
            </div>

            {business?.name && (
              <p className="px-4 py-2 border-t border-navy-100 text-2xs text-navy-400 truncate">
                {business.name}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
        danger ? 'text-danger-600 hover:bg-danger-50' : 'text-navy-700 hover:bg-gold-50 hover:text-navy-950'
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </button>
  );
}
