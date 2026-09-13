import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Crown } from 'lucide-react';
import { OwnerTxn } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select, Textarea,
  ConfirmDialog, Badge, Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, DataTable, StatCard, PrintButton, PAYMENT_METHODS,
} from '@/components/shared';
import { bnDate, isoDate, money, num, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const FLOW = {
  withdraw: { label: 'মালিক নিলেন', badge: 'destructive' },
  invest: { label: 'মালিক দিলেন / বিনিয়োগ', badge: 'success' },
};

/**
 * মালিকের হিসাব — cash the owner takes out of the shop and cash he puts back in.
 * Both move the drawer, so both land on the দৈনিক হিসাব.
 */
export default function OwnerAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency, setting } = useSettings();
  const [flow, setFlow] = useState('all');
  const [range, setRange] = useState({ from: '', to: '' });
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['owner-txns'], queryFn: () => OwnerTxn.list('-date', 2000),
  });

  const inRange = useMemo(() => rows.filter((r) => (!range.from || r.date >= range.from)
    && (!range.to || r.date <= range.to)), [rows, range]);
  const filtered = inRange.filter((r) => flow === 'all' || r.flow === flow);
  const taken = sum(inRange.filter((r) => r.flow === 'withdraw'), 'amount');
  const invested = sum(inRange.filter((r) => r.flow === 'invest'), 'amount');

  const blank = (f = 'withdraw') => ({
    date: isoDate(), flow: f, amount: '', method: 'Cash', owner_name: setting.proprietor || '', notes: '',
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="মালিকের হিসাব"
        subtitle="মালিক দোকান থেকে কত নিলেন, কত দিলেন"
        actions={
          <>
            <PrintButton />
            <Button size="sm" variant="outline" className="no-print" onClick={() => setEditing(blank('invest'))}>
              <Plus className="h-4 w-4" /> মালিক দিলেন
            </Button>
            <Button size="sm" className="no-print" onClick={() => setEditing(blank('withdraw'))}>
              <Plus className="h-4 w-4" /> মালিক নিলেন
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট নিয়েছেন" value={taken} currency={currency} tone="danger" icon={Crown} />
        <StatCard label="মোট দিয়েছেন / বিনিয়োগ" value={invested} currency={currency} tone="success" />
        <StatCard
          label={taken >= invested ? 'নিট নিয়েছেন' : 'নিট বিনিয়োগ'}
          value={Math.abs(taken - invested)} currency={currency} tone="accent"
        />
      </div>

      <div className="no-print mb-3 grid gap-2 sm:grid-cols-3">
        <Tabs
          tabs={[
            { value: 'all', label: 'সব' },
            { value: 'withdraw', label: 'নিলেন' },
            { value: 'invest', label: 'দিলেন' },
          ]}
          value={flow}
          onChange={setFlow}
        />
        <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'তারিখ', render: (r) => bnDate(r.date) },
          { key: 'flow', label: 'ধরন', render: (r) => (
            <Badge variant={FLOW[r.flow]?.badge}>{FLOW[r.flow]?.label || r.flow}</Badge>
          ) },
          { key: 'owner_name', label: 'নাম', render: (r) => r.owner_name || '—' },
          { key: 'method', label: 'মাধ্যম' },
          { key: 'notes', label: 'নোট', render: (r) => r.notes || '—' },
          { key: 'amount', label: 'টাকা', align: 'right', render: (r) => (
            <span className={`num font-semibold ${r.flow === 'withdraw' ? 'text-destructive' : 'text-emerald-700'}`}>
              {money(r.amount, currency)}
            </span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (r) => (
            <span className="no-print flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="সম্পাদনা">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} aria-label="মুছুন">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        empty={
          <EmptyState
            icon={Crown}
            title="কোনো লেনদেন নেই"
            description="মালিক দোকান থেকে টাকা নিলে বা দোকানে টাকা দিলে এখানে লিখুন।"
          />
        }
      />

      <OwnerDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['owner-txns'] });
          queryClient.invalidateQueries({ queryKey: ['daily'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="লেনদেন মুছবেন?"
        message={`${FLOW[deleteTarget?.flow]?.label} — ${money(deleteTarget?.amount, currency)}`}
        onConfirm={async () => {
          await OwnerTxn.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['owner-txns'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function OwnerDialog({ row, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(row || {});
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(row?.id);

  const [lastRow, setLastRow] = useState(row);
  if (row !== lastRow) {
    setLastRow(row);
    if (row) setForm(row);
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await OwnerTxn.update(row.id, form);
      else await OwnerTxn.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'সংরক্ষিত হয়েছে' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(row)}
      onClose={onClose}
      title={isEdit ? 'লেনদেন সম্পাদনা' : FLOW[form.flow]?.label}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ধরন">
          <Select value={form.flow} onChange={(e) => set('flow', e.target.value)}>
            <option value="withdraw">মালিক দোকান থেকে নিলেন</option>
            <option value="invest">মালিক দোকানে দিলেন / বিনিয়োগ</option>
          </Select>
        </Field>
        <Field label="তারিখ">
          <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="পরিমাণ" required>
          <Input
            type="number" step="0.01" min="0" autoFocus value={form.amount ?? ''}
            onChange={(e) => set('amount', e.target.value)}
          />
        </Field>
        <Field label="মাধ্যম">
          <Select value={form.method || 'Cash'} onChange={(e) => set('method', e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="মালিকের নাম" className="sm:col-span-2">
          <Input value={form.owner_name || ''} onChange={(e) => set('owner_name', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
