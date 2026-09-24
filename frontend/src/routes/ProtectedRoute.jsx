/**
 * ============================================
 * ProtectedRoute
 * ============================================
 * Guards a route on two things: an authenticated session, and (optionally) a
 * module permission.
 *
 * The session is verified against the server on first mount rather than trusted
 * from localStorage - a persisted session proves nothing about whether the
 * account is still active or the password has since been changed.
 */

import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';

import { useAuthStore } from '../context/authStore.js';
import { APP_NAME, APP_LOGO_MARK } from '../constants/index.js';
import Button from '../components/common/Button.jsx';

export default function ProtectedRoute({ children, permission = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isBootstrapping, bootstrap, hasPermission, user } = useAuthStore();

  // Verify the persisted session once, on first mount
  useEffect(() => {
    if (isBootstrapping) bootstrap();
  }, [isBootstrapping, bootstrap]);

  // ---- Verifying ---------------------------------------------------------
  if (isBootstrapping) {
    // Only seen on a first visit with a token but no remembered profile -
    // normally the app paints straight from the remembered session.
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-ink-950 gap-5">
        <img src={APP_LOGO_MARK} alt="" className="w-20 h-20 rounded-full ring-2 ring-gold-500/60 shadow-glow" />
        <span className="flex items-center gap-2 text-sm text-gold-200/80">
          <Loader2 size={16} className="animate-spin" />
          Opening {APP_NAME}…
        </span>
      </div>
    );
  }

  // ---- Not signed in -----------------------------------------------------
  if (!isAuthenticated) {
    // Remember where they were heading, so sign-in can return them there
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // ---- Signed in, but not permitted --------------------------------------
  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-warning-50 text-warning-600 ring-8 ring-warning-50/60 mb-5">
          <ShieldAlert size={30} />
        </span>

        <h1 className="font-display font-bold text-xl text-navy-950">You do not have access here</h1>

        <p className="mt-2 text-sm text-navy-600 max-w-sm leading-relaxed">
          Your role ({user?.roleLabel || user?.role}) does not include the{' '}
          <strong className="text-navy-900">{permission}</strong> module. Ask your administrator
          if you need it.
        </p>

        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => navigate('/dashboard', { replace: true })}
          className="mt-6"
        >
          Back to dashboard
        </Button>
      </div>
    );
  }

  return children;
}
