import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { Customer, Quotations } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, ORDER_TYPES, UNITS, InfoRow } from '@/components/shared';
import { isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const emptyItem = () => ({
  item_name: '', category: 'Thai Glass', quantity: 1, unit: 'Pcs',
  width: 0, height: 0, material: '', selling_price: 0, notes: '',
});

export default function QuotationForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency } = useSettings();

  const [form, setForm] = useState({
    quote_number: '', customer_id: '', date: isoDate(), valid_until: '',
    notes: '', status: 'Draft', discount: 0, discount_type: 'Fixed', other_cost: 0,
  });
  const [items, setItems] = useState([emptyItem()]);
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'], queryFn: () => Customer.list('name', 1000),
  });

  useEffect(() => {
    Quotations.nextNumber()
      .then(({ quote_number }) => setForm((f) => ({ ...f, quote_number })))
      .catch(() => {});
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (a, it) => a + num(it.selling_price) * num(it.quantity), 0,
    );
    let discount = num(form.discount);
    if (form.discount_type === 'Percent') discount = subtotal * (discount / 100);
    return {
      subtotal,
      discount,
      total: subtotal - discount + num(form.other_cost),
    };
  }, [items, form]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) =>
    setItems((list) => list.map((it, x) => (x === i ? { ...it, [k]: v } : it)));

  async function submit() {
    if (!form.customer_id) {
      toast({ title: 'কাস্টমার নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = await Quotations.create({ ...form, items });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'কোটেশন সংরক্ষিত' });
      navigate(`/quotations/${saved.id}/invoice`);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="নতুন কোটেশন" subtitle={form.quote_number} back="/quotations" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>কোটেশনের তথ্য</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="কাস্টমার" required>
                <Select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}>
                  <option value="">নির্বাচন করুন</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.mobile ? `— ${c.mobile}` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="অবস্থা">
                <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                </Select>
              </Field>
              <Field label="তারিখ">
                <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="মেয়াদ শেষ">
                <Input
                  type="date" value={form.valid_until}
                  onChange={(e) => set('valid_until', e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>আইটেম ({items.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setItems((l) => [...l, emptyItem()])}>
                <Plus className="h-4 w-4" /> আইটেম
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">আইটেম {i + 1}</span>
                    {items.length > 1 && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => setItems((l) => l.filter((_, x) => x !== i))}
                        aria-label="মুছুন"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="নাম" className="sm:col-span-2">
                      <Input value={it.item_name} onChange={(e) => setItem(i, 'item_name', e.target.value)} />
                    </Field>
                    <Field label="ক্যাটাগরি">
                      <Select value={it.category} onChange={(e) => setItem(i, 'category', e.target.value)}>
                        {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                    <Field label="একক">
                      <Select value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="প্রস্থ (ফুট)">
                      <Input
                        type="number" step="0.01" value={it.width}
                        onChange={(e) => setItem(i, 'width', e.target.value)}
                      />
                    </Field>
                    <Field label="উচ্চতা (ফুট)">
                      <Input
                        type="number" step="0.01" value={it.height}
                        onChange={(e) => setItem(i, 'height', e.target.value)}
                      />
                    </Field>
                    <Field label="পরিমাণ">
                      <Input
                        type="number" step="0.01" value={it.quantity}
                        onChange={(e) => setItem(i, 'quantity', e.target.value)}
                      />
                    </Field>
                    <Field label="দর">
                      <Input
                        type="number" step="0.01" value={it.selling_price}
                        onChange={(e) => setItem(i, 'selling_price', e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="num mt-2 text-right text-sm font-medium">
                    {money(num(it.selling_price) * num(it.quantity), currency)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader><CardTitle>হিসাব</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ছাড়">
                <Input
                  type="number" step="0.01" value={form.discount}
                  onChange={(e) => set('discount', e.target.value)}
                />
              </Field>
              <Field label="ছাড়ের ধরন">
                <Select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
                  <option value="Fixed">টাকা</option>
                  <option value="Percent">শতাংশ</option>
                </Select>
              </Field>
              <Field label="অন্যান্য খরচ" className="col-span-2">
                <Input
                  type="number" step="0.01" value={form.other_cost}
                  onChange={(e) => set('other_cost', e.target.value)}
                />
              </Field>
            </div>

            <div className="divide-y border-t pt-2">
              <InfoRow label="সাব-টোটাল" value={money(totals.subtotal, currency)} />
              <InfoRow label="ছাড়" value={`− ${money(totals.discount, currency)}`} />
              <InfoRow label="অন্যান্য" value={money(form.other_cost, currency)} />
              <InfoRow
                label="সর্বমোট"
                value={<span className="text-base font-bold">{money(totals.total, currency)}</span>}
              />
            </div>

            <Field label="নোট">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>

            <div className="flex flex-col gap-2">
              <Button loading={busy} onClick={submit}>
                <Save className="h-4 w-4" /> সংরক্ষণ করুন
              </Button>
              <Button variant="ghost" onClick={() => navigate('/quotations')}>বাতিল</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
