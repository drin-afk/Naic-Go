import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import AuthShell, { safeRedirect } from './AuthShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useApi';
import { parseError } from '../../services/api';
import { Alert, Checkbox, Input, Spinner } from '../../components/ui';

export const PASSWORD_HINT = 'At least 8 characters with uppercase, lowercase and a number.';

export function validateRegistration(v) {
  const e = {};
  if (!v.full_name || v.full_name.trim().length < 2) e.full_name = 'Enter your name.';
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(v.username)) e.username = 'Use 3–40 letters, numbers, dots, dashes or underscores.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = 'Enter a valid email address.';
  if (!(v.password.length >= 8 && /[a-z]/.test(v.password) && /[A-Z]/.test(v.password) && /\d/.test(v.password))) e.password = PASSWORD_HINT;
  if (v.password !== v.confirm_password) e.confirm_password = 'Passwords do not match.';
  if (!v.accept_terms) e.accept_terms = 'You must accept the Terms and Privacy Notice.';
  return e;
}

export default function RegisterCommuter() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const redirect = safeRedirect(sp.get('redirect'));
  const { values, set, errors, setErrors } = useForm({ full_name: '', username: '', email: '', contact_number: '', password: '', confirm_password: '', accept_terms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const local = validateRegistration(values);
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true); setError(null);
    try {
      await register('commuter', values);
      toast.success('Account created. Welcome to NaicGo!');
      navigate(redirect || '/commuter/dashboard', { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors || {});
      setError(p.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create a commuter account" subtitle="Track passenger reports and get updates. Route search stays free without an account." wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <Input label="Full name or display name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} autoComplete="name" required className="sm:col-span-2" />
        <Input label="Username" value={values.username} onChange={set('username')} error={errors.username} autoComplete="username" required />
        <Input label="Email address" type="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
        <Input label="Contact number (optional)" value={values.contact_number} onChange={set('contact_number')} error={errors.contact_number} autoComplete="tel" className="sm:col-span-2" />
        <Input label="Password" type="password" value={values.password} onChange={set('password')} error={errors.password} hint={PASSWORD_HINT} autoComplete="new-password" required />
        <Input label="Confirm password" type="password" value={values.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" required />
        <div className="sm:col-span-2">
          <Checkbox checked={values.accept_terms} onChange={set('accept_terms')} error={errors.accept_terms}
            label={<>I agree to the <Link to="/terms" target="_blank" className="link">Terms of Use</Link> and <Link to="/privacy" target="_blank" className="link">Privacy Notice</Link>.</>} />
        </div>
        <button className="btn-primary py-3 sm:col-span-2" disabled={busy}>{busy ? <Spinner className="h-4 w-4 text-white" /> : <UserPlus className="h-4 w-4" />} Create account</button>
      </form>
      <p className="mt-6 border-t border-black/5 pt-5 text-center text-sm text-muted">
        Already registered? <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="link">Log in</Link> · Driver? <Link to="/register/driver" className="link">Driver registration</Link>
      </p>
    </AuthShell>
  );
}
