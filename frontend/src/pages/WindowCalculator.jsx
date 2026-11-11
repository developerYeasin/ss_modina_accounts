import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Eraser } from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Field, Loading, ErrorState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { useMapProducts, useSavedState } from '@/hooks/useMapProducts';
import {
  WINDOW_CATEGORIES, computeWindow, profilesForCategory, companiesFor, coloursFor,
  glassColours, glassMMs, barLines, defaultFittingCharge,
} from '@/lib/mapCalc';
import { money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const newWindow = (category = '3inch') => ({
  id: Date.now() + Math.random(), heightRaw: '', widthRaw: '', qty: 1, category, netWheelQty: 2, rateOverrides: {},
});
const DEFAULT_SETTINGS = {
  company: '', colour: '', discountPct: '', fittingCharge: '', glassColour: '', glassMM: '', glassRate: '',
};
const f2 = (n) => (Math.round(n * 100) / 100).toLocaleString('en-IN');

/**
 * জানালা ম্যাপ ক্যালকুলেটর — Height/Width দিলে থাই প্রোফাইল (বার প্ল্যানসহ),
 * হার্ডওয়্যার, গ্লাস, ফিটিং মিলিয়ে প্রতিটা জানালার পুরো বিল।
 */
export default function WindowCalculator() {
  const { currency } = useSettings();
  const { data: products = [], isLoading, error, refetch } = useMapProducts();
  const [settings, setSettings] = useSavedState('calc.window.settings', DEFAULT_SETTINGS);
  const [windows, setWindows] = useSavedState('calc.window.rows', [newWindow()]);
  const [open, setOpen] = useState({});

  const allProfiles = useMemo(() => profilesForCategory(products, ''), [products]);
  const companies = useMemo(() => companiesFor(allProfiles), [allProfiles]);
  const colours = useMemo(() => coloursFor(allProfiles, settings.company), [allProfiles, settings.company]);
  const gColours = useMemo(() => glassColours(products), [products]);
  const gMMs = useMemo(() => glassMMs(products, settings.glassColour), [products, settings.glassColour]);

  const results = useMemo(
    () => windows.map((w) => computeWindow({ ...settings, ...w }, products)),
    [windows, settings, products],
  );
  const total = results.reduce((a, r) => ({
    qty: a.qty + r.qty, sqft: a.sqft + r.totalSqft, bill: a.bill + r.grandTotal,
  }), { qty: 0, sqft: 0, bill: 0 });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v, ...(k === 'company' ? { colour: '' } : {}), ...(k === 'glassColour' ? { glassMM: '' } : {}) }));
  const upd = (id, k, v) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, [k]: v } : w)));
  const updRate = (id, key, v) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, rateOverrides: { ...w.rateOverrides, [key]: v } } : w)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="জানালা ম্যাপ ক্যালকুলেটর"
        subtitle="Height/Width লিখুন — থাই প্রোফাইল, হার্ডওয়্যার, গ্লাস মিলিয়ে প্রতিটা জানালার পুরো হিসাব"
        print
        actions={(
          <Button variant="outline" size="sm" onClick={() => { setWindows([newWindow()]); setOpen({}); }}>
            <Eraser className="h-4 w-4" /> সব মুছুন
          </Button>
        )}
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="কোম্পানি">
            <Select value={settings.company} onChange={(e) => set('company', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="কালার (প্রোফাইল)">
            <Select value={settings.colour} onChange={(e) => set('colour', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {colours.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="ডিসকাউন্ট (% প্রোফাইলে)">
            <Input type="number" inputMode="decimal" value={settings.discountPct} onChange={(e) => set('discountPct', e.target.value)} />
          </Field>
          <Field label="ফিটিং চার্জ (৳/Sq.Ft)" hint={'খালি = অটো (৩" = ৩০, ৪" নেট সহ = ৪০)'}>
            <Input type="number" inputMode="decimal" placeholder="অটো" value={settings.fittingCharge} onChange={(e) => set('fittingCharge', e.target.value)} />
          </Field>
          <Field label="গ্লাস কালার">
            <Select value={settings.glassColour} onChange={(e) => set('glassColour', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {gColours.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="গ্লাস M.M">
            <Select value={settings.glassMM} onChange={(e) => set('glassMM', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {gMMs.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="গ্লাস রেট (৳/Sq.Ft)" hint="খালি = Product DB থেকে">
            <Input type="number" inputMode="decimal" placeholder={String(results[0]?.glassRate || 'অটো')} value={settings.glassRate} onChange={(e) => set('glassRate', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {!settings.company && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">⚠ উপরে কোম্পানি ও কালার বাছুন — তাহলে প্রোফাইলের কোড/রেট নিজে থেকেই বসবে।</p>}

      {windows.map((w, i) => {
        const r = results[i];
        const isOpen = open[w.id];
        return (
          <Card key={w.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">জানালা {i + 1} <span className="text-sm font-normal text-muted-foreground">· {r.sizeLabel}</span></p>
                <Button variant="ghost" size="icon" aria-label="মুছুন" onClick={() => setWindows((ws) => ws.filter((x) => x.id !== w.id))} disabled={windows.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="Height (ফুট-ইঞ্চি)"><Input placeholder="4-5" value={w.heightRaw} onChange={(e) => upd(w.id, 'heightRaw', e.target.value)} /></Field>
                <Field label="Width (ফুট-ইঞ্চি)"><Input placeholder="5-0" value={w.widthRaw} onChange={(e) => upd(w.id, 'widthRaw', e.target.value)} /></Field>
                <Field label="Qty"><Input type="number" inputMode="numeric" value={w.qty} onChange={(e) => upd(w.id, 'qty', e.target.value)} /></Field>
                <Field label="ক্যাটাগরি">
                  <Select value={w.category} onChange={(e) => upd(w.id, 'category', e.target.value)}>
                    {WINDOW_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </Field>
                {w.category === '4inch_net' && (
                  <Field label="Net Wheel">
                    <Select value={w.netWheelQty} onChange={(e) => upd(w.id, 'netWheelQty', Number(e.target.value))}>
                      <option value={2}>২ পিস</option><option value={4}>৪ পিস</option>
                    </Select>
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
                <span>Sq.Ft: <b>{f2(r.totalSqft)}</b></span>
                <span>প্রোফাইল: <b>{money(r.profileAmount, currency)}</b></span>
                <span>হার্ডওয়্যার: <b>{money(r.hardwareAmount, currency)}</b></span>
                <span>গ্লাস: <b>{money(r.glassAmount, currency)}</b></span>
                <span>ডিসকাউন্ট: <b>−{money(r.discountAmount, currency)}</b></span>
                <span>ফিটিং (৳{r.fittingRate}/Sq.Ft): <b>+{money(r.fittingTotal, currency)}</b></span>
                <span className="text-primary">মোট বিল: <b>{money(r.grandTotal, currency)}</b></span>
                <span className="text-primary">রেট: <b>৳{r.perSqft.toFixed(2)}/Sq.Ft</b></span>
              </div>

              <Button variant="outline" size="sm" onClick={() => setOpen((o) => ({ ...o, [w.id]: !isOpen }))}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} বিস্তারিত / BOM
              </Button>

              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="py-1">আইটেম</th><th>কোড</th><th>প্রতি জানালা</th><th>বিল পরিমাণ</th><th>রেট</th><th className="text-right">টাকা</th>
                    </tr></thead>
                    <tbody>
                      {r.profileRows.map((x) => (
                        <tr key={'p' + x.key} className="border-b align-top">
                          <td className="py-1">{x.name}{x.plan && <div className="text-xs text-muted-foreground">{barLines(x.plan).join(', ')}</div>}</td>
                          <td>{x.code || <Badge variant="warning">নেই</Badge>}</td>
                          <td>{f2(x.perWindowQty)} ফুট</td>
                          <td>{f2(x.totalQty)} ফুট</td>
                          <td><Input className="h-8 w-24" type="number" placeholder={String(x.rate)} value={w.rateOverrides?.['p:' + x.key] ?? ''} onChange={(e) => updRate(w.id, 'p:' + x.key, e.target.value)} /></td>
                          <td className="text-right">{money(x.amount, currency)}</td>
                        </tr>
                      ))}
                      {r.hardwareRows.map((x) => (
                        <tr key={'h' + x.key} className="border-b">
                          <td className="py-1">{x.name}</td>
                          <td>{x.code || <Badge variant="warning">নেই</Badge>}</td>
                          <td>{f2(x.perWindowQty)} {x.unit}</td>
                          <td>{f2(x.totalQty)} {x.unit}</td>
                          <td><Input className="h-8 w-24" type="number" placeholder={String(x.rate)} value={w.rateOverrides?.['h:' + x.key] ?? ''} onChange={(e) => updRate(w.id, 'h:' + x.key, e.target.value)} /></td>
                          <td className="text-right">{money(x.amount, currency)}</td>
                        </tr>
                      ))}
                      <tr className="border-b"><td className="py-1">গ্লাস</td><td>{settings.glassColour} {settings.glassMM}</td><td>{f2(r.perWindowSqft)} Sq.Ft</td><td>{f2(r.totalSqft)} Sq.Ft</td><td>{r.glassRate}</td><td className="text-right">{money(r.glassAmount, currency)}</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs text-muted-foreground">রেট বক্সে লিখলে শুধু এই জানালায় সেই রেট বসবে; খালি রাখলে Product DB-র রেট।</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button className="no-print" variant="outline" onClick={() => setWindows((ws) => [...ws, newWindow(ws[ws.length - 1]?.category)])}>
        <Plus className="h-4 w-4" /> নতুন জানালা যোগ করুন
      </Button>

      <Card className="border-primary/40">
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          <div><p className="text-muted-foreground">মোট জানালা</p><p className="text-lg font-bold">{total.qty}</p></div>
          <div><p className="text-muted-foreground">মোট Sq.Ft</p><p className="text-lg font-bold">{f2(total.sqft)}</p></div>
          <div><p className="text-muted-foreground">গড় রেট</p><p className="text-lg font-bold">৳{(total.sqft ? total.bill / total.sqft : 0).toFixed(2)}</p></div>
          <div><p className="text-muted-foreground">সর্বমোট বিল</p><p className="text-lg font-bold text-primary">{money(total.bill, currency)}</p></div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        মাপ লেখার নিয়ম: ৪ ফুট ৫ ইঞ্চি = 4-5 বা 4'-5" বা 4 5। ফিটিং চার্জ ডিফল্ট: ৩" = {defaultFittingCharge('3inch')}, ৪" নেট সহ = {defaultFittingCharge('4inch_net')} ৳/Sq.Ft।
      </p>
    </div>
  );
}
