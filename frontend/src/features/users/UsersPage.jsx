/**
 * ============================================
 * Users & Roles
 * ============================================
 * The administrator creates every other account here and decides what each one
 * can reach.
 *
 * Permissions are derived from the role, never stored per user. That keeps the
 * model simple to reason about — "what can an accountant do?" has one answer —
 * and means a role change takes effect on the person's very next request.
 *
 * Password resets live here too: there is deliberately no self-service reset on
 * the sign-in screen, so this is the only route back in for a member of staff
 * who has forgotten theirs.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCog, Plus, Pencil, Trash2, KeyRound, ShieldCheck, Shield,
  Mail, Phone, Check, Clock, UserX, Copy, Eye,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Select, PasswordInput, PhoneInput, Checkbox,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { AvatarUpload } from '../../components/common/FileUpload.jsx';

import { userService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import {
  cn, formatDate, formatDateTime, timeAgo, getInitials,
  resolveFileUrl, copyToClipboard, titleCase,
} from '../../utils/index.js';
import { ROLE_META } from '../../constants/index.js';

const emptyUser = () => ({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'salesman',
  phone: '',
  designation: '',
  photo: null,
  isActive: true,
  mustChangePassword: true,
});

export default function UsersPage() {
  const toast = useToastStore();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUser());
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const table = useTableState({ initialSort: 'createdAt', initialFilters: { role: '' } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        userService.list(table.params),
        userService.getRoles(),
      ]);
      setUsers(usersRes.data.users || []);
      setPagination(usersRes.data.pagination || { page: 1, totalPages: 1, total: 0 });
      setRoles(rolesRes.data.roles || []);
    } catch (error) {
      toast.apiError(error, 'Could not load users.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyUser());
    setFormOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    const blank = emptyUser();
    setForm({
      ...Object.keys(blank).reduce((acc, key) => {
        acc[key] = user[key] ?? blank[key];
        return acc;
      }, {}),
      password: '', // Never round-trips; use the reset flow instead
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      toast.warning('Name, username and email are all required.');
      return;
    }
    if (!editing && form.password.length < 6) {
      toast.warning('Choose a password of at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { password, ...updates } = form;
        await userService.update(editing._id, updates);
        toast.success('User updated.');
      } else {
        await userService.create(form);
        toast.success(`${form.name} can now sign in as ${ROLE_META[form.role]?.label}.`);
      }
      setFormOpen(false);
      load();
    } catch (error) {
      toast.apiError(error, 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await userService.delete(deleteTarget._id);
      toast.success(response?.message || 'User deactivated.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  const stats = useMemo(
    () => ({
      active: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.role === 'admin').length,
      neverSignedIn: users.filter((u) => !u.lastLogin).length,
    }),
    [users]
  );

  const columns = [
    {
      accessor: 'name',
      header: 'User',
      sortable: true,
      primary: true,
      render: (user) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold flex-shrink-0 overflow-hidden">
            {user.photo ? (
              <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(user.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-navy-950 truncate">
              {user.name}
              {user._id === currentUser?.id && (
                <span className="ml-1.5 text-2xs font-normal text-navy-400">(you)</span>
              )}
            </p>
            <p className="text-2xs text-navy-500 truncate">@{user.username}</p>
          </div>
        </div>
      ),
      exportValue: (user) => user.name,
    },
    {
      accessor: 'email',
      header: 'Email',
      secondary: true,
      hideOnMobile: true,
      render: (user) => <span className="text-sm text-navy-700 truncate">{user.email}</span>,
      exportValue: (user) => user.email,
    },
    {
      accessor: 'role',
      header: 'Role',
      sortable: true,
      render: (user) => (
        <Badge variant={user.role === 'admin' ? 'gold' : 'neutral'} size="sm">
          {ROLE_META[user.role]?.label || user.role}
        </Badge>
      ),
      exportValue: (user) => ROLE_META[user.role]?.label,
    },
    {
      accessor: 'lastLogin',
      header: 'Last signed in',
      sortable: true,
      hideOnMobile: true,
      render: (user) =>
        user.lastLogin ? (
          <span className="text-sm text-navy-600" title={formatDateTime(user.lastLogin)}>
            {timeAgo(user.lastLogin)}
          </span>
        ) : (
          <span className="text-2xs text-warning-600">Never</span>
        ),
      exportValue: (user) => (user.lastLogin ? formatDate(user.lastLogin) : 'Never'),
    },
    {
      accessor: 'isActive',
      header: 'Status',
      render: (user) => (
        <div className="flex flex-col gap-0.5 items-start">
          <Badge variant={user.isActive ? 'success' : 'danger'} size="sm">
            {user.isActive ? 'Active' : 'Disabled'}
          </Badge>
          {user.mustChangePassword && (
            <span className="text-2xs text-warning-600">Must change password</span>
          )}
        </div>
      ),
      exportValue: (user) => (user.isActive ? 'Active' : 'Disabled'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (user) => {
        const isSelf = user._id === currentUser?.id;

        return (
          <div className="flex items-center justify-end gap-0.5">
            <IconButton
              icon={Eye}
              label="View this user"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); setViewing(user); }}
            />

            {/* An admin cannot reset, edit or disable their own account from
                here — that would be a quick way to lock everyone out. */}
            {!isSelf && (
              <>
                <IconButton
                  icon={KeyRound}
                  label="Reset this password"
                  size="icon-sm"
                  className="text-warning-600 hover:bg-warning-50"
                  onClick={(e) => { e.stopPropagation(); setResetTarget(user); }}
                />
                <IconButton
                  icon={Pencil}
                  label="Edit"
                  size="icon-sm"
                  onClick={(e) => { e.stopPropagation(); openEdit(user); }}
                />
                <IconButton
                  icon={Trash2}
                  label="Disable this account"
                  size="icon-sm"
                  className="text-danger-500 hover:bg-danger-50"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(user); }}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users & roles"
        subtitle="Create accounts for your staff and decide what each role can reach"
        icon={UserCog}
        actions={
          <Button variant="gold" icon={Plus} onClick={openCreate}>
            Add user
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Users" value={pagination.total} icon={UserCog} variant="navy" isCurrency={false} />
        <StatCard label="Active" value={stats.active} icon={Check} variant="green" isCurrency={false} />
        <StatCard label="Administrators" value={stats.admins} icon={ShieldCheck} variant="gold" isCurrency={false} />
        <StatCard
          label="Never signed in"
          value={stats.neverSignedIn}
          icon={Clock}
          variant={stats.neverSignedIn > 0 ? 'amber' : 'slate'}
          isCurrency={false}
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        serverSide
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        onPageChange={table.setPage}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        searchValue={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search by name, username or email…"
        onRowClick={setViewing}
        exportFilename="users"
        activeFilterCount={table.filters.role ? 1 : 0}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={2}>
            <Select
              label="Role"
              value={table.filters.role}
              onChange={(e) => table.setFilter('role', e.target.value)}
              placeholder="All roles"
              options={Object.entries(ROLE_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={UserCog}
            title="No users found"
            message="Add an account for each member of staff who needs to use the system."
            action={<Button variant="gold" icon={Plus} onClick={openCreate}>Add user</Button>}
          />
        }
      />

      <UserFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
        roles={roles}
      />

      <UserDetailModal
        user={viewing}
        roles={roles}
        onClose={() => setViewing(null)}
        onEdit={(user) => { setViewing(null); openEdit(user); }}
        isSelf={viewing?._id === currentUser?.id}
      />

      <ResetPasswordModal
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onSuccess={() => { setResetTarget(null); load(); }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Disable this account?"
        message={`${deleteTarget?.name} will lose access immediately. Their record and everything they entered is kept.`}
        detail="You can re-enable the account later from the edit form."
        confirmText="Disable account"
        icon={UserX}
      />
    </div>
  );
}

/* ============================================================================
 * Form
 * ========================================================================== */

function UserFormModal({ isOpen, onClose, editing, form, setForm, onSubmit, saving, roles }) {
  const rolePermissions = roles.find((r) => r.role === form.role)?.permissions || [];

  /** Suggest a username from the person's name, if they have not typed one. */
  const suggestUsername = (name) => {
    if (editing || form.username) return;
    const suggestion = name.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '');
    if (suggestion && suggestion.length >= 3) setForm((c) => ({ ...c, username: suggestion }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit user' : 'Add a user'}
      subtitle={editing?.name || 'They will sign in with the username or email you set here'}
      icon={UserCog}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={onSubmit} isLoading={saving} loadingText="Saving…">
            {editing ? 'Save changes' : 'Create account'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="Who they are" icon={UserCog}>
          <AvatarUpload
            label="Photo"
            value={form.photo}
            onChange={(url) => setForm({ ...form, photo: url })}
            folder="users"
          />

          <FormRow cols={2}>
            <Input
              label="Full name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={(e) => suggestUsername(e.target.value)}
            />
            <Input
              label="Username"
              required
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })
              }
              hint="Letters, numbers, dots and underscores only"
              disabled={Boolean(editing)}
            />
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              icon={<Mail size={16} />}
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
            hint="Shown on the users list — useful when two people share a first name"
          />
        </FormSection>

        {!editing && (
          <FormSection title="First password" icon={KeyRound}>
            <PasswordInput
              label="Password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint="Give this to them directly — they will be asked to change it on first sign-in"
            />

            <Checkbox
              label="Require a password change on first sign-in"
              description="Strongly recommended, so the password you chose does not stay in use"
              checked={form.mustChangePassword}
              onChange={(e) => setForm({ ...form, mustChangePassword: e.target.checked })}
            />
          </FormSection>
        )}

        <FormSection
          title="Role and access"
          icon={Shield}
          description="Permissions come from the role — change the role to change what they can reach"
        >
          <Select
            label="Role"
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={Object.entries(ROLE_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            hint={ROLE_META[form.role]?.description}
          />

          {/* Exactly what this role unlocks, so the choice is informed */}
          {rolePermissions.length > 0 && (
            <div className="rounded-lg bg-navy-50 border border-navy-200 p-3 animate-fade-in">
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-2">
                <ShieldCheck size={12} />
                {ROLE_META[form.role]?.label} can reach {rolePermissions.length} module
                {rolePermissions.length === 1 ? '' : 's'}
              </p>

              <div className="flex flex-wrap gap-1">
                {rolePermissions.map((permission) => (
                  <span
                    key={permission}
                    className="px-1.5 py-0.5 rounded bg-white border border-navy-200 text-2xs text-navy-700"
                  >
                    {titleCase(permission)}
                  </span>
                ))}
              </div>

              {form.role === 'admin' && (
                <p className="mt-2 text-2xs text-warning-700">
                  An administrator can change settings, manage users and erase data. Give this role
                  sparingly.
                </p>
              )}
            </div>
          )}

          {editing && (
            <Checkbox
              label="Account is active"
              description="Turn this off to block sign-in without deleting anything"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          )}
        </FormSection>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function UserDetailModal({ user, roles, onClose, onEdit, isSelf }) {
  if (!user) return null;
  const permissions = roles.find((r) => r.role === user.role)?.permissions || [];

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={onClose}
      title={user.name}
      subtitle={`@${user.username}`}
      icon={UserCog}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!isSelf && (
            <Button variant="gold" icon={Pencil} onClick={() => onEdit(user)}>Edit</Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-navy-950 text-gold-500 font-bold overflow-hidden">
            {user.photo ? (
              <img src={resolveFileUrl(user.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(user.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-navy-950">{user.name}</p>
            <Badge variant={user.role === 'admin' ? 'gold' : 'neutral'} size="sm">
              {ROLE_META[user.role]?.label}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Email" value={user.email} icon={Mail} />
          <FieldDisplay label="Phone" value={user.phone} icon={Phone} mono />
          <FieldDisplay label="Designation" value={user.designation} />
          <FieldDisplay label="Status" value={user.isActive ? 'Active' : 'Disabled'} />
          <FieldDisplay
            label="Last signed in"
            value={user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
          />
          <FieldDisplay label="Added" value={formatDate(user.createdAt)} />
        </div>

        <div>
          <p className="label">What this role can reach</p>
          <div className="flex flex-wrap gap-1">
            {permissions.map((permission) => (
              <span
                key={permission}
                className="px-1.5 py-0.5 rounded bg-navy-50 border border-navy-200 text-2xs text-navy-700"
              >
                {titleCase(permission)}
              </span>
            ))}
          </div>
          <p className="text-2xs text-navy-500 mt-2">{ROLE_META[user.role]?.description}</p>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
 * Reset password
 * ========================================================================== */

function ResetPasswordModal({ user, onClose, onSuccess }) {
  const toast = useToastStore();
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) { setPassword(''); setMustChange(true); setCopied(false); }
  }, [user]);

  if (!user) return null;

  /**
   * Generate a readable temporary password.
   *
   * Deliberately pronounceable rather than maximally random: it is going to be
   * read out loud or written on a slip of paper, and the user must change it on
   * first sign-in anyway.
   */
  const generate = () => {
    const words = ['Shop', 'Trade', 'Store', 'Sale', 'Cash', 'Stock'];
    const word = words[Math.floor(Math.random() * words.length)];
    const digits = Math.floor(1000 + Math.random() * 9000);
    setPassword(`${word}@${digits}`);
    setCopied(false);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(password);
    setCopied(ok);
    if (!ok) toast.error('Could not copy to the clipboard.');
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (password.length < 6) {
      toast.warning('The password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await userService.resetPassword(user._id, { newPassword: password, mustChangePassword: mustChange });
      toast.success(`Password reset. Give ${user.name.split(' ')[0]} the new password directly.`);
      onSuccess?.();
    } catch (error) {
      toast.apiError(error, 'Could not reset the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Reset password"
      subtitle={`${user.name} · @${user.username}`}
      icon={KeyRound}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="gold"
            icon={KeyRound}
            onClick={handleSubmit}
            isLoading={saving}
            disabled={password.length < 6}
          >
            Reset password
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600 leading-relaxed">
          There is no self-service password reset by design, so this is the only way back in for
          someone who has forgotten theirs. Their other sessions will be signed out.
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <PasswordInput
              label="New password"
              required
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setCopied(false); }}
            />
          </div>
          <Button variant="secondary" onClick={generate} className="mb-[1px]">
            Generate
          </Button>
        </div>

        {password && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-2xs font-medium text-gold-600 hover:text-gold-700 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied to the clipboard' : 'Copy the password'}
          </button>
        )}

        <Checkbox
          label="Require a change on next sign-in"
          description="Recommended — the password you set here should not stay in use"
          checked={mustChange}
          onChange={(e) => setMustChange(e.target.checked)}
        />

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
