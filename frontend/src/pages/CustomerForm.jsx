import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Customer, Customers } from '@/api/entities';
import {
  Button, Card, CardContent, Field, Input, Select, Textarea, Loading,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared';
import { useSettings } from '@/hooks/useSettings';

const blank = {
  name: '', mobile: '', alt_mobile: '', address: '', village: '', area: '',
  branch_id: '', type: 'Regular', opening_due: 0, notes: '', status: 'Active',
};

const TYPES = ['Regular', 'Wholesale', 'Contractor', 'One-time'];

export default function CustomerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches } = useSettings();

  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['customer', id], queryFn: () => Customer.get(id), enabled: isEdit,
  });

  useEffect(() => {
    if (existing) setForm({ ...blank, ...existing, branch_id: existing.branch_id || '' });
  }, [existing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = isEdit
        ? await Customers.update(id, form)
        : await Customers.create(form);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: isEdit ? 'হালনাগাদ হয়েছে' : 'কাস্টমার যোগ হয়েছে' });
      navigate(`/customers/${saved.id}`);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && isLoading) return <Loading />;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isEdit ? 'কাস্টমার সম্পাদনা' : 'নতুন কাস্টমার'}
        subtitle={isEdit ? form.customer_id : undefined}
        back="/customers"
      />

      <Card className="mx-auto max-w-3xl">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="নাম" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </Field>

          <Field label="মোবাইল">
            <Input
              type="tel" inputMode="tel" value={form.mobile}
              onChange={(e) => set('mobile', e.target.value)}
            />
          </Field>
          <Field label="বিকল্প মোবাইল">
            <Input
              type="tel" inputMode="tel" value={form.alt_mobile}
              onChange={(e) => set('alt_mobile', e.target.value)}
            />
          </Field>

          <Field label="গ্রাম">
            <Input value={form.village} onChange={(e) => set('village', e.target.value)} />
          </Field>
          <Field label="এলাকা">
            <Input value={form.area} onChange={(e) => set('area', e.target.value)} />
          </Field>

          <Field label="ঠিকানা" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>

          <Field label="শাখা">
            <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
              <option value="">নির্বাচন করুন</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>

          <Field label="ধরন">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          <Field label="পূর্বের বাকি" hint="আগের খাতার বাকি থাকলে লিখুন">
            <Input
              type="number" step="0.01" value={form.opening_due}
              onChange={(e) => set('opening_due', e.target.value)}
            />
          </Field>

          <Field label="অবস্থা">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="Active">সক্রিয়</option>
              <option value="Inactive">নিষ্ক্রিয়</option>
            </Select>
          </Field>

          <Field label="নোট" className="sm:col-span-2">
            <Textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>
              <Save className="h-4 w-4" /> সংরক্ষণ করুন
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/customers')}>বাতিল</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
