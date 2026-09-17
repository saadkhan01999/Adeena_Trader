/**
 * ============================================
 * Sign In
 * ============================================
 * Split layout: a branded panel on the left from `lg` up, the form on the right.
 * On a phone the panel collapses to a compact header so the form is reachable
 * without scrolling.
 *
 * Role-aware sign-in
 * ------------------
 * The administrator creates every other account, so staff arrive knowing which
 * role they were given but not necessarily which credential to use. Selecting a
 * role re-frames the form - its heading, its hint, its accent colour and the
 * placeholder in the identifier field all change - while still posting to the
 * single `/auth/login` endpoint. The server decides the real role from the
 * account; the tab is guidance, never authorisation.
 *
 * There is no "forgot password" link by design: password resets are handled by
 * the administrator from Users & Roles.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, AlertCircle, ShieldCheck, ArrowRight,
  Phone, MapPin, Loader2, Wifi, WifiOff, Check,
} from 'lucide-react';
import { getIcon } from '../components/common/Icon.jsx';

import { useAuthStore } from '../context/authStore.js';
import { useToastStore } from '../context/toastStore.js';
import { authService } from '../services/authService.js';
import { Input, PasswordInput, Checkbox } from '../components/common/Form.jsx';
import Button from '../components/common/Button.jsx';
import {
  APP_NAME, APP_SHORT, APP_OWNER, APP_PHONE, APP_ADDRESS,
  ROLE_META, STORAGE_KEYS,
} from '../constants/index.js';
import { cn, resolveFileUrl } from '../utils/index.js';
import { useOnlineStatus } from '../hooks/index.js';

/** Accent treatment per role, applied to the submit button and the tab. */
const accentStyles = {
  gold: { tab: 'bg-gold-500 text-navy-950', button: 'gold', ring: 'ring-gold-500/30' },
  navy: { tab: 'bg-navy-950 text-white', button: 'primary', ring: 'ring-navy-900/20' },
  blue: { tab: 'bg-info-600 text-white', button: 'primary', ring: 'ring-info-500/25' },
  green: { tab: 'bg-success-600 text-white', button: 'success', ring: 'ring-success-500/25' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const isOnline = useOnlineStatus();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState(
    () => localStorage.getItem(STORAGE_KEYS.LAST_ROLE) || 'admin'
  );

  const [setupState, setSetupState] = useState({ loading: true, required: false, roles: [], business: null });

  // ---- Which roles exist? ----------------------------------------------
  useEffect(() => {
    let cancelled = false;

    authService
      .getSetupStatus()
      .then((response) => {
        if (cancelled) return;
        const { isSetupRequired, roles, business } = response.data;
        setSetupState({ loading: false, required: isSetupRequired, roles: roles || [], business });

        // Default to a role that actually has an account
        if (roles?.length && !roles.some((r) => r.role === selectedRole)) {
          setSelectedRole(roles[0].role);
        }
      })
      .catch(() => {
        // The API may be unreachable. Show the form anyway with every role
        // offered - a stranded user should still be able to try signing in.
        if (!cancelled) {
          setSetupState({
            loading: false,
            required: false,
            roles: Object.keys(ROLE_META).map((role) => ({ role, ...ROLE_META[role] })),
            business: null,
          });
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear a stale error when the user starts correcting their input
  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, password, selectedRole]);

  const roleTabs = useMemo(() => {
    const available = setupState.roles.length
      ? setupState.roles
      : Object.keys(ROLE_META).map((role) => ({ role }));

    return available.map(({ role }) => ({
      role,
      ...ROLE_META[role],
      Icon: getIcon(ROLE_META[role]?.icon),
    }));
  }, [setupState.roles]);

  const activeRole = ROLE_META[selectedRole] || ROLE_META.admin;
  const accent = accentStyles[activeRole.accent] || accentStyles.navy;

  const business = setupState.business;
  const businessName = business?.name || APP_NAME;
  const logoUrl = business?.logo ? resolveFileUrl(business.logo) : null;

  // ---- Redirects --------------------------------------------------------
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (!setupState.loading && setupState.required) return <Navigate to="/setup" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      toast.warning('Enter your username or email and your password.');
      return;
    }
    if (!isOnline) {
      toast.error('You are offline. Connect to the internet and try again.');
      return;
    }

    const result = await login({
      identifier: identifier.trim(),
      password,
      rememberMe,
      role: selectedRole,
    });

    if (result.success) {
      toast.success(`Welcome back, ${result.user.name?.split(' ')[0] || 'there'}.`);
      navigate('/dashboard', { replace: true });
    }
    // The inline error block below reports a failure; no duplicate toast.
  };

  return (
    <div className="min-h-[100dvh] flex bg-navy-50/50">
      {/* ================================================================= */}
      {/* Brand panel - desktop only                                        */}
      {/* ================================================================= */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] bg-navy-gradient overflow-hidden">
        {/* Soft light blooms, kept very low contrast so text stays readable */}
        <div className="absolute inset-0 opacity-[0.18]" aria-hidden="true">
          <div className="absolute -top-20 -left-16 w-96 h-96 rounded-full bg-gold-500 blur-[110px]" />
          <div className="absolute bottom-0 -right-24 w-[420px] h-[420px] rounded-full bg-gold-400 blur-[130px]" />
        </div>

        {/* Faint grid, for texture rather than decoration */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-14 text-white">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-gold-500 text-navy-950 overflow-hidden flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display font-bold text-xl">{APP_SHORT}</span>
              )}
            </span>
            <span>
              <span className="block font-display font-bold text-lg leading-tight">{businessName}</span>
              <span className="block text-2xs text-navy-300">Business Management System</span>
            </span>
          </motion.div>

          <div className="max-w-md">
            <motion.h2
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-white font-bold text-3xl xl:text-4xl leading-[1.15]"
            >
              Easy Installments.
              <br />
              <span className="text-gold-500">Quality Products.</span>
              <br />
             <p className="text-white"> Best Service.</p>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 text-navy-300 leading-relaxed"
            >
              One system for installments, inventory, customers, partners, investors,
              agreements and Zakat — built for how your shop actually runs.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="mt-7 space-y-2.5"
            >
              {[
                '6 and 12 month plans, calculated to the rupee',
                'Automatic payment reminders over WhatsApp',
                'Zakat on the Shariah nisab, owner and partners only',
                'Printable invoices, receipts and signed agreements',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-navy-200">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gold-500/20 text-gold-500 mt-0.5 flex-shrink-0">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-3 gap-4 pt-7 border-t border-white/10"
          >
            {[
              { icon: User, label: 'Owner', value: business?.owner || APP_OWNER },
              { icon: Phone, label: 'Phone', value: business?.phone || APP_PHONE },
              { icon: MapPin, label: 'Location', value: business?.address || APP_ADDRESS },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <span className="flex items-center gap-1 text-2xs text-navy-400 mb-1">
                  <item.icon size={11} />
                  {item.label}
                </span>
                <span className="block text-sm font-medium truncate">{item.value}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* Form                                                              */}
      {/* ================================================================= */}
      <main className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile brand header */}
          <div className="flex flex-col items-center text-center mb-7 lg:hidden">
            <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-navy-950 text-gold-500 overflow-hidden mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display font-bold text-2xl">{APP_SHORT}</span>
              )}
            </span>
            <h1 className="font-display font-bold text-xl text-navy-950">{businessName}</h1>
            <p className="text-xs text-navy-500 mt-0.5">Business Management System</p>
          </div>

          {/* ---- Role tabs ---- */}
          <div className="mb-5">
            <p className="text-2xs font-semibold uppercase tracking-widest text-navy-400 mb-2">
              Sign in as
            </p>

            {setupState.loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-[52px] rounded-lg" />
                ))}
              </div>
            ) : (
              <div
                className={cn('grid gap-2', roleTabs.length <= 2 ? 'grid-cols-2' : 'grid-cols-2')}
                role="radiogroup"
                aria-label="Select your role"
              >
                {roleTabs.map(({ role, label, Icon, accent: roleAccent }) => {
                  const isActive = role === selectedRole;
                  const style = accentStyles[roleAccent] || accentStyles.navy;

                  return (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left',
                        'transition-all duration-200 ease-out-expo active:scale-[0.97]',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        isActive
                          ? cn('border-transparent shadow-xs ring-2', style.tab, style.ring)
                          : 'border-navy-200 bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                      )}
                    >
                      <Icon size={17} className="flex-shrink-0" />
                      <span className="text-xs font-semibold truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- Heading, changes with the selected role ---- */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedRole}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mb-5"
            >
              <h2 className="font-display font-bold text-xl sm:text-2xl text-navy-950">
                {activeRole.label} sign in
              </h2>
              <p className="text-sm text-navy-500 mt-1">{activeRole.hint}</p>
            </motion.div>
          </AnimatePresence>

          {/* ---- Error ---- */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
                role="alert"
              >
                <div className="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-700">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---- Offline warning ---- */}
          {!isOnline && (
            <div className="flex items-center gap-2.5 p-3 mb-4 rounded-lg bg-warning-50 border border-warning-200 text-sm text-warning-800">
              <WifiOff size={16} className="flex-shrink-0" />
              You are offline. Connect to the internet to sign in.
            </div>
          )}

          {/* ---- Form ---- */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or email"
              required
              autoFocus
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={selectedRole === 'admin' ? 'admin or admin@yourshop.com' : 'your username'}
              icon={<User size={17} />}
              disabled={isLoading}
            />

            <PasswordInput
              label="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              icon={<Lock size={17} />}
              disabled={isLoading}
              hint="Use the eye icon to check what you typed."
            />

            <div className="flex items-center justify-between gap-3">
              <Checkbox
                label="Keep me signed in"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />

              {/* No "forgot password" link: resets are the administrator's job */}
              <span className="text-2xs text-navy-400 text-right leading-snug">
                Lost your password?
                <br className="sm:hidden" /> Ask your administrator.
              </span>
            </div>

            <Button
              type="submit"
              variant={accent.button}
              size="lg"
              fullWidth
              isLoading={isLoading}
              loadingText="Signing in…"
              disabled={!isOnline}
              iconRight={isLoading ? undefined : ArrowRight}
              className="mt-1"
            >
              Sign in
            </Button>
          </form>

          {/* ---- Footer ---- */}
          <div className="flex items-center justify-center gap-2 mt-6 text-2xs text-navy-400">
            <ShieldCheck size={13} className="flex-shrink-0" />
            <span>Encrypted passwords and short-lived sessions.</span>
            <span
              className={cn('flex items-center gap-1', isOnline ? 'text-success-600' : 'text-danger-500')}
              title={isOnline ? 'Connected' : 'Offline'}
            >
              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
