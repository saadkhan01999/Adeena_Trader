/**
 * ============================================
 * First-run Setup
 * ============================================
 * Shown once, on a database with no users: creates the first administrator and
 * the business profile.
 *
 * Two steps rather than one long form. Asking someone to fill in fourteen
 * fields before they have seen anything is the fastest way to lose them; two
 * short steps with visible progress is not.
 *
 * The endpoint refuses to run once any user exists, so this cannot be replayed
 * to create a second administrator.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, User, Building2, ArrowRight, ArrowLeft, Check, ShieldCheck,
  Loader2, AlertCircle, Mail, Phone, MapPin,
} from 'lucide-react';

import { useAuthStore } from '../context/authStore.js';
import { useToastStore } from '../context/toastStore.js';
import { authService } from '../services/authService.js';
import {
  Input, PasswordInput, Textarea, PhoneInput, FormRow,
} from '../components/common/Form.jsx';
import Button from '../components/common/Button.jsx';
import { APP_NAME, APP_SHORT } from '../constants/index.js';
import { cn } from '../utils/index.js';

const STEPS = [
  { id: 'admin', label: 'Administrator', icon: User },
  { id: 'business', label: 'Your business', icon: Building2 },
];

export default function SetupPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { isAuthenticated } = useAuthStore();

  const [checking, setChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [step, setStep] = useState('admin');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [admin, setAdmin] = useState({
    name: '',
    username: 'admin',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [business, setBusiness] = useState({
    name: 'ADEENA TRADERS',
    tagline: 'Easy Installments • Quality Products • Best Service',
    owner: '',
    phone: '',
    alternatePhone: '',
    address: '',
    city: 'Mardan',
  });

  // ---- Is setup still needed? -------------------------------------------
  useEffect(() => {
    authService
      .getSetupStatus()
      .then((response) => setSetupRequired(response.data.isSetupRequired))
      .catch(() => setSetupRequired(false))
      .finally(() => setChecking(false));
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-navy-50/50 gap-4">
        <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-navy-950 text-gold-500 font-display font-bold text-xl">
          {APP_SHORT}
        </span>
        <span className="flex items-center gap-2 text-sm text-navy-500">
          <Loader2 size={16} className="animate-spin" /> Checking your system…
        </span>
      </div>
    );
  }

  // Setup already done — the sign-in screen is the right destination
  if (!setupRequired) return <Navigate to="/login" replace />;

  // ---- Validation --------------------------------------------------------
  const adminErrors = {
    name: !admin.name.trim() ? 'Enter your name' : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) ? 'Enter a valid email address' : null,
    username: admin.username.length < 3 ? 'At least 3 characters' : null,
    password: admin.password.length < 8 ? 'At least 8 characters' : null,
    confirmPassword:
      admin.confirmPassword && admin.password !== admin.confirmPassword
        ? 'The two passwords do not match'
        : null,
  };

  const adminValid = Object.values(adminErrors).every((e) => !e) && admin.confirmPassword;
  const businessValid = business.name.trim().length > 0;

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      const response = await authService.initialSetup({
        admin: {
          name: admin.name,
          username: admin.username,
          email: admin.email,
          password: admin.password,
          phone: admin.phone,
        },
        business: { ...business, owner: business.owner || admin.name },
      });

      // The endpoint returns a session, so the user lands signed in
      localStorage.setItem('at_access_token', response.data.accessToken);

      toast.success('Setup complete. Welcome to your new system.');
      // A full reload lets the auth store bootstrap cleanly from the new token
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-[100dvh] bg-navy-gradient flex items-center justify-center p-4 sm:p-6">
      {/* Ambient light, kept low-contrast so the card stays the focus */}
      <div className="fixed inset-0 opacity-[0.16] pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gold-500 blur-[120px]" />
        <div className="absolute bottom-0 -right-24 w-[420px] h-[420px] rounded-full bg-gold-400 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-lg"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-gold-500 text-navy-950 font-display font-bold text-2xl mb-3">
            {APP_SHORT}
          </span>
          <h1 className="font-display font-bold text-xl text-white">Welcome to {APP_NAME}</h1>
          <p className="text-sm text-navy-300 mt-1">
            Two short steps and your system is ready to use.
          </p>
        </div>

        <div className="card p-5 sm:p-6">
          {/* Progress */}
          <ol className="flex items-center gap-2 mb-6" aria-label="Setup progress">
            {STEPS.map((s, index) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = index < stepIndex;

              return (
                <li key={s.id} className="flex items-center flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors',
                        isDone && 'bg-success-600 text-white',
                        isActive && 'bg-navy-950 text-gold-500',
                        !isDone && !isActive && 'bg-navy-100 text-navy-400'
                      )}
                    >
                      {isDone ? <Check size={15} /> : <Icon size={15} />}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium truncate',
                        isActive ? 'text-navy-950' : 'text-navy-500'
                      )}
                    >
                      {s.label}
                    </span>
                  </span>

                  {index < STEPS.length - 1 && (
                    <span className={cn('h-px flex-1 mx-2', isDone ? 'bg-success-400' : 'bg-navy-200')} />
                  )}
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-danger-50 border border-danger-200 text-sm text-danger-700" role="alert">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'admin' ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display font-semibold text-navy-950">
                    Create your administrator account
                  </h2>
                  <p className="text-xs text-navy-500 mt-0.5">
                    This account can do everything, including creating accounts for your staff.
                  </p>
                </div>

                <Input
                  label="Your full name"
                  required
                  autoFocus
                  value={admin.name}
                  onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
                  error={admin.name && adminErrors.name}
                  icon={<User size={16} />}
                />

                <FormRow cols={2}>
                  <Input
                    label="Username"
                    required
                    value={admin.username}
                    onChange={(e) =>
                      setAdmin({
                        ...admin,
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
                      })
                    }
                    error={admin.username && adminErrors.username}
                    hint="What you will type to sign in"
                  />
                  <PhoneInput
                    label="Phone"
                    value={admin.phone}
                    onChange={(e) => setAdmin({ ...admin, phone: e.target.value })}
                  />
                </FormRow>

                <Input
                  label="Email"
                  type="email"
                  required
                  value={admin.email}
                  onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                  error={admin.email && adminErrors.email}
                  icon={<Mail size={16} />}
                  autoComplete="email"
                />

                <PasswordInput
                  label="Password"
                  required
                  value={admin.password}
                  onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                  error={admin.password && adminErrors.password}
                  hint="At least 8 characters. There is no self-service reset, so keep it safe."
                  autoComplete="new-password"
                />

                <PasswordInput
                  label="Confirm password"
                  required
                  value={admin.confirmPassword}
                  onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })}
                  error={adminErrors.confirmPassword}
                  autoComplete="new-password"
                />

                <Button
                  variant="gold"
                  size="lg"
                  fullWidth
                  iconRight={ArrowRight}
                  onClick={() => setStep('business')}
                  disabled={!adminValid}
                >
                  Continue
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="business"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display font-semibold text-navy-950">Tell us about your business</h2>
                  <p className="text-xs text-navy-500 mt-0.5">
                    This appears on your invoices, receipts and agreements. You can change any of it
                    later in Settings.
                  </p>
                </div>

                <Input
                  label="Business name"
                  required
                  autoFocus
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                  icon={<Building2 size={16} />}
                />

                <Input
                  label="Tagline"
                  value={business.tagline}
                  onChange={(e) => setBusiness({ ...business, tagline: e.target.value })}
                  hint="A short line printed under your name on documents"
                />

                <Input
                  label="Proprietor"
                  value={business.owner}
                  onChange={(e) => setBusiness({ ...business, owner: e.target.value })}
                  placeholder={admin.name}
                  hint="Leave blank to use your own name"
                />

                <FormRow cols={2}>
                  <PhoneInput
                    label="Business phone"
                    value={business.phone}
                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                  />
                  <PhoneInput
                    label="Alternate phone"
                    value={business.alternatePhone}
                    onChange={(e) => setBusiness({ ...business, alternatePhone: e.target.value })}
                  />
                </FormRow>

                <Textarea
                  label="Address"
                  value={business.address}
                  onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                  rows={2}
                  placeholder="Shop address, printed on every document"
                />

                <Input
                  label="City"
                  value={business.city}
                  onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                  icon={<MapPin size={16} />}
                />

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={ArrowLeft}
                    onClick={() => setStep('admin')}
                    disabled={saving}
                  >
                    Back
                  </Button>
                  <Button
                    variant="gold"
                    size="lg"
                    icon={Rocket}
                    onClick={handleSubmit}
                    isLoading={saving}
                    loadingText="Setting up…"
                    disabled={!businessValid}
                    className="flex-1"
                  >
                    Finish setup
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="flex items-center justify-center gap-1.5 mt-5 text-2xs text-navy-400">
          <ShieldCheck size={12} />
          Your password is encrypted and never stored in readable form.
        </p>
      </motion.div>
    </div>
  );
}
