import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Pencil, Trash2 } from 'lucide-react';
import {
  AluminiumProfile, SSMaterial, GlassPrice, Accessory, LabourSetting,
} from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Dialog, Field, Input, Select,
  Textarea, ConfirmDialog, Checkbox, Badge, Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * One config object per price list. Each declares the client, the columns to
 * show, and the fields to edit — so all five tabs share one table and one form.
 */
const LISTS = {
  glass: {
    label: 'থাই গ্লাস',
    client: GlassPrice,
    queryKey: 'glass-prices',
    sort: 'glass_type',
    blank: { glass_type: '', thickness: '5mm', rate: 0, rate_unit: 'Per Sqft', cutting_cost: 0, fitting_cost: 0, notes: '', active: true },
    title: (r) => `${r.glass_type} ${r.thickness || ''}`.trim(),
    columns: (c) => [
      { key: 'glass_type', label: 'ধরন', render: (r) => <span className="font-medium">{r.glass_type}</span> },
      { key: 'thickness', label: 'পুরুত্ব', render: (r) => r.thickness || '—' },
      { key: 'rate', label: 'দর', align: 'right', render: (r) => money(r.rate, c) },
      { key: 'rate_unit', label: 'একক' },
      { key: 'cutting_cost', label: 'কাটিং', align: 'right', render: (r) => money(r.cutting_cost, c) },
      { key: 'fitting_cost', label: 'ফিটিং', align: 'right', render: (r) => money(r.fitting_cost, c) },
    ],
    fields: [
      { key: 'glass_type', label: 'গ্লাসের ধরন', required: true },
      { key: 'thickness', label: 'পুরুত্ব' },
      { key: 'rate', label: 'দর', type: 'number' },
      { key: 'rate_unit', label: 'দরের একক', type: 'select', options: ['Per Sqft', 'Per Rft', 'Per Piece'] },
      { key: 'cutting_cost', label: 'কাটিং খরচ', type: 'number' },
      { key: 'fitting_cost', label: 'ফিটিং খরচ', type: 'number' },
    ],
  },

  profile: {
    label: 'অ্যালুমিনিয়াম প্রোফাইল',
    client: AluminiumProfile,
    queryKey: 'aluminium-profiles',
    sort: 'profile_name',
    blank: { profile_name: '', profile_type: '', formula: 'perimeter', price_per_foot: 0, price_per_kg: 0, price_per_piece: 0, length_per_piece: 0, pieces_per_window: 2, cutting_deduction: 0, waste_percent: 5, description: '', notes: '', active: true },
    title: (r) => r.profile_name,
    columns: (c) => [
      { key: 'profile_name', label: 'প্রোফাইল', render: (r) => <span className="font-medium">{r.profile_name}</span> },
      { key: 'profile_type', label: 'ধরন', render: (r) => r.profile_type || '—' },
      { key: 'formula', label: 'ফর্মুলা' },
      { key: 'price_per_foot', label: 'প্রতি ফুট', align: 'right', render: (r) => money(r.price_per_foot, c) },
      { key: 'price_per_kg', label: 'প্রতি কেজি', align: 'right', render: (r) => money(r.price_per_kg, c) },
      { key: 'waste_percent', label: 'অপচয় %', align: 'right', render: (r) => `${r.waste_percent}%` },
    ],
    fields: [
      { key: 'profile_name', label: 'প্রোফাইলের নাম', required: true },
      { key: 'profile_type', label: 'ধরন' },
      { key: 'formula', label: 'ফর্মুলা', type: 'select', options: ['perimeter', 'height', 'width', 'fixed'] },
      { key: 'price_per_foot', label: 'প্রতি ফুট দর', type: 'number' },
      { key: 'price_per_kg', label: 'প্রতি কেজি দর', type: 'number' },
      { key: 'price_per_piece', label: 'প্রতি পিস দর', type: 'number' },
      { key: 'length_per_piece', label: 'প্রতি পিস লম্বা (ফুট)', type: 'number' },
      { key: 'pieces_per_window', label: 'প্রতি জানালায় পিস', type: 'number' },
      { key: 'cutting_deduction', label: 'কাটিং বাদ', type: 'number' },
      { key: 'waste_percent', label: 'অপচয় (%)', type: 'number' },
    ],
  },

  ss: {
    label: 'এসএস ম্যাটেরিয়াল',
    client: SSMaterial,
    queryKey: 'ss-materials',
    sort: 'material_name',
    blank: { material_name: '', grade: '304', size: '', length: 0, unit: 'ft', price_type: 'Per Foot', price: 0, supplier: '', notes: '', active: true },
    title: (r) => r.material_name,
    columns: (c) => [
      { key: 'material_name', label: 'ম্যাটেরিয়াল', render: (r) => <span className="font-medium">{r.material_name}</span> },
      { key: 'grade', label: 'গ্রেড', render: (r) => r.grade || '—' },
      { key: 'size', label: 'সাইজ', render: (r) => r.size || '—' },
      { key: 'price_type', label: 'দরের ধরন' },
      { key: 'price', label: 'দর', align: 'right', render: (r) => money(r.price, c) },
      { key: 'supplier', label: 'সরবরাহকারী', render: (r) => r.supplier || '—' },
    ],
    fields: [
      { key: 'material_name', label: 'ম্যাটেরিয়ালের নাম', required: true },
      { key: 'grade', label: 'গ্রেড' },
      { key: 'size', label: 'সাইজ' },
      { key: 'length', label: 'লম্বা', type: 'number' },
      { key: 'unit', label: 'একক' },
      { key: 'price_type', label: 'দরের ধরন', type: 'select', options: ['Per Foot', 'Per Kg', 'Per Piece', 'Per Sheet'] },
      { key: 'price', label: 'দর', type: 'number' },
      { key: 'supplier', label: 'সরবরাহকারী' },
    ],
  },

  accessory: {
    label: 'এক্সেসরিজ',
    client: Accessory,
    queryKey: 'accessories',
    sort: 'name',
    blank: { name: '', unit: 'Piece', unit_price: 0, notes: '', active: true },
    title: (r) => r.name,
    columns: (c) => [
      { key: 'name', label: 'নাম', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'unit', label: 'একক' },
      { key: 'unit_price', label: 'দর', align: 'right', render: (r) => money(r.unit_price, c) },
      { key: 'notes', label: 'নোট', render: (r) => r.notes || '—' },
    ],
    fields: [
      { key: 'name', label: 'নাম', required: true },
      { key: 'unit', label: 'একক', type: 'select', options: ['Piece', 'Tube', 'Roll', 'Packet', 'Set', 'Kg'] },
      { key: 'unit_price', label: 'একক দর', type: 'number' },
    ],
  },

  labour: {
    label: 'মজুরি',
    client: LabourSetting,
    queryKey: 'labour-settings',
    sort: 'label',
    blank: { label: '', category: 'Labour', rate: 0, rate_unit: 'Per Sqft', notes: '', active: true },
    title: (r) => r.label,
    columns: (c) => [
      { key: 'label', label: 'নাম', render: (r) => <span className="font-medium">{r.label}</span> },
      { key: 'category', label: 'ক্যাটাগরি' },
      { key: 'rate', label: 'দর', align: 'right', render: (r) => money(r.rate, c) },
      { key: 'rate_unit', label: 'একক' },
    ],
    fields: [
      { key: 'label', label: 'নাম', required: true },
      { key: 'category', label: 'ক্যাটাগরি', type: 'select', options: ['Labour', 'Fitting', 'Transport', 'Other'] },
      { key: 'rate', label: 'দর', type: 'number' },
      { key: 'rate_unit', label: 'দরের একক', type: 'select', options: ['Per Sqft', 'Per Rft', 'Per Piece', 'Fixed'] },
    ],
  },
};

const TAB_ORDER = ['glass', 'profile', 'ss', 'accessory', 'labour'];

export default function PriceLists() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [tab, setTab] = useState('glass');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const config = LISTS[tab];

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: [config.queryKey],
    queryFn: () => config.client.list(config.sort, 500),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(term));
  }, [rows, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.queryKey] });

  return (
    <div>
      <PageHeader
        title="মূল্য তালিকা"
        subtitle="অর্ডার ও ক্যালকুলেটরে এই দরগুলোই ব্যবহৃত হয়"
        actions={
          <Button size="sm" onClick={() => setEditing(config.blank)}>
            <Plus className="h-4 w-4" /> নতুন যোগ করুন
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={config.label} value={rows.length} currency={false} tone="primary" icon={Tags} />
        <StatCard label="সক্রিয়" value={rows.filter((r) => r.active).length} currency={false} tone="success" />
        <StatCard
          label="দর নির্ধারিত নয়"
          value={rows.filter((r) => !Number(r.rate ?? r.price ?? r.unit_price ?? r.price_per_foot ?? 0)).length}
          currency={false}
          tone="accent"
        />
      </div>

      <Tabs
        tabs={TAB_ORDER.map((k) => ({ value: k, label: LISTS[k].label }))}
        value={tab}
        onChange={(v) => { setTab(v); setSearch(''); }}
        className="mb-3"
      />

      <SearchInput value={search} onChange={setSearch} placeholder="খুঁজুন…" className="mb-3" />

      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          columns={[
            ...config.columns(currency),
            { key: 'active', label: 'অবস্থা', render: (r) => (
              <Badge variant={r.active ? 'success' : 'secondary'}>
                {r.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
              </Badge>
            ) },
            { key: 'actions', label: '', align: 'right', render: (r) => (
              <span className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="সম্পাদনা">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} aria-label="মুছুন">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </span>
            ) },
          ]}
          rows={filtered}
          empty={
            <EmptyState
              icon={Tags}
              title={`${config.label} তালিকা খালি`}
              action={<Button size="sm" onClick={() => setEditing(config.blank)}><Plus className="h-4 w-4" /> যোগ করুন</Button>}
            />
          }
        />
      )}

      <PriceDialog
        config={config}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); invalidate(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="মুছে ফেলবেন?"
        message={deleteTarget ? config.title(deleteTarget) : ''}
        onConfirm={async () => {
          await config.client.delete(deleteTarget.id);
          invalidate();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function PriceDialog({ config, row, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(config.blank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(row?.id);

  const key = `${config.queryKey}:${row?.id || 'new'}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...config.blank, ...(row || {}) });
  }

  async function save() {
    const required = config.fields.filter((f) => f.required);
    for (const f of required) {
      if (!String(form[f.key] || '').trim()) {
        toast({ title: `${f.label} দিন`, variant: 'destructive' });
        return;
      }
    }
    setBusy(true);
    try {
      if (isEdit) await config.client.update(row.id, form);
      else await config.client.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'যোগ হয়েছে' });
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
      open={Boolean(row)}
      onClose={onClose}
      title={`${config.label} — ${isEdit ? 'সম্পাদনা' : 'নতুন'}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required}>
            {f.type === 'select' ? (
              <Select value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            ) : (
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                step={f.type === 'number' ? '0.01' : undefined}
                value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}

        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Checkbox checked={form.active} onChange={(v) => set('active', v)} label="সক্রিয়" />
        </div>
      </div>
    </Dialog>
  );
}
