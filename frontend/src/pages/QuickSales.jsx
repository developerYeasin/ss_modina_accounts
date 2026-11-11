import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Zap } from 'lucide-react';
import { QuickSale } from '@/api/entities';
import { Button, Card, CardContent, Input, Loading, ErrorState, ConfirmDialog, Select } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared';
import { bnDate, isoDate, money, monthStart, cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const ITEMS = ['এসএস', 'থাই', 'পাইপ', 'বক্স', 'গ্লাস', 'হার্ডওয়্যার', 'অন্যান্য'];
const KINDS = [
  { value: 'sale', label: 'নগদ বিক্রি', hint: 'টাকা ক্যাশে ঢুকল' },
  { value: 'purchase', label: 'খুচরা কেনা', hint: 'টাকা ক্যাশ থেকে গেল' },
];

/**
 * খুচরা / তাৎক্ষণিক বিক্রি — মেমো, কাস্টমার, অর্ডার কিছুই লাগে না।
 * মাল + টাকা লিখে "যোগ করুন" — দৈনিক রিপোর্টের ক্যাশে আর বিক্রয় পাতায় নিজে থেকেই যোগ হয়।
 */
export default function QuickSales() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();
  const amountRef = useRef(null);
  const [form, setForm] = useState({ date: isoDate(), kind: 'sale', item: 'এসএস', description: '', amount: '' });
  const [range, setRange] = useState({ from: monthStart(), to: isoDate() });
  const [kindFilter, setKindFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['quick-sales'],
    queryFn: () => QuickSale.list('-date', 5000),
  });

  const filtered = useMemo(() => data.filter((x) => (!range.from || x.date >= range.from)
    && (!range.to || x.date <= range.to) && (!kindFilter || x.kind === kindFilter)), [data, range, kindFilter]);
  const byDay = useMemo(() => {
    const map = new Map();
    filtered.forEach((x) => {
      const d = map.get(x.date) || { date: x.date, sale: 0, purchase: 0, rows: [] };
      d[x.kind === 'purchase' ? 'purchase' : 'sale'] += Number(x.amount) || 0;
      d.rows.push(x);
      map.set(x.date, d);
    });
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filtered]);
  const totals = byDay.reduce((a, d) => ({ sale: a.sale + d.sale, purchase: a.purchase + d.purchase }), { sale: 0, purchase: 0 });

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) { amountRef.current?.focus(); return; }
    setSaving(true);
    try {
      await QuickSale.create({ ...form, amount, method: 'Cash' });
      setForm((f) => ({ ...f, description: '', amount: '' }));
      await qc.invalidateQueries({ queryKey: ['quick-sales'] });
      qc.invalidateQueries({ queryKey: ['daily-report'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      toast({ title: `${form.kind === 'sale' ? 'বিক্রি' : 'কেনা'} যোগ হয়েছে — ${money(amount, currency)}` });
      amountRef.current?.focus();
    } catch (err) {
      toast({ title: 'যোগ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <PageHeader title="খুচরা বিক্রি / কেনা" subtitle="মেমো ছাড়া, নগদ — শুধু মাল আর টাকা লিখুন" print />

      <Card className="no-print border-primary/40">
        <CardContent className="p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button key={k.value} type="button" onClick={() => setForm((f) => ({ ...f, kind: k.value }))}
                  className={cn('rounded-lg border p-2 text-left text-sm', form.kind === k.value ? (k.value === 'sale' ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50') : 'border-slate-200')}>
                  <b>{k.label}</b><span className="block text-xs text-muted-foreground">{k.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ITEMS.map((it) => (
                <button key={it} type="button" onClick={() => setForm((f) => ({ ...f, item: it }))}
                  className={cn('rounded-full border px-3 py-1 text-sm', form.item === it ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-300')}>
                  {it}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_140px_auto]">
              <Input ref={amountRef} type="number" inputMode="decimal" placeholder="টাকা" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="text-lg font-semibold" autoFocus />
              <Input placeholder="বিবরণ (ঐচ্ছিক) — যেমন ২ ফুট পাইপ" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              <Button type="submit" disabled={saving}><Zap className="h-4 w-4" /> যোগ করুন</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        <Input type="date" className="w-auto" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        <span>থেকে</span>
        <Input type="date" className="w-auto" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        <Select className="w-auto" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">বিক্রি + কেনা</option><option value="sale">শুধু বিক্রি</option><option value="purchase">শুধু কেনা</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3"><p className="text-sm text-muted-foreground">মোট খুচরা বিক্রি</p><p className="text-xl font-bold text-emerald-700">{money(totals.sale, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-sm text-muted-foreground">মোট খুচরা কেনা</p><p className="text-xl font-bold text-rose-700">{money(totals.purchase, currency)}</p></CardContent></Card>
      </div>

      {byDay.map((d) => (
        <Card key={d.date}>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-sm">
              <b>{bnDate(d.date)}</b>
              <span>বিক্রি <b className="text-emerald-700">{money(d.sale, currency)}</b>{d.purchase > 0 && <> · কেনা <b className="text-rose-700">{money(d.purchase, currency)}</b></>}</span>
            </div>
            {d.rows.map((x) => (
              <div key={x.id} className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0">
                <span className={cn('rounded px-1.5 text-xs', x.kind === 'purchase' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}>{x.kind === 'purchase' ? 'কেনা' : 'বিক্রি'}</span>
                <span className="font-medium">{x.item}</span>
                <span className="flex-1 truncate text-muted-foreground">{x.description}</span>
                <b>{money(x.amount, currency)}</b>
                <Button className="no-print" variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setDel(x)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      {!byDay.length && <p className="py-8 text-center text-sm text-muted-foreground">এই সময়ে কোনো খুচরা এন্ট্রি নেই</p>}

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="এন্ট্রি মুছবেন?"
        message={del ? `${del.item} — ${money(del.amount, currency)}` : ''}
        onConfirm={async () => {
          await QuickSale.delete(del.id); setDel(null);
          qc.invalidateQueries({ queryKey: ['quick-sales'] });
          qc.invalidateQueries({ queryKey: ['daily-report'] });
        }}
      />
    </div>
  );
}
