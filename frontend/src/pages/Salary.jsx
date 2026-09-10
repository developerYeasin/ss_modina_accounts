import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Users, Pencil, Trash2, Download, HandCoins, Printer, ArrowLeft } from 'lucide-react';
import { Salary, Staff } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Input,
  Select, Dialog, Field, Checkbox, ConfirmDialog, Tabs, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
  PageHeader, DataTable, StatCard, EmptyState, PAYMENT_METHODS,
  PrintDoc, PrintTable, PrintTotals,
} from '@/components/shared';
import { BN_MONTH_NAMES, bnDate, downloadCsv, isoDate, money, num, toBnDigits } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const staffBlank = { name: '', position: '', phone: '', base_salary: '', active: true };

/** Net = base + lunch allowance − advance − owner due + previous due. */
const computeNet = (row, lunchRate) =>
  num(row.base_salary_snapshot)
  + num(row.lunch_days) * num(lunchRate)
  - num(row.advance)
  - num(row.owner_due)
  + num(row.previous_due);

export default function SalaryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const now = new Date();
  const [tab, setTab] = useState('sheet');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [deleteAdvance, setDeleteAdvance] = useState(null);
  // null | 'sheet' | a staff row — what is on the printer right now.
  const [printing, setPrinting] = useState(null);

  const { data: sheet, isLoading, error, refetch } = useQuery({
    queryKey: ['salary-sheet', year, month],
    queryFn: () => Salary.sheet(year, month),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'], queryFn: () => Staff.list('-created_date', 200),
  });

  const { data: advanceData, refetch: refetchAdvances } = useQuery({
    queryKey: ['salary-advances', year, month],
    queryFn: () => Salary.advances(year, month),
  });
  const advances = advanceData?.entries || [];

  /** Advances and the sheet read the same rows, so refresh both together. */
  const refreshAdvances = () => {
    refetchAdvances();
    refetch();
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  useEffect(() => {
    if (sheet) setRows(sheet.rows);
  }, [sheet]);

  const lunchRate = sheet?.lunch_rate || 0;
  const setRow = (staffId, key, value) =>
    setRows((list) => list.map((r) => (r.staff_id === staffId ? { ...r, [key]: value } : r)));

  const totalNet = rows.reduce((a, r) => a + computeNet(r, lunchRate), 0);
  const totalAdvance = rows.reduce((a, r) => a + num(r.advance), 0);
  const totalBase = rows.reduce((a, r) => a + num(r.base_salary_snapshot), 0);

  async function save() {
    setBusy(true);
    try {
      await Salary.save({ year, month, rows });
      queryClient.invalidateQueries({ queryKey: ['salary-sheet'] });
      toast({ title: 'স্যালারি শিট সংরক্ষিত হয়েছে' });
      refetch();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (printing) {
    const period = `${BN_MONTH_NAMES[month - 1]} ${toBnDigits(year)}`;
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
        {printing === 'sheet' ? (
          <SalarySheetPrint
            period={period} rows={rows} lunchRate={lunchRate} currency={currency}
            totals={{ base: totalBase, advance: totalAdvance, net: totalNet }}
          />
        ) : (
          <SalarySlip row={printing} period={period} lunchRate={lunchRate} currency={currency} />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="স্যালারি"
        subtitle={`${BN_MONTH_NAMES[month - 1]} ${toBnDigits(year)} · লাঞ্চ রেট ${money(lunchRate, currency)}`}
        actions={
          tab === 'sheet' ? (
            <>
              <Button
                variant="outline" size="sm"
                onClick={() => downloadCsv(`salary-${year}-${month}`, rows.map((r) => ({
                  ...r, net_payment: computeNet(r, lunchRate),
                })))}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPrinting('sheet')}>
                <Printer className="h-4 w-4" /> মাসিক প্রিন্ট
              </Button>
              <Button size="sm" loading={busy} onClick={save}>
                <Save className="h-4 w-4" /> সংরক্ষণ
              </Button>
            </>
          ) : tab === 'advance' ? (
            <>
              <Button
                variant="outline" size="sm"
                onClick={() => downloadCsv(`advances-${year}-${month}`, advances, [
                  { key: 'date', label: 'Date' },
                  { key: 'staff_name', label: 'Staff' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'method', label: 'Method' },
                  { key: 'notes', label: 'Notes' },
                ])}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" onClick={() => setAdvanceOpen(true)}>
                <Plus className="h-4 w-4" /> অগ্রিম দিন
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setEditingStaff(staffBlank)}>
              <Plus className="h-4 w-4" /> নতুন কর্মী
            </Button>
          )
        }
      />

      <Tabs
        tabs={[
          { value: 'sheet', label: 'মাসিক শিট' },
          { value: 'advance', label: 'অগ্রিম', count: advances.length },
          { value: 'staff', label: 'কর্মী', count: staff.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'sheet' ? (
        <>
          <Card className="mb-4">
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="বছর">
                <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                    <option key={y} value={y}>{toBnDigits(y)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="মাস">
                <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {BN_MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
              </Field>
              <StatCard label="মোট বেতন" value={totalBase} currency={currency} tone="primary" />
              <StatCard label="নিট প্রদেয়" value={totalNet} currency={currency} tone="success" />
            </CardContent>
          </Card>

          {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
            rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="কোনো সক্রিয় কর্মী নেই"
                description="কর্মী ট্যাব থেকে কর্মী যোগ করুন।"
                action={<Button size="sm" onClick={() => { setTab('staff'); setEditingStaff(staffBlank); }}>
                  <Plus className="h-4 w-4" /> কর্মী যোগ করুন
                </Button>}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>কর্মী</th>
                      <th className="text-right">মূল বেতন</th>
                      <th className="text-right">ডিউটি দিন</th>
                      <th className="text-right">অনুপস্থিত</th>
                      <th className="text-right">শুক্রবার</th>
                      <th className="text-right">লাঞ্চ দিন</th>
                      <th className="text-right">লাঞ্চ ভাতা</th>
                      <th className="text-right">অগ্রিম (মাসে নেওয়া)</th>
                      <th className="text-right">মালিকের পাওনা</th>
                      <th className="text-right">পূর্বের বাকি</th>
                      <th className="text-right">নিট প্রদেয়</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.staff_id}>
                        <td>
                          <p className="font-medium">{r.staff_name}</p>
                          <p className="text-xs text-muted-foreground">{r.position}</p>
                        </td>
                        {[
                          'base_salary_snapshot', 'duty_days', 'absent_days', 'friday_count',
                          'lunch_days',
                        ].map((key) => (
                          <td key={key} className="text-right">
                            <Input
                              type="number" step="0.01"
                              className="h-8 w-24 text-right"
                              value={r[key]}
                              onChange={(e) => setRow(r.staff_id, key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="num text-right text-muted-foreground">
                          {money(num(r.lunch_days) * num(lunchRate), currency)}
                        </td>
                        <td className="num text-right">
                          <button
                            type="button"
                            onClick={() => setTab('advance')}
                            className="font-medium text-primary hover:underline"
                            title="অগ্রিম ট্যাব থেকে যোগ বা বাদ করুন"
                          >
                            {money(r.advance, currency)}
                          </button>
                        </td>
                        {['owner_due', 'previous_due'].map((key) => (
                          <td key={key} className="text-right">
                            <Input
                              type="number" step="0.01"
                              className="h-8 w-24 text-right"
                              value={r[key]}
                              onChange={(e) => setRow(r.staff_id, key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="num text-right font-bold">
                          <span className="inline-flex items-center gap-2">
                            {money(computeNet(r, lunchRate), currency)}
                            <button
                              type="button"
                              onClick={() => setPrinting(r)}
                              title="স্যালারি স্লিপ প্রিন্ট"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/40 font-semibold">
                    <tr>
                      <td>সর্বমোট</td>
                      <td className="num text-right">{money(totalBase, currency)}</td>
                      <td colSpan={5} />
                      <td className="num text-right">{money(totalAdvance, currency)}</td>
                      <td colSpan={2} />
                      <td className="num text-right">{money(totalNet, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </>
      ) : tab === 'advance' ? (
        <>
          <Card className="mb-4">
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="বছর">
                <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                    <option key={y} value={y}>{toBnDigits(y)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="মাস">
                <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {BN_MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
              </Field>
              <StatCard
                label="এই মাসে অগ্রিম"
                value={advanceData?.total || 0}
                currency={currency} tone="danger" icon={HandCoins}
              />
              <StatCard label="এন্ট্রি" value={advances.length} currency={false} tone="info" />
            </CardContent>
          </Card>

          {advanceData?.by_staff?.length > 0 && (
            <Card className="mb-4">
              <CardHeader><CardTitle>কর্মীভিত্তিক মোট</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {advanceData.by_staff.map((s) => (
                  <div key={s.staff_id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{s.staff_name}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-muted-foreground">{s.count} বার</span>
                      <span className="num font-semibold text-destructive">
                        {money(s.total, currency)}
                      </span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <DataTable
            columns={[
              { key: 'date', label: 'তারিখ', render: (a) => bnDate(a.date) },
              { key: 'staff_name', label: 'কর্মী', render: (a) => (
                <span className="font-medium">{a.staff_name}</span>
              ) },
              { key: 'method', label: 'মাধ্যম' },
              { key: 'notes', label: 'নোট', render: (a) => a.notes || '—' },
              { key: 'amount', label: 'পরিমাণ', align: 'right', render: (a) => (
                <span className="num font-semibold text-destructive">{money(a.amount, currency)}</span>
              ) },
              { key: 'actions', label: '', align: 'right', render: (a) => (
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setDeleteAdvance(a)}
                  aria-label="মুছুন"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) },
            ]}
            rows={advances}
            empty={
              <EmptyState
                icon={HandCoins}
                title="এই মাসে কোনো অগ্রিম নেই"
                description="কর্মীকে অগ্রিম দিলে তা এখানে জমা হবে, খরচের খাতায় যোগ হবে এবং মাসিক বেতন থেকে কাটা পড়বে।"
                action={<Button size="sm" onClick={() => setAdvanceOpen(true)}>
                  <Plus className="h-4 w-4" /> অগ্রিম দিন
                </Button>}
              />
            }
            mobileCard={(a) => (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.staff_name}</span>
                  <span className="num font-semibold text-destructive">
                    {money(a.amount, currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[bnDate(a.date), a.method, a.notes].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}
          />
        </>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'নাম', render: (s) => <span className="font-medium">{s.name}</span> },
            { key: 'position', label: 'পদ', render: (s) => s.position || '—' },
            { key: 'phone', label: 'মোবাইল', render: (s) => s.phone || '—' },
            { key: 'base_salary', label: 'মূল বেতন', align: 'right', render: (s) => (
              <span className="num">{money(s.base_salary, currency)}</span>
            ) },
            { key: 'active', label: 'অবস্থা', render: (s) => (
              <Badge variant={s.active ? 'success' : 'secondary'}>
                {s.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
              </Badge>
            ) },
            { key: 'actions', label: '', align: 'right', render: (s) => (
              <span className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingStaff(s)} aria-label="সম্পাদনা">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)} aria-label="মুছুন">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </span>
            ) },
          ]}
          rows={staff}
          empty={
            <EmptyState
              icon={Users}
              title="কোনো কর্মী নেই"
              action={<Button size="sm" onClick={() => setEditingStaff(staffBlank)}><Plus className="h-4 w-4" /> যোগ করুন</Button>}
            />
          }
        />
      )}

      <StaffDialog
        staff={editingStaff}
        onClose={() => setEditingStaff(null)}
        onSaved={() => {
          setEditingStaff(null);
          queryClient.invalidateQueries({ queryKey: ['staff-all'] });
          queryClient.invalidateQueries({ queryKey: ['staff'] });
          refetch();
        }}
      />

      <AdvanceDialog
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        staff={staff.filter((s) => s.active)}
        year={year}
        month={month}
        onSaved={() => { setAdvanceOpen(false); refreshAdvances(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteAdvance)}
        onClose={() => setDeleteAdvance(null)}
        title="অগ্রিম মুছবেন?"
        message={`${deleteAdvance?.staff_name} — ${money(deleteAdvance?.amount, currency)}। খরচের খাতা থেকেও এন্ট্রিটি মুছে যাবে।`}
        onConfirm={async () => {
          await Salary.deleteAdvance(deleteAdvance.id);
          refreshAdvances();
          toast({ title: 'অগ্রিম মুছে ফেলা হয়েছে' });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="কর্মী মুছবেন?"
        message={`${deleteTarget?.name} — এই কর্মীর স্যালারি এন্ট্রিগুলোও মুছে যাবে।`}
        onConfirm={async () => {
          await Staff.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['staff-all'] });
          refetch();
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function StaffDialog({ staff, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(staffBlank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(staff?.id);

  const key = staff?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...staffBlank, ...(staff || {}) });
  }

  async function save() {
    if (!String(form.name).trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await Staff.update(staff.id, form);
      else await Staff.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'কর্মী যোগ হয়েছে' });
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
      open={Boolean(staff)}
      onClose={onClose}
      title={isEdit ? 'কর্মী সম্পাদনা' : 'নতুন কর্মী'}
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
        <Field label="পদ">
          <Input value={form.position || ''} onChange={(e) => set('position', e.target.value)} />
        </Field>
        <Field label="মোবাইল">
          <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="মূল বেতন (মাসিক)">
          <Input
            type="number" step="0.01" value={form.base_salary}
            onChange={(e) => set('base_salary', e.target.value)}
          />
        </Field>
        <Field label="যোগদানের তারিখ">
          <Input
            type="date" value={form.joined_date || ''}
            onChange={(e) => set('joined_date', e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox checked={form.active} onChange={(v) => set('active', v)} label="সক্রিয় কর্মী" />
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Hand an advance to a staff member. The backend books a matching expense, so
 * the cash shows up in খরচ and the month's salary drops by the same amount —
 * nothing has to be typed twice.
 */
function AdvanceDialog({ open, onClose, staff, year, month, onSaved }) {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [form, setForm] = useState({
    staff_id: '', date: isoDate(), amount: '', method: 'Cash', notes: '',
  });
  const [busy, setBusy] = useState(false);

  const selected = staff.find((s) => s.id === form.staff_id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.staff_id) {
      toast({ title: 'কর্মী নির্বাচন করুন', variant: 'destructive' });
      return;
    }
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await Salary.addAdvance(form);
      toast({ title: 'অগ্রিম যোগ হয়েছে', description: 'খরচের খাতায়ও যুক্ত হয়েছে' });
      setForm({ staff_id: '', date: isoDate(), amount: '', method: 'Cash', notes: '' });
      onSaved();
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="কর্মীকে অগ্রিম"
      description={`${BN_MONTH_NAMES[month - 1]} ${toBnDigits(year)} — মাসিক বেতন থেকে কাটা পড়বে`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="কর্মী" required className="sm:col-span-2">
          <Select value={form.staff_id} onChange={(e) => set('staff_id', e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.position ? ` — ${s.position}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="তারিখ" required>
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="পরিমাণ" required>
          <Input
            type="number" step="0.01" min="0" autoFocus value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </Field>
        <Field label="মাধ্যম">
          <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="নোট">
          <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {selected && (
          <div className="divide-y rounded-lg border border-white/60 bg-white/60 p-3 sm:col-span-2">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">মূল বেতন</span>
              <span className="num font-medium">{money(selected.base_salary, currency)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">এই অগ্রিমের পর অবশিষ্ট</span>
              <span className="num font-semibold">
                {money(num(selected.base_salary) - num(form.amount), currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The month's whole sheet on one page — what the owner signs off on. */
function SalarySheetPrint({ period, rows, lunchRate, currency, totals }) {
  return (
    <PrintDoc
      title="মাসিক বেতন শিট"
      copyLabel="অফিস কপি"
      meta={[['মাস', period], ['কর্মী', toBnDigits(rows.length)]]}
      signatures={['হিসাবরক্ষক', 'মালিকের স্বাক্ষর']}
      footerNote="বেতন বুঝে পেলাম — কর্মীর স্বাক্ষর নিয়ে সংরক্ষণ করুন।"
    >
      <PrintTable
        head={[
          { label: 'ক্র.', width: '34px', align: 'center' },
          { label: 'কর্মীর নাম' },
          { label: 'পদ', width: '96px' },
          { label: 'মূল বেতন', align: 'right', width: '86px' },
          { label: 'ডিউটি', align: 'right', width: '54px' },
          { label: 'অনুপ.', align: 'right', width: '54px' },
          { label: 'লাঞ্চ ভাতা', align: 'right', width: '86px' },
          { label: 'অগ্রিম', align: 'right', width: '86px' },
          { label: 'পূর্বের বাকি', align: 'right', width: '86px' },
          { label: 'নিট প্রদেয়', align: 'right', width: '96px' },
          { label: 'স্বাক্ষর', width: '90px' },
        ]}
        foot={(
          <tfoot>
            <tr>
              <td colSpan={3}>সর্বমোট</td>
              <td className="num" style={{ textAlign: 'right' }}>{money(totals.base, currency)}</td>
              <td colSpan={3} />
              <td className="num" style={{ textAlign: 'right' }}>{money(totals.advance, currency)}</td>
              <td />
              <td className="num" style={{ textAlign: 'right' }}>{money(totals.net, currency)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      >
        {rows.map((r, i) => (
          <tr key={r.staff_id}>
            <td className="num" style={{ textAlign: 'center' }}>{i + 1}</td>
            <td style={{ fontWeight: 600 }}>{r.staff_name}</td>
            <td>{r.position || '—'}</td>
            <td className="num" style={{ textAlign: 'right' }}>{money(r.base_salary_snapshot, currency)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{num(r.duty_days)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{num(r.absent_days)}</td>
            <td className="num" style={{ textAlign: 'right' }}>
              {money(num(r.lunch_days) * num(lunchRate), currency)}
            </td>
            <td className="num" style={{ textAlign: 'right' }}>{money(r.advance, currency)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{money(r.previous_due, currency)}</td>
            <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>
              {money(computeNet(r, lunchRate), currency)}
            </td>
            <td />
          </tr>
        ))}
      </PrintTable>
    </PrintDoc>
  );
}

/** One কর্মীর স্যালারি স্লিপ — the paper handed over with the money. */
function SalarySlip({ row, period, lunchRate, currency }) {
  const lunch = num(row.lunch_days) * num(lunchRate);
  return (
    <PrintDoc
      title="স্যালারি স্লিপ"
      copyLabel="কর্মী কপি"
      meta={[['মাস', period], ['কর্মী', row.staff_name]]}
      signatures={['কর্মীর স্বাক্ষর', 'মালিকের স্বাক্ষর']}
      footerNote="উপরের টাকা বুঝে পেলাম।"
    >
      <section className="print-parties">
        <div>
          <p className="print-party-label">কর্মীর তথ্য</p>
          <p className="print-party-name">{row.staff_name}</p>
          <p>পদ: {row.position || '—'}</p>
          <p>মাস: {period}</p>
        </div>
        <div>
          <p className="print-party-label">উপস্থিতি</p>
          <p>ডিউটি দিন: {num(row.duty_days)}</p>
          <p>অনুপস্থিত: {num(row.absent_days)}</p>
          <p>শুক্রবার: {num(row.friday_count)} · লাঞ্চ দিন: {num(row.lunch_days)}</p>
        </div>
      </section>

      <PrintTable
        head={[{ label: 'বিবরণ' }, { label: 'টাকা', align: 'right', width: '140px' }]}
      >
        <tr><td>মূল বেতন</td>
          <td className="num" style={{ textAlign: 'right' }}>{money(row.base_salary_snapshot, currency)}</td></tr>
        <tr><td>লাঞ্চ ভাতা ({num(row.lunch_days)} দিন × {money(lunchRate, currency)})</td>
          <td className="num" style={{ textAlign: 'right' }}>{money(lunch, currency)}</td></tr>
        <tr><td>পূর্বের বাকি</td>
          <td className="num" style={{ textAlign: 'right' }}>{money(row.previous_due, currency)}</td></tr>
        <tr><td>অগ্রিম (মাসে নেওয়া)</td>
          <td className="num" style={{ textAlign: 'right' }}>− {money(row.advance, currency)}</td></tr>
        <tr><td>মালিকের পাওনা</td>
          <td className="num" style={{ textAlign: 'right' }}>− {money(row.owner_due, currency)}</td></tr>
      </PrintTable>

      <PrintTotals
        rows={[
          { label: 'মোট প্রাপ্য', value: money(num(row.base_salary_snapshot) + lunch + num(row.previous_due), currency) },
          { label: 'মোট কর্তন', value: money(num(row.advance) + num(row.owner_due), currency) },
          { label: 'নিট প্রদেয়', value: money(computeNet(row, lunchRate), currency), strong: true },
        ]}
      />
    </PrintDoc>
  );
}
