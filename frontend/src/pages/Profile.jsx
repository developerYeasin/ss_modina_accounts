import { useState } from 'react';
import { Save, LogOut, KeyRound, Mail } from 'lucide-react';
import { Auth } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, PasswordInput, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, InfoRow } from '@/components/shared';
import { bnDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    photo_url: user.photo_url || '',
  });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [emailForm, setEmailForm] = useState({ email: user.email || '', current_password: '' });
  const [emailBusy, setEmailBusy] = useState(false);

  async function changeEmail(e) {
    e.preventDefault();
    setEmailBusy(true);
    try {
      await Auth.updateMe({ ...form, ...emailForm });
      await refresh();
      setEmailForm((f) => ({ ...f, current_password: '' }));
      toast({ title: 'লগইন ইমেইল পরিবর্তন হয়েছে', description: 'এখন থেকে নতুন ইমেইল দিয়ে লগইন করবেন' });
    } catch (err) {
      toast({ title: 'পরিবর্তন করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setEmailBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await Auth.updateMe(form);
      await refresh();
      toast({ title: 'প্রোফাইল হালনাগাদ হয়েছে' });
    } catch (err) {
      toast({ title: 'সংরক্ষণ করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      toast({ title: 'নতুন পাসওয়ার্ড দুটি মিলছে না', variant: 'destructive' });
      return;
    }
    setPwBusy(true);
    try {
      await Auth.changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast({ title: 'পাসওয়ার্ড পরিবর্তন হয়েছে' });
    } catch (err) {
      toast({ title: 'পরিবর্তন করা যায়নি', description: err.message, variant: 'destructive' });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="প্রোফাইল"
        subtitle={user.email}
        actions={
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> লগআউট
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>অ্যাকাউন্ট</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow label="ইমেইল" value={user.email} />
            <InfoRow label="ভূমিকা" value={<Badge variant="default">{user.role}</Badge>} />
            <InfoRow label="যোগদান" value={bnDate(user.created_date)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>তথ্য সম্পাদনা</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
              <Field label="নাম" className="sm:col-span-2">
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field label="মোবাইল">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="ছবির URL">
                <Input
                  value={form.photo_url}
                  onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" loading={busy}>
                  <Save className="h-4 w-4" /> সংরক্ষণ করুন
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> লগইন ইমেইল পরিবর্তন
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changeEmail} className="grid gap-4 sm:grid-cols-3">
              <Field label="নতুন ইমেইল" required hint="যে ইমেইল মনে থাকবে সেটি দিন">
                <Input
                  type="email" autoComplete="email" value={emailForm.email}
                  onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  required
                />
              </Field>
              <Field label="বর্তমান পাসওয়ার্ড" required hint="নিশ্চিত করার জন্য">
                <PasswordInput
                  autoComplete="current-password" value={emailForm.current_password}
                  onChange={(e) => setEmailForm({ ...emailForm, current_password: e.target.value })}
                  required
                />
              </Field>
              <div className="flex items-end">
                <Button type="submit" loading={emailBusy} disabled={emailForm.email === user.email}>
                  ইমেইল পরিবর্তন করুন
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> পাসওয়ার্ড পরিবর্তন
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3">
              <Field label="বর্তমান পাসওয়ার্ড" required>
                <PasswordInput
                  autoComplete="current-password" value={pw.current_password}
                  onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                  required
                />
              </Field>
              <Field label="নতুন পাসওয়ার্ড" required hint="কমপক্ষে ৬ অক্ষর">
                <PasswordInput
                  autoComplete="new-password" minLength={6} value={pw.new_password}
                  onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                  required
                />
              </Field>
              <Field label="আবার লিখুন" required>
                <PasswordInput
                  autoComplete="new-password" minLength={6} value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  required
                />
              </Field>
              <div className="sm:col-span-3">
                <Button type="submit" loading={pwBusy}>পাসওয়ার্ড পরিবর্তন করুন</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
