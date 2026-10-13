import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck } from 'lucide-react';
import AuthShell from './AuthShell';
import { PASSWORD_HINT } from './RegisterCommuter';
import api, { parseError } from '../../services/api';
import { useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, Input, Spinner } from '../../components/ui';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDone(data.data.message);
    } catch (err) { setError(parseError(err).message); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to reset it.">
      {done ? (
        <div className="text-center">
          <MailCheck className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 text-sm text-muted">{done}</p>
          <Link to="/login" className="btn-secondary mt-5">Back to log in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Send reset link</button>
          <p className="text-center text-sm"><Link to="/login" className="link">Back to log in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const { values, set, errors, setErrors } = useForm({ password: '', confirm_password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (values.password !== values.confirm_password) return setErrors({ confirm_password: 'Passwords do not match.' });
    setBusy(true); setError(null);
    try {
      await api.post('/auth/reset-password', { token, ...values });
      toast.success('Password reset. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      const p = parseError(err); setErrors(p.fieldErrors || {}); setError(p.message);
    } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Choose a new password">
      {!token ? <Alert tone="danger">This reset link is incomplete. Please request a new one.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error} {error.includes('expired') && <Link to="/forgot-password" className="link">Request a new link</Link>}</Alert>}
          <Input label="New password" type="password" value={values.password} onChange={set('password')} error={errors.password} hint={PASSWORD_HINT} autoComplete="new-password" required />
          <Input label="Confirm new password" type="password" value={values.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" required />
          <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Reset password</button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const [state, setState] = useState({ loading: true });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState({ error: 'This verification link is incomplete.' }); return; }
    api.post('/auth/verify-email', { token })
      .then((r) => setState({ message: r.data.data.message }))
      .catch((e) => setState({ error: parseError(e).message }));
  }, [token]);
  return (
    <AuthShell title="Email verification">
      {state.loading ? <div className="flex justify-center"><Spinner className="h-8 w-8" /></div> : state.error ? <Alert tone="danger">{state.error}</Alert> : (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 text-sm">{state.message}</p>
          <Link to="/login" className="btn-primary mt-5">Continue</Link>
        </div>
      )}
    </AuthShell>
  );
}
