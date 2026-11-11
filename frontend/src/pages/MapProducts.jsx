import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { MapProduct } from '@/api/entities';
import { Button, Card, CardContent, Input, Select, Loading, ErrorState, Tabs, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput } from '@/components/shared';
import { useMapProducts } from '@/hooks/useMapProducts';

const TYPES = [
  { value: 'profile', label: 'থাই প্রোফাইল' },
  { value: 'hardware', label: 'হার্ডওয়্যার' },
  { value: 'glass', label: 'গ্লাস' },
];
const CATEGORIES = {
  profile: [['3inch', '৩" স্লাইডিং'], ['4inch', '৪" স্লাইডিং'], ['4inch_net', '৪" নেট সহ'], ['net', 'নেট / সিলিং'], ['thaiCeiling', 'থাই সিলিং'], ['powderCode', 'পাউডার কোড']],
  hardware: [['slLock', 'SL Lock'], ['mohiyer', 'SL মহিয়ার'], ['rover', 'SL Rabar'], ['screws', 'স্ক্রু'], ['halfScrew', '১/২" স্ক্রু'], ['slWheel', 'SL হুইল'], ['net', 'Net'], ['netWheel', 'Net Wheel'], ['netAngle', 'Net Angle'], ['netRover', 'Net Rover'], ['rivets', 'Rivets'], ['thaiCeiling', 'থাই সিলিং (প্যানেল/স্ক্রু/প্লাগ/রিভেট)']],
  glass: [],
};
// কোন কলাম কোন ধরনে দেখাবে
const COLS = {
  profile: [['slide_category', 'ক্যাটাগরি'], ['product_code', 'কোড'], ['product_name', 'নাম'], ['company', 'কোম্পানি'], ['colour', 'কালার'], ['sell_rate', 'রেট (৳/ফুট)'], ['purchase_rate', 'বারের দাম']],
  hardware: [['slide_category', 'কোন অংশ'], ['product_code', 'কোড'], ['product_name', 'নাম'], ['company', 'কোম্পানি'], ['quality', 'Quality'], ['purchase_rate', 'রেট']],
  glass: [['product_name', 'গ্লাস কালার'], ['glass_mm', 'M.M'], ['purchase_rate', 'রেট (৳/Sq.Ft)']],
};
const NUMERIC = new Set(['sell_rate', 'purchase_rate']);

/** ম্যাপ Product DB — ক্যালকুলেটরগুলোর রেট এখানে বদলালেই সব হিসাবে বসে যায়। */
export default function MapProducts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading, error, refetch } = useMapProducts();
  const [type, setType] = useState('profile');
  const [cat, setCat] = useState('');
  const [company, setCompany] = useState('');
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);

  const ofType = useMemo(() => data.filter((p) => p.item_type === type), [data, type]);
  const companies = useMemo(() => [...new Set(ofType.map((p) => p.company).filter(Boolean))].sort(), [ofType]);
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return ofType.filter((p) => (!cat || p.slide_category === cat) && (!company || p.company === company)
      && (!t || [p.product_code, p.product_name, p.colour].some((v) => String(v || '').toLowerCase().includes(t))));
  }, [ofType, cat, company, search]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const val = (p, k) => (edits[p.id]?.[k] !== undefined ? edits[p.id][k] : (p[k] ?? ''));
  const edit = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const dirty = Object.keys(edits).length;

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [id, patch] of Object.entries(edits)) {
        const body = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, NUMERIC.has(k) ? (v === '' ? null : Number(v)) : v]));
        await MapProduct.update(id, body);
      }
      setEdits({});
      await qc.invalidateQueries({ queryKey: ['map-products'] });
      toast({ title: 'সেভ হয়েছে' });
    } catch (e) {
      toast({ title: 'সেভ করা যায়নি', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };
  const addRow = async () => {
    await MapProduct.create({ item_type: type, slide_category: cat || null, company: company || null, purchase_rate: 0 });
    await qc.invalidateQueries({ queryKey: ['map-products'] });
    toast({ title: 'নতুন লাইন যোগ হয়েছে — উপরের দিকে খুঁজে তথ্য বসান' });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="ম্যাপ Product DB"
        subtitle="জানালা ও সিলিং ক্যালকুলেটরের প্রোফাইল / হার্ডওয়্যার / গ্লাস রেট"
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4" /> নতুন</Button>
            <Button size="sm" onClick={saveAll} disabled={!dirty || saving}><Save className="h-4 w-4" /> সেভ {dirty ? `(${dirty})` : ''}</Button>
          </>
        )}
      />
      <Tabs tabs={TYPES.map((t) => ({ ...t, count: data.filter((p) => p.item_type === t.value).length }))} value={type} onChange={(v) => { setType(v); setCat(''); setCompany(''); }} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES[type].length > 0 && (
          <Select className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">সব ক্যাটাগরি</option>
            {CATEGORIES[type].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
        {companies.length > 0 && (
          <Select className="w-auto" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">সব কোম্পানি</option>
            {companies.map((c) => <option key={c}>{c}</option>)}
          </Select>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="কোড / নাম / কালার" className="min-w-[200px] flex-1" />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b bg-slate-50 text-left">
              {COLS[type].map(([, l]) => <th key={l} className="px-2 py-2">{l}</th>)}<th />
            </tr></thead>
            <tbody>
              {rows.slice(0, 400).map((p) => (
                <tr key={p.id} className={edits[p.id] ? 'bg-amber-50' : 'border-b'}>
                  {COLS[type].map(([k]) => (
                    <td key={k} className="px-1 py-1">
                      {k === 'slide_category' && CATEGORIES[type].length ? (
                        <Select className="h-8" value={val(p, k)} onChange={(e) => edit(p.id, k, e.target.value)}>
                          <option value="">—</option>
                          {CATEGORIES[type].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                      ) : (
                        <Input className="h-8" type={NUMERIC.has(k) ? 'number' : 'text'} value={val(p, k)} onChange={(e) => edit(p.id, k, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td className="px-1"><Button variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 400 && <p className="p-3 text-xs text-muted-foreground">প্রথম ৪০০টা দেখানো হচ্ছে — ক্যাটাগরি/কোম্পানি দিয়ে ছাঁকুন।</p>}
          {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">কিছু পাওয়া যায়নি</p>}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="প্রোডাক্ট মুছবেন?"
        message={del ? `${del.product_code || ''} ${del.product_name || ''}` : ''}
        onConfirm={async () => { await MapProduct.delete(del.id); setDel(null); qc.invalidateQueries({ queryKey: ['map-products'] }); }}
      />
    </div>
  );
}
