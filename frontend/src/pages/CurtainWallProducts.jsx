import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { CurtainWallProduct, CurtainWallHardware } from '@/api/entities';
import { Button, Card, CardContent, Input, Select, Loading, ErrorState, Tabs, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared';
import { useCurtainWallProducts, useCurtainWallHardware } from '@/hooks/useMapProducts';
import { CW_COLOURS, CW_HW_ITEMS } from '@/lib/mapCalc';

const SECTION = [['half', 'Half'], ['sbit', 'S.Bit'], ['dbit', 'D.Bit'], ['angle', 'অ্যাঙ্গেল']];
const DIE_COLS = [['die_no', 'Die'], ['inch', 'ইঞ্চি'], ['size_mm', 'সাইজ'], ['bar_ft', 'বার (ফুট)'], ...CW_COLOURS.map((c) => ['price_' + c.key, c.label])];
const NUMERIC = new Set(['inch', 'bar_ft', 'rate', 'pack_qty', ...CW_COLOURS.map((c) => 'price_' + c.key)]);

/** কার্টেন ওয়াল প্রোডাক্ট — ডাই-ভিত্তিক বারের দাম (কালার অনুযায়ী) আর হার্ডওয়্যার/টেপ/গাম রেট। */
export default function CurtainWallProducts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const dies = useCurtainWallProducts();
  const hw = useCurtainWallHardware();
  const [tab, setTab] = useState('dies');
  const [company, setCompany] = useState('');
  const [section, setSection] = useState('');
  const [edits, setEdits] = useState({});
  const [del, setDel] = useState(null);

  const companies = useMemo(() => [...new Set((dies.data || []).map((p) => p.company))].sort(), [dies.data]);
  const rows = useMemo(() => (dies.data || []).filter((p) => (!company || p.company === company) && (!section || p.section_type === section)), [dies.data, company, section]);

  if (dies.isLoading || hw.isLoading) return <Loading />;
  if (dies.error || hw.error) return <ErrorState error={dies.error || hw.error} onRetry={() => { dies.refetch(); hw.refetch(); }} />;

  const val = (p, k) => (edits[p.id]?.[k] !== undefined ? edits[p.id][k] : (p[k] ?? ''));
  const edit = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const dirty = Object.keys(edits).length;
  const Entity = tab === 'dies' ? CurtainWallProduct : CurtainWallHardware;
  const key = tab === 'dies' ? ['curtain-wall-products'] : ['curtain-wall-hardware'];

  const save = async () => {
    try {
      for (const [id, patch] of Object.entries(edits)) {
        await Entity.update(id, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, NUMERIC.has(k) ? Number(v) || 0 : v])));
      }
      setEdits({});
      await qc.invalidateQueries({ queryKey: key });
      toast({ title: 'সেভ হয়েছে' });
    } catch (e) { toast({ title: 'সেভ করা যায়নি', description: e.message, variant: 'destructive' }); }
  };
  const add = async () => {
    if (tab === 'dies') await CurtainWallProduct.create({ company: company || 'নতুন', die_no: '', section_type: section || 'half', inch: 2, bar_ft: 21 });
    else await CurtainWallHardware.create({ item_key: 'clamp', item_name: '', rate: 0, pack_qty: 1 });
    await qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="কার্টেন ওয়াল প্রোডাক্ট"
        subtitle="ডাই অনুযায়ী এক বারের দাম (কালার ভেদে) — ক্যালকুলেটর দাম ÷ বারের ফুট = প্রতি ফুট রেট ধরে"
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4" /> নতুন</Button>
            <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-4 w-4" /> সেভ {dirty ? `(${dirty})` : ''}</Button>
          </>
        )}
      />
      <Tabs tabs={[{ value: 'dies', label: 'সেকশন / ডাই', count: dies.data.length }, { value: 'hw', label: 'হার্ডওয়্যার / টেপ / গাম', count: hw.data.length }]} value={tab} onChange={(v) => { setTab(v); setEdits({}); }} />

      {tab === 'dies' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Select className="w-auto" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">সব কোম্পানি</option>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select className="w-auto" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">সব সেকশন</option>
              {SECTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[1000px] text-sm">
                <thead><tr className="border-b bg-slate-50 text-left">
                  <th className="px-2 py-2">কোম্পানি</th><th>সেকশন</th>{DIE_COLS.map(([, l]) => <th key={l} className="px-1">{l}</th>)}<th />
                </tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className={edits[p.id] ? 'bg-amber-50' : 'border-b'}>
                      <td className="px-1 py-1"><Input className="h-8 w-28" value={val(p, 'company')} onChange={(e) => edit(p.id, 'company', e.target.value)} /></td>
                      <td className="px-1"><Select className="h-8" value={val(p, 'section_type')} onChange={(e) => edit(p.id, 'section_type', e.target.value)}>{SECTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></td>
                      {DIE_COLS.map(([k]) => (
                        <td key={k} className="px-1"><Input className="h-8 w-20" type={NUMERIC.has(k) ? 'number' : 'text'} value={val(p, k)} onChange={(e) => edit(p.id, k, e.target.value)} /></td>
                      ))}
                      <td><Button variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b bg-slate-50 text-left"><th className="px-2 py-2">আইটেম</th><th>নাম</th><th>রেট</th><th>প্যাকে কত (টেপ: রোলে কত ফুট)</th><th /></tr></thead>
              <tbody>
                {hw.data.map((p) => (
                  <tr key={p.id} className={edits[p.id] ? 'bg-amber-50' : 'border-b'}>
                    <td className="px-1 py-1"><Select className="h-8" value={val(p, 'item_key')} onChange={(e) => edit(p.id, 'item_key', e.target.value)}>{CW_HW_ITEMS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</Select></td>
                    <td className="px-1"><Input className="h-8" value={val(p, 'item_name')} onChange={(e) => edit(p.id, 'item_name', e.target.value)} /></td>
                    <td className="px-1"><Input className="h-8 w-24" type="number" value={val(p, 'rate')} onChange={(e) => edit(p.id, 'rate', e.target.value)} /></td>
                    <td className="px-1"><Input className="h-8 w-24" type="number" value={val(p, 'pack_qty')} onChange={(e) => edit(p.id, 'pack_qty', e.target.value)} /></td>
                    <td><Button variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-xs text-muted-foreground">মাস্কিং / নটন টেপ: রেট = এক রোলের দাম, প্যাকে কত = রোলে কত ফুট। বাকিগুলোর রেট প্রতি পিস।</p>
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="মুছবেন?"
        message={del ? (del.die_no || del.item_name || '') : ''}
        onConfirm={async () => { await Entity.delete(del.id); setDel(null); qc.invalidateQueries({ queryKey: key }); }}
      />
    </div>
  );
}
