import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Store, Pencil, Trash2 } from 'lucide-react';
import { Party, Parties as PartiesApi } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Textarea, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DataTable, StatCard } from '@/components/shared';
import { bnDate, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/** Positive balance = they owe us, negative = we owe them. */
export function BalanceText({ value, currency, className = '' }) {
  if (!value) return <span className={`num font-bold ${className}`}>{money(0, currency)}</span>;
  return value > 0
    ? <span className={`num font-bold text-emerald-700 ${className}`}>পাবো {money(value, currency)}</span>
    : <span className={`num font-bold text-destructive ${className}`}>দেবো {money(-value, currency)}</span>;
}

/**
 * পাশের দোকান / পার্টি — যাদের সাথে মাল ও টাকা দুই দিকেই লেনদেন হয়।
 * প্রত্যেক পার্টির খাতায় ঢুকে লেনদেন লেখা যায়।
 */
export default function Parties() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: parties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['parties'], queryFn: () => PartiesApi.summary(),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const receivable = parties.filter((p) => p.balance > 0).reduce((a, p) => a + p.balance, 0);
  const payable = -parties.filter((p) => p.balance < 0).reduce((a, p) => a + p.balance, 0);

  return (
    <div>
      <PageHeader
        title="পাশের দোকান / পার্টি"
        subtitle="মাল ও টাকার অদলবদলের হিসাব"
        print
        actions={
          <Button size="sm" onClick={() => setEditing({ name: '', shop_name: '', mobile: '', address: '', opening_balance: 0, notes: '' })}>
            <Plus className="h-4 w-4" /> নতুন পার্টি
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="আমরা পাবো" value={receivable} currency={currency} tone="success" icon={Store} />
        <StatCard label="আমরা দেবো" value={payable} currency={currency} tone="danger" />
        <StatCard label="পার্টি" value={parties.length} currency={false} tone="info" />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'নাম', render: (p) => (
            <span>
              <span className="font-semibold text-primary">{p.name}</span>
              {p.shop_name && <span className="block text-xs text-muted-foreground">{p.shop_name}</span>}
            </span>
          ) },
          { key: 'mobile', label: 'মোবাইল', render: (p) => p.mobile || '—' },
          { key: 'goods_given', label: 'মাল দিলাম', align: 'right', render: (p) => money(p.goods_given, currency) },
          { key: 'goods_taken', label: 'মাল আনলাম', align: 'right', render: (p) => money(p.goods_taken, currency) },
          { key: 'last_date', label: 'শেষ লেনদেন', render: (p) => (p.last_date ? bnDate(p.last_date) : '—') },
          { key: 'balance', label: 'ব্যালান্স', align: 'right', render: (p) => <BalanceText value={p.balance} currency={currency} /> },
          { key: 'actions', label: '', align: 'right', render: (p) => (
            <span className="no-print flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(p); }} aria-label="সম্পাদনা">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} aria-label="মুছুন">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={parties}
        onRowClick={(p) => navigate(`/parties/${p.id}`)}
        empty={
          <EmptyState
            icon={Store}
            title="কোনো পার্টি নেই"
            description="পাশের দোকান বা যাদের সাথে মাল/টাকা অদলবদল হয়, তাদের যোগ করুন।"
          />
        }
      />

      <PartyDialog
        party={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          const wasNew = !editing?.id;
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['parties'] });
          if (wasNew && saved?.id) navigate(`/parties/${saved.id}`);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="পার্টি মুছবেন?"
        message={`${deleteTarget?.name} — এর সব লেনদেনও মুছে যাবে।`}
        onConfirm={async () => {
          await Party.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['parties'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

export function PartyDialog({ party, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(party || {});
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(party?.id);

  const [last, setLast] = useState(party);
  if (party !== last) {
    setLast(party);
    if (party) setForm(party);
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!String(form.name || '').trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name, shop_name: form.shop_name || '', mobile: form.mobile || '',
        address: form.address || '', opening_balance: form.opening_balance || 0, notes: form.notes || '',
      };
      const saved = isEdit ? await Party.update(party.id, payload) : await Party.create(payload);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'পার্টি যোগ হয়েছে' });
      onSaved(saved);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(party)} onClose={onClose}
      title={isEdit ? 'পার্টি সম্পাদনা' : 'নতুন পার্টি / দোকান'}
      footer={<><Button variant="outline" onClick={onClose}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="নাম" required>
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="দোকানের নাম">
          <Input value={form.shop_name || ''} onChange={(e) => set('shop_name', e.target.value)} />
        </Field>
        <Field label="মোবাইল">
          <Input value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="ঠিকানা">
          <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field
          label="আগের হিসাব" className="sm:col-span-2"
          hint="তারা আগে থেকে আমাদের কাছে টাকা বাকি থাকলে ধনাত্মক (যেমন 5000), আমরা তাদের কাছে বাকি থাকলে ঋণাত্মক (যেমন -5000)"
        >
          <Input type="number" step="0.01" value={form.opening_balance ?? 0} onChange={(e) => set('opening_balance', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
