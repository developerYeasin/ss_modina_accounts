import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, X, Pencil } from 'lucide-react';
import { Setting, Branch, AuditLog, ExpenseCategories } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select,
  Textarea, Loading, Tabs, Badge, Dialog, ConfirmDialog, Checkbox,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DataTable, EmptyState } from '@/components/shared';
import { bnDate } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const TABS = [
  { value: 'business', label: 'ব্যবসার তথ্য' },
  { value: 'categories', label: 'খরচের খাত' },
  { value: 'branches', label: 'শাখা' },
  { value: 'audit', label: 'অডিট লগ' },
];

const branchBlank = { name: '', address: '', phone: '', manager: '', notes: '', active: true };

export default function SettingsPage() {
  const { setting, settingId, refetch: refetchSettings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'business');
  const [form, setForm] = useState(setting);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deleteBranch, setDeleteBranch] = useState(null);

  useEffect(() => {
    setForm(setting);
    try { setCategories(JSON.parse(setting.expense_categories || '[]')); } catch { setCategories([]); }
  }, [setting]);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all'], queryFn: () => Branch.list('name', 200),
  });
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs'], queryFn: () => AuditLog.list('-created_date', 200),
    enabled: tab === 'audit',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function saveSetting(extra = {}) {
    setBusy(true);
    try {
      const payload = { ...form, ...extra };
      if (settingId) await Setting.update(settingId, payload);
      else await Setting.create(payload);
      refetchSettings();
      queryClient.invalidateQueries({ queryKey: ['setting'] });
      toast({ title: 'সেটিংস সংরক্ষিত হয়েছে' });
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const saveCategories = (list) => {
    setCategories(list);
    saveSetting({ expense_categories: JSON.stringify(list) });
  };

  return (
    <div>
      <PageHeader
        title="সেটিংস"
        subtitle="ব্যবসার তথ্য, খরচের খাত ও শাখা"
        actions={
          tab === 'business' ? (
            <Button size="sm" loading={busy} onClick={() => saveSetting()}>
              <Save className="h-4 w-4" /> সংরক্ষণ
            </Button>
          ) : tab === 'branches' ? (
            <Button size="sm" onClick={() => setEditingBranch(branchBlank)}>
              <Plus className="h-4 w-4" /> নতুন শাখা
            </Button>
          ) : null
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'business' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>প্রতিষ্ঠানের পরিচয়</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="ব্যবসার নাম" className="sm:col-span-2">
                <Input value={form.business_name || ''} onChange={(e) => set('business_name', e.target.value)} />
              </Field>
              <Field label="সংক্ষিপ্ত নাম" hint="সাইডবারে দেখানো হয়">
                <Input value={form.short_name || ''} onChange={(e) => set('short_name', e.target.value)} />
              </Field>
              <Field label="সাব-টাইটেল">
                <Input value={form.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
              </Field>
              <Field label="লোগো URL" className="sm:col-span-2">
                <Input value={form.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} />
              </Field>
              <Field label="ঠিকানা" className="sm:col-span-2">
                <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
              </Field>
              <Field label="ফোন">
                <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="মুদ্রার চিহ্ন">
                <Input value={form.currency || ''} onChange={(e) => set('currency', e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>দায়িত্বপ্রাপ্ত ব্যক্তি</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="প্রোপাইটর">
                <Input value={form.proprietor || ''} onChange={(e) => set('proprietor', e.target.value)} />
              </Field>
              <Field label="প্রোপাইটরের ফোন">
                <Input value={form.proprietor_phone || ''} onChange={(e) => set('proprietor_phone', e.target.value)} />
              </Field>
              <Field label="ম্যানেজার">
                <Input value={form.manager || ''} onChange={(e) => set('manager', e.target.value)} />
              </Field>
              <Field label="ম্যানেজারের ফোন">
                <Input value={form.manager_phone || ''} onChange={(e) => set('manager_phone', e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>হিসাব ও ইনভয়েস</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="অর্ডার প্রিফিক্স" hint="যেমন SMTG → SMTG-000001">
                <Input value={form.order_prefix || ''} onChange={(e) => set('order_prefix', e.target.value)} />
              </Field>
              <Field label="লাঞ্চ রেট (প্রতি দিন)">
                <Input
                  type="number" step="0.01" value={form.lunch_rate ?? 0}
                  onChange={(e) => set('lunch_rate', e.target.value)}
                />
              </Field>
              <Field label="ডিফল্ট ট্যাক্স (%)">
                <Input
                  type="number" step="0.01" value={form.default_tax ?? 0}
                  onChange={(e) => set('default_tax', e.target.value)}
                />
              </Field>
              <Field label="রাউন্ডিং">
                <Select value={form.rounding || 'None'} onChange={(e) => set('rounding', e.target.value)}>
                  <option value="None">None</option>
                  <option value="Nearest1">Nearest 1</option>
                  <option value="Nearest5">Nearest 5</option>
                  <option value="Nearest10">Nearest 10</option>
                </Select>
              </Field>
              <Field label="ইনভয়েসের ফুটার" className="sm:col-span-2">
                <Textarea
                  value={form.invoice_footer || ''}
                  onChange={(e) => set('invoice_footer', e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>প্রিভিউ</CardTitle></CardHeader>
            <CardContent className="flex items-start gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-16 w-16 rounded-md object-contain" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
                  SS
                </div>
              )}
              <div className="text-sm">
                <p className="font-display text-lg font-bold">{form.business_name}</p>
                <p className="text-muted-foreground">{form.address}</p>
                <p className="text-muted-foreground">{form.phone}</p>
                <p className="mt-1 text-xs text-muted-foreground">{form.invoice_footer}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'categories' && (
        <Card className="mx-auto max-w-2xl">
          <CardHeader><CardTitle>খরচের খাত ({categories.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="নতুন খাতের নাম"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategory.trim()) {
                    saveCategories([...categories, newCategory.trim()]);
                    setNewCategory('');
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!newCategory.trim()) return;
                  saveCategories([...categories, newCategory.trim()]);
                  setNewCategory('');
                }}
              >
                <Plus className="h-4 w-4" /> যোগ
              </Button>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">কোনো খাত যোগ করা হয়নি।</p>
            ) : (
              <div className="divide-y rounded-lg border border-slate-200">
                {categories.map((c, i) => (
                  <div key={`${c}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-medium">{c}</span>
                    <span className="flex gap-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={async () => {
                          const to = window.prompt('খাতের নতুন নাম লিখুন', c);
                          if (!to || to.trim() === c) return;
                          try {
                            const r = await ExpenseCategories.rename(c, to.trim());
                            setCategories(r.categories);
                            refetchSettings();
                            queryClient.invalidateQueries({ queryKey: ['expenses'] });
                            toast({ title: 'নাম ঠিক হয়েছে', description: r.renamed ? `${r.renamed} টি পুরনো খরচও নতুন নামে গেছে` : undefined });
                          } catch (err) {
                            toast({ title: 'পরিবর্তন করা যায়নি', description: err.message, variant: 'destructive' });
                          }
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> নাম ঠিক করুন
                      </Button>
                      <Button
                        variant="ghost" size="icon" aria-label="মুছুন"
                        onClick={() => saveCategories(categories.filter((_, x) => x !== i))}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              খাতের নাম ঠিক করলে আগের সব খরচও নতুন নামে চলে যায়। খাত মুছলে পুরনো খরচ মুছে না।
            </p>
          </CardContent>
        </Card>
      )}

      {tab === 'branches' && (
        branchesLoading ? <Loading /> : (
          <DataTable
            columns={[
              { key: 'name', label: 'নাম', render: (b) => <span className="font-medium">{b.name}</span> },
              { key: 'address', label: 'ঠিকানা', render: (b) => b.address || '—' },
              { key: 'phone', label: 'ফোন', render: (b) => b.phone || '—' },
              { key: 'manager', label: 'ম্যানেজার', render: (b) => b.manager || '—' },
              { key: 'active', label: 'অবস্থা', render: (b) => (
                <Badge variant={b.active ? 'success' : 'secondary'}>
                  {b.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Badge>
              ) },
              { key: 'actions', label: '', align: 'right', render: (b) => (
                <span className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditingBranch(b)} aria-label="সম্পাদনা">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteBranch(b)} aria-label="মুছুন">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              ) },
            ]}
            rows={branches}
            empty={
              <EmptyState
                title="কোনো শাখা নেই"
                action={<Button size="sm" onClick={() => setEditingBranch(branchBlank)}><Plus className="h-4 w-4" /> শাখা যোগ করুন</Button>}
              />
            }
          />
        )
      )}

      {tab === 'audit' && (
        logsLoading ? <Loading /> : (
          <DataTable
            columns={[
              { key: 'created_date', label: 'সময়', render: (l) => bnDate(l.datetime || l.created_date) },
              { key: 'action', label: 'কাজ', render: (l) => <span className="font-medium">{l.action}</span> },
              { key: 'record_type', label: 'ধরন', render: (l) => l.record_type || '—' },
              { key: 'user_name', label: 'ব্যবহারকারী', render: (l) => l.user_name || '—' },
              { key: 'new_value', label: 'বিবরণ', render: (l) => (
                <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                  {l.new_value || l.old_value || '—'}
                </span>
              ) },
            ]}
            rows={logs}
            empty={<EmptyState title="কোনো লগ নেই" />}
          />
        )
      )}

      <BranchDialog
        branch={editingBranch}
        onClose={() => setEditingBranch(null)}
        onSaved={() => {
          setEditingBranch(null);
          queryClient.invalidateQueries({ queryKey: ['branches-all'] });
          queryClient.invalidateQueries({ queryKey: ['branches'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteBranch)}
        onClose={() => setDeleteBranch(null)}
        title="শাখা মুছবেন?"
        message={deleteBranch?.name}
        onConfirm={async () => {
          await Branch.delete(deleteBranch.id);
          queryClient.invalidateQueries({ queryKey: ['branches-all'] });
          queryClient.invalidateQueries({ queryKey: ['branches'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}

function BranchDialog({ branch, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(branchBlank);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(branch?.id);

  const key = branch?.id || 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm({ ...branchBlank, ...(branch || {}) });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'শাখার নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await Branch.update(branch.id, form);
      else await Branch.create(form);
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'শাখা যোগ হয়েছে' });
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
      open={Boolean(branch)}
      onClose={onClose}
      title={isEdit ? 'শাখা সম্পাদনা' : 'নতুন শাখা'}
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
        <Field label="ঠিকানা" className="sm:col-span-2">
          <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="ফোন">
          <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="ম্যানেজার">
          <Input value={form.manager || ''} onChange={(e) => set('manager', e.target.value)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox checked={form.active} onChange={(v) => set('active', v)} label="সক্রিয় শাখা" />
        </div>
      </div>
    </Dialog>
  );
}
