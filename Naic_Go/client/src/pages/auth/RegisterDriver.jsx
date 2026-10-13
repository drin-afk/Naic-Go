import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthShell from './AuthShell';
import { PASSWORD_HINT, validateRegistration } from './RegisterCommuter';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useApi';
import { parseError } from '../../services/api';
import { Alert, Checkbox, Input, Select, Spinner, Textarea } from '../../components/ui';
import { VEHICLE_TYPES } from '../../utils/format';

export default function RegisterDriver() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { values, set, errors, setErrors } = useForm({
    full_name: '', username: '', email: '', contact_number: '', vehicle_type: '', operator_name: '', association_name: '',
    vehicle_details: '', password: '', confirm_password: '', accept_terms: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const local = validateRegistration(values);
    if (!values.vehicle_type) local.vehicle_type = 'Select your transportation type.';
    if (values.contact_number && !/^[0-9+()\-\s]{7,20}$/.test(values.contact_number)) local.contact_number = 'Enter a valid contact number.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true); setError(null);
    try {
      await register('driver', values);
      toast.success('Registration submitted for administrator approval.');
      navigate('/driver/pending', { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors || {});
      setError(p.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Driver registration" subtitle="Your account will be reviewed by a NaicGo administrator before driver features are enabled." wide>
      <Alert tone="info" className="mb-5" title="How approval works">
        After you register, an administrator verifies your details and assigns your vehicle and route. You&apos;ll be notified once your account is approved.
      </Alert>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <Input label="Full name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} autoComplete="name" required className="sm:col-span-2" />
        <Input label="Username" value={values.username} onChange={set('username')} error={errors.username} autoComplete="username" required />
        <Input label="Email address" type="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
        <Input label="Contact number" value={values.contact_number} onChange={set('contact_number')} error={errors.contact_number} autoComplete="tel" hint="Visible only to administrators." />
        <Select label="Transportation type" value={values.vehicle_type} onChange={set('vehicle_type')} error={errors.vehicle_type} required>
          <option value="">Select…</option>
          {VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
        </Select>
        <Input label="Operator (if applicable)" value={values.operator_name} onChange={set('operator_name')} error={errors.operator_name} />
        <Input label="Association / TODA (if applicable)" value={values.association_name} onChange={set('association_name')} error={errors.association_name} />
        <Textarea label="Vehicle or assignment details (if known)" value={values.vehicle_details} onChange={set('vehicle_details')} error={errors.vehicle_details}
          placeholder="e.g. plate/body number, usual terminal or route" maxLength={255} className="sm:col-span-2" />
        <Input label="Password" type="password" value={values.password} onChange={set('password')} error={errors.password} hint={PASSWORD_HINT} autoComplete="new-password" required />
        <Input label="Confirm password" type="password" value={values.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} autoComplete="new-password" required />
        <div className="sm:col-span-2">
          <Checkbox checked={values.accept_terms} onChange={set('accept_terms')} error={errors.accept_terms}
            label={<>I confirm the information is accurate and agree to the <Link to="/terms" target="_blank" className="link">Terms of Use</Link> and <Link to="/privacy" target="_blank" className="link">Privacy Notice</Link>.</>} />
        </div>
        <button className="btn-primary py-3 sm:col-span-2" disabled={busy}>{busy ? <Spinner className="h-4 w-4 text-white" /> : <ShieldCheck className="h-4 w-4" />} Submit registration</button>
      </form>
      <p className="mt-6 border-t border-black/5 pt-5 text-center text-sm text-muted">Already registered? <Link to="/login" className="link">Log in</Link></p>
    </AuthShell>
  );
}
