import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, Pencil, Trash2 } from 'lucide-react';
import { Users as UsersApi, Branch } from '@/api/entities';
import {
  Button, Loading, ErrorState, Dialog, Field, Input, Select, ConfirmDialog,
  Badge, Checkbox,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DataTable, StatCard, EmptyState } from '@/components/shared';
import { bnDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const blank = { full_name: '', email: '', password: '', role: 'user', phone: '', branch_id: '', active: true };

const ROLE_LABELS = { admin: 'অ্যাডমিন', manager: 'ম্যানেজার', user: 'ইউজার' };
const ROLE_VARIANTS = { admin: 'default', manager: 'info', user: 'secondary' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();

  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'], queryFn: UsersApi.list,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-all'], queryFn: () => Branch.list('name', 200),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="ইউজার"
        subtitle={`${users.length} জন ব্যবহারকারী`}
        actions={
          <Button size="sm" onClick={() => setEditing(blank)}>
            <Plus className="h-4 w-4" /> নতুন ইউজার
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="মোট" value={users.length} currency={false} tone="primary" icon={UserCog} />
        <StatCard
          label="অ্যাডমিন"
          value={users.filter((u) => u.role === 'admin').length}
          currency={false} tone="info"
        />
        <StatCard
          label="সক্রিয়"
          value={users.filter((u) => u.active).length}
          currency={false} tone="success"
        />
      </div>

      <DataTable
        columns={[
          { key: 'full_name', label: 'নাম', render: (u) => (
            <div>
              <p className="font-medium">{u.full_name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
          ) },
          { key: 'role', label: 'ভূমিকা', render: (u) => (
            <Badge variant={ROLE_VARIANTS[u.role]}>{ROLE_LABELS[u.role] || u.role}</Badge>
          ) },
          { key: 'phone', label: 'মোবাইল', render: (u) => u.phone || '—' },
          { key: 'created_date', label: 'যোগদান', render: (u) => bnDate(u.created_date) },
          { key: 'active', label: 'অবস্থা', render: (u) => (
            <Badge variant={u.active ? 'success' : 'secondary'}>
              {u.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </Badge>
          ) },
          { key: 'actions', label: '', align: 'right', render: (u) => (
            <span className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(u)} aria-label="সম্পাদনা">
                <Pencil className="h-4 w-4" />
              </Button>
              {u.id !== me.id && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} aria-label="মুছুন">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </span>
          ) },
        ]}
        rows={users}
        empty={<EmptyState icon={UserCog} title="কোনো ইউজার নেই" />}
      />

      <UserDialog
        user={editing}
        branches={branches}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="ইউজার মুছবেন?"
        message={`${deleteTarget?.full_name} (${deleteTarget?.email})`}
        onConfirm={async () => {
          await UsersApi.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['users'] });
          toast({ title: 'ইউজার মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function UserDialog({ user, branches, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(user?.id);

  const key = user?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...blank, ...(user || {}), password: '' });
  }

  async function save() {
    if (!form.full_name.trim() || (!isEdit && !form.email.trim())) {
      toast({ title: 'নাম ও ইমেইল দিন', variant: 'destructive' });
      return;
    }
    if (!isEdit && form.password.length < 6) {
      toast({ title: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.email;
        await UsersApi.update(user.id, payload);
      } else {
        await UsersApi.create(form);
      }
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'ইউজার তৈরি হয়েছে' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title={isEdit ? 'ইউজার সম্পাদনা' : 'নতুন ইউজার'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="নাম" required className="sm:col-span-2">
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
        </Field>
        <Field label="ইমেইল" required>
          <Input
            type="email" value={form.email}
            onChange={(e) => set('email', e.target.value)}
            disabled={isEdit}
            className={isEdit ? 'bg-muted' : undefined}
          />
        </Field>
        <Field
          label={isEdit ? 'নতুন পাসওয়ার্ড' : 'পাসওয়ার্ড'}
          required={!isEdit}
          hint={isEdit ? 'খালি রাখলে অপরিবর্তিত থাকবে' : 'কমপক্ষে ৬ অক্ষর'}
        >
          <Input
            type="password" value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>
        <Field label="ভূমিকা">
          <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="user">ইউজার</option>
            <option value="manager">ম্যানেজার</option>
            <option value="admin">অ্যাডমিন</option>
          </Select>
        </Field>
        <Field label="মোবাইল">
          <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="শাখা" className="sm:col-span-2">
          <Select value={form.branch_id || ''} onChange={(e) => set('branch_id', e.target.value)}>
            <option value="">সব শাখা</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Checkbox checked={form.active} onChange={(v) => set('active', v)} label="সক্রিয় অ্যাকাউন্ট" />
        </div>
      </div>
    </Dialog>
  );
}
