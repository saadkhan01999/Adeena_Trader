/**
 * ============================================
 * Settings
 * ============================================
 * Everything configurable, organised by who needs it and how often.
 *
 * Access
 * ------
 * Settings are READABLE by everyone signed in — a salesman's screen needs the
 * default installment plan and the currency symbol to render correctly — and
 * WRITABLE only by an administrator. Non-admins see their own profile and
 * password sections, and a read-only view of the business preferences.
 *
 * Layout
 * ------
 * A section rail on the left from `lg` up; a scrolling tab strip on a phone.
 * The active section is kept in the URL (`?section=password`), so the profile
 * menu can deep-link straight to it and a reload lands in the same place.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon, Building2, User, KeyRound, Shield, Package,
  CalendarClock, Wallet, UsersRound, BriefcaseBusiness, FileText, Bell,
  MessageCircle, Database, Palette, Save, Download, Upload, Trash2,
  Wrench, HardDrive, AlertTriangle, Check, Plus, Pencil, RotateCcw,
  GripVertical, ListPlus, Info, ShieldAlert, Landmark,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import {
  Input, Textarea, Select, Checkbox, Switch, CurrencyInput, PhoneInput,
  RadioCards, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import FileUpload, { AvatarUpload } from '../../components/common/FileUpload.jsx';
import { PageSkeleton, ListSkeleton } from '../../components/common/Skeleton.jsx';
import ChangePasswordModal from '../../components/modals/ChangePasswordModal.jsx';

import {
  templateService, customFieldService, dataService, uploadService, userService,
} from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import {
  cn, formatCurrency, formatDate, formatFileSize, titleCase,
  resolveFileUrl, getInitials, parseNumber,
} from '../../utils/index.js';
import {
  DOCUMENT_TYPE_META, CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES,
  EXPENSE_CATEGORIES, PAYMENT_METHODS, ROLE_META,
} from '../../constants/index.js';

/** Section definitions. `admin` marks the ones only an administrator can open. */
const SECTIONS = [
  { id: 'profile', label: 'My profile', icon: User, group: 'You' },
  { id: 'password', label: 'Password', icon: KeyRound, group: 'You' },

  { id: 'business', label: 'Business', icon: Building2, group: 'Business', admin: true },
  { id: 'documents', label: 'Documents & agreements', icon: FileText, group: 'Business', admin: true },
  { id: 'fields', label: 'Custom fields', icon: ListPlus, group: 'Business', admin: true },

  { id: 'installments', label: 'Installments', icon: CalendarClock, group: 'Operations', admin: true },
  { id: 'payments', label: 'Payments', icon: Wallet, group: 'Operations', admin: true },
  { id: 'products', label: 'Products & stock', icon: Package, group: 'Operations', admin: true },
  { id: 'ownership', label: 'Ownership', icon: UsersRound, group: 'Operations', admin: true },
  { id: 'investors', label: 'Investors', icon: BriefcaseBusiness, group: 'Operations', admin: true },

  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Communication', admin: true },
  { id: 'reminders', label: 'Customer reminders', icon: MessageCircle, group: 'Communication', admin: true },

  { id: 'security', label: 'Security', icon: Shield, group: 'System', admin: true },
  { id: 'data', label: 'Data management', icon: Database, group: 'System', admin: true },
];

export default function SettingsPage() {
  const toast = useToastStore();
  const { user, isAdmin } = useAuthStore();
  const {
    business, settings, isLoaded, load, saveBusiness, saveSettings,
    uploadBranding, removeBranding, canEditSettings,
  } = useSettingsStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState(searchParams.get('section') || 'profile');

  useEffect(() => { load(); }, [load]);

  // Keep the URL in step, so a reload or a shared link lands in the same place
  const changeSection = (id) => {
    setSection(id);
    setSearchParams({ section: id }, { replace: true });
  };

  const admin = isAdmin();
  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.admin || admin),
    [admin]
  );

  const grouped = useMemo(() => {
    return visibleSections.reduce((acc, item) => {
      (acc[item.group] ||= []).push(item);
      return acc;
    }, {});
  }, [visibleSections]);

  if (!isLoaded) return <PageSkeleton stats={0} showChart={false} />;

  const active = visibleSections.find((s) => s.id === section) || visibleSections[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle={
          admin
            ? 'Configure how the whole system behaves'
            : 'Your profile and the preferences you are allowed to see'
        }
        icon={SettingsIcon}
        badge={
          admin ? (
            <Badge variant="gold" size="sm">Administrator</Badge>
          ) : (
            <Badge variant="neutral" size="sm">{ROLE_META[user?.role]?.label}</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* ---- Section rail (desktop) ---- */}
        <nav className="hidden lg:block lg:col-span-1">
          <div className="card p-2 lg:sticky lg:top-20 space-y-3">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-widest text-navy-400">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === section;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => changeSection(item.id)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left',
                            'text-sm font-medium transition-all duration-200 active:scale-[0.98]',
                            isActive
                              ? 'bg-navy-950 text-white shadow-xs'
                              : 'text-navy-600 hover:bg-navy-50 hover:text-navy-950'
                          )}
                        >
                          <Icon size={16} className="flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* ---- Section tabs (mobile) ---- */}
        <div className="lg:hidden">
          <Tabs
            tabs={visibleSections.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
            active={section}
            onChange={changeSection}
          />
        </div>

        {/* ---- Content ---- */}
        <div className="lg:col-span-3 xl:col-span-4 min-w-0">
          {section === 'profile' && <ProfileSection />}
          {section === 'password' && <PasswordSection />}
          {section === 'business' && (
            <BusinessSection
              business={business}
              onSave={saveBusiness}
              onUpload={uploadBranding}
              onRemove={removeBranding}
            />
          )}
          {section === 'documents' && <DocumentsSection />}
          {section === 'fields' && <CustomFieldsSection />}
          {section === 'installments' && <InstallmentSection settings={settings} onSave={saveSettings} />}
          {section === 'payments' && <PaymentSection settings={settings} onSave={saveSettings} />}
          {section === 'products' && <ProductSection settings={settings} onSave={saveSettings} />}
          {section === 'ownership' && <OwnershipSection settings={settings} onSave={saveSettings} />}
          {section === 'investors' && <InvestorSection settings={settings} onSave={saveSettings} />}
          {section === 'notifications' && <NotificationSection settings={settings} onSave={saveSettings} />}
          {section === 'reminders' && <ReminderSection settings={settings} onSave={saveSettings} />}
          {section === 'security' && <SecuritySection settings={settings} onSave={saveSettings} />}
          {section === 'data' && <DataSection />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Shared shell
 * ========================================================================== */

/** A settings panel with a title, body and a save button in a consistent place. */
function Panel({ title, description, icon: Icon, children, onSave, saving, footer, className }) {
  return (
    <section className={cn('card p-4 sm:p-5 lg:p-6 space-y-5', className)}>
      <header className="flex items-start gap-3 pb-4 border-b border-navy-100">
        {Icon && (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
            <Icon size={19} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-navy-950">{title}</h2>
          {description && <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </header>

      {children}

      {(onSave || footer) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-navy-100">
          {footer}
          {onSave && (
            <Button
              variant="gold"
              icon={Save}
              onClick={onSave}
              isLoading={saving}
              loadingText="Saving…"
              className="ml-auto"
            >
              Save changes
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Local draft state for a settings group.
 * Keeps each panel's edits isolated until Save, so abandoning a section does
 * not leave half-changed values in the shared cache.
 */
function useDraft(source, key) {
  const [draft, setDraft] = useState(() => ({ ...(source?.[key] || {}) }));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft({ ...(source?.[key] || {}) }); }, [source, key]);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  return { draft, set, setDraft, saving, setSaving };
}

/* ============================================================================
 * You
 * ========================================================================== */

function ProfileSection() {
  const toast = useToastStore();
  const { user, updateProfile, uploadPhoto } = useAuthStore();
  const [form, setForm] = useState({ name: '', phone: '', designation: '', photo: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        designation: user.designation || '',
        photo: user.photo || null,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile(form);
    setSaving(false);

    if (result.success) toast.success('Profile updated.');
    else toast.error(result.error);
  };

  return (
    <Panel
      title="My profile"
      description="How you appear to your colleagues across the system"
      icon={User}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex items-center gap-4 pb-4 border-b border-navy-100">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-navy-950 text-gold-500 text-lg font-bold overflow-hidden flex-shrink-0">
          {form.photo ? (
            <img src={resolveFileUrl(form.photo)} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(user?.name)
          )}
        </span>

        <div className="min-w-0">
          <p className="font-display font-semibold text-navy-950">{user?.name}</p>
          <p className="text-xs text-navy-500">@{user?.username} · {user?.email}</p>
          <Badge variant="gold" size="sm" className="mt-1">
            {ROLE_META[user?.role]?.label || user?.role}
          </Badge>
        </div>
      </div>

      <AvatarUpload
        label="Profile photo"
        value={form.photo}
        onChange={(url) => setForm({ ...form, photo: url })}
        folder="users"
      />

      <FormRow cols={2}>
        <Input
          label="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <PhoneInput
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </FormRow>

      <Input
        label="Designation"
        value={form.designation}
        onChange={(e) => setForm({ ...form, designation: e.target.value })}
        placeholder="e.g. Counter 2, evening shift"
      />

      {/* Immutable fields, shown so it is clear they exist and who changes them */}
      <div className="rounded-lg bg-navy-50 border border-navy-100 p-3.5">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-2.5">
          <Info size={12} /> Set by your administrator
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Username" value={user?.username} mono />
          <FieldDisplay label="Email" value={user?.email} />
          <FieldDisplay label="Role" value={ROLE_META[user?.role]?.label} />
          <FieldDisplay label="Modules" value={`${user?.permissions?.length || 0} accessible`} />
        </div>
      </div>
    </Panel>
  );
}

function PasswordSection() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Panel
        title="Password"
        description="Changing your password signs out every other device"
        icon={KeyRound}
      >
        {user?.mustChangePassword && (
          <div className="flex items-start gap-2.5 rounded-lg bg-warning-50 border border-warning-200 p-3">
            <AlertTriangle size={16} className="text-warning-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning-800 leading-relaxed">
              Your account is still using a temporary password set by an administrator. Choose your
              own now.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-navy-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-900">Change your password</p>
              <p className="text-xs text-navy-500 mt-0.5">
                You will need your current password to confirm.
              </p>
            </div>
            <Button variant="gold" icon={KeyRound} onClick={() => setOpen(true)}>
              Change password
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-navy-50 border border-navy-100 p-3.5">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-1.5">
            <ShieldAlert size={12} /> Forgotten your password?
          </p>
          <p className="text-xs text-navy-600 leading-relaxed">
            There is no self-service reset by design. Ask an administrator to reset it from
            Users &amp; Roles — they will give you a temporary password to change on your next
            sign-in.
          </p>
        </div>
      </Panel>

      <ChangePasswordModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ============================================================================
 * Business
 * ========================================================================== */

function BusinessSection({ business, onSave, onUpload, onRemove }) {
  const toast = useToastStore();
  const [form, setForm] = useState(business || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(business || {}); }, [business]);

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave(form);
    setSaving(false);

    if (result.success) toast.success('Business profile saved.');
    else toast.error(result.error);
  };

  const handleBranding = async (file, field) => {
    const result = await onUpload(file, field);
    if (result.success) toast.success(`${titleCase(field)} uploaded.`);
    else toast.error(result.error);
  };

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Panel
      title="Business profile"
      description="Everything printed on your invoices, receipts and agreements"
      icon={Building2}
      onSave={handleSave}
      saving={saving}
    >
      <FormSection title="Identity" icon={Building2}>
        <FormRow cols={2}>
          <Input label="Business name" required value={form.name || ''} onChange={(e) => set({ name: e.target.value })} />
          <Input label="Proprietor" value={form.owner || ''} onChange={(e) => set({ owner: e.target.value })} />
        </FormRow>

        <FormRow cols={2}>
          <Input label="Tagline" value={form.tagline || ''} onChange={(e) => set({ tagline: e.target.value })} />
          <Input
            label="Proprietor CNIC"
            value={form.ownerCnic || ''}
            onChange={(e) => set({ ownerCnic: e.target.value })}
            hint="Printed on formal agreements"
          />
        </FormRow>
      </FormSection>

      <FormSection title="Contact" icon={MessageCircle}>
        <FormRow cols={2}>
          <PhoneInput label="Phone" value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
          <PhoneInput
            label="Alternate phone"
            value={form.alternatePhone || ''}
            onChange={(e) => set({ alternatePhone: e.target.value })}
          />
        </FormRow>

        <FormRow cols={2}>
          <Input label="Email" type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} />
          <Input label="Website" value={form.website || ''} onChange={(e) => set({ website: e.target.value })} />
        </FormRow>

        <Textarea label="Address" value={form.address || ''} onChange={(e) => set({ address: e.target.value })} rows={2} />

        <FormRow cols={2}>
          <Input label="City" value={form.city || ''} onChange={(e) => set({ city: e.target.value })} />
          <Input label="Country" value={form.country || ''} onChange={(e) => set({ country: e.target.value })} />
        </FormRow>
      </FormSection>

      <FormSection
        title="Registration"
        icon={FileText}
        description="Printed on formal documents where applicable"
      >
        <FormRow cols={3}>
          <Input label="NTN" value={form.ntn || ''} onChange={(e) => set({ ntn: e.target.value })} />
          <Input label="STRN" value={form.strn || ''} onChange={(e) => set({ strn: e.target.value })} />
          <Input
            label="Registration no."
            value={form.registrationNumber || ''}
            onChange={(e) => set({ registrationNumber: e.target.value })}
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Branding"
        icon={Palette}
        description="Appears on the sidebar, the sign-in screen and every printed document"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { field: 'logo', label: 'Logo', hint: 'Shown on documents and in the app' },
            { field: 'stamp', label: 'Company stamp', hint: 'Overlaid on signed agreements' },
            { field: 'signature', label: 'Signature', hint: 'Authorised signatory image' },
          ].map((item) => (
            <div key={item.field}>
              <p className="label">{item.label}</p>

              <div className="rounded-lg border border-navy-200 bg-navy-50 aspect-[16/10] flex items-center justify-center overflow-hidden mb-2">
                {form[item.field] ? (
                  <img
                    src={resolveFileUrl(form[item.field])}
                    alt=""
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <span className="text-2xs text-navy-400">Not set</span>
                )}
              </div>

              <div className="flex gap-1.5">
                <label className="btn-secondary btn btn-sm flex-1 justify-center cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleBranding(e.target.files[0], item.field)}
                  />
                </label>
                {form[item.field] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-500"
                    onClick={async () => {
                      const result = await onRemove(item.field);
                      if (result.success) toast.success(`${item.label} removed.`);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <p className="text-2xs text-navy-400 mt-1">{item.hint}</p>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Document numbering"
        icon={FileText}
        description="Prefixes and starting numbers for each series"
      >
        {[
          { prefix: 'invoicePrefix', start: 'invoiceStartingNumber', counter: 'invoiceCounter', label: 'Invoices' },
          { prefix: 'receiptPrefix', start: 'receiptStartingNumber', counter: 'receiptCounter', label: 'Receipts' },
          { prefix: 'agreementPrefix', start: 'agreementStartingNumber', counter: 'agreementCounter', label: 'Agreements' },
        ].map((series) => (
          <FormRow cols={3} key={series.label}>
            <Input
              label={`${series.label} prefix`}
              value={form[series.prefix] || ''}
              onChange={(e) => set({ [series.prefix]: e.target.value.toUpperCase() })}
              maxLength={6}
            />
            <Input
              label="Starting number"
              type="number"
              min={0}
              value={form[series.start] ?? 1000}
              onChange={(e) => set({ [series.start]: parseNumber(e.target.value) })}
              hint="Can only be raised, never lowered"
            />
            <div className="flex items-end pb-1">
              <p className="text-2xs text-navy-500">
                Next: <strong className="text-navy-900 tabular">
                  {form[series.prefix]}-{(form[series.counter] ?? 1000) + 1}
                </strong>
              </p>
            </div>
          </FormRow>
        ))}
      </FormSection>

      <FormSection
        title="Bank details"
        icon={Landmark}
        description="Printed on invoices when you accept transfers"
      >
        <FormRow cols={2}>
          <Input label="Bank name" value={form.bankName || ''} onChange={(e) => set({ bankName: e.target.value })} />
          <Input
            label="Account title"
            value={form.bankAccountTitle || ''}
            onChange={(e) => set({ bankAccountTitle: e.target.value })}
          />
        </FormRow>
        <FormRow cols={2}>
          <Input
            label="Account number"
            value={form.bankAccountNumber || ''}
            onChange={(e) => set({ bankAccountNumber: e.target.value })}
          />
          <Input label="IBAN" value={form.bankIban || ''} onChange={(e) => set({ bankIban: e.target.value })} />
        </FormRow>
      </FormSection>

      <FormSection title="Default wording" icon={FileText}>
        <Textarea
          label="Terms & conditions"
          value={form.termsAndConditions || ''}
          onChange={(e) => set({ termsAndConditions: e.target.value })}
          rows={5}
          hint="Printed on invoices. Agreement clauses are edited under Documents."
        />
        <FormRow cols={2}>
          <Input
            label="Invoice footer"
            value={form.invoiceFooter || ''}
            onChange={(e) => set({ invoiceFooter: e.target.value })}
          />
          <Input
            label="Receipt footer"
            value={form.receiptFooter || ''}
            onChange={(e) => set({ receiptFooter: e.target.value })}
          />
        </FormRow>
      </FormSection>
    </Panel>
  );
}

/* ============================================================================
 * Documents & agreements
 * ========================================================================== */

/**
 * The admin owns the wording of every document the business issues. Clauses can
 * be edited, reordered, switched off, and added to — which is what makes the
 * installment, investor and partnership agreements genuinely this shop's own
 * rather than boilerplate.
 */
function DocumentsSection() {
  const toast = useToastStore();

  const [templates, setTemplates] = useState([]);
  const [types, setTypes] = useState([]);
  const [activeType, setActiveType] = useState('installment_agreement');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await templateService.list();
      setTemplates(response.data.templates || []);
      setTypes(response.data.types || []);
    } catch (error) {
      toast.apiError(error, 'Could not load the document templates.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load the selected template into an editable draft
  useEffect(() => {
    const found = templates.find((t) => t.type === activeType);
    if (found) setDraft(JSON.parse(JSON.stringify(found)));
  }, [templates, activeType]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await templateService.update(activeType, draft);
      toast.success('Document wording saved.');
      load();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await templateService.reset(activeType);
      toast.success('Restored to the wording the system shipped with.');
      setResetTarget(null);
      load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  // ---- Clause helpers --------------------------------------------------
  const updateClause = (index, patch) => {
    setDraft((current) => ({
      ...current,
      clauses: current.clauses.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const moveClause = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.clauses.length) return;

    const clauses = [...draft.clauses];
    [clauses[index], clauses[target]] = [clauses[target], clauses[index]];
    setDraft({ ...draft, clauses });
  };

  const addClause = () => {
    setDraft((current) => ({
      ...current,
      clauses: [...current.clauses, { title: '', body: '', isActive: true, isCustom: true }],
    }));
  };

  const removeClause = (index) => {
    setDraft((current) => ({ ...current, clauses: current.clauses.filter((_, i) => i !== index) }));
  };

  if (loading || !draft) return <div className="card p-6"><ListSkeleton items={5} /></div>;

  const isAgreement = activeType.endsWith('_agreement');

  return (
    <>
      <Panel
        title="Documents & agreements"
        description="You own the wording of every document your business issues"
        icon={FileText}
        onSave={handleSave}
        saving={saving}
        footer={
          <Button variant="ghost" icon={RotateCcw} onClick={() => setResetTarget(activeType)}>
            Restore defaults
          </Button>
        }
      >
        <Tabs
          tabs={types.map((t) => ({
            id: t.type,
            label: DOCUMENT_TYPE_META[t.type]?.label || t.label,
            icon: FileText,
          }))}
          active={activeType}
          onChange={setActiveType}
        />

        <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
          <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            Text in {'{braces}'} is replaced with the real values when a document is issued — for
            example {'{customerName}'} or {'{monthlyInstallment}'}. Editing the wording here affects
            documents issued from now on; agreements already signed keep the words that were agreed.
          </p>
        </div>

        <FormSection title="Headings" icon={FileText}>
          <FormRow cols={2}>
            <Input
              label="Document title"
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Input
              label="Subtitle"
              value={draft.subtitle || ''}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              placeholder="Optional, e.g. Qist Par Farokht Ka Muahida"
            />
          </FormRow>

          {isAgreement && (
            <Textarea
              label="Opening paragraph"
              value={draft.introText || ''}
              onChange={(e) => setDraft({ ...draft, introText: e.target.value })}
              rows={5}
              hint="Names the parties and states what is being agreed"
            />
          )}
        </FormSection>

        {/* ---- Clauses ---- */}
        <FormSection
          title={isAgreement ? 'Clauses' : 'Terms'}
          icon={FileText}
          description={`${draft.clauses?.filter((c) => c.isActive).length || 0} of ${draft.clauses?.length || 0} will print`}
          action={
            <Button variant="secondary" size="sm" icon={Plus} onClick={addClause}>
              Add clause
            </Button>
          }
        >
          {draft.clauses?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No clauses"
              message="Add the terms you want printed on this document."
              size="sm"
            />
          ) : (
            <ul className="space-y-2.5">
              {draft.clauses.map((clause, index) => (
                <li
                  key={index}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    clause.isActive ? 'border-navy-200' : 'border-navy-100 bg-navy-50/60 opacity-70'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Reorder controls. Arrow buttons rather than drag-and-drop:
                        they work on a touch screen and with a keyboard. */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => moveClause(index, -1)}
                        disabled={index === 0}
                        aria-label="Move this clause up"
                        className="p-0.5 rounded text-navy-400 hover:bg-navy-100 hover:text-navy-700 disabled:opacity-25 transition-colors"
                      >
                        <GripVertical size={12} className="rotate-180" />
                      </button>
                      <span className="flex items-center justify-center w-5 h-5 rounded bg-navy-950 text-gold-500 text-2xs font-bold">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveClause(index, 1)}
                        disabled={index === draft.clauses.length - 1}
                        aria-label="Move this clause down"
                        className="p-0.5 rounded text-navy-400 hover:bg-navy-100 hover:text-navy-700 disabled:opacity-25 transition-colors"
                      >
                        <GripVertical size={12} />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={clause.title || ''}
                          onChange={(e) => updateClause(index, { title: e.target.value })}
                          placeholder="Clause heading (optional)"
                          className="input-sm"
                        />
                        {clause.isCustom && <Badge variant="gold" size="sm">Yours</Badge>}
                      </div>

                      <Textarea
                        value={clause.body || ''}
                        onChange={(e) => updateClause(index, { body: e.target.value })}
                        rows={3}
                        placeholder="The clause text"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <Checkbox
                          label="Print this clause"
                          checked={clause.isActive}
                          onChange={(e) => updateClause(index, { isActive: e.target.checked })}
                        />

                        {clause.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeClause(index)}
                            className="text-2xs font-medium text-danger-600 hover:text-danger-700 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        {/* ---- The admin's own wording ---- */}
        <FormSection
          title="Your own wording"
          icon={Pencil}
          description="Printed after the clauses — anything specific to how you trade"
        >
          <Textarea
            value={draft.customText || ''}
            onChange={(e) => setDraft({ ...draft, customText: e.target.value })}
            rows={4}
            placeholder="e.g. A repossession charge of Rs. 2,000 applies where goods must be collected."
            maxLength={2000}
          />
        </FormSection>

        <FormSection title="Footer" icon={FileText}>
          <Textarea
            label="Closing text"
            value={draft.footerText || ''}
            onChange={(e) => setDraft({ ...draft, footerText: e.target.value })}
            rows={2}
          />
          <Textarea
            label="Legal note"
            value={draft.legalNote || ''}
            onChange={(e) => setDraft({ ...draft, legalNote: e.target.value })}
            rows={2}
            hint="Small print under the signatures"
          />
        </FormSection>

        {/* ---- Available tokens ---- */}
        {draft.availableTokens?.length > 0 && (
          <div className="rounded-lg bg-navy-50 border border-navy-200 p-3.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-2">
              Available placeholders — click to copy
            </p>
            <div className="flex flex-wrap gap-1">
              {draft.availableTokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`{${token}}`);
                    toast.success(`{${token}} copied`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-white border border-navy-200 text-2xs font-mono text-navy-700 hover:border-gold-400 hover:text-gold-700 transition-colors"
                >
                  {'{'}{token}{'}'}
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={handleReset}
        title="Restore the default wording?"
        message="Every clause and every edit you have made to this document will be replaced with the wording the system shipped with."
        confirmText="Restore defaults"
        variant="warning"
      />
    </>
  );
}

/* ============================================================================
 * Custom fields
 * ========================================================================== */

/**
 * Lets the admin add their own fields to any module's form — "Registration Book
 * No." for a bike dealer, "Panel Watts" for solar — without a code change.
 */
function CustomFieldsSection() {
  const toast = useToastStore();
  const reloadFields = useSettingsStore((s) => s.reloadCustomFields);

  const [grouped, setGrouped] = useState({});
  const [module, setModule] = useState('product');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await customFieldService.list();
      setGrouped(response.data.grouped || {});
    } catch (error) {
      toast.apiError(error, 'Could not load custom fields.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const fields = grouped[module] || [];

  const handleDelete = async (hard) => {
    try {
      await customFieldService.delete(deleteTarget._id, hard);
      toast.success(hard ? 'Field deleted.' : 'Field hidden. Existing values are kept.');
      setDeleteTarget(null);
      load();
      reloadFields();
    } catch (error) {
      toast.apiError(error);
    }
  };

  return (
    <>
      <Panel
        title="Custom fields"
        description="Add the fields your business records that the system does not have by default"
        icon={ListPlus}
        footer={
          <Button
            variant="gold"
            icon={Plus}
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            Add a field to {CUSTOM_FIELD_MODULES.find((m) => m.value === module)?.label}
          </Button>
        }
      >
        <Tabs
          tabs={CUSTOM_FIELD_MODULES.map((m) => ({
            id: m.value,
            label: m.label,
            count: grouped[m.value]?.length,
          }))}
          active={module}
          onChange={setModule}
        />

        <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
          <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            A field added here appears on that module&apos;s form under &ldquo;Additional
            details&rdquo;, in its detail view, and in CSV exports. Hiding a field keeps the values
            already captured; deleting one removes the definition entirely.
          </p>
        </div>

        {loading ? (
          <ListSkeleton items={3} />
        ) : fields.length === 0 ? (
          <EmptyState
            icon={ListPlus}
            title="No custom fields here yet"
            message={`Add a field to record something specific about your ${module}s.`}
            size="sm"
          />
        ) : (
          <ul className="space-y-2">
            {fields.map((field) => (
              <li
                key={field._id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border p-3',
                  field.isActive ? 'border-navy-200' : 'border-navy-100 bg-navy-50/60 opacity-70'
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-navy-950">
                    {field.label}
                    {field.isRequired && <Badge variant="danger" size="sm">Required</Badge>}
                    {!field.isActive && <Badge variant="neutral" size="sm">Hidden</Badge>}
                    {field.showOnDocuments && <Badge variant="gold" size="sm">On documents</Badge>}
                  </p>
                  <p className="text-2xs text-navy-500 mt-0.5">
                    {CUSTOM_FIELD_TYPES.find((t) => t.value === field.type)?.label} ·{' '}
                    <span className="font-mono">{field.key}</span>
                    {field.options?.length > 0 && ` · ${field.options.length} options`}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <IconButton
                    icon={Pencil}
                    label="Edit this field"
                    size="icon-sm"
                    onClick={() => { setEditing(field); setFormOpen(true); }}
                  />
                  <IconButton
                    icon={Trash2}
                    label="Remove this field"
                    size="icon-sm"
                    className="text-danger-500 hover:bg-danger-50"
                    onClick={() => setDeleteTarget(field)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CustomFieldModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        module={module}
        onSuccess={() => { setFormOpen(false); load(); reloadFields(); }}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this field"
        subtitle={deleteTarget?.label}
        icon={Trash2}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleDelete(false)}>Hide it</Button>
            <Button variant="danger" onClick={() => handleDelete(true)}>Delete permanently</Button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-navy-600 leading-relaxed">
          <strong>Hide it</strong> removes the field from the form but keeps every value already
          captured, so old records still read correctly. <strong>Delete permanently</strong> removes
          the definition — use it for a field created by mistake.
        </p>
      </Modal>
    </>
  );
}

function CustomFieldModal({ isOpen, onClose, editing, module, onSuccess }) {
  const toast = useToastStore();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      editing || {
        module,
        label: '',
        type: 'text',
        options: [],
        placeholder: '',
        helpText: '',
        isRequired: false,
        isActive: true,
        showOnDocuments: false,
        span: 1,
      }
    );
  }, [isOpen, editing, module]);

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.label?.trim()) {
      toast.warning('Give the field a label.');
      return;
    }
    if (form.type === 'select' && (!form.options || form.options.length === 0)) {
      toast.warning('A dropdown needs at least one option.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await customFieldService.update(editing._id, form);
        toast.success('Field updated.');
      } else {
        await customFieldService.create({ ...form, module });
        toast.success(`"${form.label}" added to the ${module} form.`);
      }
      onSuccess?.();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit custom field' : 'Add a custom field'}
      subtitle={CUSTOM_FIELD_MODULES.find((m) => m.value === module)?.label}
      icon={ListPlus}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={handleSubmit} isLoading={saving}>
            {editing ? 'Save changes' : 'Add field'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow cols={2}>
          <Input
            label="Field label"
            required
            autoFocus
            value={form.label || ''}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. Registration Book No."
            hint={editing ? 'The internal key stays the same' : 'What staff will see on the form'}
          />
          <Select
            label="Field type"
            value={form.type || 'text'}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={CUSTOM_FIELD_TYPES}
          />
        </FormRow>

        {form.type === 'select' && (
          <Textarea
            label="Options"
            value={(form.options || []).join('\n')}
            onChange={(e) =>
              setForm({ ...form, options: e.target.value.split('\n').filter((o) => o.trim()) })
            }
            rows={4}
            placeholder={'One option per line\nNew\nUsed\nRefurbished'}
            hint="One per line"
          />
        )}

        <FormRow cols={2}>
          <Input
            label="Placeholder"
            value={form.placeholder || ''}
            onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
          />
          <Select
            label="Width"
            value={form.span || 1}
            onChange={(e) => setForm({ ...form, span: Number(e.target.value) })}
            options={[
              { value: 1, label: 'Half width' },
              { value: 2, label: 'Full width' },
            ]}
          />
        </FormRow>

        <Input
          label="Help text"
          value={form.helpText || ''}
          onChange={(e) => setForm({ ...form, helpText: e.target.value })}
          placeholder="Shown under the field (optional)"
        />

        <div className="space-y-2.5 rounded-lg bg-navy-50 border border-navy-100 p-3">
          <Checkbox
            label="Required"
            description="The form cannot be saved without it"
            checked={form.isRequired || false}
            onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
          />
          <Checkbox
            label="Print on documents"
            description="Include this value on the record's invoice or agreement"
            checked={form.showOnDocuments || false}
            onChange={(e) => setForm({ ...form, showOnDocuments: e.target.checked })}
          />
          {editing && (
            <Checkbox
              label="Visible on the form"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          )}
        </div>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Operations
 * ========================================================================== */

function InstallmentSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'installment');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ installment: draft });
    setSaving(false);
    if (result.success) toast.success('Installment settings saved.');
    else toast.error(result.error);
  };

  return (
    <Panel
      title="Installments"
      description="How installment sales are calculated and enforced"
      icon={CalendarClock}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex items-start gap-2.5 rounded-lg bg-gold-50 border border-gold-200 p-3">
        <Info size={15} className="text-gold-600 flex-shrink-0 mt-0.5" />
        <p className="text-2xs text-navy-700 leading-relaxed">
          Only 6-month and 12-month plans are offered, and no interest is charged — the price is
          fixed at the time of sale.
        </p>
      </div>

      <FormRow cols={2}>
        <Select
          label="Default plan"
          value={draft.defaultPlan ?? 6}
          onChange={(e) => set({ defaultPlan: Number(e.target.value) })}
          options={[
            { value: 6, label: '6 months' },
            { value: 12, label: '12 months' },
          ]}
          hint="Pre-selected on a new installment sale"
        />
        <Input
          label="Grace period"
          type="number"
          min={0}
          max={30}
          value={draft.gracePeriodDays ?? 0}
          onChange={(e) => set({ gracePeriodDays: parseNumber(e.target.value) })}
          suffix="days"
          hint="Days past due before an installment counts as overdue"
        />
      </FormRow>

      <FormRow cols={2}>
        <Input
          label="Minimum advance"
          type="number"
          min={0}
          max={100}
          value={draft.minAdvancePercent ?? 0}
          onChange={(e) => set({ minAdvancePercent: parseNumber(e.target.value) })}
          suffix="%"
          hint="0 means no minimum down payment"
        />
        <Select
          label="Rounding"
          value={draft.roundingRule || 'round'}
          onChange={(e) => set({ roundingRule: e.target.value })}
          options={[
            { value: 'round', label: 'Round to the nearest rupee' },
            { value: 'floor', label: 'Round down' },
            { value: 'ceil', label: 'Round up' },
          ]}
        />
      </FormRow>

      <div className="space-y-3 rounded-lg border border-navy-200 p-3.5">
        <Switch
          label="Require a guarantor"
          description="Block an installment sale unless the customer has guarantor details on file"
          checked={draft.requireGuarantor ?? true}
          onChange={(value) => set({ requireGuarantor: value })}
        />
        <div className="border-t border-navy-100 pt-3">
          <Switch
            label="Issue the agreement automatically"
            description="Create the installment agreement as soon as the sale is saved, ready to print"
            checked={draft.autoGenerateAgreement ?? true}
            onChange={(value) => set({ autoGenerateAgreement: value })}
          />
        </div>
      </div>
    </Panel>
  );
}

function PaymentSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'payment');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ payment: draft });
    setSaving(false);
    if (result.success) toast.success('Payment settings saved.');
    else toast.error(result.error);
  };

  const methods = draft.acceptedMethods || [];

  return (
    <Panel
      title="Payments"
      description="How money received is recorded and allocated"
      icon={Wallet}
      onSave={handleSave}
      saving={saving}
    >
      <FormRow cols={2}>
        <Input
          label="Receipt prefix"
          value={draft.receiptPrefix || 'RCP'}
          onChange={(e) => set({ receiptPrefix: e.target.value.toUpperCase() })}
          maxLength={6}
        />
        <Select
          label="Allocation"
          value={draft.allocationRule || 'oldest_first'}
          onChange={(e) => set({ allocationRule: e.target.value })}
          options={[
            { value: 'oldest_first', label: 'Oldest installment first' },
            { value: 'admin_selected', label: 'Choose the installment each time' },
          ]}
          hint="Oldest-first clears the most overdue liability, which is fairest to the customer"
        />
      </FormRow>

      <div>
        <p className="label">Accepted payment methods</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method.value}
              className="flex items-center gap-2 rounded-lg border border-navy-200 p-2.5 cursor-pointer hover:bg-navy-50 transition-colors"
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={methods.includes(method.value)}
                onChange={(e) =>
                  set({
                    acceptedMethods: e.target.checked
                      ? [...methods, method.value]
                      : methods.filter((m) => m !== method.value),
                  })
                }
              />
              <span className="text-sm text-navy-800">{method.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-navy-200 p-3.5">
        <Switch
          label="Allow partial payments"
          description="Accept less than the full installment amount"
          checked={draft.allowPartialPayment ?? true}
          onChange={(value) => set({ allowPartialPayment: value })}
        />
        <div className="border-t border-navy-100 pt-3">
          <Switch
            label="Offer a thank-you message"
            description="After a payment is recorded, offer to send the customer a confirmation on WhatsApp"
            checked={draft.sendThankYouMessage ?? true}
            onChange={(value) => set({ sendThankYouMessage: value })}
          />
        </div>
      </div>
    </Panel>
  );
}

function ProductSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'product');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ product: draft });
    setSaving(false);
    if (result.success) toast.success('Product settings saved.');
    else toast.error(result.error);
  };

  return (
    <Panel
      title="Products & stock"
      description="Defaults applied to new products and stock warnings"
      icon={Package}
      onSave={handleSave}
      saving={saving}
    >
      <FormRow cols={2}>
        <Input
          label="SKU prefix"
          value={draft.skuPrefix || 'PRD'}
          onChange={(e) => set({ skuPrefix: e.target.value.toUpperCase() })}
          maxLength={6}
        />
        <Input
          label="Default reorder level"
          type="number"
          min={0}
          value={draft.lowStockThreshold ?? 5}
          onChange={(e) => set({ lowStockThreshold: parseNumber(e.target.value) })}
          hint="Warn when a product falls to this many units"
        />
      </FormRow>

      <FormRow cols={2}>
        <Input
          label="Default warranty"
          type="number"
          min={0}
          value={draft.defaultWarrantyMonths ?? 0}
          onChange={(e) => set({ defaultWarrantyMonths: parseNumber(e.target.value) })}
          suffix="months"
        />
        <Input
          label="Installment markup"
          type="number"
          min={0}
          max={200}
          value={draft.defaultInstallmentMarkupPercent ?? 20}
          onChange={(e) => set({ defaultInstallmentMarkupPercent: parseNumber(e.target.value) })}
          suffix="%"
          hint="Used by the suggested installment price"
        />
      </FormRow>

      <div className="space-y-3 rounded-lg border border-navy-200 p-3.5">
        <Switch
          label="Prevent negative stock"
          description="Block a sale that would take stock below zero"
          checked={draft.preventNegativeStock ?? true}
          onChange={(value) => set({ preventNegativeStock: value })}
        />
        <div className="border-t border-navy-100 pt-3">
          <Switch
            label="Require a serial number"
            description="Insist on an IMEI or serial for every product"
            checked={draft.requireSerial ?? false}
            onChange={(value) => set({ requireSerial: value })}
          />
        </div>
      </div>
    </Panel>
  );
}

function OwnershipSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'ownership');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ ownership: draft });
    setSaving(false);
    if (result.success) toast.success('Ownership settings saved.');
    else toast.error(result.error);
  };

  const partnerShare = draft.defaultPartnerShare ?? 40;

  return (
    <Panel
      title="Ownership"
      description="How a shared record is split between you and a partner"
      icon={UsersRound}
      onSave={handleSave}
      saving={saving}
    >
      <Input
        label="Default partner share"
        type="number"
        min={0}
        max={100}
        value={partnerShare}
        onChange={(e) => set({ defaultPartnerShare: parseNumber(e.target.value) })}
        suffix="%"
        hint="Applied to records marked as shared, unless a partner has their own agreed percentage"
      />

      {/* A visual split reads faster than two numbers */}
      <div>
        <div className="flex h-8 rounded-lg overflow-hidden border border-navy-200">
          <div
            className="bg-navy-950 flex items-center justify-center text-2xs font-semibold text-gold-500 transition-all duration-300"
            style={{ width: `${100 - partnerShare}%` }}
          >
            {100 - partnerShare > 12 && `Owner ${100 - partnerShare}%`}
          </div>
          <div
            className="bg-gold-500 flex items-center justify-center text-2xs font-semibold text-navy-950 transition-all duration-300"
            style={{ width: `${partnerShare}%` }}
          >
            {partnerShare > 12 && `Partner ${partnerShare}%`}
          </div>
        </div>
        <p className="text-2xs text-navy-500 mt-1.5">
          Applies to stock, sales, collections and expenses marked as shared.
        </p>
      </div>

      <Select
        label="Profit split"
        value={draft.profitSplitMode || 'by_share'}
        onChange={(e) => set({ profitSplitMode: e.target.value })}
        options={[
          { value: 'by_share', label: 'In proportion to capital' },
          { value: 'fixed', label: 'By a fixed agreement' },
        ]}
        hint="Under Shariah, loss is always borne in proportion to capital regardless of this setting"
      />
    </Panel>
  );
}

function InvestorSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'investor');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ investor: draft });
    setSaving(false);
    if (result.success) toast.success('Investor settings saved.');
    else toast.error(result.error);
  };

  return (
    <Panel
      title="Investors"
      description="Defaults applied when a new investor is added"
      icon={BriefcaseBusiness}
      onSave={handleSave}
      saving={saving}
    >
      <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
        <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
        <p className="text-2xs text-navy-700 leading-relaxed">
          <strong>Investors are never included in Zakat.</strong> Their capital is a liability of the
          business towards them, not your wealth. Zakat is calculated for the owner and partners
          only.
        </p>
      </div>

      <FormRow cols={2}>
        <Input
          label="Default profit share"
          type="number"
          min={0}
          max={100}
          value={draft.defaultProfitPercentage ?? 10}
          onChange={(e) => set({ defaultProfitPercentage: parseNumber(e.target.value) })}
          suffix="%"
        />
        <Select
          label="Default basis"
          value={draft.defaultCalcMethod || 'fixed_percent'}
          onChange={(e) => set({ defaultCalcMethod: e.target.value })}
          options={[
            { value: 'fixed_percent', label: 'Fixed % of capital' },
            { value: 'profit_sharing', label: 'Share of business profit' },
            { value: 'monthly_fixed', label: 'Fixed monthly amount' },
          ]}
        />
      </FormRow>

      <FormRow cols={2}>
        <Select
          label="Payout frequency"
          value={draft.payoutFrequency || 'monthly'}
          onChange={(e) => set({ payoutFrequency: e.target.value })}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'half_yearly', label: 'Half-yearly' },
            { value: 'annually', label: 'Annually' },
            { value: 'on_demand', label: 'On demand' },
          ]}
        />
      </FormRow>

      <Switch
        label="Issue the agreement automatically"
        description="Create the investment agreement when an investor is added"
        checked={draft.autoGenerateAgreement ?? true}
        onChange={(value) => set({ autoGenerateAgreement: value })}
      />
    </Panel>
  );
}

/* ============================================================================
 * Communication
 * ========================================================================== */

function NotificationSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'notification');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ notification: draft });
    setSaving(false);
    if (result.success) toast.success('Notification settings saved.');
    else toast.error(result.error);
  };

  const alerts = [
    { key: 'overdueAlerts', label: 'Overdue installments', description: 'One alert per customer who is behind' },
    { key: 'lowStockAlerts', label: 'Low and out of stock', description: 'When a product reaches its reorder level' },
    { key: 'supplierPayableAlerts', label: 'Supplier payables', description: 'Money still owed to suppliers' },
    { key: 'investorPayoutAlerts', label: 'Investor payouts', description: 'Profit earned but not yet paid out' },
    { key: 'zakatReminder', label: 'Zakat due', description: 'As the lunar year (hawl) completes' },
  ];

  return (
    <Panel
      title="Notifications"
      description="What the bell in the header tells you about"
      icon={Bell}
      onSave={handleSave}
      saving={saving}
    >
      <Switch
        label="Notifications enabled"
        description="Turn everything off without losing your individual choices"
        checked={draft.enabled ?? true}
        onChange={(value) => set({ enabled: value })}
      />

      <div className={cn('space-y-3 transition-opacity', !draft.enabled && 'opacity-50 pointer-events-none')}>
        <Input
          label="Warn about payments this far ahead"
          type="number"
          min={1}
          max={30}
          value={draft.upcomingDueDays ?? 3}
          onChange={(e) => set({ upcomingDueDays: parseNumber(e.target.value) })}
          suffix="days"
          hint="An installment starts appearing as upcoming this many days before it falls due"
        />

        <div className="rounded-lg border border-navy-200 divide-y divide-navy-100">
          {alerts.map((alert) => (
            <div key={alert.key} className="p-3.5">
              <Switch
                label={alert.label}
                description={alert.description}
                checked={draft[alert.key] ?? true}
                onChange={(value) => set({ [alert.key]: value })}
              />
            </div>
          ))}
        </div>

        <Switch
          label="Play a sound"
          description="A short chime when a new alert arrives"
          checked={draft.soundEnabled ?? false}
          onChange={(value) => set({ soundEnabled: value })}
        />
      </div>

      <p className="text-2xs text-navy-500 leading-relaxed">
        Alerts are re-checked automatically every 30 minutes, and on demand from the bell icon.
        Duplicate alerts for the same condition are suppressed for the day.
      </p>
    </Panel>
  );
}

function ReminderSection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'whatsapp');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ whatsapp: draft });
    setSaving(false);
    if (result.success) toast.success('Reminder settings saved.');
    else toast.error(result.error);
  };

  const templates = [
    {
      key: 'upcomingTemplate',
      label: 'Upcoming payment',
      placeholder: 'Sent a few days before an installment falls due',
    },
    {
      key: 'dueTodayTemplate',
      label: 'Due today',
      placeholder: 'Sent on the morning the installment is due',
    },
    {
      key: 'overdueTemplate',
      label: 'Overdue',
      placeholder: 'Sent when an installment has passed its due date',
    },
    {
      key: 'thankYouTemplate',
      label: 'Payment received',
      placeholder: 'Offered after you record a payment',
    },
  ];

  const tokens = [
    'customerName', 'invoiceNumber', 'installmentNumber', 'amount',
    'balance', 'dueDate', 'daysOverdue', 'receiptNumber',
    'businessName', 'businessPhone',
  ];

  return (
    <Panel
      title="Customer reminders"
      description="The wording sent to customers about their payments"
      icon={MessageCircle}
      onSave={handleSave}
      saving={saving}
    >
      <Switch
        label="Reminders enabled"
        description="Show the reminder actions on the Installments and Customers screens"
        checked={draft.enabled ?? true}
        onChange={(value) => set({ enabled: value })}
      />

      <div className={cn('space-y-4 transition-opacity', !draft.enabled && 'opacity-50 pointer-events-none')}>
        <FormRow cols={2}>
          <PhoneInput
            label="Business WhatsApp number"
            value={draft.businessNumber || ''}
            onChange={(e) => set({ businessNumber: e.target.value })}
            hint="Shown to customers as the number to reply to"
          />
          <Input
            label="Cooldown"
            type="number"
            min={1}
            max={168}
            value={draft.reminderCooldownHours ?? 20}
            onChange={(e) => set({ reminderCooldownHours: parseNumber(e.target.value) })}
            suffix="hours"
            hint="The same installment will not be chased again within this window"
          />
        </FormRow>

        <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
          <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            Leave a message blank to use the built-in wording. Messages open in WhatsApp with the
            text already filled in — your staff press send, so nothing reaches a customer without
            someone looking at it first.
          </p>
        </div>

        {templates.map((template) => (
          <Textarea
            key={template.key}
            label={template.label}
            value={draft[template.key] || ''}
            onChange={(e) => set({ [template.key]: e.target.value })}
            rows={3}
            placeholder={template.placeholder}
            maxLength={600}
          />
        ))}

        <div className="rounded-lg bg-navy-50 border border-navy-200 p-3.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-2">
            Placeholders — click to copy
          </p>
          <div className="flex flex-wrap gap-1">
            {tokens.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`{${token}}`);
                  toast.success(`{${token}} copied`);
                }}
                className="px-1.5 py-0.5 rounded bg-white border border-navy-200 text-2xs font-mono text-navy-700 hover:border-gold-400 hover:text-gold-700 transition-colors"
              >
                {'{'}{token}{'}'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================================
 * Security
 * ========================================================================== */

function SecuritySection({ settings, onSave }) {
  const toast = useToastStore();
  const { draft, set, saving, setSaving } = useDraft(settings, 'security');

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave({ security: draft });
    setSaving(false);
    if (result.success) toast.success('Security settings saved.');
    else toast.error(result.error);
  };

  return (
    <Panel
      title="Security"
      description="Password rules and protection against unauthorised access"
      icon={Shield}
      onSave={handleSave}
      saving={saving}
    >
      <FormSection title="Passwords" icon={KeyRound}>
        <FormRow cols={2}>
          <Input
            label="Minimum length"
            type="number"
            min={6}
            max={64}
            value={draft.minPasswordLength ?? 8}
            onChange={(e) => set({ minPasswordLength: parseNumber(e.target.value) })}
            suffix="characters"
          />
          <Input
            label="Session timeout"
            type="number"
            min={5}
            max={1440}
            value={draft.sessionTimeoutMinutes ?? 30}
            onChange={(e) => set({ sessionTimeoutMinutes: parseNumber(e.target.value) })}
            suffix="minutes"
          />
        </FormRow>

        <Switch
          label="Require letters and numbers"
          description="Reject a password made of letters alone"
          checked={draft.requireStrongPassword ?? true}
          onChange={(value) => set({ requireStrongPassword: value })}
        />
      </FormSection>

      <FormSection
        title="Sign-in protection"
        icon={ShieldAlert}
        description="Makes guessing a password impractical"
      >
        <FormRow cols={2}>
          <Input
            label="Attempts before lockout"
            type="number"
            min={3}
            max={20}
            value={draft.maxLoginAttempts ?? 8}
            onChange={(e) => set({ maxLoginAttempts: parseNumber(e.target.value) })}
          />
          <Input
            label="Lockout duration"
            type="number"
            min={1}
            max={1440}
            value={draft.lockoutMinutes ?? 15}
            onChange={(e) => set({ lockoutMinutes: parseNumber(e.target.value) })}
            suffix="minutes"
          />
        </FormRow>

        <p className="text-2xs text-navy-500 leading-relaxed">
          An administrator can clear a lockout immediately by resetting that user&apos;s password
          from Users &amp; Roles.
        </p>
      </FormSection>

      <FormSection title="Audit" icon={FileText}>
        <Switch
          label="Record every change"
          description="Log who created, edited or deleted each record, and when"
          checked={draft.auditAllChanges ?? true}
          onChange={(value) => set({ auditAllChanges: value })}
        />
      </FormSection>
    </Panel>
  );
}

/* ============================================================================
 * Data management
 * ========================================================================== */

/**
 * Backup, restore, repair and reset.
 *
 * Every destructive action here requires a typed confirmation phrase, and
 * erasing everything additionally requires the administrator's password. These
 * operations can end a business's records, so a single click must never be
 * enough.
 */
function DataSection() {
  const toast = useToastStore();

  const [stats, setStats] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [clearTransactionsOpen, setClearTransactionsOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dataRes, uploadRes] = await Promise.all([
        dataService.getStats(),
        uploadService.getStats().catch(() => null),
      ]);
      setStats(dataRes.data);
      setUploadStats(uploadRes?.data || null);
    } catch (error) {
      toast.apiError(error, 'Could not read the database statistics.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBackup = async (includeLogs) => {
    setBusy('backup');
    try {
      const { filename } = await dataService.downloadBackup(includeLogs);
      toast.success(`Backup downloaded as ${filename}`);
    } catch (error) {
      toast.apiError(error, 'Could not create the backup.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setBusy('restore');

    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);

      const response = await dataService.restore(
        backup,
        restoreMode,
        restoreMode === 'replace' ? 'REPLACE ALL DATA' : undefined
      );

      toast.success(response.message, 8000);
      setRestoreFile(null);
      load();
    } catch (error) {
      toast.apiError(error, 'That file could not be restored. Check it is an ADEENA TRADERS backup.');
    } finally {
      setBusy(null);
    }
  };

  const handleRepair = async () => {
    setBusy('repair');
    try {
      const response = await dataService.repair();
      toast.success(response.message, 6000);
      load();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleClearTransactions = async () => {
    setBusy('clear');
    try {
      const response = await dataService.clearTransactions();
      toast.success(response.message, 6000);
      setClearTransactionsOpen(false);
      load();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleClearAll = async () => {
    if (!adminPassword) {
      toast.warning('Enter your password to confirm.');
      return;
    }

    setBusy('clear-all');
    try {
      const response = await dataService.clearAll(adminPassword);
      toast.success(response.message, 8000);
      setClearAllOpen(false);
      setAdminPassword('');
      load();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ---- What is stored ---- */}
      <Panel
        title="What is stored"
        description="A live count of every record in your database"
        icon={HardDrive}
      >
        {loading ? (
          <ListSkeleton items={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Total records', value: stats?.totalRecords?.toLocaleString('en-PK') },
                { label: 'Database', value: stats?.database?.name },
                {
                  label: 'Data size',
                  value: stats?.database?.dataSizeMB ? `${stats.database.dataSizeMB} MB` : '—',
                },
                {
                  label: 'Uploaded files',
                  value: uploadStats ? `${uploadStats.totalFiles} (${uploadStats.totalMB} MB)` : '—',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-navy-50 border border-navy-100 p-3">
                  <p className="text-2xs text-navy-500">{item.label}</p>
                  <p className="text-sm font-semibold text-navy-950 mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-navy-200 overflow-hidden">
              <ul className="divide-y divide-navy-100 max-h-64 overflow-y-auto scrollbar-thin">
                {stats?.collections
                  ?.filter((c) => c.count > 0)
                  .map((collection) => (
                    <li
                      key={collection.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-navy-700">{collection.label}</span>
                      <span className="font-medium text-navy-950 tabular">
                        {collection.count.toLocaleString('en-PK')}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </>
        )}
      </Panel>

      {/* ---- Backup ---- */}
      <Panel
        title="Backup"
        description="Download everything as a single JSON file you can keep safely"
        icon={Download}
      >
        <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
          <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            Passwords are deliberately excluded from backups — the file travels on laptops and
            phones, and must not carry credentials with it. Users restored from a backup need their
            passwords reset by an administrator.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="gold"
            icon={Download}
            onClick={() => handleBackup(false)}
            isLoading={busy === 'backup'}
            loadingText="Preparing…"
          >
            Download backup
          </Button>
          <Button variant="secondary" icon={Download} onClick={() => handleBackup(true)}>
            Include audit logs
          </Button>
        </div>
      </Panel>

      {/* ---- Restore ---- */}
      <Panel
        title="Restore"
        description="Bring records back from a backup file"
        icon={Upload}
      >
        <label className="btn-secondary btn w-full justify-center cursor-pointer">
          <Upload size={15} />
          {restoreFile ? restoreFile.name : 'Choose a backup file'}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
          />
        </label>

        {restoreFile && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-2xs text-navy-500">
              {restoreFile.name} · {formatFileSize(restoreFile.size)}
            </p>

            <RadioCards
              label="How should it be restored?"
              options={[
                {
                  value: 'merge',
                  label: 'Merge',
                  hint: 'Add records that are missing, keep everything you already have',
                },
                {
                  value: 'replace',
                  label: 'Replace',
                  hint: 'Erase current records first, then restore from the file',
                },
              ]}
              value={restoreMode}
              onChange={setRestoreMode}
              columns={2}
            />

            {restoreMode === 'replace' && (
              <div className="flex items-start gap-2.5 rounded-lg bg-danger-50 border border-danger-200 p-3">
                <AlertTriangle size={15} className="text-danger-600 flex-shrink-0 mt-0.5" />
                <p className="text-2xs text-danger-700 leading-relaxed">
                  Replace erases your current records before restoring. Take a backup first.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRestoreFile(null)}>Cancel</Button>
              <Button
                variant={restoreMode === 'replace' ? 'danger' : 'gold'}
                icon={Upload}
                onClick={handleRestore}
                isLoading={busy === 'restore'}
                loadingText="Restoring…"
              >
                Restore ({restoreMode})
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* ---- Repair ---- */}
      <Panel
        title="Repair"
        description="Recalculate cached balances from the underlying transactions"
        icon={Wrench}
      >
        <p className="text-sm text-navy-600 leading-relaxed">
          Customer balances and installment statuses are caches over the real transactions. If a
          figure ever looks wrong after a reversal or a manual edit, this rebuilds them from source.
          It changes no transactions and is safe to run at any time.
        </p>

        <Button
          variant="secondary"
          icon={Wrench}
          onClick={handleRepair}
          isLoading={busy === 'repair'}
          loadingText="Repairing…"
        >
          Run the repair
        </Button>
      </Panel>

      {/* ---- Danger zone ---- */}
      <section className="card border-danger-200 overflow-hidden">
        <header className="flex items-start gap-3 p-4 sm:p-5 bg-danger-50 border-b border-danger-200">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-danger-600 text-white flex-shrink-0">
            <AlertTriangle size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-danger-900">Danger zone</h2>
            <p className="text-xs text-danger-700 mt-0.5">
              These actions cannot be undone. Take a backup first.
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-200 p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-900">Clear transactions</p>
              <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">
                Delete all sales, payments, purchases, expenses and agreements. Your products,
                customers, suppliers, users and settings are kept.
              </p>
            </div>
            <Button variant="danger-soft" onClick={() => setClearTransactionsOpen(true)}>
              Clear transactions
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50/50 p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-danger-900">Erase everything</p>
              <p className="text-xs text-danger-700 mt-0.5 leading-relaxed">
                Delete every record in the database. Only your own administrator account survives.
              </p>
            </div>
            <Button variant="danger" onClick={() => setClearAllOpen(true)}>
              Erase everything
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={clearTransactionsOpen}
        onClose={() => setClearTransactionsOpen(false)}
        onConfirm={handleClearTransactions}
        isLoading={busy === 'clear'}
        title="Clear all transactions?"
        message="Every sale, payment, purchase, return, expense and agreement will be deleted, and all balances reset to zero."
        detail="Products, customers, suppliers, partners, investors, users and settings are kept."
        confirmText="Clear transactions"
        requireTyping="CLEAR TRANSACTIONS"
        variant="critical"
      />

      <Modal
        isOpen={clearAllOpen}
        onClose={() => { setClearAllOpen(false); setAdminPassword(''); }}
        title="Erase everything"
        subtitle="This cannot be undone"
        icon={AlertTriangle}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={() => { setClearAllOpen(false); setAdminPassword(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleClearAll}
              isLoading={busy === 'clear-all'}
              disabled={!adminPassword}
            >
              Erase everything
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg bg-danger-50 border border-danger-200 p-3">
            <AlertTriangle size={16} className="text-danger-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger-800 leading-relaxed">
              Every customer, product, sale, payment and agreement will be permanently deleted. Only
              your own administrator account will remain.
            </p>
          </div>

          <p className="text-sm text-navy-600">
            Enter your password to confirm. A hijacked session should not be able to do this.
          </p>

          <Input
            label="Your password"
            type="password"
            required
            autoComplete="current-password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
