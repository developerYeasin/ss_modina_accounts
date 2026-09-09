import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, Trash2, Pencil } from 'lucide-react';
import { Supplier, Suppliers as SuppliersApi } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Textarea, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const blank = {
  name: '', mobile: '', address: '', business: '', materials_supplied: '',
  opening_due: 0, notes: '',
};

export default function Suppliers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: suppliers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['suppliers'], queryFn: () => Supplier.list('name'),
  });
  const { data: dueRows = [] } = useQuery({
    queryKey: ['supplier-due'], queryFn: () => SuppliersApi.dueList(),
  });

  /** id -> { count, total, due }, where due already carries the opening balance. */
  const stats = useMemo(
    () => new Map(dueRows.map((r) => [r.id, {
      count: r.purchases, total: r.billed, due: r.due, paid: r.paid,
    }])),
    [dueRows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.mobile, s.business, s.materials_supplied]
        .some((v) => String(v || '').toLowerCase().includes(term)));
  }, [suppliers, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-due'] });
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="সরবরাহকারী"
        subtitle={`${filtered.length} জন`}
        actions={
          <Button size="sm" onClick={() => setEditing(blank)}>
            <Plus className="h-4 w-4" /> নতুন সরবরাহকারী
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="সরবরাহকারী" value={filtered.length} currency={false} tone="primary" icon={Truck} />
        <StatCard
          label="মোট ক্রয়"
          value={[...stats.values()].reduce((a, s) => a + s.total, 0)}
          currency={currency} tone="info"
        />
        <StatCard
          label="মোট বাকি"
          value={[...stats.values()].reduce((a, s) => a + s.due, 0)}
          currency={currency} tone="danger"
        />
      </div>

      <SearchInput
        value={search} onChange={setSearch}
        placeholder="নাম, মোবাইল বা ব্যবসা…" className="mb-3"
      />

      <DataTable
        columns={[
          { key: 'name', label: 'নাম', render: (s) => <span className="font-medium">{s.name}</span> },
          { key: 'mobile', label: 'মোবাইল', render: (s) => s.mobile || '—' },
          { key: 'business', label: 'ব্যবসা', render: (s) => s.business || '—' },
          { key: 'materials_supplied', label: 'ম্যাটেরিয়াল', render: (s) => s.materials_supplied || '—' },
          { key: 'count', label: 'ক্রয়', align: 'right', render: (s) => stats.get(s.id)?.count || 0 },
          { key: 'due', label: 'বাকি', align: 'right', render: (s) => {
            const due = stats.get(s.id)?.due || 0;
            return (
              <span className={due > 0 ? 'num font-semibold text-destructive' : 'num text-muted-foreground'}>
                {money(due, currency)}
              </span>
            );
          } },
          { key: 'actions', label: '', align: 'right', render: (s) => (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                aria-label="সম্পাদনা"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                aria-label="মুছুন"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        empty={
          <EmptyState
            icon={Truck}
            title="কোনো সরবরাহকারী নেই"
            action={<Button size="sm" onClick={() => setEditing(blank)}><Plus className="h-4 w-4" /> যোগ করুন</Button>}
          />
        }
      />

      <SupplierDialog
        supplier={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); invalidate(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="সরবরাহকারী মুছবেন?"
        message={deleteTarget?.name}
        onConfirm={async () => {
          await Supplier.delete(deleteTarget.id);
          invalidate();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function SupplierDialog({ supplier, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(supplier?.id);

  // Reset the form whenever a different supplier is opened.
  const key = supplier?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...blank, ...(supplier || {}) });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await Supplier.update(supplier.id, form);
      else await Supplier.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'সরবরাহকারী যোগ হয়েছে' });
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
      open={Boolean(supplier)}
      onClose={onClose}
      title={isEdit ? 'সরবরাহকারী সম্পাদনা' : 'নতুন সরবরাহকারী'}
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
        <Field label="ব্যবসার নাম">
          <Input value={form.business} onChange={(e) => set('business', e.target.value)} />
        </Field>
        <Field label="ঠিকানা" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="পূর্বের পাওনা" hint="আগের খাতায় যত টাকা বাকি ছিল">
          <Input
            type="number" step="0.01" value={form.opening_due}
            onChange={(e) => set('opening_due', e.target.value)}
          />
        </Field>
        <Field label="সরবরাহকৃত ম্যাটেরিয়াল" className="sm:col-span-2">
          <Input
            value={form.materials_supplied}
            onChange={(e) => set('materials_supplied', e.target.value)}
            placeholder="যেমন: থাই গ্লাস, অ্যালুমিনিয়াম প্রোফাইল"
          />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
