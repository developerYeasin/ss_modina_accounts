import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { ExpenseCategories } from '@/api/entities';
import { Button, Dialog, Field, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useSettings } from '@/hooks/useSettings';

/**
 * খরচের খাত picker with add (➕) and rename (✏️) right beside it — a wrong or
 * missing head is fixed on the spot, and a rename carries old expenses along.
 */
export function CategorySelect({ value, onChange, extra = [] }) {
  const { expenseCategories, refetch } = useSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // null | { mode: 'add' } | { mode: 'rename', from }
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const options = [...new Set([...expenseCategories, ...extra, value].filter(Boolean))];
  const open = (d) => { setDialog(d); setName(d.mode === 'rename' ? d.from : ''); };

  async function save() {
    const next = name.trim();
    if (!next) {
      toast({ title: 'খাতের নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (dialog.mode === 'add') {
        await ExpenseCategories.add(next);
        toast({ title: 'নতুন খাত যোগ হয়েছে' });
      } else {
        const r = await ExpenseCategories.rename(dialog.from, next);
        toast({ title: 'খাতের নাম ঠিক হয়েছে', description: r.renamed ? `${r.renamed} টি পুরনো খরচও নতুন নামে গেছে` : undefined });
      }
      refetch();
      ['setting', 'expenses'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      onChange(next);
      setDialog(null);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <div className="min-w-0 flex-1">
        <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">নির্বাচন করুন</option>
          {options.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
      {value && (
        <Button
          type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
          onClick={() => open({ mode: 'rename', from: value })} title="খাতের নাম ঠিক করুন" aria-label="খাতের নাম ঠিক করুন"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
        onClick={() => open({ mode: 'add' })} title="নতুন খাত যোগ" aria-label="নতুন খাত যোগ"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        size="sm"
        title={dialog?.mode === 'rename' ? 'খাতের নাম সম্পাদনা' : 'নতুন খরচের খাত'}
        description={dialog?.mode === 'rename' ? `বর্তমান নাম: ${dialog.from}` : 'যেমন: গাড়ি ভাড়া, বিদ্যুৎ বিল, Wi-Fi বিল'}
        footer={<><Button variant="outline" onClick={() => setDialog(null)}>বাতিল</Button><Button loading={busy} onClick={save}>সংরক্ষণ</Button></>}
      >
        <Field label="খাতের নাম" required>
          <Input
            value={name} autoFocus onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          />
        </Field>
      </Dialog>
    </div>
  );
}
