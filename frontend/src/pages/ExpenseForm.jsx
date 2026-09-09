import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Expense } from '@/api/entities';
import {
  Button, Card, CardContent, Field, Input, Select, Textarea, Loading,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, PAYMENT_METHODS } from '@/components/shared';
import { isoDate, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const blank = {
  date: isoDate(), category: '', description: '', amount: 0,
  method: 'Cash', person: '', branch_id: '', notes: '',
};

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, expenseCategories } = useSettings();

  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['expense', id], queryFn: () => Expense.get(id), enabled: isEdit,
  });

  useEffect(() => {
    if (existing) setForm({ ...blank, ...existing, branch_id: existing.branch_id || '' });
  }, [existing]);

  useEffect(() => {
    if (!isEdit && !form.category && expenseCategories.length) {
      setForm((f) => ({ ...f, category: expenseCategories[0] }));
    }
  }, [expenseCategories, isEdit, form.category]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form };
      if (payload.branch_id) {
        payload.branch_name = branches.find((b) => b.id === payload.branch_id)?.name || '';
      }
      if (isEdit) await Expense.update(id, payload);
      else await Expense.create(payload);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'খরচ যোগ হয়েছে' });
      navigate('/expenses');
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && isLoading) return <Loading />;

  return (
    <form onSubmit={submit}>
      <PageHeader title={isEdit ? 'খরচ সম্পাদনা' : 'নতুন খরচ'} back="/expenses" />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="তারিখ" required>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </Field>

          <Field label="পরিমাণ" required>
            <Input
              type="number" step="0.01" min="0" autoFocus value={form.amount}
              onChange={(e) => set('amount', e.target.value)} required
            />
          </Field>

          <Field label="খাত" required>
            <Select value={form.category} onChange={(e) => set('category', e.target.value)} required>
              <option value="">নির্বাচন করুন</option>
              {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Labour">Labour</option>
              <option value="Other">Other</option>
            </Select>
          </Field>

          <Field label="মাধ্যম">
            <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>

          <Field label="বিবরণ" className="sm:col-span-2">
            <Input value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <Field label="ব্যক্তি / প্রাপক">
            <Input value={form.person || ''} onChange={(e) => set('person', e.target.value)} />
          </Field>

          <Field label="শাখা">
            <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>

          <Field label="নোট" className="sm:col-span-2">
            <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>
              <Save className="h-4 w-4" /> সংরক্ষণ করুন
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/expenses')}>বাতিল</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
