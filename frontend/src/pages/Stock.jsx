import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Boxes, AlertTriangle, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { StockItem, Stock, StockAdjustment, Customer } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select,
  Textarea, ConfirmDialog, Badge, Card, CardContent, CardHeader, CardTitle, Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard, PAYMENT_METHODS } from '@/components/shared';
import { bnDate, isoDate, money, num, qty } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const CATEGORIES = ['Aluminium', 'SS', 'Glass', 'Accessory', 'Other'];

/** স্টক কমে দুইভাবে — বিক্রি (টাকা আসে) আর নিজে ব্যবহার (শুধু মাল কমে)। */
const MOVE_TYPES = {
  sale: { label: 'বিক্রি', badge: 'success', hint: 'স্টক কমবে, টাকা আজকের জমা ও হাতে নগদে যোগ হবে' },
  use: { label: 'নিজে ব্যবহার', badge: 'warning', hint: 'দোকানে কেটে পণ্য বানাতে ব্যবহার — শুধু স্টক কমবে, টাকা নয়' },
  in: { label: 'স্টক যোগ', badge: 'info', hint: 'নতুন মাল এসেছে — স্টক বাড়বে' },
  adjust: { label: 'সমন্বয়', badge: 'secondary', hint: 'গণনা ঠিক করা — বাড়াতে ধনাত্মক, কমাতে ঋণাত্মক' },
};
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
        print
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
          { value: 'history', label: 'ইতিহাস (বিক্রি / ব্যবহার)' },
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
                  <Button variant="outline" size="sm" className="no-print" onClick={() => setAdjusting(it)}>
                    <ArrowUpDown className="h-4 w-4" /> বিক্রি / ব্যবহার
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
            { key: 'type', label: 'ধরন', render: (a) => (
              <Badge variant={MOVE_TYPES[a.type]?.badge || 'secondary'}>
                {MOVE_TYPES[a.type]?.label || 'সমন্বয়'}
              </Badge>
            ) },
            { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (a) => (
              <span className={num(a.quantity) >= 0 ? 'num text-emerald-700' : 'num text-destructive'}>
                {num(a.quantity) >= 0 ? '+' : ''}{qty(a.quantity)}
              </span>
            ) },
            { key: 'amount', label: 'বিক্রির টাকা', align: 'right', render: (a) => (
              num(a.amount) > 0 ? <span className="num font-medium">{money(a.amount, currency)}</span> : '—'
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
        onSaved={() => {
          setAdjusting(null);
          invalidate();
          ['payments', 'daily', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        }}
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

const blankMove = (item) => ({
  type: 'sale', date: isoDate(), quantity: '', rate: item?.price || '', amount: '',
  customer_id: '', method: 'Cash', reason: '', notes: '',
});

function AdjustDialog({ item, onClose, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useState(blankMove(item));
  const [busy, setBusy] = useState(false);

  const key = item?.id || null;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    if (item) setForm(blankMove(item));
  }

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'], queryFn: () => Customer.list('name', 1000), enabled: form.type === 'sale',
  });

  const saleAmount = form.amount !== '' ? num(form.amount) : Math.abs(num(form.quantity)) * num(form.rate);
  const after = num(item?.current_stock) + (
    form.type === 'in' ? Math.abs(num(form.quantity))
      : form.type === 'adjust' ? num(form.quantity) : -Math.abs(num(form.quantity))
  );

  async function save() {
    if (!num(form.quantity)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (form.type === 'sale' && !(saleAmount > 0)) {
      toast({ title: 'বিক্রির দর বা মোট টাকা দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Stock.adjust(item.id, form);
      toast({
        title: `${MOVE_TYPES[form.type].label} সংরক্ষিত হয়েছে`,
        description: form.type === 'sale' ? `${money(saleAmount, currency)} জমায় যোগ হয়েছে` : undefined,
      });
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
      title="স্টক কমানো / বাড়ানো"
      description={item ? `${item.name} — বর্তমান ${qty(item.current_stock, item.unit)}` : ''}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(MOVE_TYPES).map(([k, t]) => (
          <button
            key={k} type="button" onClick={() => set('type', k)}
            className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
              form.type === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-white/70 hover:bg-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{MOVE_TYPES[form.type].hint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="তারিখ">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={`পরিমাণ (${item?.unit || ''})`} required>
          <Input
            type="number" step="0.001" autoFocus value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            placeholder={form.type === 'adjust' ? 'যেমন: 25 অথবা -10' : 'যেমন: 10'}
          />
        </Field>

        {form.type === 'sale' && (
          <>
            <Field label="দর (প্রতি একক)">
              <Input type="number" step="0.01" min="0" value={form.rate} onChange={(e) => set('rate', e.target.value)} />
            </Field>
            <Field label="মোট টাকা" hint="খালি রাখলে পরিমাণ × দর">
              <Input
                type="number" step="0.01" min="0" value={form.amount}
                placeholder={String(Math.abs(num(form.quantity)) * num(form.rate) || '')}
                onChange={(e) => set('amount', e.target.value)}
              />
            </Field>
            <Field label="কাস্টমার (ঐচ্ছিক)">
              <Select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}>
                <option value="">নগদ বিক্রি</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="মাধ্যম">
              <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
          </>
        )}

        <Field label="কারণ" className="sm:col-span-2">
          <Input
            value={form.reason} onChange={(e) => set('reason', e.target.value)}
            placeholder={form.type === 'use' ? 'যেমন: গেট বানাতে কাটা হয়েছে' : ''}
          />
        </Field>

        <div className="flex justify-between rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
          <span className="text-muted-foreground">এরপর স্টক থাকবে</span>
          <span className="num font-bold">{qty(after, item?.unit)}</span>
        </div>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
