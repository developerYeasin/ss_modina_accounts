import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, Download, Trash2, Pencil, ReceiptText } from 'lucide-react';
import { Payment, Payments as PaymentsApi } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Select, Input, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, SearchInput, DataTable, StatCard, PAYMENT_METHODS, PaymentDialog, PrintButton,
} from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, monthStart, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function Payments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [range, setRange] = useState({ from: monthStart(), to: isoDate() });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data: payments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => Payment.filter({ archived: false }, '-date', 1000),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (method && p.method !== method) return false;
      if (range.from && p.date < range.from) return false;
      if (range.to && p.date > range.to) return false;
      if (!term) return true;
      return [p.customer_name, p.order_number, p.reference, p.received_by]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [payments, search, method, range]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="পেমেন্ট"
        subtitle={`${filtered.length} টি এন্ট্রি`}
        actions={
          <>
            <PrintButton />
            <Button
              variant="outline" size="sm"
              onClick={() => downloadCsv('payments', filtered, [
                { key: 'date', label: 'Date' },
                { key: 'customer_name', label: 'Customer' },
                { key: 'order_number', label: 'Order' },
                { key: 'method', label: 'Method' },
                { key: 'reference', label: 'Reference' },
                { key: 'amount', label: 'Amount' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => navigate('/payments/new')}>
              <Plus className="h-4 w-4" /> নতুন পেমেন্ট
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট আদায়" value={sum(filtered, 'amount')} currency={currency} tone="success" icon={Wallet} />
        <StatCard label="এন্ট্রি" value={filtered.length} currency={false} tone="info" />
        <StatCard
          label="নগদ আদায়"
          value={sum(filtered.filter((p) => p.method === 'Cash'), 'amount')}
          currency={currency} tone="primary"
        />
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput value={search} onChange={setSearch} placeholder="কাস্টমার, অর্ডার বা রেফ…" />
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">সব মাধ্যম</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
          { key: 'customer_name', label: 'কাস্টমার', render: (p) => (
            <span className="font-medium">{p.customer_name || '—'}</span>
          ) },
          { key: 'order_number', label: 'অর্ডার', render: (p) => p.order_number || '—' },
          { key: 'method', label: 'মাধ্যম' },
          { key: 'received_by', label: 'গ্রহণকারী', render: (p) => p.received_by || '—' },
          { key: 'amount', label: 'পরিমাণ', align: 'right', render: (p) => (
            <span className="num font-semibold text-emerald-700">{money(p.amount, currency)}</span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (p) => (
            <span className="no-print flex justify-end gap-1">
              <Button
                variant="ghost" size="icon" title="জমা রসিদ প্রিন্ট" aria-label="রসিদ"
                onClick={(e) => { e.stopPropagation(); navigate(`/payments/${p.id}/receipt`); }}
              >
                <ReceiptText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" title="সংশোধন" aria-label="সংশোধন"
                onClick={(e) => { e.stopPropagation(); setEditing(p); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                aria-label="মুছুন"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        onRowClick={(p) => p.order_id && navigate(`/orders/${p.order_id}`)}
        empty={
          <EmptyState
            icon={Wallet}
            title="কোনো পেমেন্ট নেই"
            action={<Link to="/payments/new"><Button size="sm"><Plus className="h-4 w-4" /> নতুন পেমেন্ট</Button></Link>}
          />
        }
        mobileCard={(p) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{p.customer_name || '—'}</span>
              <span className="num font-semibold text-emerald-700">{money(p.amount, currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {[bnDate(p.date), p.order_number, p.method].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}
      />

      <PaymentDialog
        open={Boolean(editing)}
        payment={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          ['payments', 'orders', 'dashboard', 'daily'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="পেমেন্ট মুছবেন?"
        message="সংশ্লিষ্ট অর্ডারের বাকি পুনরায় হিসাব হবে।"
        onConfirm={async () => {
          await PaymentsApi.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          toast({ title: 'পেমেন্ট মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}
