import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Printer, Plus, Trash2, Phone } from 'lucide-react';
import { Orders, Payments } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Select,
  Dialog, Field, Input, Textarea, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, InfoRow, StatusBadge, DataTable, ORDER_STATUSES, PAYMENT_METHODS,
} from '@/components/shared';
import { bnDate, isoDate, lineAmount, money, num, qty } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency } = useSettings();

  const [payOpen, setPayOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => Orders.detail(id),
  });

  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  async function changeStatus(status) {
    try {
      await Orders.setStatus(id, status);
      toast({ title: 'অবস্থা পরিবর্তন হয়েছে' });
      refreshAll();
    } catch (err) {
      toast({ title: 'পরিবর্তন করা যায়নি', description: err.message, variant: 'destructive' });
    }
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { order, payments, customer, items } = data;

  return (
    <div>
      <PageHeader
        title={order.order_number}
        subtitle={`${order.order_type} · ${bnDate(order.order_date)}`}
        back="/orders"
        actions={
          <>
            <Select
              value={order.status}
              onChange={(e) => changeStatus(e.target.value)}
              className="h-9 w-40 text-sm"
            >
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${id}/invoice`)}>
              <Printer className="h-4 w-4" /> ইনভয়েস
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> সম্পাদনা
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>আইটেম</CardTitle></CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: 'item_name', label: 'নাম', render: (it) => it.item_name || '—' },
                  { key: 'quantity', label: 'পিস', align: 'right', render: (it) => qty(it.quantity) },
                  { key: 'sqft', label: 'বর্গফুট', align: 'right', render: (it) =>
                    (num(it.sqft ?? it.area) > 0 ? qty(it.sqft ?? it.area) : '—') },
                  { key: 'selling_price', label: 'দর', align: 'right', render: (it) => money(it.selling_price, currency) },
                  { key: 'total', label: 'টাকা', align: 'right', render: (it) => (
                    <span className="num font-medium">{money(lineAmount(it), currency)}</span>
                  ) },
                ]}
                rows={items}
                empty={<p className="py-4 text-sm text-muted-foreground">কোনো আইটেম নেই</p>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>পেমেন্ট ({payments.length})</CardTitle>
              <Button size="sm" onClick={() => setPayOpen(true)}>
                <Plus className="h-4 w-4" /> পেমেন্ট
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
                  { key: 'method', label: 'মাধ্যম' },
                  { key: 'received_by', label: 'গ্রহণকারী', render: (p) => p.received_by || '—' },
                  { key: 'notes', label: 'নোট', render: (p) => p.notes || '—' },
                  { key: 'amount', label: 'পরিমাণ', align: 'right', render: (p) => (
                    <span className="num font-medium">{money(p.amount, currency)}</span>
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
                rows={payments}
                empty={<p className="py-4 text-sm text-muted-foreground">এখনো কোনো পেমেন্ট নেই</p>}
              />
            </CardContent>
          </Card>

          {(order.description || order.notes) && (
            <Card>
              <CardHeader><CardTitle>বিবরণ ও নোট</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {order.description && <p>{order.description}</p>}
                {order.notes && <p className="text-muted-foreground">{order.notes}</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>কাস্টমার</CardTitle></CardHeader>
            <CardContent>
              {customer ? (
                <div className="space-y-2">
                  <Link to={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                    {customer.name}
                  </Link>
                  {customer.mobile && (
                    <a href={`tel:${customer.mobile}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {customer.mobile}
                    </a>
                  )}
                  {customer.customer_id && (
                    <p className="text-xs text-muted-foreground">{customer.customer_id}</p>
                  )}
                  {(customer.village || customer.address) && (
                    <p className="text-sm text-muted-foreground">
                      {customer.village || customer.address}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">কাস্টমার তথ্য নেই</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>হিসাব</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="অবস্থা" value={<StatusBadge status={order.status} />} />
              <InfoRow label="শাখা" value={order.branch_name || '—'} />
              <InfoRow label="দায়িত্বপ্রাপ্ত" value={order.assigned_staff_name || '—'} />
              <InfoRow label="ডেলিভারি" value={order.expected_delivery ? bnDate(order.expected_delivery) : '—'} />
              <InfoRow label="মোট বিক্রয়" value={<span className="font-bold">{money(order.total_selling, currency)}</span>} />
              <InfoRow label="ছাড়" value={money(order.discount, currency)} />
              <InfoRow label="আদায়" value={money(order.total_paid, currency)} />
              <InfoRow
                label="বাকি"
                value={<span className="text-base font-bold text-destructive">{money(order.due, currency)}</span>}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        order={order}
        onSaved={() => { setPayOpen(false); refreshAll(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="পেমেন্ট মুছবেন?"
        message={`${money(deleteTarget?.amount, currency)} পেমেন্টটি মুছে ফেলা হবে এবং বাকি পুনরায় হিসাব হবে।`}
        onConfirm={async () => {
          await Payments.delete(deleteTarget.id);
          toast({ title: 'পেমেন্ট মুছে ফেলা হয়েছে' });
          refreshAll();
        }}
      />
    </div>
  );
}

function PaymentDialog({ open, onClose, order, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useState({
    date: isoDate(), amount: '', method: 'Cash', reference: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Payments.create({ ...form, order_id: order.id, customer_id: order.customer_id });
      toast({ title: 'পেমেন্ট যোগ হয়েছে' });
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
      title="নতুন পেমেন্ট"
      description={`বর্তমান বাকি ${money(order.due, currency)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="তারিখ">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="পরিমাণ" required>
          <Input
            type="number" step="0.01" min="0" autoFocus value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="মাধ্যম">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="রেফারেন্স">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
