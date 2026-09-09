import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, Input } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';

export default function Register() {
  const { register } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({ ...form, email: form.email.trim() });
      toast({ title: 'অ্যাকাউন্ট তৈরি হয়েছে' });
    } catch (err) {
      setError(err.message || 'অ্যাকাউন্ট তৈরি করা যায়নি');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-muted p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold">নতুন অ্যাকাউন্ট</h1>
          <p className="mt-1 text-sm text-muted-foreground">SS Modina হিসাব ব্যবহার শুরু করুন</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="নাম" required>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </Field>
          <Field label="ইমেইল" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="মোবাইল">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="পাসওয়ার্ড" required hint="কমপক্ষে ৬ অক্ষর">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </Field>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" loading={busy}>অ্যাকাউন্ট তৈরি করুন</Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          আগে থেকেই আছে?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">লগ ইন করুন</Link>
        </p>
      </Card>
    </div>
  );
}
