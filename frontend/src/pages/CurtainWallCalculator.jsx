import { useMemo } from 'react';
import { Plus, Trash2, Eraser } from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Field, Loading, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import {
  useMapProducts, useCurtainWallProducts, useCurtainWallHardware, useSavedState,
} from '@/hooks/useMapProducts';
import {
  CW_COLOURS, CW_ANGLE_INCHES, CW_BAR_LENGTHS, CW_HW_ITEMS, computeCurtainWall, cwCompanies,
  cwMatchDies, glassColours, glassMMs, piecesText, fmtFt,
} from '@/lib/mapCalc';
import { money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const newRow = () => ({
  id: Date.now() + Math.random(), heightRaw: '', widthRaw: '', qty: 1, hCount: '', wCount: '',
  middleType: 'sbit', halfDie: '', mullionDie: '', maskingFeet: '', notanFeet: '',
});
const DEFAULTS = {
  company: '', colour: '', angleInch: 2, barLength: 21, gumTotal: '', glassColour: '', glassMM: '',
  glassRate: '', discountPct: '', fitPerSqft: '', carrying: '', rates: {},
};
const f2 = (n) => (Math.round(n * 100) / 100).toLocaleString('en-IN');

/** কার্টেন ওয়াল ক্যালকুলেটর — গ্রিড (খোপ) অনুযায়ী Half/Mullion বার, অ্যাঙ্গেল, গ্লাস, হার্ডওয়্যার ও বিল। */
export default function CurtainWallCalculator() {
  const { currency } = useSettings();
  const mp = useMapProducts();
  const cw = useCurtainWallProducts();
  const hw = useCurtainWallHardware();
  const [s, setS] = useSavedState('calc.cw.settings', DEFAULTS);
  const [rows, setRows] = useSavedState('calc.cw.rows', [newRow()]);

  const products = mp.data || [];
  const dies = cw.data || [];
  const hwRows = hw.data || [];
  const results = useMemo(
    () => rows.map((r) => computeCurtainWall(r, s, dies, hwRows, products, rows)),
    [rows, s, dies, hwRows, products],
  );

  if (mp.isLoading || cw.isLoading || hw.isLoading) return <Loading />;
  const err = mp.error || cw.error || hw.error;
  if (err) return <ErrorState error={err} onRetry={() => { mp.refetch(); cw.refetch(); hw.refetch(); }} />;

  const set = (k, v) => setS((x) => ({ ...x, [k]: v, ...(k === 'glassColour' ? { glassMM: '' } : {}) }));
  const setRate = (k, v) => setS((x) => ({ ...x, rates: { ...x.rates, [k]: v } }));
  const upd = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  const winTotal = results.reduce((a, r) => a + r.total, 0);
  const sqft = results.reduce((a, r) => a + r.glassSqftAll, 0);
  const grand = winTotal + (Number(s.carrying) || 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="কার্টেন ওয়াল ক্যালকুলেটর"
        subtitle="Height/Width ও খোপ সংখ্যা দিন — সেকশন বার, অ্যাঙ্গেল, গ্লাস, হার্ডওয়্যার ও মোট বিল"
        print
        actions={<Button variant="outline" size="sm" onClick={() => setRows([newRow()])}><Eraser className="h-4 w-4" /> সব মুছুন</Button>}
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="কোম্পানি">
            <Select value={s.company} onChange={(e) => set('company', e.target.value)}>
              <option value="">— বাছুন —</option>
              {cwCompanies(dies).map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="কালার">
            <Select value={s.colour} onChange={(e) => set('colour', e.target.value)}>
              <option value="">— বাছুন —</option>
              {CW_COLOURS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="ফিটিং অ্যাঙ্গেল / সেকশন (ইঞ্চি)">
            <Select value={s.angleInch} onChange={(e) => set('angleInch', Number(e.target.value))}>
              {CW_ANGLE_INCHES.map((x) => <option key={x} value={x}>{x}"</option>)}
            </Select>
          </Field>
          <Field label="বার Length">
            <Select value={s.barLength} onChange={(e) => set('barLength', Number(e.target.value))}>
              {CW_BAR_LENGTHS.map((x) => <option key={x} value={x}>{fmtFt(x)}</option>)}
            </Select>
          </Field>
          <Field label="গ্লাস কালার">
            <Select value={s.glassColour} onChange={(e) => set('glassColour', e.target.value)}>
              <option value="">—</option>
              {glassColours(products).map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="গ্লাস M.M">
            <Select value={s.glassMM} onChange={(e) => set('glassMM', e.target.value)}>
              <option value="">—</option>
              {glassMMs(products, s.glassColour).map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="গ্লাস রেট (৳/Sq.Ft)" hint="খালি = Product DB থেকে">
            <Input type="number" value={s.glassRate} onChange={(e) => set('glassRate', e.target.value)} />
          </Field>
          <Field label="সিলিকন গাম (মোট পিস)" hint="খালি = অটো">
            <Input type="number" value={s.gumTotal} onChange={(e) => set('gumTotal', e.target.value)} />
          </Field>
          <Field label="ডিসকাউন্ট (% প্রোফাইলে)"><Input type="number" value={s.discountPct} onChange={(e) => set('discountPct', e.target.value)} /></Field>
          <Field label="ফিটিং চার্জ (৳/Sq.Ft)"><Input type="number" value={s.fitPerSqft} onChange={(e) => set('fitPerSqft', e.target.value)} /></Field>
          <Field label="ক্যারিং চার্জ (মোট)"><Input type="number" value={s.carrying} onChange={(e) => set('carrying', e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">হার্ডওয়্যার রেট <span className="font-normal text-muted-foreground">(খালি = কার্টেন ওয়াল প্রোডাক্ট থেকে)</span></p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ key: 'angle', label: 'অ্যাঙ্গেল (৳/ফুট)' }, ...CW_HW_ITEMS.map((i) => ({ key: i.key, label: `${i.label} (৳/${i.unit})` }))].map((i) => (
              <Field key={i.key} label={i.label}>
                <Input type="number" value={s.rates?.[i.key] ?? ''} onChange={(e) => setRate(i.key, e.target.value)} />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      {rows.map((row, i) => {
        const c = results[i];
        const halfOpts = s.company ? cwMatchDies(dies, s.company, 'half', s.angleInch) : [];
        const mulOpts = s.company ? cwMatchDies(dies, s.company, row.middleType, s.angleInch) : [];
        return (
          <Card key={row.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">জানালা {i + 1} <span className="text-sm font-normal text-muted-foreground">· {c.sizeLabel}</span></p>
                <Button variant="ghost" size="icon" aria-label="মুছুন" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.id !== row.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Height"><Input placeholder="8-0" value={row.heightRaw} onChange={(e) => upd(row.id, 'heightRaw', e.target.value)} /></Field>
                <Field label="Width"><Input placeholder="10-6" value={row.widthRaw} onChange={(e) => upd(row.id, 'widthRaw', e.target.value)} /></Field>
                <Field label="Qty"><Input type="number" value={row.qty} onChange={(e) => upd(row.id, 'qty', e.target.value)} /></Field>
                <Field label="মিডল ধরন">
                  <Select value={row.middleType} onChange={(e) => upd(row.id, 'middleType', e.target.value)}>
                    <option value="sbit">S.Bit</option><option value="dbit">D.Bit</option>
                  </Select>
                </Field>
                <Field label="Height-এ খোপ (আড়াআড়ি)"><Input type="number" value={row.hCount} onChange={(e) => upd(row.id, 'hCount', e.target.value)} /></Field>
                <Field label="Width-এ খোপ (খাড়া কলাম)"><Input type="number" value={row.wCount} onChange={(e) => upd(row.id, 'wCount', e.target.value)} /></Field>
                <Field label="Half কোড">
                  <Select value={row.halfDie} onChange={(e) => upd(row.id, 'halfDie', e.target.value)}>
                    <option value="">অটো{c.halfDie ? `: ${c.halfDie.die_no}` : ''}</option>
                    {halfOpts.map((p) => <option key={p.id} value={p.die_no}>{p.die_no} — {p.size_mm}</option>)}
                  </Select>
                </Field>
                <Field label="Mullion কোড">
                  <Select value={row.mullionDie} onChange={(e) => upd(row.id, 'mullionDie', e.target.value)}>
                    <option value="">অটো{c.mullionDie ? `: ${c.mullionDie.die_no}` : ''}</option>
                    {mulOpts.map((p) => <option key={p.id} value={p.die_no}>{p.die_no} — {p.size_mm}</option>)}
                  </Select>
                </Field>
              </div>

              {c.rows > 0 && c.cols > 0 && (
                <p className="text-xs text-muted-foreground">
                  খোপ: {c.rows} × {c.cols} = {c.rows * c.cols}টা গ্লাস/জানালা · প্রতি খোপ {fmtFt(c.cellH)} × {fmtFt(c.cellW)} ·
                  Half: {piecesText(c.framePieces)} · Mullion: {piecesText(c.middlePieces)} · অ্যাঙ্গেল {c.angleCount}টা = {c.angleLabel}
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">আইটেম</th><th>পরিমাণ</th><th>রেট</th><th className="text-right">টাকা</th></tr></thead>
                  <tbody>
                    {c.lines.map((l) => (
                      <tr key={l.key} className="border-b">
                        <td className="py-1">{l.label}</td>
                        <td>{f2(l.qty)} {l.unit}</td>
                        <td>{l.rate != null ? `৳${f2(l.rate)}` : <span className="text-amber-700">রেট নেই</span>}</td>
                        <td className="text-right">{money(l.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.missing.length > 0 && <p className="text-xs text-amber-700">⚠ রেট পাওয়া যায়নি: {c.missing.join(', ')}</p>}
              <div className="grid grid-cols-2 gap-x-4 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
                <span>উপমোট: <b>{money(c.sub, currency)}</b></span>
                <span>ডিসকাউন্ট: <b>−{money(c.disc, currency)}</b></span>
                <span>ফিটিং: <b>+{money(c.fit, currency)}</b></span>
                <span className="text-primary">মোট: <b>{money(c.total, currency)}</b> (৳{c.perSqft.toFixed(2)}/Sq.Ft)</span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button className="no-print" variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}><Plus className="h-4 w-4" /> নতুন জানালা</Button>

      <Card className="border-primary/40">
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          <div><p className="text-muted-foreground">মোট Sq.Ft</p><p className="text-lg font-bold">{f2(sqft)}</p></div>
          <div><p className="text-muted-foreground">জানালার মোট</p><p className="text-lg font-bold">{money(winTotal, currency)}</p></div>
          <div><p className="text-muted-foreground">ক্যারিং</p><p className="text-lg font-bold">{money(Number(s.carrying) || 0, currency)}</p></div>
          <div><p className="text-muted-foreground">সর্বমোট (৳{(sqft ? grand / sqft : 0).toFixed(2)}/Sq.Ft)</p><p className="text-lg font-bold text-primary">{money(grand, currency)}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
