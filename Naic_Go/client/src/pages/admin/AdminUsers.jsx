import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { parseError } from '../../services/api';
import { useApi, useDebounce } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, ConfirmDialog, ErrorState, Loading, PageHeader, Pagination, StatusBadge, Table } from '../../components/ui';
import { formatDate, titleCase } from '../../utils/format';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [role, setRole] = useState(sp.get('role') || '');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/admin/users', { role: role || undefined, status: status || undefined, q: dq || undefined, page });
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try { await api.patch(`/admin/users/${target.user.id}/status`, { status: target.status }); toast.success('Account updated.'); setTarget(null); reload(); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="User accounts" subtitle="Commuter, driver and administrator accounts." />
      <Alert tone="info" className="mb-4">Administrator accounts can only be created with the server-side <code>npm run create-admin</code> script. Driver approvals are handled on the Drivers page.</Alert>
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]">
        <input className="input" placeholder="Search name, username or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" />
        <select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role"><option value="">All roles</option><option value="commuter">Commuters</option><option value="driver">Drivers</option><option value="admin">Administrators</option></select>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All statuses</option>{['active', 'pending', 'suspended', 'rejected', 'inactive'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <Table rows={data} columns={[
            { key: 'full_name', label: 'User', render: (u) => <div><p className="font-semibold">{u.full_name}</p><p className="text-xs text-muted">@{u.username} · {u.email}</p></div> },
            { key: 'role', label: 'Role', render: (u) => titleCase(u.role) },
            { key: 'email_verified_at', label: 'Email', render: (u) => (u.email_verified_at ? 'Verified' : <span className="text-muted">Unverified</span>) },
            { key: 'last_login_at', label: 'Last login', render: (u) => formatDate(u.last_login_at, true) },
            { key: 'created_at', label: 'Created', render: (u) => formatDate(u.created_at) },
            { key: 'status', label: 'Status', render: (u) => <StatusBadge status={u.status} /> },
            { key: 'actions', label: 'Actions', className: 'text-right', render: (u) => (u.role === 'admin' || u.id === me.id || u.role === 'driver' ? <span className="text-xs text-muted">{u.role === 'driver' ? 'Use Drivers page' : '—'}</span> : (
              u.status === 'active'
                ? <button className="btn-secondary btn-sm" onClick={() => setTarget({ user: u, status: 'suspended' })}>Suspend</button>
                : <button className="btn-secondary btn-sm" onClick={() => setTarget({ user: u, status: 'active' })}>Reactivate</button>
            )) },
          ]} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
      <ConfirmDialog open={Boolean(target)} title={target?.status === 'suspended' ? 'Suspend account' : 'Reactivate account'} busy={busy} onCancel={() => setTarget(null)} onConfirm={apply}
        tone={target?.status === 'suspended' ? 'danger' : 'primary'} confirmLabel="Confirm"
        message={target ? `${target.status === 'suspended' ? 'Suspend' : 'Reactivate'} ${target.user.full_name}'s account? Suspended users cannot log in. This is recorded in the audit log.` : ''} />
    </div>
  );
}
