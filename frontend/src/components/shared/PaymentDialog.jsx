import { useState } from 'react';
import { Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { Payments } from '@/api/entities';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { isoDate, money, num } from '@/lib/utils';
import { StaffSelect } from './StaffSelect';

export const PAYMENT_METHOD_LIST = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank', 'Other'];

const blank = (user) => ({
  date: isoDate(), amount: '', method: 'Cash', reference: '', notes: '',
  received_by: user?.full_name || '',
});

/**
 * জমা নেওয়া বা ভুল জমা ঠিক করা — one dialog for both.
 *
 *   payment    existing row → edit; null → new
 *   orderId    ties a new payment to that order
 *   customerId general deposit on the customer's account
 *   due        shown as the current balance
 *   onSaved(payment) — the saved row, so the caller can open its receipt
 */
export function PaymentDialog({ open, onClose, payment, orderId, customerId, due, onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currency } = useSettings();
  const isEdit = Boolean(payment?.id);
  const [form, setForm] = useState(blank(user));
  const [busy, setBusy] = useState(false);

  // Re-seed whenever a different payment (or a fresh "new") is opened.
  const key = open ? payment?.id || 'new' : null;
  const [lastKey, setLastKey] = useState(null);
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setForm(isEdit ? {
        date: payment.date, amount: payment.amount, method: payment.method || 'Cash',
        reference: payment.reference || '', notes: payment.notes || '',
        received_by: payment.received_by || '',
      } : blank(user));
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!num(form.amount)) {
      toast({ title: 'পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = isEdit
        ? await Payments.update(payment.id, form)
        : await Payments.create({
          ...form, order_id: orderId || undefined, customer_id: customerId || undefined,
        });
      toast({ title: isEdit ? 'জমা সংশোধন হয়েছে' : 'জমা যোগ হয়েছে' });
      onSaved?.(saved);
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // Editing an old payment: its own amount is already inside the due.
  const baseDue = num(due) + (isEdit ? num(payment.amount) : 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'জমা সংশোধন' : 'নতুন জমা / পেমেন্ট'}
      description={due !== undefined ? `বর্তমান বাকি ${money(due, currency)}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button loading={busy} onClick={save}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="তারিখ">
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
            {PAYMENT_METHOD_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="রেফারেন্স">
          <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} />
        </Field>
        <Field label="টাকা গ্রহণকারী" className="sm:col-span-2">
          <StaffSelect by="name" value={form.received_by} onChange={(v) => set('received_by', v)} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {due !== undefined && (
          <div className="flex justify-between rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
            <span className="text-muted-foreground">এই জমার পর বাকি</span>
            <span className="num font-bold">{money(baseDue - num(form.amount), currency)}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
