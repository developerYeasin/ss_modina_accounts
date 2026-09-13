import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, HandCoins, Trash2, Pencil } from 'lucide-react';
import { Loan } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select,
  Textarea, ConfirmDialog, Tabs, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const blank = { name: '', mobile: '', type: 'Borrowed', address: '', notes: '' };

const TYPE_LABELS = { Borrowed: 'আমি ধার নিয়েছি', Lent: 'আমি ধার দিয়েছি' };

export default function Loans() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: loans = [], isLoading, error, refetch } = useQuery({
    queryKey: ['loans'], queryFn: () => Loan.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return loans.filter((l) => {
      if (type !== 'all' && l.type !== type) return false;
      if (!term) return true;
      return [l.name, l.mobile, l.address]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [loans, search, type]);

  const borrowed = loans.filter((l) => l.type === 'Borrowed').reduce((a, l) => a + num(l.balance), 0);
  const lent = loans.filter((l) => l.type === 'Lent').reduce((a, l) => a + num(l.balance), 0);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="ধার হিসাব"
        print
        subtitle={`${filtered.length} টি হিসাব`}
        actions={
          <Button size="sm" onClick={() => setEditing(blank)}>
            <Plus className="h-4 w-4" /> নতুন হিসাব
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="আমি ধার নিয়েছি" value={borrowed} currency={currency} tone="danger" icon={HandCoins} />
        <StatCard label="আমি ধার দিয়েছি" value={lent} currency={currency} tone="success" />
        <StatCard label="নিট" value={lent - borrowed} currency={currency} tone="accent" />
      </div>

      <div className="mb-3 space-y-2">
        <Tabs
          tabs={[
            { value: 'all', label: 'সব', count: loans.length },
            { value: 'Borrowed', label: 'ধার নিয়েছি', count: loans.filter((l) => l.type === 'Borrowed').length },
            { value: 'Lent', label: 'ধার দিয়েছি', count: loans.filter((l) => l.type === 'Lent').length },
          ]}
          value={type}
          onChange={setType}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="নাম বা মোবাইল…" />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'নাম', render: (l) => <span className="font-medium">{l.name}</span> },
          { key: 'mobile', label: 'মোবাইল', render: (l) => l.mobile || '—' },
          { key: 'type', label: 'ধরন', render: (l) => (
            <Badge variant={l.type === 'Borrowed' ? 'destructive' : 'success'}>
              {TYPE_LABELS[l.type] || l.type}
            </Badge>
          ) },
          { key: 'address', label: 'ঠিকানা', render: (l) => l.address || '—' },
          { key: 'balance', label: 'ব্যালান্স', align: 'right', render: (l) => (
            <span className={`num font-semibold ${l.type === 'Borrowed' ? 'text-destructive' : 'text-emerald-700'}`}>
              {money(l.balance, currency)}
            </span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (l) => (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setEditing(l); }}
                aria-label="সম্পাদনা"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(l); }}
                aria-label="মুছুন"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        onRowClick={(l) => navigate(`/loans/${l.id}`)}
        empty={
          <EmptyState
            icon={HandCoins}
            title="কোনো ধার হিসাব নেই"
            description="ধার নেওয়া বা দেওয়ার হিসাব রাখতে নতুন হিসাব যোগ করুন।"
            action={<Button size="sm" onClick={() => setEditing(blank)}><Plus className="h-4 w-4" /> নতুন হিসাব</Button>}
          />
        }
      />

      <LoanDialog
        loan={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['loans'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="হিসাব মুছবেন?"
        message={`${deleteTarget?.name} — সব লেনদেনও মুছে যাবে।`}
        onConfirm={async () => {
          await Loan.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['loans'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function LoanDialog({ loan, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(loan?.id);

  const key = loan?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...blank, ...(loan || {}) });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await Loan.update(loan.id, form);
      else await Loan.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'হিসাব যোগ হয়েছে' });
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
      open={Boolean(loan)}
      onClose={onClose}
      title={isEdit ? 'হিসাব সম্পাদনা' : 'নতুন ধার হিসাব'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="নাম" required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="মোবাইল">
          <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="ধরন">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="Borrowed">আমি ধার নিয়েছি</option>
            <option value="Lent">আমি ধার দিয়েছি</option>
          </Select>
        </Field>
        <Field label="ঠিকানা" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
