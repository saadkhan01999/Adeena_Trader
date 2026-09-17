/**
 * ============================================
 * MainLayout
 * ============================================
 * The authenticated shell: sidebar, header, page content, and the global
 * overlays (calculator, command palette, toasts).
 *
 * Responsibilities kept here rather than in each page:
 *   - Load the shared settings cache once per session.
 *   - Keep the overdue badge on the sidebar current.
 *   - Show an offline banner when the connection drops.
 *   - Prompt for a password change when an admin has forced one.
 *   - Animate page transitions on route change.
 */

import { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, KeyRound } from 'lucide-react';

import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import CommandPalette from './CommandPalette.jsx';
import ToastContainer from '../common/ToastContainer.jsx';
import QuickCalculatorModal from '../modals/QuickCalculatorModal.jsx';
import ChangePasswordModal from '../modals/ChangePasswordModal.jsx';
import Button from '../common/Button.jsx';

import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { saleService } from '../../services/entities.js';
import { useInterval, useKeyboardShortcut } from '../../hooks/index.js';
import { cn } from '../../utils/index.js';

export default function MainLayout() {
  const location = useLocation();
  const { calculatorOpen, setCalculatorOpen, isOnline, closeAllOverlays } = useUIStore();
  const { user, hasPermission } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.load);

  const [overdueCount, setOverdueCount] = useState(0);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  // ---- Shared settings, loaded once per session -------------------------
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ---- Forced password change ------------------------------------------
  useEffect(() => {
    // Raised by an admin reset or by the bootstrap account. The prompt is not
    // dismissible-and-forgotten: it reappears until the password is changed.
    if (user?.mustChangePassword) setShowPasswordPrompt(true);
  }, [user?.mustChangePassword]);

  // ---- Sidebar overdue badge -------------------------------------------
  const refreshOverdue = useCallback(async () => {
    if (!hasPermission('installments') || !isOnline) return;
    try {
      const response = await saleService.getInstallments();
      setOverdueCount(response.data.summary?.overdueCount || 0);
    } catch {
      // A failed badge refresh is silent - it is decoration, not a blocker
    }
  }, [hasPermission, isOnline]);

  useEffect(() => { refreshOverdue(); }, [refreshOverdue]);

  // Refresh on route change too, so recording a payment updates the badge
  useEffect(() => { refreshOverdue(); }, [location.pathname, refreshOverdue]);

  // And every five minutes while the tab is open
  useInterval(refreshOverdue, isOnline ? 300_000 : null);

  // ---- Escape closes every overlay --------------------------------------
  useKeyboardShortcut('escape', closeAllOverlays, { allowInInputs: false });

  return (
    <div className="min-h-[100dvh] bg-navy-50/40 flex">
      <Sidebar overdueCount={overdueCount} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* Offline banner - a shop needs to know before it starts typing an
            invoice that nothing will be saved. */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden no-print"
              role="alert"
            >
              <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-danger-600 text-white text-xs sm:text-sm">
                <WifiOff size={16} className="flex-shrink-0" />
                <span className="font-medium">
                  You are offline. Anything you enter now will not be saved.
                </span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors font-semibold"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forced password change reminder */}
        {user?.mustChangePassword && !showPasswordPrompt && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 bg-warning-50 border-b border-warning-200 text-warning-800 text-xs no-print">
            <KeyRound size={14} className="flex-shrink-0" />
            <span>Your password still needs to be changed.</span>
            <Button variant="gold" size="xs" onClick={() => setShowPasswordPrompt(true)}>
              Change it now
            </Button>
          </div>
        )}

        {/* Page content. `key` on the route path replays the entrance
            animation, which gives navigation a sense of direction. */}
        <main className="flex-1 page-gutter py-4 sm:py-5 lg:py-6 overflow-x-hidden">
          <div className="content-shell">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ---- Global overlays ---- */}
      <QuickCalculatorModal isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
      <CommandPalette />
      <ChangePasswordModal
        isOpen={showPasswordPrompt}
        onClose={() => setShowPasswordPrompt(false)}
        forced={Boolean(user?.mustChangePassword)}
      />
      <ToastContainer />
    </div>
  );
}
