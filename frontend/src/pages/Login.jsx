import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, Input, PasswordInput } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      toast({ title: 'স্বাগতম!' });
    } catch (err) {
      setError(err.message || 'লগইন করা যায়নি');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground">
            SS
          </div>
          <h1 className="font-heading text-2xl font-bold">SS Modina হিসাব</h1>
          <p className="mt-1 text-sm text-muted-foreground">আপনার অ্যাকাউন্টে লগইন করুন</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="ইমেইল" required>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>

          <Field label="পাসওয়ার্ড" required>
            <PasswordInput
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" loading={busy}>লগ ইন</Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          অ্যাকাউন্ট নেই?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            নতুন তৈরি করুন
          </Link>
        </p>
      </Card>
    </div>
  );
}
