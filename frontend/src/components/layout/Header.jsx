/**
 * ============================================
 * Header
 * ============================================
 * The top bar: menu toggle, greeting, global search, the ownership lens,
 * calculator shortcut, notifications and the profile menu.
 *
 * Space budget on a 380px phone is roughly: menu button, a compact search
 * button, the bell and the avatar. Everything else - the greeting, the date,
 * the connection pill, the ownership label - progressively appears as the
 * viewport widens, rather than being crushed together.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Search, Calculator, User, Settings as SettingsIcon, LogOut,
  ChevronDown, Wifi, WifiOff, Building2, KeyRound,
} from 'lucide-react';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useKeyboardShortcut, useClickOutside, useOnlineStatus } from '../../hooks/index.js';
import { OWNERSHIP_OPTIONS, ROLE_META } from '../../constants/index.js';
import { cn, getGreeting, formatDate, getInitials, resolveFileUrl } from '../../utils/index.js';
import NotificationPanel from './NotificationPanel.jsx';

export default function Header() {
  const navigate = useNavigate();
  const {
    sidebarOpen, setSidebarOpen, ownership, setOwnership,
    toggleCalculator, setCommandPaletteOpen, isOnline, setOnline,
  } = useUIStore();
  const { user, logout } = useAuthStore();
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

  return (
    <header className="sticky top-0 z-sticky bg-white/95 backdrop-blur-sm border-b border-navy-100 no-print">
      <div className="flex items-center gap-2 sm:gap-3 h-16 px-3 sm:px-4 lg:px-6">
        {/* ---- Left: menu + greeting ---- */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Open the menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-navy-600 hover:bg-navy-100 active:scale-95 transition-all flex-shrink-0"
        >
          <Menu size={21} />
        </button>

        <div className="hidden md:block min-w-0 flex-shrink">
          <p className="text-sm text-navy-600 truncate">
            {getGreeting()},{' '}
            <span className="font-semibold text-navy-950">
              {user?.name?.split(' ')[0] || 'there'}
            </span>
          </p>
          <p className="text-2xs text-navy-400 truncate">
            {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* ---- Centre: search ---- */}
        <div className="flex-1 flex justify-center min-w-0 px-1">
          {/* Desktop: a wide affordance that looks like a search field */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className={cn(
              'hidden sm:flex items-center gap-2.5 w-full max-w-md px-3 py-2 rounded-lg',
              'text-sm text-navy-400 bg-navy-50 border border-transparent',
              'hover:bg-white hover:border-navy-200 hover:shadow-xs',
              'transition-all duration-200 active:scale-[0.99]'
            )}
            aria-label="Search"
          >
            <Search size={16} className="flex-shrink-0" />
            <span className="truncate">Search customers, products, invoices…</span>
            <kbd className="ml-auto hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-navy-200 bg-white text-2xs font-sans text-navy-500 flex-shrink-0">
              Ctrl K
            </kbd>
          </button>

          {/* Mobile: just the icon */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="sm:hidden p-2 rounded-lg text-navy-600 hover:bg-navy-100 active:scale-95 transition-all"
          >
            <Search size={19} />
          </button>
        </div>

        {/* ---- Right: status and actions ---- */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Connection pill - hidden on phones, where the sidebar shows it */}
          <span
            className={cn(
              'hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium',
              isOnline ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
            )}
            title={isOnline ? 'Connected to the server' : 'No internet connection'}
          >
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Online' : 'Offline'}
          </span>

          {/* Ownership lens */}
          <OwnershipSelector value={ownership} onChange={setOwnership} current={currentOwnership} />

          {/* Calculator */}
          <button
            type="button"
            onClick={toggleCalculator}
            title="Installment calculator (Ctrl+Shift+C)"
            aria-label="Open the installment calculator"
            className="hidden xs:block p-2 rounded-lg text-navy-600 hover:bg-navy-100 hover:text-navy-950 active:scale-95 transition-all"
          >
            <Calculator size={19} />
          </button>

          <NotificationPanel />

          {/* Profile */}
          <ProfileMenu
            user={user}
            business={business}
            onNavigate={(path) => navigate(path)}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * The owner / partner / all-business lens.
 *
 * Rendered as a custom dropdown rather than a native `<select>` so each option
 * can carry an explanatory line - "Only your portion of every record" - which
 * is the difference between the control being understood and being ignored.
 */
function OwnershipSelector({ value, onChange, current }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  const tones = {
    all: 'bg-navy-950 text-white',
    owner: 'bg-gold-500 text-navy-950',
    partner: 'bg-info-600 text-white',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Viewing: ${current.label}`}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-2xs sm:text-xs font-semibold',
          'transition-all duration-200 active:scale-95',
          tones[value] || tones.all
        )}
        title={`Viewing: ${current.label}`}
      >
        <Building2 size={13} className="flex-shrink-0" />
        <span className="hidden sm:inline truncate max-w-[92px]">{current.label}</span>
        <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden z-dropdown"
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

/** Avatar dropdown: profile, settings and sign out. */
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
        className="flex items-center gap-1.5 p-0.5 sm:pr-1.5 rounded-lg hover:bg-navy-100 active:scale-95 transition-all"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold flex-shrink-0 overflow-hidden">
          {user?.photo ? (
            <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(user?.name)
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn('hidden sm:block text-navy-400 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden z-dropdown"
          >
            <div className="px-3.5 py-3 border-b border-navy-100 bg-navy-50/60">
              <p className="text-sm font-semibold text-navy-950 truncate">{user?.name}</p>
              <p className="text-2xs text-navy-500 truncate">{user?.email}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded bg-gold-100 text-gold-700 text-2xs font-semibold">
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
              <p className="px-3.5 py-2 border-t border-navy-100 text-2xs text-navy-400 truncate">
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
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors',
        danger ? 'text-danger-600 hover:bg-danger-50' : 'text-navy-700 hover:bg-navy-50 hover:text-navy-950'
      )}
    >
      <Icon size={15} className="flex-shrink-0" />
      {label}
    </button>
  );
}
