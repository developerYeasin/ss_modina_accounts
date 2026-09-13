import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react';
import { BankAccount, BankTxn } from '@/api/entities';
import {
  Button, Card, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select, Textarea,
  ConfirmDialog, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DataTable, StatCard, PrintButton } from '@/components/shared';
import { bnDate, isoDate, money, num, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const FLOW = {
  deposit: { label: 'ব্যাংকে জমা', badge: 'success' },
  withdraw: { label: 'ব্যাংক থেকে উত্তোলন', badge: 'destructive' },
};

/**
 * ব্যাংক — every account with its balance (opening + জমা − উত্তোলন) and the dated
 * list of deposits and withdrawals. A deposit leaves the cash drawer and a
 * withdrawal comes back into it, so both show on the দৈনিক হিসাব.
 */
export default function Bank() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();
  const [accountFilter, setAccountFilter] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const accountsQ = useQuery({ queryKey: ['bank-accounts'], queryFn: () => BankAccount.list('name', 200) });
  const txnsQ = useQuery({ queryKey: ['bank-txns'], queryFn: () => BankTxn.list('-date', 5000) });
  const accounts = accountsQ.data || [];
  const txns = txnsQ.data || [];

  const balances = useMemo(() => new Map(accounts.map((a) => {
    const own = txns.filter((t) => t.account_id === a.id);
    const dep = sum(own.filter((t) => t.flow === 'deposit'), 'amount');
    const wd = sum(own.filter((t) => t.flow === 'withdraw'), 'amount');
    return [a.id, { deposit: dep, withdraw: wd, balance: num(a.opening_balance) + dep - wd }];
  })), [accounts, txns]);
  const totalBalance = [...balances.values()].reduce((a, b) => a + b.balance, 0);

  const filtered = txns.filter((t) => (!accountFilter || t.account_id === accountFilter)
    && (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['bank-txns'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
  };

  if (accountsQ.isLoading || txnsQ.isLoading) return <Loading />;
  if (accountsQ.error) return <ErrorState error={accountsQ.error} onRetry={accountsQ.refetch} />;

  const newTxn = (flow) => ({
    account_id: accountFilter || accounts[0]?.id || '', date: isoDate(), flow, amount: '', reference: '', notes: '',
  });

  return (
    <div>
      <PageHeader
        title="ব্যাংক"
        subtitle={`${accounts.length} টি অ্যাকাউন্ট`}
        actions={
          <>
            <PrintButton />
            <Button
              size="sm" variant="outline" className="no-print"
              onClick={() => setEditingAccount({ name: '', bank_name: '', account_no: '', branch: '', opening_balance: 0, notes: '', active: true })}
            >
              <Plus className="h-4 w-4" /> নতুন অ্যাকাউন্ট
            </Button>
            {accounts.length > 0 && (
              <>
                <Button size="sm" variant="outline" className="no-print" onClick={() => setEditingTxn(newTxn('withdraw'))}>
                  <Plus className="h-4 w-4" /> উত্তোলন
                </Button>
                <Button size="sm" className="no-print" onClick={() => setEditingTxn(newTxn('deposit'))}>
                  <Plus className="h-4 w-4" /> জমা
                </Button>
              </>
            )}
          </>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="কোনো ব্যাংক অ্যাকাউন্ট নেই"
          description="প্রথমে অ্যাকাউন্ট যোগ করুন, তারপর জমা ও উত্তোলন লিখুন।"
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="সব ব্যাংকে মোট" value={totalBalance} currency={currency} tone="primary" icon={Landmark} />
            {accounts.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button" className="min-w-0 text-left"
                    onClick={() => setAccountFilter(accountFilter === a.id ? '' : a.id)}
                  >
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[a.bank_name, a.account_no].filter(Boolean).join(' · ')}
                    </p>
                    <p className="num mt-1 font-heading text-xl font-bold">
                      {money(balances.get(a.id)?.balance, currency)}
                    </p>
                  </button>
                  <Button
                    variant="ghost" size="icon" className="no-print"
                    onClick={() => setEditingAccount(a)} aria-label="সম্পাদনা"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                {accountFilter === a.id && <Badge className="mt-2">ফিল্টার চালু</Badge>}
              </Card>
            ))}
          </div>

          <div className="no-print mb-3 grid gap-2 sm:grid-cols-3">
            <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value="">সব অ্যাকাউন্ট</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>

          <DataTable
            columns={[
              { key: 'date', label: 'তারিখ', render: (t) => bnDate(t.date) },
              { key: 'account_name', label: 'অ্যাকাউন্ট', render: (t) => <span className="font-medium">{t.account_name}</span> },
              { key: 'flow', label: 'ধরন', render: (t) => (
                <Badge variant={FLOW[t.flow]?.badge}>{FLOW[t.flow]?.label}</Badge>
              ) },
              { key: 'reference', label: 'রেফারেন্স', render: (t) => t.reference || '—' },
              { key: 'notes', label: 'নোট', render: (t) => t.notes || '—' },
              { key: 'amount', label: 'টাকা', align: 'right', render: (t) => (
                <span className={`num font-semibold ${t.flow === 'deposit' ? 'text-emerald-700' : 'text-destructive'}`}>
                  {money(t.amount, currency)}
                </span>
              ) },
              { key: 'actions', label: '', align: 'right', render: (t) => (
                <span className="no-print flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditingTxn(t)} aria-label="সম্পাদনা">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} aria-label="মুছুন">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              ) },
            ]}
            rows={filtered}
            empty={<EmptyState icon={Landmark} title="কোনো জমা/উত্তোলন নেই" />}
          />
        </>
      )}

      <AccountDialog account={editingAccount} onClose={() => setEditingAccount(null)}
        onSaved={() => { setEditingAccount(null); invalidate(); }} />
      <TxnDialog txn={editingTxn} accounts={accounts} balances={balances}
        onClose={() => setEditingTxn(null)} onSaved={() => { setEditingTxn(null); invalidate(); }} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="লেনদেন মুছবেন?"
        message={`${FLOW[deleteTarget?.flow]?.label} — ${money(deleteTarget?.amount, currency)}`}
        onConfirm={async () => {
          await BankTxn.delete(deleteTarget.id);
          invalidate();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

/** Seeds the form each time a different row (or a fresh one) is opened. */
function useSeededForm(row) {
  const [form, setForm] = useState(row || {});
  const [last, setLast] = useState(row);
  if (row !== last) {
    setLast(row);
    if (row) setForm(row);
  }
  return [form, setForm];
}

function AccountDialog({ account, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useSeededForm(account);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(account?.id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!String(form.name || '').trim()) {
      toast({ title: 'অ্যাকাউন্টের নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await BankAccount.update(account.id, form);
      else await BankAccount.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'অ্যাকাউন্ট যোগ হয়েছে' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(account)} onClose={onClose}
      title={isEdit ? 'অ্যাকাউন্ট সম্পাদনা' : 'নতুন ব্যাংক অ্যাকাউন্ট'}
      footer={<><Button variant="outline" onClick={onClose}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="অ্যাকাউন্টের নাম" required className="sm:col-span-2" hint="যেমন: ইসলামী ব্যাংক — চলতি">
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="ব্যাংকের নাম">
          <Input value={form.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} />
        </Field>
        <Field label="অ্যাকাউন্ট নম্বর">
          <Input value={form.account_no || ''} onChange={(e) => set('account_no', e.target.value)} />
        </Field>
        <Field label="শাখা">
          <Input value={form.branch || ''} onChange={(e) => set('branch', e.target.value)} />
        </Field>
        <Field label="শুরুর ব্যালান্স" hint="এই সফটওয়্যারে লেখার আগে যা ছিল">
          <Input type="number" step="0.01" value={form.opening_balance ?? 0} onChange={(e) => set('opening_balance', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function TxnDialog({ txn, accounts, balances, onClose, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useSeededForm(txn);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(txn?.id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.account_id) {
      toast({ title: 'অ্যাকাউন্ট নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    const account = accounts.find((a) => a.id === form.account_id);
    setBusy(true);
    try {
      const payload = { ...form, account_name: account?.name || '' };
      if (isEdit) await BankTxn.update(txn.id, payload);
      else await BankTxn.create(payload);
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
      open={Boolean(txn)} onClose={onClose}
      title={isEdit ? 'লেনদেন সম্পাদনা' : FLOW[form.flow]?.label}
      description={form.account_id ? `বর্তমান ব্যালান্স ${money(balances.get(form.account_id)?.balance, currency)}` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="অ্যাকাউন্ট" required>
          <Select value={form.account_id || ''} onChange={(e) => set('account_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="ধরন">
          <Select value={form.flow} onChange={(e) => set('flow', e.target.value)}>
            <option value="deposit">ব্যাংকে জমা (ক্যাশ থেকে)</option>
            <option value="withdraw">ব্যাংক থেকে উত্তোলন (ক্যাশে)</option>
          </Select>
        </Field>
        <Field label="তারিখ">
          <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="পরিমাণ" required>
          <Input type="number" step="0.01" min="0" autoFocus value={form.amount ?? ''} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="রেফারেন্স / চেক নং" className="sm:col-span-2">
          <Input value={form.reference || ''} onChange={(e) => set('reference', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
