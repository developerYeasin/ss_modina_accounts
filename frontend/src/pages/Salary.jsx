import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Users, Pencil, Trash2, Download } from 'lucide-react';
import { Salary, Staff } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Input,
  Select, Dialog, Field, Checkbox, ConfirmDialog, Tabs, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DataTable, StatCard, EmptyState } from '@/components/shared';
import { BN_MONTH_NAMES, downloadCsv, money, num, toBnDigits } from '@/lib/utils';
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

  const { data: sheet, isLoading, error, refetch } = useQuery({
    queryKey: ['salary-sheet', year, month],
    queryFn: () => Salary.sheet(year, month),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'], queryFn: () => Staff.list('-created_date', 200),
  });

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
              <Button size="sm" loading={busy} onClick={save}>
                <Save className="h-4 w-4" /> সংরক্ষণ
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
                      <th className="text-right">অগ্রিম</th>
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
                        {['advance', 'owner_due', 'previous_due'].map((key) => (
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
                          {money(computeNet(r, lunchRate), currency)}
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
