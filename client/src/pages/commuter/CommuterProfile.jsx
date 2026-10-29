import { useEffect, useState } from 'react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Input, Loading, PageHeader, Select, Spinner } from '../../components/ui';
import { EmailVerificationNotice, PasswordForm } from '../shared/AccountSecurity';
import { formatDate } from '../../utils/format';

export default function CommuterProfile() {
  const { data, loading, error, reload } = useApi('/commuter/profile');
  const { refresh } = useAuth();
  const toast = useToast();
  const { values, setValues, set, errors, setErrors } = useForm({ full_name: '', contact_number: '', preferred_contact: 'email' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setValues({ full_name: data.full_name, contact_number: data.contact_number || '', preferred_contact: data.preferred_contact || 'email' }); }, [data, setValues]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.patch('/commuter/profile', values); toast.success('Profile saved.'); refresh(); reload(); }
    catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile & security" subtitle={`Member since ${formatDate(data.created_at)}`} />
      <div className="space-y-6">
        <EmailVerificationNotice />
        <form onSubmit={save} className="card space-y-4 p-6">
          <h2 className="text-lg">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Username" value={data.username} disabled />
            <Input label="Email" value={data.email} disabled hint="Contact the administrator to change your email." />
            <Input label="Full name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} required />
            <Input label="Contact number" value={values.contact_number} onChange={set('contact_number')} error={errors.contact_number} />
            <Select label="Preferred contact for report follow-ups" value={values.preferred_contact} onChange={set('preferred_contact')}>
              <option value="email">Email</option><option value="phone">Phone</option><option value="none">In-app notifications only</option>
            </Select>
          </div>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Save profile</button>
        </form>
        <PasswordForm />
      </div>
    </div>
  );
}
