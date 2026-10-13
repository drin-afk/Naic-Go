import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AuthShell, { safeRedirect } from './AuthShell';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useApi';
import { parseError } from '../../services/api';
import { Alert, Input, Spinner } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const redirect = safeRedirect(sp.get('redirect'));
  const { values, set, errors, setErrors } = useForm({ identifier: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const user = await login(values.identifier.trim(), values.password);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      const dest = redirect && (user.role === 'commuter' || !redirect.startsWith('/commuter')) ? redirect : homeFor(user);
      navigate(dest, { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors || {});
      setError(p.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Log in to NaicGo" subtitle={redirect?.startsWith('/commuter/reports/new') ? 'Sign in to continue your report.' : 'Commuters, drivers and administrators sign in here.'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Username or email" autoComplete="username" value={values.identifier} onChange={set('identifier')} error={errors.identifier} required />
        <div className="relative">
          <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" value={values.password} onChange={set('password')} error={errors.password} required />
          <button type="button" className="absolute right-3 top-[38px] text-muted hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link></div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4 text-white" /> : <LogIn className="h-4 w-4" />} Log in</button>
      </form>
      <div className="mt-6 space-y-2 border-t border-black/5 pt-5 text-center text-sm text-muted">
        <p>New commuter? <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="link">Create an account</Link></p>
        <p>Driver? <Link to="/register/driver" className="link">Register as a driver</Link></p>
        <p><Link to="/routes" className="link">Continue as guest</Link> — route search never requires an account.</p>
      </div>
    </AuthShell>
  );
}
