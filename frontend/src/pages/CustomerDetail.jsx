import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, FileText, Plus, Phone, MapPin, Wallet, ReceiptText, Trash2 } from 'lucide-react';
import { Customers, Payments } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Badge, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, InfoRow, DataTable, StatCard, StatusBadge, PaymentDialog, PrintButton,
} from '@/components/shared';
import { bnDate, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency } = useSettings();
  // undefined = closed, null = new, row = editing
  const [paying, setPaying] = useState(undefined);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: () => Customers.detail(id),
  });

  const refreshAll = () => {
    refetch();
    ['orders', 'payments', 'dashboard', 'daily'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { customer, orders, payments, summary } = data;

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={[customer.customer_id, customer.branch_name].filter(Boolean).join(' · ')}
        back="/customers"
        actions={
          <>
            <PrintButton />
            <Button size="sm" variant="accent" onClick={() => setPaying(null)}>
              <Wallet className="h-4 w-4" /> জমা নিন
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${id}/statement`)}>
              <FileText className="h-4 w-4" /> স্টেটমেন্ট
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> সম্পাদনা
            </Button>
            <Button size="sm" onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" /> নতুন অর্ডার
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট অর্ডার" value={summary.orders} currency={false} tone="info" />
        <StatCard label="মোট বিল" value={summary.billed} currency={currency} tone="primary" />
        <StatCard label="আদায়" value={summary.paid} currency={currency} tone="success" />
        <StatCard label="বাকি" value={summary.due} currency={currency} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>তথ্য</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow
              label="মোবাইল"
              value={customer.mobile ? (
                <a href={`tel:${customer.mobile}`} className="flex items-center gap-1.5 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {customer.mobile}
                </a>
              ) : '—'}
            />
            <InfoRow label="বিকল্প মোবাইল" value={customer.alt_mobile || '—'} />
            <InfoRow
              label="ঠিকানা"
              value={customer.address || customer.village ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {customer.address || customer.village}
                </span>
              ) : '—'}
            />
            <InfoRow label="গ্রাম" value={customer.village || '—'} />
            <InfoRow label="এলাকা" value={customer.area || '—'} />
            <InfoRow label="শাখা" value={customer.branch_name || '—'} />
            <InfoRow label="ধরন" value={<Badge variant="secondary">{customer.type}</Badge>} />
            <InfoRow label="অবস্থা" value={<StatusBadge status={customer.status} />} />
            <InfoRow label="পূর্বের বাকি" value={money(customer.opening_due, currency)} />
            {customer.notes && <InfoRow label="নোট" value={customer.notes} />}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>অর্ডার ({orders.length})</CardTitle></CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: 'order_number', label: 'অর্ডার', render: (o) => (
                    <span className="font-medium">{o.order_number}</span>
                  ) },
                  { key: 'order_date', label: 'তারিখ', render: (o) => bnDate(o.order_date) },
                  { key: 'order_type', label: 'ধরন' },
                  { key: 'total_selling', label: 'মোট', align: 'right', render: (o) => (
                    <span className="num">{money(o.total_selling, currency)}</span>
                  ) },
                  { key: 'due', label: 'বাকি', align: 'right', render: (o) => (
                    <span className={o.due > 0 ? 'num text-destructive' : 'num'}>
                      {money(o.due, currency)}
                    </span>
                  ) },
                  { key: 'status', label: 'অবস্থা', render: (o) => <StatusBadge status={o.status} /> },
                ]}
                rows={orders}
                onRowClick={(o) => navigate(`/orders/${o.id}`)}
                empty={<p className="py-4 text-sm text-muted-foreground">কোনো অর্ডার নেই</p>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>জমা / পেমেন্ট ({payments.length})</CardTitle>
              <Button size="sm" className="no-print" onClick={() => setPaying(null)}>
                <Plus className="h-4 w-4" /> জমা নিন
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
                  { key: 'order_number', label: 'অর্ডার', render: (p) => p.order_number || 'সাধারণ জমা' },
                  { key: 'method', label: 'মাধ্যম' },
                  { key: 'received_by', label: 'গ্রহণকারী', render: (p) => p.received_by || '—' },
                  { key: 'amount', label: 'পরিমাণ', align: 'right', render: (p) => (
                    <span className="num font-medium">{money(p.amount, currency)}</span>
                  ) },
                  { key: 'actions', label: '', align: 'right', render: (p) => (
                    <span className="no-print flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="জমা রসিদ প্রিন্ট" aria-label="রসিদ"
                        onClick={() => navigate(`/payments/${p.id}/receipt`)}>
                        <ReceiptText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="সংশোধন" aria-label="সংশোধন"
                        onClick={() => setPaying(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </span>
                  ) },
                ]}
                rows={payments}
                empty={<p className="py-4 text-sm text-muted-foreground">কোনো পেমেন্ট নেই</p>}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* A general deposit on the account; to pay one bill, open that order. */}
      <PaymentDialog
        open={paying !== undefined}
        payment={paying}
        onClose={() => setPaying(undefined)}
        customerId={customer.id}
        due={summary.due}
        onSaved={(saved) => {
          const wasNew = !paying;
          setPaying(undefined);
          refreshAll();
          if (wasNew && saved?.id) navigate(`/payments/${saved.id}/receipt`);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="জমা মুছবেন?"
        message={`${money(deleteTarget?.amount, currency)} জমাটি মুছে ফেলা হবে।`}
        onConfirm={async () => {
          await Payments.delete(deleteTarget.id);
          toast({ title: 'জমা মুছে ফেলা হয়েছে' });
          refreshAll();
        }}
      />
    </div>
  );
}
