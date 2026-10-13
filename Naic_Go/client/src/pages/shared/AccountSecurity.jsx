import { useState } from 'react';
import { KeyRound, MailWarning } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useForm } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Input, PageHeader, Spinner } from '../../components/ui';
import { PASSWORD_HINT } from '../auth/RegisterCommuter';

export function PasswordForm() {
  const toast = useToast();
  const empty = { current_password: '', new_password: '', confirm_password: '' };
  const { values, setValues, set, errors, setErrors } = useForm(empty);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (values.new_password !== values.confirm_password) return setErrors({ confirm_password: 'Passwords do not match.' });
    setBusy(true);
    try {
      await api.patch('/auth/password', values);
      toast.success('Password updated.');
      setValues(empty);
    } catch (err) {
      const p = parseError(err); setErrors(p.fieldErrors || {}); if (!Object.keys(p.fieldErrors || {}).length) toast.error(p.message);
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-brand" /> Change password</h2>
      <Input label="Current password" type="password" value={values.current_password} onChange={set('current_password')} error={errors.current_password} autoComplete="current-password" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="New password" type="password" value={values.new_password} onChange={set('new_password')} error={errors.new_password} hint={PASSWORD_HINT} autoComplete="new-password" required />
        <Input label="Confirm new password" type="password" value={values.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" required />
      </div>
      <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Update password</button>
    </form>
  );
}

export function EmailVerificationNotice() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user || user.email_verified) return null;
  const resend = async () => {
    setBusy(true);
    try { const { data } = await api.post('/auth/resend-verification'); toast.success(data.data.message); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  return (
    <Alert tone="warning" title="Email not yet verified">
      <span className="flex flex-wrap items-center gap-2"><MailWarning className="h-4 w-4" /> Verify {user.email} to secure your account.
        <button className="font-semibold text-brand underline" onClick={resend} disabled={busy}>Resend verification link</button></span>
    </Alert>
  );
}

export default function AccountSecurity() {
  const { user } = useAuth();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Account security" subtitle={`Signed in as ${user?.username} (${user?.email})`} />
      <div className="space-y-6">
        <EmailVerificationNotice />
        <PasswordForm />
      </div>
    </div>
  );
}
