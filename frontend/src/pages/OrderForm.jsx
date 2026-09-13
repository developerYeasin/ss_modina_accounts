import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Calculator } from 'lucide-react';
import { Customer, Customers, Orders, Order } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea,
  Loading, Checkbox,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, ORDER_TYPES, InfoRow, StaffSelect } from '@/components/shared';
import { isoDate, lineAmount, money, num, parseJson } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * A line is deliberately thin: what it is, how many pieces, how many square
 * feet (blank when it is sold by the piece), and the rate. Nothing else — the
 * shop writes memos, not costings.
 */
const emptyItem = (category) => ({
  item_name: '', category, quantity: 1, unit: 'Pcs', sqft: 0, selling_price: 0, notes: '',
});

const blankForm = {
  order_number: '', customer_id: '', order_date: isoDate(), expected_delivery: '',
  order_type: 'Thai Glass', branch_id: '', description: '', notes: '',
  assigned_staff_id: '', advance: 0, discount: 0, discount_type: 'Fixed',
  transport_cost: 0, other_cost: 0, is_draft: false, status: 'New',
};

/**
 * Order money, mirroring the backend:
 *   gross = Σ line amount (বর্গফুট × দর, নয়তো পিস × দর),
 *   selling = gross − discount, বাকি = selling − advance + পূর্বের বাকি।
 */
function useTotals(form, items, previousDue = 0) {
  return useMemo(() => {
    const gross = items.reduce((a, it) => a + lineAmount(it), 0);
    let discount = num(form.discount);
    if (form.discount_type === 'Percent') discount = gross * (discount / 100);
    const totalSelling = gross - discount;
    const advance = num(form.advance);
    const due = totalSelling - advance;
    return {
      gross,
      discountAmount: discount,
      totalSelling,
      advance,
      due,
      previousDue,
      // পুরাতন কাস্টমার হলে আগের বাকি এখানেই যোগ হয়ে যায়।
      finalBalance: due + num(previousDue),
    };
  }, [form, items, previousDue]);
}

export default function OrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency, branches } = useSettings();

  const [form, setForm] = useState(blankForm);
  const [items, setItems] = useState([emptyItem('Thai Glass')]);
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'], queryFn: () => Customer.list('name', 1000),
  });
  const { data: existing, isLoading } = useQuery({
    queryKey: ['order', id], queryFn: () => Order.get(id), enabled: isEdit,
  });

  // পুরাতন কাস্টমার: their running balance, so the earlier বাকি carries into
  // this order on its own. On edit, this order's own due is taken back out.
  const { data: customerDetail } = useQuery({
    queryKey: ['customer-detail', form.customer_id],
    queryFn: () => Customers.detail(form.customer_id),
    enabled: Boolean(form.customer_id),
  });
  const previousDue = (() => {
    if (!customerDetail) return 0;
    const balance = num(customerDetail.summary?.due);
    return Math.max(balance - (isEdit ? num(existing?.due) : 0), 0);
  })();

  // Prefill on edit; on create, reserve the next order number.
  useEffect(() => {
    if (existing) {
      setForm({
        ...blankForm,
        ...existing,
        expected_delivery: existing.expected_delivery || '',
        assigned_staff_id: existing.assigned_staff_id || '',
        branch_id: existing.branch_id || '',
      });
      const parsed = parseJson(existing.items_json, []);
      setItems(parsed.length ? parsed : [emptyItem(existing.order_type)]);
    }
  }, [existing]);

  useEffect(() => {
    if (isEdit) return;
    Orders.nextNumber()
      .then(({ order_number }) => setForm((f) => ({ ...f, order_number })))
      .catch(() => {});
  }, [isEdit]);

  const totals = useTotals(form, items, previousDue);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setItem = (index, key, value) =>
    setItems((list) => list.map((it, i) => (i === index ? { ...it, [key]: value } : it)));

  async function submit(asDraft = false) {
    if (!form.customer_id) {
      toast({ title: 'কাস্টমার নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    if (!items.length) {
      toast({ title: 'অন্তত একটি আইটেম যোগ করুন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, is_draft: asDraft, items_json: JSON.stringify(items) };
      const saved = isEdit
        ? await Orders.update(id, payload)
        : await Orders.create(payload);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: isEdit ? 'অর্ডার হালনাগাদ হয়েছে' : 'অর্ডার সংরক্ষিত হয়েছে' });
      navigate(`/orders/${saved.id}`);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'অর্ডার সম্পাদনা' : 'নতুন অর্ডার'}
        subtitle={form.order_number}
        back="/orders"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/materials')}>
            <Calculator className="h-4 w-4" /> ক্যালকুলেটর
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ---- basics ---- */}
          <Card>
            <CardHeader><CardTitle>অর্ডারের তথ্য</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="কাস্টমার" required>
                <Select
                  value={form.customer_id}
                  onChange={(e) => set('customer_id', e.target.value)}
                >
                  <option value="">নির্বাচন করুন</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mobile ? `— ${c.mobile}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="অর্ডারের ধরন">
                <Select
                  value={form.order_type}
                  onChange={(e) => {
                    set('order_type', e.target.value);
                    setItems((list) => list.map((it) => ({ ...it, category: e.target.value })));
                  }}
                >
                  {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>

              <Field label="অর্ডারের তারিখ">
                <Input type="date" value={form.order_date} onChange={(e) => set('order_date', e.target.value)} />
              </Field>

              <Field label="ডেলিভারির সম্ভাব্য তারিখ">
                <Input
                  type="date"
                  value={form.expected_delivery || ''}
                  onChange={(e) => set('expected_delivery', e.target.value)}
                />
              </Field>

              <Field label="শাখা">
                <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">নির্বাচন করুন</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>

              <Field label="দায়িত্বপ্রাপ্ত কর্মী">
                <StaffSelect
                  value={form.assigned_staff_id}
                  onChange={(v) => set('assigned_staff_id', v)}
                />
              </Field>

              <Field label="কাজের বিবরণ" className="sm:col-span-2">
                <Input value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          {/* ---- items ---- */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>আইটেম ({items.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setItems((l) => [...l, emptyItem(form.order_type)])}>
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
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems((l) => l.filter((_, x) => x !== i))}
                        aria-label="মুছুন"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="আইটেমের নাম" className="sm:col-span-2">
                      <Input
                        value={it.item_name}
                        placeholder="যেমন: এস এস গেট"
                        onChange={(e) => setItem(i, 'item_name', e.target.value)}
                      />
                    </Field>

                    <Field label="পরিমাণ (পিস)">
                      <Input
                        type="number" step="0.01" min="0" value={it.quantity}
                        onChange={(e) => setItem(i, 'quantity', e.target.value)}
                      />
                    </Field>

                    <Field label="বর্গফুট" hint="মোট বর্গফুট। দিলে দর × বর্গফুট ধরা হয়; পিসে বিক্রি হলে ০ রাখুন">
                      <Input
                        type="number" step="0.01" min="0" value={it.sqft ?? 0}
                        onChange={(e) => setItem(i, 'sqft', e.target.value)}
                      />
                    </Field>

                    <Field label="দর (প্রতি একক)">
                      <Input
                        type="number" step="0.01" min="0" value={it.selling_price}
                        onChange={(e) => setItem(i, 'selling_price', e.target.value)}
                      />
                    </Field>
                  </div>

                  <p className="mt-2 text-right text-sm font-semibold">
                    টাকা: <span className="num">{money(lineAmount(it), currency)}</span>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ---- notes ---- */}
          <Card>
            <CardHeader><CardTitle>নোট</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="অতিরিক্ত কিছু লিখতে চাইলে…"
              />
            </CardContent>
          </Card>
        </div>

        {/* ---- money panel ---- */}
        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader><CardTitle>হিসাব</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="ছাড়">
                  <Input
                    type="number" step="0.01" min="0" value={form.discount}
                    onChange={(e) => set('discount', e.target.value)}
                  />
                </Field>
                <Field label="ছাড়ের ধরন">
                  <Select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
                    <option value="Fixed">টাকা</option>
                    <option value="Percent">শতাংশ</option>
                  </Select>
                </Field>
                <Field label="গাড়ি ভাড়া">
                  <Input
                    type="number" step="0.01" min="0" value={form.transport_cost}
                    onChange={(e) => set('transport_cost', e.target.value)}
                  />
                </Field>
                <Field label="অন্যান্য খরচ">
                  <Input
                    type="number" step="0.01" min="0" value={form.other_cost}
                    onChange={(e) => set('other_cost', e.target.value)}
                  />
                </Field>
                <Field label="অগ্রিম" className="col-span-2">
                  <Input
                    type="number" step="0.01" min="0" value={form.advance}
                    onChange={(e) => set('advance', e.target.value)}
                  />
                </Field>
                {!isEdit && num(form.advance) > 0 && (
                  <Field label="টাকা গ্রহণকারী" className="col-span-2">
                    <StaffSelect
                      by="name"
                      value={form.advance_received_by}
                      onChange={(v) => set('advance_received_by', v)}
                      placeholder="আমি নিজে (লগইন করা ইউজার)"
                    />
                  </Field>
                )}
              </div>

              <div className="divide-y border-t pt-2">
                <InfoRow label="মোট (ছাড়ের আগে)" value={money(totals.gross, currency)} />
                <InfoRow label="ছাড়" value={`− ${money(totals.discountAmount, currency)}`} />
                <InfoRow label="মোট বিক্রয়" value={<span className="text-base font-bold">{money(totals.totalSelling, currency)}</span>} />
                <InfoRow label="অগ্রিম / জমা" value={money(totals.advance, currency)} />
                <InfoRow label="এই অর্ডারের বাকি" value={money(totals.due, currency)} />
                {totals.previousDue > 0 && (
                  <InfoRow label="পূর্বের বাকি" value={money(totals.previousDue, currency)} />
                )}
                <InfoRow
                  label={totals.previousDue > 0 ? 'সর্বমোট বাকি' : 'বাকি'}
                  value={
                    <span className="text-base font-bold text-destructive">
                      {money(totals.finalBalance, currency)}
                    </span>
                  }
                />
              </div>

              <Checkbox
                checked={form.is_draft}
                onChange={(v) => set('is_draft', v)}
                label="ড্রাফট হিসেবে রাখুন"
              />

              <div className="flex flex-col gap-2 pt-1">
                <Button loading={busy} onClick={() => submit(false)}>
                  <Save className="h-4 w-4" /> {isEdit ? 'হালনাগাদ করুন' : 'সংরক্ষণ করুন'}
                </Button>
                {!isEdit && (
                  <Button variant="outline" loading={busy} onClick={() => submit(true)}>
                    ড্রাফট সংরক্ষণ
                  </Button>
                )}
                <Button variant="ghost" onClick={() => navigate('/orders')}>বাতিল</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
