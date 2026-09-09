import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { PriceCatalog } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Loading, Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, InfoRow } from '@/components/shared';
import { money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const TABS = [
  { value: 'thai-glass', label: 'থাই গ্লাস' },
  { value: 'aluminium', label: 'অ্যালুমিনিয়াম' },
  { value: 'ss', label: 'এসএস' },
];

export default function Calculators() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS.some((t) => t.value === kind) ? kind : 'thai-glass');

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['price-catalog'], queryFn: PriceCatalog.get,
  });

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="ক্যালকুলেটর"
        subtitle="মাপ ও দর দিয়ে খরচ, বিক্রয় ও লাভ হিসাব করুন"
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate('/price-lists')}>
            মূল্য তালিকা
          </Button>
        }
      />

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(v) => { setTab(v); navigate(`/calculator/${v}`, { replace: true }); }}
        className="mb-4"
      />

      {tab === 'thai-glass' && <ThaiGlassCalc catalog={catalog} />}
      {tab === 'aluminium' && <AluminiumCalc catalog={catalog} />}
      {tab === 'ss' && <SSCalc catalog={catalog} />}
    </div>
  );
}

/** Shared right-hand result panel. */
function Result({ rows, footer }) {
  const { toast } = useToast();
  const copy = () => {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join('\n');
    navigator.clipboard?.writeText(text)
      .then(() => toast({ title: 'কপি হয়েছে' }))
      .catch(() => toast({ title: 'কপি করা যায়নি', variant: 'destructive' }));
  };

  return (
    <Card className="lg:sticky lg:top-20 lg:self-start">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ফলাফল</CardTitle>
        <Button variant="ghost" size="icon" onClick={copy} aria-label="কপি">
          <Copy className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        {rows.map((r) => (
          <InfoRow
            key={r.label}
            label={r.label}
            value={r.strong ? <span className="text-base font-bold">{r.value}</span> : r.value}
          />
        ))}
        {footer}
      </CardContent>
    </Card>
  );
}

/* ------------------------- Thai glass ------------------------- */

function ThaiGlassCalc({ catalog }) {
  const { currency } = useSettings();
  const [glassId, setGlassId] = useState('');
  const [form, setForm] = useState({
    method: 'Square Feet', length: 0, width: 0, height: 0, quantity: 1,
    customMeasure: 0, sellingRate: 0, profitPercent: 0,
    labourCharge: 0, fittingCharge: 0, transportCharge: 0, otherCharge: 0,
  });

  const glass = catalog?.glass.find((g) => g.id === glassId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const calc = useMemo(() => {
    const w = num(form.width);
    const h = num(form.height);
    const qty = num(form.quantity) || 1;

    // Square Feet: w × h. Running Feet: the perimeter. Custom: the entered figure.
    const measure = form.method === 'Square Feet' ? w * h
      : form.method === 'Running Feet' ? 2 * (w + h)
        : num(form.customMeasure);

    const totalMeasure = measure * qty;
    const glassRate = num(glass?.rate);
    const materialCost = totalMeasure * glassRate;
    const cutting = num(glass?.cutting_cost) * qty;
    const fitting = (num(glass?.fitting_cost) * qty) + num(form.fittingCharge);
    const extras = num(form.labourCharge) + num(form.transportCharge) + num(form.otherCharge);
    const totalCost = materialCost + cutting + fitting + extras;

    // Selling either comes from an explicit rate, or from the profit margin.
    const bySellingRate = num(form.sellingRate) * totalMeasure;
    const byProfit = totalCost * (1 + num(form.profitPercent) / 100);
    const totalSelling = num(form.sellingRate) > 0 ? bySellingRate : byProfit;
    const profit = totalSelling - totalCost;

    return {
      measure, totalMeasure, glassRate, materialCost, cutting, fitting, extras,
      totalCost, totalSelling, profit,
      profitPercent: totalSelling > 0 ? (profit / totalSelling) * 100 : 0,
      perUnit: qty > 0 ? totalSelling / qty : 0,
    };
  }, [form, glass]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>থাই গ্লাসের হিসাব</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="গ্লাস" className="sm:col-span-2">
            <Select value={glassId} onChange={(e) => setGlassId(e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {catalog?.glass.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.glass_type} {g.thickness} — {money(g.rate, currency)}/{g.rate_unit?.replace('Per ', '')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="মাপের পদ্ধতি">
            <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
              <option value="Square Feet">বর্গফুট</option>
              <option value="Running Feet">রানিং ফুট</option>
              <option value="Custom">কাস্টম</option>
            </Select>
          </Field>

          {form.method === 'Custom' ? (
            <Field label="মাপ (প্রতি ইউনিট)">
              <Input
                type="number" step="0.01" value={form.customMeasure}
                onChange={(e) => set('customMeasure', e.target.value)}
              />
            </Field>
          ) : (
            <>
              <Field label="প্রস্থ (ফুট)">
                <Input
                  type="number" step="0.01" value={form.width}
                  onChange={(e) => set('width', e.target.value)}
                />
              </Field>
              <Field label="উচ্চতা (ফুট)">
                <Input
                  type="number" step="0.01" value={form.height}
                  onChange={(e) => set('height', e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="সংখ্যা">
            <Input
              type="number" step="1" min="1" value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </Field>

          <Field label="মজুরি">
            <Input
              type="number" step="0.01" value={form.labourCharge}
              onChange={(e) => set('labourCharge', e.target.value)}
            />
          </Field>
          <Field label="ফিটিং (অতিরিক্ত)">
            <Input
              type="number" step="0.01" value={form.fittingCharge}
              onChange={(e) => set('fittingCharge', e.target.value)}
            />
          </Field>
          <Field label="গাড়ি ভাড়া">
            <Input
              type="number" step="0.01" value={form.transportCharge}
              onChange={(e) => set('transportCharge', e.target.value)}
            />
          </Field>
          <Field label="অন্যান্য">
            <Input
              type="number" step="0.01" value={form.otherCharge}
              onChange={(e) => set('otherCharge', e.target.value)}
            />
          </Field>

          <Field label="বিক্রয় দর (প্রতি ইউনিট মাপ)" hint="দিলে লাভের হার উপেক্ষা করা হবে">
            <Input
              type="number" step="0.01" value={form.sellingRate}
              onChange={(e) => set('sellingRate', e.target.value)}
            />
          </Field>
          <Field label="লাভের হার (%)">
            <Input
              type="number" step="0.1" value={form.profitPercent}
              onChange={(e) => set('profitPercent', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Result
        rows={[
          { label: 'প্রতি ইউনিট মাপ', value: calc.measure.toFixed(2) },
          { label: 'মোট মাপ', value: calc.totalMeasure.toFixed(2) },
          { label: 'গ্লাসের দর', value: money(calc.glassRate, currency) },
          { label: 'ম্যাটেরিয়াল খরচ', value: money(calc.materialCost, currency) },
          { label: 'কাটিং', value: money(calc.cutting, currency) },
          { label: 'ফিটিং', value: money(calc.fitting, currency) },
          { label: 'অন্যান্য খরচ', value: money(calc.extras, currency) },
          { label: 'মোট খরচ', value: money(calc.totalCost, currency), strong: true },
          { label: 'মোট বিক্রয়', value: money(calc.totalSelling, currency), strong: true },
          { label: 'প্রতি পিস বিক্রয়', value: money(calc.perUnit, currency) },
          {
            label: 'লাভ',
            value: `${money(calc.profit, currency)} (${calc.profitPercent.toFixed(1)}%)`,
            strong: true,
          },
        ]}
      />
    </div>
  );
}

/* ------------------------- Aluminium ------------------------- */

function AluminiumCalc({ catalog }) {
  const { currency } = useSettings();
  const [profileId, setProfileId] = useState('');
  const [form, setForm] = useState({
    width: 0, height: 0, quantity: 1, labourPerSqft: 0,
    glassRate: 0, accessoryCost: 0, otherCharge: 0, profitPercent: 0,
  });

  const profile = catalog?.profile.find((p) => p.id === profileId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const calc = useMemo(() => {
    const w = num(form.width);
    const h = num(form.height);
    const qty = num(form.quantity) || 1;

    const area = w * h;
    const perimeter = 2 * (w + h);

    // Profile length follows the formula the price list declares.
    const formula = profile?.formula || 'perimeter';
    const lengthPerUnit = formula === 'perimeter' ? perimeter
      : formula === 'height' ? h * 2
        : formula === 'width' ? w * 2
          : num(profile?.length_per_piece) * num(profile?.pieces_per_window);

    const wasteFactor = 1 + num(profile?.waste_percent) / 100;
    const totalLength = lengthPerUnit * qty * wasteFactor;
    const profileCost = totalLength * num(profile?.price_per_foot);

    const glassCost = area * qty * num(form.glassRate);
    const labourCost = area * qty * num(form.labourPerSqft);
    const extras = num(form.accessoryCost) + num(form.otherCharge);
    const totalCost = profileCost + glassCost + labourCost + extras;
    const totalSelling = totalCost * (1 + num(form.profitPercent) / 100);

    return {
      area, perimeter, lengthPerUnit, totalLength, profileCost, glassCost,
      labourCost, extras, totalCost, totalSelling,
      profit: totalSelling - totalCost,
      perUnit: qty > 0 ? totalSelling / qty : 0,
    };
  }, [form, profile]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>অ্যালুমিনিয়াম হিসাব</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="প্রোফাইল" className="sm:col-span-2">
            <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {catalog?.profile.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.profile_name} — {money(p.price_per_foot, currency)}/ft ({p.formula})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="অপচয়" hint="মূল্য তালিকা থেকে">
            <Input readOnly className="bg-muted" value={`${profile?.waste_percent ?? 0}%`} />
          </Field>

          <Field label="প্রস্থ (ফুট)">
            <Input
              type="number" step="0.01" value={form.width}
              onChange={(e) => set('width', e.target.value)}
            />
          </Field>
          <Field label="উচ্চতা (ফুট)">
            <Input
              type="number" step="0.01" value={form.height}
              onChange={(e) => set('height', e.target.value)}
            />
          </Field>
          <Field label="সংখ্যা">
            <Input
              type="number" step="1" min="1" value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </Field>

          <Field label="গ্লাসের দর (প্রতি বর্গফুট)">
            <Select
              value={form.glassRate}
              onChange={(e) => set('glassRate', e.target.value)}
            >
              <option value={0}>নির্বাচন করুন</option>
              {catalog?.glass.map((g) => (
                <option key={g.id} value={g.rate}>
                  {g.glass_type} {g.thickness} — {money(g.rate, currency)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="মজুরি (প্রতি বর্গফুট)">
            <Input
              type="number" step="0.01" value={form.labourPerSqft}
              onChange={(e) => set('labourPerSqft', e.target.value)}
            />
          </Field>
          <Field label="এক্সেসরিজ খরচ">
            <Input
              type="number" step="0.01" value={form.accessoryCost}
              onChange={(e) => set('accessoryCost', e.target.value)}
            />
          </Field>
          <Field label="অন্যান্য">
            <Input
              type="number" step="0.01" value={form.otherCharge}
              onChange={(e) => set('otherCharge', e.target.value)}
            />
          </Field>
          <Field label="লাভের হার (%)">
            <Input
              type="number" step="0.1" value={form.profitPercent}
              onChange={(e) => set('profitPercent', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Result
        rows={[
          { label: 'ক্ষেত্রফল (বর্গফুট)', value: calc.area.toFixed(2) },
          { label: 'পরিসীমা (ফুট)', value: calc.perimeter.toFixed(2) },
          { label: 'প্রতি ইউনিট প্রোফাইল', value: `${calc.lengthPerUnit.toFixed(2)} ft` },
          { label: 'মোট প্রোফাইল (অপচয় সহ)', value: `${calc.totalLength.toFixed(2)} ft` },
          { label: 'প্রোফাইল খরচ', value: money(calc.profileCost, currency) },
          { label: 'গ্লাস খরচ', value: money(calc.glassCost, currency) },
          { label: 'মজুরি', value: money(calc.labourCost, currency) },
          { label: 'অন্যান্য', value: money(calc.extras, currency) },
          { label: 'মোট খরচ', value: money(calc.totalCost, currency), strong: true },
          { label: 'মোট বিক্রয়', value: money(calc.totalSelling, currency), strong: true },
          { label: 'প্রতি পিস', value: money(calc.perUnit, currency) },
          { label: 'লাভ', value: money(calc.profit, currency), strong: true },
        ]}
      />
    </div>
  );
}

/* ------------------------- SS ------------------------- */

function SSCalc({ catalog }) {
  const { currency } = useSettings();
  const [materialId, setMaterialId] = useState('');
  const [form, setForm] = useState({
    lengthFt: 0, quantity: 1, labourCharge: 0, otherCharge: 0,
    sellingRate: 0, profitPercent: 0,
  });

  const material = catalog?.ss.find((s) => s.id === materialId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const calc = useMemo(() => {
    const lengthFt = num(form.lengthFt);
    const qty = num(form.quantity) || 1;
    const totalLength = lengthFt * qty;
    const rate = num(material?.price);

    // Per Piece pricing ignores the length; every other type is length-based.
    const materialCost = material?.price_type === 'Per Piece' ? rate * qty : totalLength * rate;
    const extras = num(form.labourCharge) + num(form.otherCharge);
    const totalCost = materialCost + extras;

    const bySellingRate = num(form.sellingRate) * (material?.price_type === 'Per Piece' ? qty : totalLength);
    const byProfit = totalCost * (1 + num(form.profitPercent) / 100);
    const totalSelling = num(form.sellingRate) > 0 ? bySellingRate : byProfit;

    return {
      totalLength, rate, materialCost, extras, totalCost, totalSelling,
      profit: totalSelling - totalCost,
      perUnit: qty > 0 ? totalSelling / qty : 0,
    };
  }, [form, material]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>এসএস হিসাব</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ম্যাটেরিয়াল" className="sm:col-span-2">
            <Select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {catalog?.ss.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.material_name} {s.grade} — {money(s.price, currency)} ({s.price_type})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="দরের ধরন">
            <Input readOnly className="bg-muted" value={material?.price_type || '—'} />
          </Field>

          <Field label="লম্বা (ফুট / প্রতি পিস)">
            <Input
              type="number" step="0.01" value={form.lengthFt}
              onChange={(e) => set('lengthFt', e.target.value)}
            />
          </Field>
          <Field label="সংখ্যা">
            <Input
              type="number" step="1" min="1" value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </Field>
          <Field label="মজুরি">
            <Input
              type="number" step="0.01" value={form.labourCharge}
              onChange={(e) => set('labourCharge', e.target.value)}
            />
          </Field>
          <Field label="অন্যান্য">
            <Input
              type="number" step="0.01" value={form.otherCharge}
              onChange={(e) => set('otherCharge', e.target.value)}
            />
          </Field>
          <Field label="বিক্রয় দর" hint="দিলে লাভের হার উপেক্ষা করা হবে">
            <Input
              type="number" step="0.01" value={form.sellingRate}
              onChange={(e) => set('sellingRate', e.target.value)}
            />
          </Field>
          <Field label="লাভের হার (%)">
            <Input
              type="number" step="0.1" value={form.profitPercent}
              onChange={(e) => set('profitPercent', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Result
        rows={[
          { label: 'মোট লম্বা', value: `${calc.totalLength.toFixed(2)} ft` },
          { label: 'দর', value: money(calc.rate, currency) },
          { label: 'ম্যাটেরিয়াল খরচ', value: money(calc.materialCost, currency) },
          { label: 'অন্যান্য', value: money(calc.extras, currency) },
          { label: 'মোট খরচ', value: money(calc.totalCost, currency), strong: true },
          { label: 'মোট বিক্রয়', value: money(calc.totalSelling, currency), strong: true },
          { label: 'প্রতি পিস', value: money(calc.perUnit, currency) },
          { label: 'লাভ', value: money(calc.profit, currency), strong: true },
        ]}
      />
    </div>
  );
}
