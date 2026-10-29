import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useDebounce } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog, ErrorState, Loading, PageHeader, Pagination, StatusBadge, Table, Textarea, VehicleTypeChip } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function AdminDrivers() {
  const [sp] = useSearchParams();
  const toast = useToast();
  const [approval, setApproval] = useState(sp.get('approval') || '');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/admin/drivers', { approval: approval || undefined, q: dq || undefined, page });
  const [action, setAction] = useState(null); // {type, driver}
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (action.type === 'reject' && !reason.trim()) return toast.error('Please enter a reason for the rejection.');
    setBusy(true);
    try {
      if (action.type === 'approve') await api.post(`/admin/drivers/${action.driver.id}/approve`, { reason: reason || undefined });
      else if (action.type === 'reject') await api.post(`/admin/drivers/${action.driver.id}/reject`, { reason });
      else await api.patch(`/admin/users/${action.driver.id}/status`, { status: action.type, reason: reason || undefined });
      toast.success('Driver updated.'); setAction(null); setReason(''); reload();
    } catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };

  const titles = { approve: 'Approve driver', reject: 'Reject application', suspended: 'Suspend driver', active: 'Reactivate driver' };

  return (
    <div>
      <PageHeader title="Drivers" subtitle="Review registrations, approve or reject applications, and manage driver accounts." />
      <div className="card mb-4 flex flex-col gap-3 p-4 md:flex-row">
        <input className="input flex-1" placeholder="Search name, username, email, association" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search drivers" />
        <div className="flex flex-wrap gap-1">
          {[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => (
            <button key={k} onClick={() => { setApproval(k); setPage(1); }} className={`btn-sm btn ${approval === k ? 'bg-maroon text-white' : 'ring-1 ring-black/10 hover:bg-black/5'}`}>{l}</button>
          ))}
        </div>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <Table rows={data} empty="No drivers match." columns={[
            { key: 'full_name', label: 'Driver', render: (d) => <div><p className="font-semibold">{d.full_name}</p><p className="text-xs text-muted">@{d.username} · {d.email}</p>{d.contact_number && <p className="text-xs text-muted">{d.contact_number}</p>}</div> },
            { key: 'vehicle_type', label: 'Type', render: (d) => <VehicleTypeChip type={d.vehicle_type} /> },
            { key: 'assoc', label: 'Operator / association', render: (d) => <div className="text-xs"><p>{d.operator_name || '—'}</p><p className="text-muted">{d.association_name || ''}</p>{d.vehicle_details && <p className="mt-1 max-w-[220px] text-muted">{d.vehicle_details}</p>}</div> },
            { key: 'created_at', label: 'Registered', render: (d) => formatDate(d.created_at) },
            { key: 'approval_status', label: 'Approval', render: (d) => <div><StatusBadge status={d.approval_status} />{d.approval_reason && <p className="mt-1 max-w-[180px] text-xs text-muted">{d.approval_reason}</p>}</div> },
            { key: 'status', label: 'Account', render: (d) => <StatusBadge status={d.status} /> },
            { key: 'active_assignments', label: 'Assignments' },
            { key: 'actions', label: 'Actions', className: 'text-right whitespace-nowrap', render: (d) => (
              <div className="flex justify-end gap-1.5">
                {d.approval_status !== 'approved' && <button className="btn-primary btn-sm" onClick={() => setAction({ type: 'approve', driver: d })}><Check className="h-3.5 w-3.5" /> Approve</button>}
                {d.approval_status === 'pending' && <button className="btn-secondary btn-sm" onClick={() => setAction({ type: 'reject', driver: d })}><X className="h-3.5 w-3.5" /> Reject</button>}
                {d.approval_status === 'approved' && d.status === 'active' && <button className="btn-secondary btn-sm" onClick={() => setAction({ type: 'suspended', driver: d })}>Suspend</button>}
                {d.approval_status === 'approved' && d.status !== 'active' && <button className="btn-secondary btn-sm" onClick={() => setAction({ type: 'active', driver: d })}>Reactivate</button>}
              </div>
            ) },
          ]} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
      <ConfirmDialog open={Boolean(action)} title={action ? titles[action.type] : ''} busy={busy} onCancel={() => { setAction(null); setReason(''); }} onConfirm={run}
        tone={action?.type === 'reject' || action?.type === 'suspended' ? 'danger' : 'primary'} confirmLabel={action ? titles[action.type] : ''}
        message={action ? `${titles[action.type]}: ${action.driver.full_name}. This decision is recorded in the audit log${action.type === 'suspended' ? ' and ends active assignments' : ''}.` : ''}>
        <Textarea label={action?.type === 'reject' ? 'Reason (required, shared with the applicant)' : 'Reason / note (optional)'} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} rows={3} />
      </ConfirmDialog>
    </div>
  );
}
