import { useEffect, useState } from 'react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Input, Loading, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { EmailVerificationNotice, PasswordForm } from '../shared/AccountSecurity';
import { formatDate, vehicleName } from '../../utils/format';

export default function DriverProfile() {
  const { data, loading, error, reload } = useApi('/driver/profile');
  const { refresh } = useAuth();
  const toast = useToast();
  const { values, setValues, set, errors, setErrors } = useForm({ full_name: '', contact_number: '', operator_name: '', association_name: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setValues({ full_name: data.full_name, contact_number: data.contact_number || '', operator_name: data.operator_name || '', association_name: data.association_name || '' }); }, [data, setValues]);

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.patch('/driver/profile', values); toast.success('Profile saved.'); refresh(); reload(); }
    catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile & security" subtitle={<span className="inline-flex flex-wrap items-center gap-2">{vehicleName(data.vehicle_type)} driver · <StatusBadge status={data.approval_status} /> · approved {formatDate(data.reviewed_at)}</span>} />
      <div className="space-y-6">
        <EmailVerificationNotice />
        <form onSubmit={save} className="card space-y-4 p-6">
          <h2 className="text-lg">Driver profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Username" value={data.username} disabled />
            <Input label="Email" value={data.email} disabled />
            <Input label="Full name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} required />
            <Input label="Contact number" value={values.contact_number} onChange={set('contact_number')} error={errors.contact_number} hint="Visible to administrators only." />
            <Input label="Operator" value={values.operator_name} onChange={set('operator_name')} error={errors.operator_name} />
            <Input label="Association / TODA" value={values.association_name} onChange={set('association_name')} error={errors.association_name} />
          </div>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Save profile</button>
        </form>
        <PasswordForm />
      </div>
    </div>
  );
}
