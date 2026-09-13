import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowLeftRight, Printer, ArrowLeft } from 'lucide-react';
import { BranchTransfer } from '@/api/entities';
import {
  Button, Card, CardContent, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select,
  Textarea, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, DataTable, PrintButton, UNITS, PrintDoc, PrintTable, PrintTotals,
} from '@/components/shared';
import { bnDate, isoDate, money, num, parseJson, qty, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const emptyItem = () => ({ name: '', quantity: '', unit: 'Pcs', rate: '', amount: '' });
const itemAmount = (it) => (it.amount !== '' && it.amount !== undefined && num(it.amount) > 0
  ? num(it.amount) : num(it.quantity) * num(it.rate));

/**
 * শাখা থেকে শাখায় মাল — what went from one branch to the other, item by item,
 * and what it was worth. Goods only, so it never touches the cash sheet.
 */
export default function BranchTransfers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency, branches } = useSettings();
  const [range, setRange] = useState({ from: '', to: '' });
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printing, setPrinting] = useState(null);

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['branch-transfers'], queryFn: () => BranchTransfer.list('-date', 2000),
  });

  const filtered = rows.filter((r) => (!range.from || r.date >= range.from) && (!range.to || r.date <= range.to));

  // মোট প্রতিটি দিকে: "ফুলপুর → ধারা বাজার" কত টাকার মাল গেল।
  const byRoute = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const key = `${r.from_branch_name} → ${r.to_branch_name}`;
      const cur = map.get(key) || { key, count: 0, total: 0 };
      cur.count += 1;
      cur.total += num(r.total_amount);
      map.set(key, cur);
    });
    return [...map.values()];
  }, [filtered]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (printing) {
    return (
      <div>
        <div className="no-print mb-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrinting(null)}>
            <ArrowLeft className="h-4 w-4" /> ফিরে যান
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> প্রিন্ট
          </Button>
        </div>
        <TransferChallan row={printing} currency={currency} />
      </div>
    );
  }

  const blank = () => ({
    date: isoDate(),
    from_branch_id: branches[0]?.id || '',
    to_branch_id: branches[1]?.id || '',
    items: [emptyItem()],
    sent_by: '',
    notes: '',
  });

  return (
    <div>
      <PageHeader
        title="শাখা ট্রান্সফার"
        subtitle="এক শাখা থেকে আরেক শাখায় মাল পাঠানো / আনা"
        actions={
          <>
            <PrintButton />
            <Button size="sm" className="no-print" onClick={() => setEditing(blank())}>
              <Plus className="h-4 w-4" /> নতুন ট্রান্সফার
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {byRoute.length === 0 ? null : byRoute.map((r) => (
          <Card key={r.key} className="p-4">
            <p className="text-sm text-muted-foreground">{r.key}</p>
            <p className="num mt-1 font-heading text-xl font-bold">{money(r.total, currency)}</p>
            <p className="text-xs text-muted-foreground">{r.count} বার মাল গেছে</p>
          </Card>
        ))}
      </div>

      <div className="no-print mb-3 grid gap-2 sm:grid-cols-2">
        <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'তারিখ', render: (r) => bnDate(r.date) },
          { key: 'route', label: 'কোথা থেকে → কোথায়', render: (r) => (
            <span className="font-medium">{r.from_branch_name} → {r.to_branch_name}</span>
          ) },
          { key: 'items', label: 'মাল', render: (r) => {
            const items = parseJson(r.items_json, []);
            return (
              <span className="text-sm">
                {items.slice(0, 3).map((it) => `${it.name} ${qty(it.quantity, it.unit)}`).join(', ')}
                {items.length > 3 ? ` +${items.length - 3}` : ''}
              </span>
            );
          } },
          { key: 'sent_by', label: 'কে পাঠাল', render: (r) => r.sent_by || '—' },
          { key: 'total_amount', label: 'মালের মূল্য', align: 'right', render: (r) => (
            <span className="num font-semibold">{money(r.total_amount, currency)}</span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (r) => (
            <span className="no-print flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => setPrinting(r)} aria-label="চালান প্রিন্ট">
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" aria-label="সম্পাদনা"
                onClick={() => setEditing({ ...r, items: parseJson(r.items_json, []) })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} aria-label="মুছুন">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        footer={filtered.length > 0 && (
          <tr>
            <td colSpan={4}>মোট</td>
            <td className="num text-right">{money(sum(filtered, 'total_amount'), currency)}</td>
            <td />
          </tr>
        )}
        empty={
          <EmptyState
            icon={ArrowLeftRight}
            title="কোনো ট্রান্সফার নেই"
            description="এক শাখা থেকে আরেক শাখায় মাল পাঠালে বা আনলে এখানে লিখুন।"
          />
        }
      />

      <TransferDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['branch-transfers'] }); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="ট্রান্সফার মুছবেন?"
        message={`${deleteTarget?.from_branch_name} → ${deleteTarget?.to_branch_name} — ${money(deleteTarget?.total_amount, currency)}`}
        onConfirm={async () => {
          await BranchTransfer.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['branch-transfers'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function TransferDialog({ row, onClose, onSaved }) {
  const { toast } = useToast();
  const { currency, branches } = useSettings();
  const [form, setForm] = useState(row || {});
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(row?.id);

  const [last, setLast] = useState(row);
  if (row !== last) {
    setLast(row);
    if (row) setForm({ ...row, items: row.items?.length ? row.items : [emptyItem()] });
  }

  const items = form.items || [];
  const total = items.reduce((a, it) => a + itemAmount(it), 0);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => set('items', items.map((it, x) => (x === i ? { ...it, [k]: v } : it)));

  async function save() {
    if (!form.from_branch_id || !form.to_branch_id) {
      toast({ title: 'দুই শাখাই নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    if (form.from_branch_id === form.to_branch_id) {
      toast({ title: 'একই শাখায় ট্রান্সফার হয় না', variant: 'destructive' });
      return;
    }
    const clean = items.filter((it) => String(it.name).trim())
      .map((it) => ({ ...it, amount: itemAmount(it) }));
    if (!clean.length) {
      toast({ title: 'অন্তত একটি মালের নাম দিন', variant: 'destructive' });
      return;
    }
    const name = (id) => branches.find((b) => b.id === id)?.name || '';
    const payload = {
      date: form.date,
      from_branch_id: form.from_branch_id,
      from_branch_name: name(form.from_branch_id),
      to_branch_id: form.to_branch_id,
      to_branch_name: name(form.to_branch_id),
      items_json: JSON.stringify(clean),
      total_amount: Math.round(clean.reduce((a, it) => a + it.amount, 0) * 100) / 100,
      sent_by: form.sent_by || '',
      notes: form.notes || '',
    };
    setBusy(true);
    try {
      if (isEdit) await BranchTransfer.update(row.id, payload);
      else await BranchTransfer.create(payload);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'ট্রান্সফার সংরক্ষিত হয়েছে' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(row)} onClose={onClose} size="xl"
      title={isEdit ? 'ট্রান্সফার সম্পাদনা' : 'নতুন শাখা ট্রান্সফার'}
      footer={<><Button variant="outline" onClick={onClose}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="তারিখ">
          <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="যে শাখা থেকে গেল" required>
          <Select value={form.from_branch_id || ''} onChange={(e) => set('from_branch_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="যে শাখায় গেল" required>
          <Select value={form.to_branch_id || ''} onChange={(e) => set('to_branch_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </div>

      <Card className="mt-4">
        <CardContent className="space-y-2 pt-4">
          {items.map((it, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-12">
              <Field label={i === 0 ? 'মালের নাম' : undefined} className="sm:col-span-4">
                <Input value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="যেমন: এস এস পাইপ" />
              </Field>
              <Field label={i === 0 ? 'পরিমাণ' : undefined} className="sm:col-span-2">
                <Input type="number" step="0.01" min="0" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
              </Field>
              <Field label={i === 0 ? 'একক' : undefined} className="sm:col-span-2">
                <Select value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label={i === 0 ? 'দর' : undefined} className="sm:col-span-2">
                <Input type="number" step="0.01" min="0" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
              </Field>
              <div className="flex items-center justify-between gap-1 sm:col-span-2">
                <span className="num text-sm font-semibold">{money(itemAmount(it), currency)}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => set('items', items.filter((_, x) => x !== i))} aria-label="মুছুন">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2">
            <Button size="sm" variant="outline" onClick={() => set('items', [...items, emptyItem()])}>
              <Plus className="h-4 w-4" /> মাল যোগ
            </Button>
            <span className="text-sm">মোট মূল্য: <span className="num font-bold">{money(total, currency)}</span></span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="কে পাঠাল / আনল">
          <Input value={form.sent_by || ''} onChange={(e) => set('sent_by', e.target.value)} />
        </Field>
        <Field label="নোট">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className="min-h-[40px]" />
        </Field>
      </div>
    </Dialog>
  );
}

/** মাল চালান — goes with the goods to the other branch. */
function TransferChallan({ row, currency }) {
  const items = parseJson(row.items_json, []);
  return (
    <PrintDoc
      title="শাখা মাল চালান"
      copyLabel="অফিস কপি"
      meta={[['তারিখ', bnDate(row.date)], ['থেকে', row.from_branch_name], ['প্রতি', row.to_branch_name]]}
      signatures={['প্রেরকের স্বাক্ষর', 'গ্রহণকারীর স্বাক্ষর']}
      footerNote=""
    >
      <PrintTable
        head={[
          { label: 'ক্র.', width: '36px', align: 'center' },
          { label: 'মালের নাম' },
          { label: 'পরিমাণ', align: 'right', width: '100px' },
          { label: 'দর', align: 'right', width: '90px' },
          { label: 'টাকা', align: 'right', width: '110px' },
        ]}
      >
        {items.map((it, i) => (
          <tr key={i}>
            <td className="num" style={{ textAlign: 'center' }}>{i + 1}</td>
            <td>{it.name}</td>
            <td className="num" style={{ textAlign: 'right' }}>{qty(it.quantity, it.unit)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{num(it.rate) ? money(it.rate, currency) : '—'}</td>
            <td className="num" style={{ textAlign: 'right' }}>{money(it.amount, currency)}</td>
          </tr>
        ))}
      </PrintTable>
      <PrintTotals rows={[{ label: 'মোট মালের মূল্য', value: money(row.total_amount, currency), strong: true }]} />
      {(row.sent_by || row.notes) && (
        <div className="print-subsection">
          {row.sent_by && <p>পাঠিয়েছেন: {row.sent_by}</p>}
          {row.notes && <p>নোট: {row.notes}</p>}
        </div>
      )}
    </PrintDoc>
  );
}
