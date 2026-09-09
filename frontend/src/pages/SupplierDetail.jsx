import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Download, Plus, Trash2, Printer } from 'lucide-react';
import { Suppliers } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState,
  Dialog, Field, Input, Select, Textarea, ConfirmDialog, Tabs, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, InfoRow, DataTable, StatCard, PAYMENT_METHODS,
} from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const ENTRY_LABELS = {
  purchase: 'ক্রয়',
  purchase_paid: 'ক্রয়ের সময় জমা',
  payment: 'জমা',
};

export default function SupplierDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { currency, setting } = useSettings();

  const [tab, setTab] = useState('ledger');
  const [payOpen, setPayOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supplier-detail', id],
    queryFn: () => Suppliers.detail(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { supplier, purchases, payments, ledger, summary } = data;

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.business || undefined}
        back="/suppliers"
        actions={
          <>
            <Button
              variant="outline" size="sm" className="no-print"
              onClick={() => downloadCsv(`ledger-${supplier.name}`, ledger, [
                { key: 'date', label: 'Date' },
                { key: 'type', label: 'Type' },
                { key: 'ref', label: 'Ref' },
                { key: 'description', label: 'Description' },
                { key: 'debit', label: 'Bill' },
                { key: 'credit', label: 'Paid' },
                { key: 'balance', label: 'Balance' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
            <Button size="sm" className="no-print" onClick={() => setPayOpen(true)}>
              <Plus className="h-4 w-4" /> টাকা পরিশোধ
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="পূর্বের পাওনা" value={summary.opening_due} currency={currency} tone="muted" />
        <StatCard label="মোট বিল" value={summary.billed} currency={currency} tone="primary" />
        <StatCard label="মোট পরিশোধ" value={summary.paid} currency={currency} tone="success" />
        <StatCard label="বর্তমান বাকি" value={summary.due} currency={currency} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>তথ্য</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow
              label="মোবাইল"
              value={supplier.mobile ? (
                <a href={`tel:${supplier.mobile}`} className="flex items-center gap-1.5 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {supplier.mobile}
                </a>
              ) : '—'}
            />
            <InfoRow label="ব্যবসা" value={supplier.business || '—'} />
            <InfoRow label="ঠিকানা" value={supplier.address || '—'} />
            <InfoRow label="ম্যাটেরিয়াল" value={supplier.materials_supplied || '—'} />
            <InfoRow label="মোট ক্রয়" value={`${summary.purchases} টি`} />
            <InfoRow label="ক্রয়ের সময় জমা" value={money(summary.paid_at_purchase, currency)} />
            <InfoRow label="পরে জমা" value={money(summary.paid_later, currency)} />
            {supplier.notes && <InfoRow label="নোট" value={supplier.notes} />}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs
            tabs={[
              { value: 'ledger', label: 'হিসাব খাতা', count: ledger.length },
              { value: 'purchases', label: 'ক্রয়', count: purchases.length },
              { value: 'payments', label: 'পরিশোধ', count: payments.length },
            ]}
            value={tab}
            onChange={setTab}
            className="mb-3 no-print"
          />

          {tab === 'ledger' && (
            <Card className="print-area">
              <CardHeader>
                <CardTitle>হিসাব খাতা</CardTitle>
                <p className="text-sm text-muted-foreground">
                  পূর্বের পাওনার সাথে প্রতিটি নতুন বিল যোগ হয়, আর প্রতিটি জমা বাদ যায়।
                </p>
              </CardHeader>
              <CardContent>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>তারিখ</th>
                        <th>বিবরণ</th>
                        <th className="text-right">বিল</th>
                        <th className="text-right">জমা</th>
                        <th className="text-right">ব্যালান্স</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} className="text-muted-foreground">পূর্বের পাওনা</td>
                        <td className="num text-right font-medium">
                          {money(summary.opening_due, currency)}
                        </td>
                      </tr>
                      {ledger.map((row, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap">{bnDate(row.date)}</td>
                          <td>
                            <p className="font-medium">{row.ref || ENTRY_LABELS[row.type]}</p>
                            <p className="text-xs text-muted-foreground">
                              {ENTRY_LABELS[row.type]}
                              {row.description ? ` · ${row.description}` : ''}
                            </p>
                          </td>
                          <td className="num text-right">
                            {row.debit ? money(row.debit, currency) : '—'}
                          </td>
                          <td className="num text-right text-emerald-700">
                            {row.credit ? money(row.credit, currency) : '—'}
                          </td>
                          <td className="num text-right font-semibold">
                            {money(row.balance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-white/60 font-semibold">
                      <tr>
                        <td colSpan={2}>বর্তমান বাকি</td>
                        <td className="num text-right">{money(summary.billed, currency)}</td>
                        <td className="num text-right">{money(summary.paid, currency)}</td>
                        <td className="num text-right text-destructive">
                          {money(summary.due, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {setting?.invoice_footer && (
                  <p className="mt-4 hidden text-center text-xs text-muted-foreground print:block">
                    {setting.invoice_footer}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'purchases' && (
            <Card>
              <CardHeader><CardTitle>ক্রয়ের তালিকা</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
                    { key: 'material', label: 'ম্যাটেরিয়াল', render: (p) => (
                      <span className="font-medium">{p.material || '—'}</span>
                    ) },
                    { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (p) => `${p.quantity} ${p.unit}` },
                    { key: 'unit_cost', label: 'দর', align: 'right', render: (p) => money(p.unit_cost, currency) },
                    { key: 'total_cost', label: 'মোট', align: 'right', render: (p) => (
                      <span className="num font-medium">{money(p.total_cost, currency)}</span>
                    ) },
                    { key: 'paid', label: 'তখন জমা', align: 'right', render: (p) => (
                      <span className="num text-emerald-700">{money(p.paid, currency)}</span>
                    ) },
                  ]}
                  rows={purchases}
                  empty={<p className="py-4 text-sm text-muted-foreground">কোনো ক্রয় নেই</p>}
                />
              </CardContent>
            </Card>
          )}

          {tab === 'payments' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>পরিশোধের তালিকা</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
                  <Plus className="h-4 w-4" /> পরিশোধ
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
                    { key: 'method', label: 'মাধ্যম', render: (p) => (
                      <Badge variant="secondary">{p.method}</Badge>
                    ) },
                    { key: 'reference', label: 'রেফারেন্স', render: (p) => p.reference || '—' },
                    { key: 'notes', label: 'নোট', render: (p) => p.notes || '—' },
                    { key: 'amount', label: 'পরিমাণ', align: 'right', render: (p) => (
                      <span className="num font-semibold text-emerald-700">
                        {money(p.amount, currency)}
                      </span>
                    ) },
                    { key: 'actions', label: '', align: 'right', render: (p) => (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => setDeleteTarget(p)}
                        aria-label="মুছুন"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) },
                  ]}
                  rows={payments}
                  empty={<p className="py-4 text-sm text-muted-foreground">এখনো কোনো পরিশোধ নেই</p>}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        supplier={supplier}
        due={summary.due}
        onSaved={() => { setPayOpen(false); refetch(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="পরিশোধ মুছবেন?"
        message={`${money(deleteTarget?.amount, currency)} — বাকি পুনরায় হিসাব হবে।`}
        onConfirm={async () => {
          await Suppliers.deletePayment(id, deleteTarget.id);
          refetch();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

/** Pay against the running balance, not against one particular purchase. */
function PaymentDialog({ open, onClose, supplier, due, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useState({
    date: isoDate(), amount: '', method: 'Cash', reference: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Suppliers.addPayment(supplier.id, form);
      toast({ title: 'পরিশোধ সংরক্ষিত হয়েছে' });
      setForm({ date: isoDate(), amount: '', method: 'Cash', reference: '', notes: '' });
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
      title="সরবরাহকারীকে পরিশোধ"
      description={`${supplier.name} — বর্তমান বাকি ${money(due, currency)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="তারিখ" required>
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
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
        <Field label="রেফারেন্স">
          <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div className="divide-y rounded-lg border border-white/60 bg-white/60 p-3 sm:col-span-2">
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">বর্তমান বাকি</span>
            <span className="num font-medium">{money(due, currency)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">এই পরিশোধের পর বাকি</span>
            <span className="num font-semibold text-destructive">
              {money(num(due) - num(form.amount), currency)}
            </span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
