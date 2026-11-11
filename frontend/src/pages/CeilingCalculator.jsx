import { useMemo } from 'react';
import { Plus, Trash2, Eraser } from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Field, Loading, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { useMapProducts, useSavedState } from '@/hooks/useMapProducts';
import {
  computeCeiling, ceilingProfiles, companiesFor, coloursFor, ceilBreakText, ceilFmt,
} from '@/lib/mapCalc';
import { money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const newRoom = () => ({ id: Date.now() + Math.random(), lengthRaw: '', widthRaw: '', qty: 1 });
const DEFAULTS = {
  category: 'thai', barFt: 21, xtInch: 27, company: '', colour: '', discountPct: '', carrying: '', fittingPerSqft: '',
  guna: '', board: '', rates: {},
};
const f2 = (n) => (Math.round(n * 100) / 100).toLocaleString('en-IN');

/**
 * সিলিং ম্যাপ ক্যালকুলেটর (থাই সিলিং) — ২'×২' খোপ। সাইড অ্যাঙ্গেল, Main T, Cross T,
 * স্ক্রু/প্লাগ/রিভেট আর প্যানেল — পরিমাণ ও টাকা।
 */
export default function CeilingCalculator() {
  const { currency } = useSettings();
  const { data: products = [], isLoading, error, refetch } = useMapProducts();
  const [s, setS] = useSavedState('calc.ceiling.settings', DEFAULTS);
  const [rooms, setRooms] = useSavedState('calc.ceiling.rooms', [newRoom()]);

  const profs = useMemo(() => ceilingProfiles(products), [products]);
  const c = useMemo(() => computeCeiling(rooms, s, products), [rooms, s, products]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const set = (k, v) => setS((x) => ({ ...x, [k]: v, ...(k === 'company' ? { colour: '' } : {}) }));
  const setRate = (k, v) => setS((x) => ({ ...x, rates: { ...x.rates, [k]: v } }));
  const upd = (id, k, v) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="সিলিং ম্যাপ ক্যালকুলেটর"
        subtitle="রুমের দৈর্ঘ্য × প্রস্থ দিন — ২'×২' খোপ ধরে প্রোফাইল, হার্ডওয়্যার ও প্যানেলের হিসাব"
        print
        actions={<Button variant="outline" size="sm" onClick={() => setRooms([newRoom()])}><Eraser className="h-4 w-4" /> সব মুছুন</Button>}
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="ক্যাটাগরি">
            <Select value={s.category || 'thai'} onChange={(e) => set('category', e.target.value)}>
              <option value="thai">থাই সিলিং</option><option value="powder">পাউডার কোড</option>
            </Select>
          </Field>
          <Field label="কোম্পানি">
            <Select value={s.company} onChange={(e) => set('company', e.target.value)}>
              <option value="">— বাছুন —</option>
              {companiesFor(profs).map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="কালার">
            <Select value={s.colour} onChange={(e) => set('colour', e.target.value)}>
              <option value="">— বাছুন —</option>
              {coloursFor(profs, s.company).map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="বোর্ড ক্যাটাগরি">
            <Select value={s.board} onChange={(e) => set('board', e.target.value)}>
              <option value="">যেকোনো</option><option value="pvc">PVC</option><option value="gypsum">জিপসাম</option>
            </Select>
          </Field>
          <Field label="বার Length (ফুট)"><Input type="number" value={s.barFt} onChange={(e) => set('barFt', e.target.value)} /></Field>
          <Field label="Cross T পিস (ইঞ্চি)"><Input type="number" value={s.xtInch} onChange={(e) => set('xtInch', e.target.value)} /></Field>
          <Field label="ডিসকাউন্ট (% প্রোফাইলে)"><Input type="number" value={s.discountPct} onChange={(e) => set('discountPct', e.target.value)} /></Field>
          <Field label="ফিটিং চার্জ (৳/Sq.Ft)"><Input type="number" value={s.fittingPerSqft} onChange={(e) => set('fittingPerSqft', e.target.value)} /></Field>
          <Field label="ক্যারিং চার্জ"><Input type="number" value={s.carrying} onChange={(e) => set('carrying', e.target.value)} /></Field>
          <Field label="গুনা (টাকা)"><Input type="number" value={s.guna} onChange={(e) => set('guna', e.target.value)} /></Field>
        </CardContent>
      </Card>

      {rooms.map((r, i) => (
          <Card key={r.id}>
            <CardContent className="grid grid-cols-[1fr_1fr_80px_40px] items-end gap-3 p-4">
              <Field label={`রুম ${i + 1} — দৈর্ঘ্য`}><Input placeholder="12-0" value={r.lengthRaw} onChange={(e) => upd(r.id, 'lengthRaw', e.target.value)} /></Field>
              <Field label="প্রস্থ"><Input placeholder="10-0" value={r.widthRaw} onChange={(e) => upd(r.id, 'widthRaw', e.target.value)} /></Field>
              <Field label="Qty (×)"><Input type="number" value={r.qty} onChange={(e) => upd(r.id, 'qty', e.target.value)} /></Field>
              <Button variant="ghost" size="icon" aria-label="মুছুন" disabled={rooms.length === 1} onClick={() => setRooms((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
      ))}
      <Button className="no-print" variant="outline" onClick={() => setRooms((rs) => [...rs, newRoom()])}><Plus className="h-4 w-4" /> নতুন রুম</Button>

      {c.rooms.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <span>মোট Sq.Ft: <b>{f2(c.sqft)}</b></span>
              <span>প্যানেল (২'×২'): <b>{c.panels} পিস</b></span>
              <span>সিলিং সংখ্যা: <b>{c.ceilings}</b></span>
              <span>সাইড অ্যাঙ্গেল: <b>{ceilBreakText(c.angle)}</b></span>
              <span>Main T: <b>{ceilFmt(c.mainT.barIn)} = {c.mainT.bars} পিস</b>{c.mainT.rem > 0 && <> (১টা Cut — লাগবে {ceilFmt(c.mainT.rem)})</>}</span>
              <span>Cross T ({c.xtPieces} পিস × {c.xtIn}"): <b>{ceilBreakText(c.xT)}</b></span>
            </div>
            {c.rooms.some((x) => x.uneven) && <p className="text-xs text-amber-700">⚠ কোনো রুমের মাপ ২ ফুটের গুণিতক নয় — শেষ খোপ ছোট হবে, পূর্ণ খোপ ধরে হিসাব করা হয়েছে।</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">আইটেম</th><th>পরিমাণ</th><th>রেট</th><th className="text-right">টাকা</th></tr></thead>
                <tbody>
                  {c.costLines.map((l) => (
                    <tr key={l.key} className="border-b">
                      <td className="py-1">{l.label}</td>
                      <td>{f2(l.qty)} {l.unit}</td>
                      <td><Input className="h-8 w-24" type="number" placeholder={l.rate != null ? String(l.rate) : 'নেই'} value={s.rates?.[l.key] ?? ''} onChange={(e) => setRate(l.key, e.target.value)} /></td>
                      <td className="text-right">{money(l.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {c.missing.length > 0 && <p className="text-xs text-amber-700">⚠ রেট নেই: {c.missing.join(', ')} — রেট বক্সে লিখুন বা ম্যাপ Product DB-তে "{s.category === 'powder' ? 'পাউডার কোড' : 'থাই সিলিং'}" ক্যাটাগরিতে যোগ করুন।</p>}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <span>প্রোফাইল: <b>{money(c.profileGross, currency)}</b></span>
              <span>ডিসকাউন্ট: <b>−{money(c.discount, currency)}</b></span>
              <span>হার্ডওয়্যার: <b>{money(c.hw, currency)}</b></span>
              <span>গুনা + ক্যারিং + ফিটিং: <b>{money(c.guna + c.carrying + c.fitting, currency)}</b></span>
              <span className="text-primary">সর্বমোট: <b>{money(c.grand, currency)}</b></span>
              <span className="text-primary">৳{c.perSqft.toFixed(2)} / Sq.Ft</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
