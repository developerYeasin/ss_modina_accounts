import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Customer, Order, Payments } from '@/api/entities';
import {
  Button, Card, CardContent, Field, Input, Select, Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, PAYMENT_METHODS, InfoRow } from '@/components/shared';
import { isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function PaymentForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency, branches } = useSettings();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    order_id: params.get('order_id') || '',
    customer_id: params.get('customer_id') || '',
    date: isoDate(),
    amount: '',
    method: 'Cash',
    reference: '',
    notes: '',
    branch_id: '',
  });
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'], queryFn: () => Customer.list('name', 1000),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'], queryFn: () => Order.filter({ archived: false }, '-created_date', 1000),
  });

  /** Only unpaid orders of the chosen customer are worth showing. */
  const dueOrders = useMemo(
    () => orders.filter((o) => (!form.customer_id || o.customer_id === form.customer_id) && o.due > 0),
    [orders, form.customer_id],
  );

  const selectedOrder = orders.find((o) => o.id === form.order_id);

  // Selecting an order pins its customer, and pre-fills the outstanding amount.
  useEffect(() => {
    if (selectedOrder) {
      setForm((f) => ({
        ...f,
        customer_id: selectedOrder.customer_id,
        amount: f.amount || selectedOrder.due,
        branch_id: f.branch_id || selectedOrder.branch_id || '',
      }));
    }
  }, [selectedOrder]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (!form.order_id && !form.customer_id) {
      toast({ title: 'অর্ডার বা কাস্টমার নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Payments.create(form);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'পেমেন্ট যোগ হয়েছে' });
      navigate(form.order_id ? `/orders/${form.order_id}` : '/payments');
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="নতুন পেমেন্ট" back="/payments" />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="কাস্টমার">
            <Select
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value, order_id: '' }))}
            >
              <option value="">নির্বাচন করুন</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.mobile ? `— ${c.mobile}` : ''}</option>
              ))}
            </Select>
          </Field>

          <Field label="অর্ডার" hint="বাকি আছে এমন অর্ডার">
            <Select value={form.order_id} onChange={(e) => set('order_id', e.target.value)}>
              <option value="">সাধারণ জমা (অর্ডার ছাড়া)</option>
              {dueOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — বাকি {money(o.due, currency)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="তারিখ" required>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </Field>

          <Field label="পরিমাণ" required>
            <Input
              type="number" step="0.01" min="0" value={form.amount}
              onChange={(e) => set('amount', e.target.value)} required
            />
          </Field>

          <Field label="মাধ্যম">
            <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>

          <Field label="রেফারেন্স" hint="বিকাশ/নগদ ট্রানজেকশন আইডি">
            <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} />
          </Field>

          <Field label="শাখা">
            <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>

          <Field label="নোট" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          {selectedOrder && (
            <div className="divide-y rounded-lg border bg-muted/30 p-3 sm:col-span-2">
              <InfoRow label="অর্ডার" value={selectedOrder.order_number} />
              <InfoRow label="মোট বিক্রয়" value={money(selectedOrder.total_selling, currency)} />
              <InfoRow label="আগে আদায়" value={money(selectedOrder.total_paid, currency)} />
              <InfoRow
                label="এই পেমেন্টের পর বাকি"
                value={
                  <span className="font-bold">
                    {money(num(selectedOrder.due) - num(form.amount), currency)}
                  </span>
                }
              />
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>
              <Save className="h-4 w-4" /> সংরক্ষণ করুন
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/payments')}>বাতিল</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
