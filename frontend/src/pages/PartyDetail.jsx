import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, PackageMinus, PackagePlus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Parties as PartiesApi, PartyTxn } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Dialog, Field,
  Input, Select, Textarea, ConfirmDialog, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, DataTable, StatCard, PAYMENT_METHODS, PrintDoc, PrintTable, PrintTotals,
} from '@/components/shared';
import { bnDate, isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { BalanceText, PartyDialog } from './Parties';

/** The four ways goods and money move between the two shops. */
export const PARTY_TYPES = {
  give_goods: {
    label: 'মাল দিলাম (তারা নিল)', short: 'মাল দিলাম', badge: 'info', icon: PackageMinus,
    hint: 'তারা আমাদের কাছ থেকে মাল নিল। সাথে কিছু নগদ দিলে "নগদ পেলাম" ঘরে লিখুন, বাকিটা তাদের বাকি হবে।',
    cashLabel: 'সাথে নগদ পেলাম',
  },
  take_goods: {
    label: 'মাল আনলাম (তাদের কাছ থেকে)', short: 'মাল আনলাম', badge: 'warning', icon: PackagePlus,
    hint: 'আমরা তাদের কাছ থেকে মাল আনলাম। সাথে কিছু নগদ দিলে "নগদ দিলাম" ঘরে লিখুন, বাকিটা আমাদের বাকি হবে।',
    cashLabel: 'সাথে নগদ দিলাম',
  },
  receive_cash: {
    label: 'টাকা পেলাম (তারা দিল)', short: 'টাকা পেলাম', badge: 'success', icon: ArrowDownLeft,
    hint: 'তারা আমাদের টাকা দিল — হাতে নগদে যোগ হবে।',
  },
  pay_cash: {
    label: 'টাকা দিলাম (আমরা দিলাম)', short: 'টাকা দিলাম', badge: 'destructive', icon: ArrowUpRight,
    hint: 'আমরা তাদের টাকা দিলাম — হাতে নগদ থেকে বাদ যাবে।',
  },
};

export default function PartyDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();
  const [editingTxn, setEditingTxn] = useState(null);
  const [editingParty, setEditingParty] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['party-detail', id], queryFn: () => PartiesApi.detail(id),
  });

  const refresh = () => {
    refetch();
    ['parties', 'daily', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { party, ledger, summary } = data;
  const newTxn = (type) => ({
    type, date: isoDate(), description: '', amount: '', cash_amount: '', method: 'Cash', notes: '',
  });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={party.name}
          subtitle={[party.shop_name, party.mobile].filter(Boolean).join(' · ')}
          back="/parties"
          print
          actions={
            <Button variant="outline" size="sm" onClick={() => setEditingParty(party)}>
              <Pencil className="h-4 w-4" /> সম্পাদনা
            </Button>
          }
        />

        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Object.entries(PARTY_TYPES).map(([type, t]) => (
            <Button key={type} variant="outline" className="h-auto justify-start py-3" onClick={() => setEditingTxn(newTxn(type))}>
              <t.icon className="h-5 w-5" /> {t.short}
            </Button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="মাল দিলাম" value={summary.goods_given} currency={currency} tone="info" />
          <StatCard label="মাল আনলাম" value={summary.goods_taken} currency={currency} tone="accent" />
          <StatCard label="নগদ পেলাম" value={summary.cash_received} currency={currency} tone="success" />
          <StatCard label="নগদ দিলাম" value={summary.cash_paid} currency={currency} tone="danger" />
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">বর্তমান হিসাব</p>
            <p className="mt-1 text-xl"><BalanceText value={summary.balance} currency={currency} /></p>
            <p className="text-xs text-muted-foreground">পাবো = তারা দেবে · দেবো = আমরা দেবো</p>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>হিসাব খাতা ({ledger.length})</CardTitle>
            <Button size="sm" onClick={() => setEditingTxn(newTxn('give_goods'))}>
              <Plus className="h-4 w-4" /> লেনদেন
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'date', label: 'তারিখ', render: (t) => bnDate(t.date) },
                { key: 'type', label: 'ধরন', render: (t) => (
                  <Badge variant={PARTY_TYPES[t.type]?.badge}>{PARTY_TYPES[t.type]?.short || t.type}</Badge>
                ) },
                { key: 'description', label: 'বিবরণ', render: (t) => (
                  <span>
                    {t.description || '—'}
                    {num(t.cash_amount) > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {t.type === 'give_goods' ? 'নগদ পেলাম' : 'নগদ দিলাম'} {money(t.cash_amount, currency)}
                      </span>
                    )}
                  </span>
                ) },
                { key: 'amount', label: 'টাকা', align: 'right', render: (t) => (
                  <span className="num font-medium">{money(t.amount, currency)}</span>
                ) },
                { key: 'balance', label: 'ব্যালান্স', align: 'right', render: (t) => (
                  <BalanceText value={t.balance} currency={currency} />
                ) },
                { key: 'actions', label: '', align: 'right', render: (t) => (
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingTxn(t)} aria-label="সংশোধন">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} aria-label="মুছুন">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </span>
                ) },
              ]}
              rows={[...ledger].reverse()}
              empty={<p className="py-4 text-sm text-muted-foreground">এখনো কোনো লেনদেন নেই — উপরের বাটন থেকে লিখুন</p>}
            />
          </CardContent>
        </Card>
      </div>

      <div className="print-only">
        <PrintDoc
          title="পার্টি হিসাব খাতা"
          copyLabel="অফিস কপি"
          meta={[['পার্টি', party.name], ['তারিখ', bnDate(isoDate())]]}
          signatures={['পার্টির স্বাক্ষর', 'অনুমোদিত স্বাক্ষর']}
          footerNote=""
        >
          <PrintTable
            head={[
              { label: 'তারিখ', width: '96px' },
              { label: 'ধরন', width: '96px' },
              { label: 'বিবরণ' },
              { label: 'টাকা', align: 'right', width: '96px' },
              { label: 'ব্যালান্স', align: 'right', width: '120px' },
            ]}
          >
            {ledger.map((t) => (
              <tr key={t.id}>
                <td>{bnDate(t.date)}</td>
                <td>{PARTY_TYPES[t.type]?.short}</td>
                <td>{t.description || '—'}{num(t.cash_amount) > 0 ? ` (নগদ ${money(t.cash_amount, currency)})` : ''}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(t.amount, currency)}</td>
                <td className="num" style={{ textAlign: 'right' }}>
                  {t.balance >= 0 ? `পাবো ${money(t.balance, currency)}` : `দেবো ${money(-t.balance, currency)}`}
                </td>
              </tr>
            ))}
          </PrintTable>
          <PrintTotals
            rows={[
              { label: 'আগের হিসাব', value: money(summary.opening_balance, currency) },
              { label: 'মাল দিলাম', value: money(summary.goods_given, currency) },
              { label: 'মাল আনলাম', value: money(summary.goods_taken, currency) },
              { label: 'নগদ পেলাম', value: money(summary.cash_received, currency) },
              { label: 'নগদ দিলাম', value: money(summary.cash_paid, currency) },
              {
                label: summary.balance >= 0 ? 'আমরা পাবো' : 'আমরা দেবো',
                value: money(Math.abs(summary.balance), currency), strong: true,
              },
            ]}
          />
        </PrintDoc>
      </div>

      <TxnDialog txn={editingTxn} party={party} onClose={() => setEditingTxn(null)} onSaved={() => { setEditingTxn(null); refresh(); }} />
      <PartyDialog party={editingParty} onClose={() => setEditingParty(null)} onSaved={() => { setEditingParty(null); refresh(); }} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="লেনদেন মুছবেন?"
        message={`${PARTY_TYPES[deleteTarget?.type]?.short} — ${money(deleteTarget?.amount, currency)}`}
        onConfirm={async () => {
          await PartyTxn.delete(deleteTarget.id);
          refresh();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function TxnDialog({ txn, party, onClose, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useState(txn || {});
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(txn?.id);

  const [last, setLast] = useState(txn);
  if (txn !== last) {
    setLast(txn);
    if (txn) setForm({ ...txn, cash_amount: num(txn.cash_amount) || '' });
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const type = PARTY_TYPES[form.type] || PARTY_TYPES.give_goods;
  const isGoods = form.type === 'give_goods' || form.type === 'take_goods';

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'টাকার পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (isGoods && num(form.cash_amount) > num(form.amount)) {
      toast({ title: 'নগদ টাকা মালের দামের চেয়ে বেশি হতে পারে না', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        party_id: party.id, party_name: party.name, date: form.date, type: form.type,
        description: form.description || '', amount: form.amount,
        cash_amount: isGoods ? num(form.cash_amount) : 0,
        method: form.method || 'Cash', notes: form.notes || '',
      };
      if (isEdit) await PartyTxn.update(txn.id, payload);
      else await PartyTxn.create(payload);
      toast({ title: isEdit ? 'লেনদেন সংশোধন হয়েছে' : 'লেনদেন যোগ হয়েছে' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(txn)} onClose={onClose}
      title={isEdit ? 'লেনদেন সংশোধন' : type.label}
      description={party.name}
      footer={<><Button variant="outline" onClick={onClose}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ধরন" className="sm:col-span-2">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {Object.entries(PARTY_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </Select>
        </Field>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">{type.hint}</p>
        <Field label="তারিখ">
          <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={isGoods ? 'মালের মোট দাম' : 'টাকার পরিমাণ'} required>
          <Input type="number" step="0.01" min="0" autoFocus value={form.amount ?? ''} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        {isGoods && (
          <Field label={type.cashLabel} hint="না দিলে খালি রাখুন — পুরোটা বাকি হবে">
            <Input type="number" step="0.01" min="0" value={form.cash_amount ?? ''} onChange={(e) => set('cash_amount', e.target.value)} />
          </Field>
        )}
        <Field label="মাধ্যম">
          <Select value={form.method || 'Cash'} onChange={(e) => set('method', e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label={isGoods ? 'কী মাল' : 'বিবরণ'} className="sm:col-span-2">
          <Input value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder={isGoods ? 'যেমন: এস এস পাইপ ১০ ফুট' : ''} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {isGoods && num(form.amount) > 0 && (
          <div className="flex justify-between rounded-lg border bg-white p-3 text-sm sm:col-span-2">
            <span className="text-muted-foreground">
              {form.type === 'give_goods' ? 'তাদের বাকি হবে' : 'আমাদের বাকি হবে'}
            </span>
            <span className="num font-bold">{money(num(form.amount) - num(form.cash_amount), currency)}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
