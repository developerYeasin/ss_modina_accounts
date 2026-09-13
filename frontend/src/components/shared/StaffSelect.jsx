import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { Staff } from '@/api/entities';
import { Button, Dialog, Field, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

/**
 * দায়িত্বপ্রাপ্ত / গ্রহণকারী কর্মী picker with its own add and edit buttons, so a
 * new name never needs a trip to the salary screen.
 *
 *   by="id"   — value and onChange carry the staff id (orders)
 *   by="name" — value and onChange carry the name (payment received_by)
 */
export function StaffSelect({ value, onChange, by = 'id', placeholder = 'নির্বাচন করুন' }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'], queryFn: () => Staff.filter({ active: true }, 'name'),
  });

  const selected = staff.find((s) => (by === 'id' ? s.id : s.name) === value);
  // A saved name that is no longer on the list still shows instead of going blank.
  const orphan = by === 'name' && value && !selected;

  return (
    <div className="flex gap-1.5">
      <div className="min-w-0 flex-1">
        <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {orphan && <option value={value}>{value}</option>}
          {staff.map((s) => (
            <option key={s.id} value={by === 'id' ? s.id : s.name}>{s.name}</option>
          ))}
        </Select>
      </div>
      {selected && (
        <Button
          type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
          onClick={() => setEditing(selected)} aria-label="নাম সম্পাদনা" title="নাম সম্পাদনা"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
        onClick={() => setEditing({ name: '', position: '', phone: '' })}
        aria-label="নতুন নাম যোগ" title="নতুন নাম যোগ"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <QuickStaffDialog
        staff={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['staff'] });
          queryClient.invalidateQueries({ queryKey: ['staff-all'] });
          onChange(by === 'id' ? saved.id : saved.name);
        }}
      />
    </div>
  );
}

function QuickStaffDialog({ staff, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', position: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(staff?.id);

  const key = staff ? staff.id || 'new' : null;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    if (staff) setForm({ name: staff.name || '', position: staff.position || '', phone: staff.phone || '' });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = isEdit
        ? await Staff.update(staff.id, form)
        : await Staff.create({ ...form, active: true });
      toast({ title: isEdit ? 'নাম হালনাগাদ হয়েছে' : 'নতুন নাম যোগ হয়েছে' });
      onSaved(saved);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(staff)}
      onClose={onClose}
      title={isEdit ? 'কর্মীর নাম সম্পাদনা' : 'নতুন কর্মী যোগ'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="নাম" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="পদ">
          <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
        </Field>
        <Field label="মোবাইল">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
