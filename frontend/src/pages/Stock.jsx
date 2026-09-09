import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Boxes, AlertTriangle, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { StockItem, Stock, StockAdjustment } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select,
  Textarea, ConfirmDialog, Badge, Card, CardContent, CardHeader, CardTitle, Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { bnDate, isoDate, money, num, qty } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const CATEGORIES = ['Aluminium', 'SS', 'Glass', 'Accessory', 'Other'];
const blank = {
  name: '', category: 'Aluminium', opening_stock: 0, current_stock: 0,
  minimum_stock: 0, unit: 'ft', price: 0, notes: '',
};

export default function StockPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [tab, setTab] = useState('items');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-items'], queryFn: () => StockItem.list('name', 500),
  });
  const { data: adjustments = [] } = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => StockAdjustment.list('-created_date', 500),
    enabled: tab === 'history',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (!term) return true;
      return [it.name, it.category].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [items, search, category]);

  const lowStock = filtered.filter(
    (it) => num(it.minimum_stock) > 0 && num(it.current_stock) <= num(it.minimum_stock),
  );
  const stockValue = filtered.reduce((a, it) => a + num(it.current_stock) * num(it.price), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="স্টক"
        subtitle={`${filtered.length} টি আইটেম`}
        actions={
          <Button size="sm" onClick={() => setEditing(blank)}>
            <Plus className="h-4 w-4" /> নতুন আইটেম
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট আইটেম" value={filtered.length} currency={false} tone="primary" icon={Boxes} />
        <StatCard label="স্টকের মূল্য" value={stockValue} currency={currency} tone="info" />
        <StatCard label="কম স্টক" value={lowStock.length} currency={false} tone="danger" icon={AlertTriangle} />
      </div>

      {lowStock.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" /> কম স্টকের আইটেম
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStock.map((it) => (
              <Badge key={it.id} variant="warning">
                {it.name}: {qty(it.current_stock, it.unit)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs
        tabs={[
          { value: 'items', label: 'আইটেম', count: items.length },
          { value: 'history', label: 'সমন্বয়ের ইতিহাস' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'items' ? (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="আইটেমের নাম…" className="flex-1" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48">
              <option value="">সব ক্যাটাগরি</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <DataTable
            columns={[
              { key: 'name', label: 'নাম', render: (it) => <span className="font-medium">{it.name}</span> },
              { key: 'category', label: 'ক্যাটাগরি', render: (it) => (
                <Badge variant="secondary">{it.category}</Badge>
              ) },
              { key: 'opening_stock', label: 'ওপেনিং', align: 'right', render: (it) => qty(it.opening_stock) },
              { key: 'current_stock', label: 'বর্তমান', align: 'right', render: (it) => {
                const low = num(it.minimum_stock) > 0 && num(it.current_stock) <= num(it.minimum_stock);
                return (
                  <span className={low ? 'num font-semibold text-destructive' : 'num font-medium'}>
                    {qty(it.current_stock, it.unit)}
                  </span>
                );
              } },
              { key: 'minimum_stock', label: 'সর্বনিম্ন', align: 'right', render: (it) => qty(it.minimum_stock) },
              { key: 'price', label: 'দর', align: 'right', render: (it) => money(it.price, currency) },
              { key: 'value', label: 'মূল্য', align: 'right', render: (it) => (
                <span className="num">{money(num(it.current_stock) * num(it.price), currency)}</span>
              ) },
              { key: 'actions', label: '', align: 'right', render: (it) => (
                <span className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setAdjusting(it)} aria-label="সমন্বয়">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(it)} aria-label="সম্পাদনা">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(it)} aria-label="মুছুন">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              ) },
            ]}
            rows={filtered}
            empty={
              <EmptyState
                icon={Boxes}
                title="কোনো স্টক আইটেম নেই"
                action={<Button size="sm" onClick={() => setEditing(blank)}><Plus className="h-4 w-4" /> যোগ করুন</Button>}
              />
            }
          />
        </>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'তারিখ', render: (a) => bnDate(a.date) },
            { key: 'stock_name', label: 'আইটেম', render: (a) => (
              <span className="font-medium">{a.stock_name}</span>
            ) },
            { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (a) => (
              <span className={num(a.quantity) >= 0 ? 'num text-emerald-700' : 'num text-destructive'}>
                {num(a.quantity) >= 0 ? '+' : ''}{qty(a.quantity)}
              </span>
            ) },
            { key: 'reason', label: 'কারণ', render: (a) => a.reason || '—' },
            { key: 'notes', label: 'নোট', render: (a) => a.notes || '—' },
          ]}
          rows={adjustments}
          empty={<EmptyState icon={ArrowUpDown} title="কোনো সমন্বয় নেই" />}
        />
      )}

      <ItemDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); invalidate(); }}
      />

      <AdjustDialog
        item={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={() => { setAdjusting(null); invalidate(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="আইটেম মুছবেন?"
        message={deleteTarget?.name}
        onConfirm={async () => {
          await StockItem.delete(deleteTarget.id);
          invalidate();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function ItemDialog({ item, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(item?.id);

  const key = item?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...blank, ...(item || {}) });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await StockItem.update(item.id, form);
      else await Stock.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'আইটেম যোগ হয়েছে' });
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
      open={Boolean(item)}
      onClose={onClose}
      title={isEdit ? 'আইটেম সম্পাদনা' : 'নতুন স্টক আইটেম'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="নাম" required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="ক্যাটাগরি">
          <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="একক">
          <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} />
        </Field>
        <Field label="ওপেনিং স্টক">
          <Input
            type="number" step="0.001" value={form.opening_stock}
            onChange={(e) => set('opening_stock', e.target.value)}
            disabled={isEdit}
          />
        </Field>
        {isEdit && (
          <Field label="বর্তমান স্টক" hint="সমন্বয় দিয়ে পরিবর্তন করুন">
            <Input readOnly className="bg-muted" value={form.current_stock} />
          </Field>
        )}
        <Field label="সর্বনিম্ন স্টক" hint="এর নিচে গেলে সতর্কতা">
          <Input
            type="number" step="0.001" value={form.minimum_stock}
            onChange={(e) => set('minimum_stock', e.target.value)}
          />
        </Field>
        <Field label="একক দর">
          <Input
            type="number" step="0.01" value={form.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function AdjustDialog({ item, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ date: isoDate(), quantity: '', reason: '', notes: '' });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!num(form.quantity)) {
      toast({ title: 'পরিমাণ দিন (বাড়াতে + , কমাতে −)', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Stock.adjust(item.id, form);
      toast({ title: 'স্টক সমন্বয় হয়েছে' });
      setForm({ date: isoDate(), quantity: '', reason: '', notes: '' });
      onSaved();
    } catch (err) {
      toast({ title: 'সমন্বয় করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title="স্টক সমন্বয়"
      description={item ? `${item.name} — বর্তমান ${qty(item.current_stock, item.unit)}` : ''}
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
        <Field label="পরিমাণ" required hint="বাড়াতে ধনাত্মক, কমাতে ঋণাত্মক">
          <Input
            type="number" step="0.001" autoFocus value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            placeholder="যেমন: 25 অথবা -10"
          />
        </Field>
        <Field label="কারণ" className="sm:col-span-2">
          <Input
            value={form.reason} onChange={(e) => set('reason', e.target.value)}
            placeholder="ক্রয় / ব্যবহার / নষ্ট / গণনা সংশোধন"
          />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
