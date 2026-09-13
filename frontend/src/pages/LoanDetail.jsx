import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Phone, Pencil, Trash2 } from 'lucide-react';
import { Loans } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState,
  Dialog, Field, Input, Select, Textarea, Badge, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, InfoRow, DataTable, StatCard, PAYMENT_METHODS } from '@/components/shared';
import { bnDate, isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const TYPE_LABELS = { Borrowed: 'আমি ধার নিয়েছি', Lent: 'আমি ধার দিয়েছি' };

export default function LoanDetail() {
  const { id } = useParams();
  const { currency } = useSettings();
  const { toast } = useToast();
  const [txnOpen, setTxnOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['loan-detail', id],
    queryFn: () => Loans.detail(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { loan, ledger } = data;
  const increased = ledger.filter((t) => t.flow === 'increase').reduce((a, t) => a + num(t.amount), 0);
  const decreased = ledger.filter((t) => t.flow !== 'increase').reduce((a, t) => a + num(t.amount), 0);

  return (
    <div>
      <PageHeader
        title={loan.name}
        subtitle={TYPE_LABELS[loan.type] || loan.type}
        back="/loans"
        actions={
          <Button size="sm" onClick={() => setTxnOpen(true)}>
            <Plus className="h-4 w-4" /> নতুন লেনদেন
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট বৃদ্ধি" value={increased} currency={currency} tone="danger" />
        <StatCard label="মোট পরিশোধ" value={decreased} currency={currency} tone="success" />
        <StatCard label="বর্তমান ব্যালান্স" value={loan.balance} currency={currency} tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>তথ্য</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow
              label="মোবাইল"
              value={loan.mobile ? (
                <a href={`tel:${loan.mobile}`} className="flex items-center gap-1.5 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {loan.mobile}
                </a>
              ) : '—'}
            />
            <InfoRow
              label="ধরন"
              value={
                <Badge variant={loan.type === 'Borrowed' ? 'destructive' : 'success'}>
                  {TYPE_LABELS[loan.type] || loan.type}
                </Badge>
              }
            />
            <InfoRow label="ঠিকানা" value={loan.address || '—'} />
            {loan.notes && <InfoRow label="নোট" value={loan.notes} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>লেনদেন ({ledger.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'date', label: 'তারিখ', render: (t) => bnDate(t.date) },
                { key: 'flow', label: 'ধরন', render: (t) => (
                  <Badge variant={t.flow === 'increase' ? 'destructive' : 'success'}>
                    {t.flow === 'increase' ? 'বৃদ্ধি' : 'পরিশোধ'}
                  </Badge>
                ) },
                { key: 'method', label: 'মাধ্যম' },
                { key: 'notes', label: 'নোট', render: (t) => t.notes || '—' },
                { key: 'amount', label: 'পরিমাণ', align: 'right', render: (t) => (
                  <span className="num font-medium">{money(t.amount, currency)}</span>
                ) },
                { key: 'balance', label: 'ব্যালান্স', align: 'right', render: (t) => (
                  <span className="num font-semibold">{money(t.balance, currency)}</span>
                ) },
                { key: 'actions', label: '', align: 'right', render: (t) => (
                  <span className="no-print flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(t)} aria-label="সংশোধন">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} aria-label="মুছুন">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </span>
                ) },
              ]}
              rows={ledger}
              empty={<p className="py-4 text-sm text-muted-foreground">কোনো লেনদেন নেই</p>}
            />
          </CardContent>
        </Card>
      </div>

      <TxnDialog
        open={txnOpen || Boolean(editing)}
        txn={editing}
        onClose={() => { setTxnOpen(false); setEditing(null); }}
        loanId={id}
        onSaved={() => { setTxnOpen(false); setEditing(null); refetch(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="লেনদেন মুছবেন?"
        message={`${money(deleteTarget?.amount, currency)} — ব্যালান্স পুনরায় হিসাব হবে।`}
        onConfirm={async () => {
          await Loans.deleteTxn(id, deleteTarget.id);
          refetch();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function TxnDialog({ open, onClose, loanId, onSaved, txn }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: isoDate(), flow: 'increase', amount: '', method: 'Cash', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(txn?.id);

  const key = open ? txn?.id || 'new' : null;
  const [lastKey, setLastKey] = useState(null);
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setForm(isEdit
        ? { date: txn.date, flow: txn.flow, amount: txn.amount, method: txn.method || 'Cash', notes: txn.notes || '' }
        : { date: isoDate(), flow: 'increase', amount: '', method: 'Cash', notes: '' });
    }
  }

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await Loans.updateTxn(loanId, txn.id, form);
      else await Loans.addTxn(loanId, form);
      toast({ title: isEdit ? 'লেনদেন সংশোধন হয়েছে' : 'লেনদেন যোগ হয়েছে' });
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
      open={open}
      onClose={onClose}
      title={isEdit ? 'লেনদেন সংশোধন' : 'নতুন লেনদেন'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="তারিখ">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="ধরন">
          <Select value={form.flow} onChange={(e) => set('flow', e.target.value)}>
            <option value="increase">বৃদ্ধি (নতুন ধার)</option>
            <option value="decrease">পরিশোধ</option>
          </Select>
        </Field>
        <Field label="পরিমাণ" required>
          <Input
            type="number" step="0.01" min="0" autoFocus value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </Field>
        <Field label="মাধ্যম">
          <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
