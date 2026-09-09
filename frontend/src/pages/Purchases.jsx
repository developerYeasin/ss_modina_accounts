import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart, Download, Trash2 } from 'lucide-react';
import { Purchase, Purchases as PurchasesApi, Supplier } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Select, Input, Dialog, Field,
  Textarea, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard, UNITS } from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, num, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function Purchases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: purchases = [], isLoading, error, refetch } = useQuery({
    queryKey: ['purchases'], queryFn: () => Purchase.list('-date', 1000),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'], queryFn: () => Supplier.list('name'),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (supplier && p.supplier_id !== supplier) return false;
      if (!term) return true;
      return [p.material, p.supplier_name, p.notes]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [purchases, search, supplier]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="ক্রয়"
        subtitle={`${filtered.length} টি ক্রয়`}
        actions={
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => downloadCsv('purchases', filtered, [
                { key: 'date', label: 'Date' },
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'material', label: 'Material' },
                { key: 'quantity', label: 'Qty' },
                { key: 'unit', label: 'Unit' },
                { key: 'unit_cost', label: 'Unit cost' },
                { key: 'total_cost', label: 'Total' },
                { key: 'paid', label: 'Paid' },
                { key: 'due', label: 'Due' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> নতুন ক্রয়
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট ক্রয়" value={sum(filtered, 'total_cost')} currency={currency} tone="primary" icon={ShoppingCart} />
        <StatCard label="পরিশোধ" value={sum(filtered, 'paid')} currency={currency} tone="success" />
        <StatCard label="বাকি" value={sum(filtered, 'due')} currency={currency} tone="danger" />
        <StatCard label="এন্ট্রি" value={filtered.length} currency={false} tone="info" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="ম্যাটেরিয়াল বা সরবরাহকারী…" className="flex-1" />
        <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="sm:w-56">
          <option value="">সব সরবরাহকারী</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
          { key: 'material', label: 'ম্যাটেরিয়াল', render: (p) => (
            <span className="font-medium">{p.material || '—'}</span>
          ) },
          { key: 'supplier_name', label: 'সরবরাহকারী', render: (p) => p.supplier_name || '—' },
          { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (p) => `${p.quantity} ${p.unit}` },
          { key: 'unit_cost', label: 'দর', align: 'right', render: (p) => money(p.unit_cost, currency) },
          { key: 'total_cost', label: 'মোট', align: 'right', render: (p) => (
            <span className="num font-medium">{money(p.total_cost, currency)}</span>
          ) },
          { key: 'due', label: 'বাকি', align: 'right', render: (p) => (
            <span className={p.due > 0 ? 'num text-destructive' : 'num text-muted-foreground'}>
              {money(p.due, currency)}
            </span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (p) => (
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
              aria-label="মুছুন"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) },
        ]}
        rows={filtered}
        onRowClick={(p) => p.supplier_id && navigate(`/suppliers/${p.supplier_id}`)}
        empty={
          <EmptyState
            icon={ShoppingCart}
            title="কোনো ক্রয় নেই"
            action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> নতুন ক্রয়</Button>}
          />
        }
        mobileCard={(p) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{p.material || '—'}</span>
              <span className="num font-semibold">{money(p.total_cost, currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {[bnDate(p.date), p.supplier_name, `${p.quantity} ${p.unit}`].filter(Boolean).join(' · ')}
            </p>
            {p.due > 0 && (
              <p className="num text-xs font-semibold text-destructive">বাকি {money(p.due, currency)}</p>
            )}
          </div>
        )}
      />

      <PurchaseDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        suppliers={suppliers}
        onSaved={() => {
          setFormOpen(false);
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="ক্রয় মুছবেন?"
        message={`${deleteTarget?.material} — ${money(deleteTarget?.total_cost, currency)}`}
        onConfirm={async () => {
          await Purchase.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          toast({ title: 'ক্রয় মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function PurchaseDialog({ open, onClose, suppliers, onSaved }) {
  const { toast } = useToast();
  const { currency, branches } = useSettings();
  const [form, setForm] = useState({
    supplier_id: '', date: isoDate(), material: '', quantity: 0, unit: 'ft',
    unit_cost: 0, paid: 0, notes: '', branch_id: '',
  });
  const [busy, setBusy] = useState(false);

  const total = num(form.quantity) * num(form.unit_cost);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.material.trim()) {
      toast({ title: 'ম্যাটেরিয়ালের নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await PurchasesApi.create(form);
      toast({ title: 'ক্রয় সংরক্ষিত হয়েছে' });
      setForm({
        supplier_id: '', date: isoDate(), material: '', quantity: 0, unit: 'ft',
        unit_cost: 0, paid: 0, notes: '', branch_id: '',
      });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="নতুন ক্রয়"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="সরবরাহকারী">
          <Select value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="তারিখ">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="ম্যাটেরিয়াল" required className="sm:col-span-2">
          <Input value={form.material} onChange={(e) => set('material', e.target.value)} autoFocus />
        </Field>
        <Field label="পরিমাণ">
          <Input
            type="number" step="0.01" min="0" value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
          />
        </Field>
        <Field label="একক">
          <Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            <option value="pc">pc</option>
          </Select>
        </Field>
        <Field label="একক দর">
          <Input
            type="number" step="0.01" min="0" value={form.unit_cost}
            onChange={(e) => set('unit_cost', e.target.value)}
          />
        </Field>
        <Field label="পরিশোধ">
          <Input
            type="number" step="0.01" min="0" value={form.paid}
            onChange={(e) => set('paid', e.target.value)}
          />
        </Field>
        <Field label="শাখা">
          <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="মোট">
          <Input readOnly className="num bg-muted" value={money(total, currency)} />
        </Field>
        <Field label="বাকি">
          <Input readOnly className="num bg-muted" value={money(total - num(form.paid), currency)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
