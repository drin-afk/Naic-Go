import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import ResourceManager, { cleanPayload } from './ResourceManager';
import { Alert, ConfirmDialog, StatusBadge, VerificationBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';

/** Small status changer used by several admin tables (with confirmation). */
export function StatusChanger({ row, endpoint, options, onDone, label = 'Change status' }) {
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await api.patch(`${endpoint}/${row.id}/status`, { status: target }); toast.success('Status updated.'); setTarget(null); onDone(); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  return (
    <>
      <select className="input w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && setTarget(e.target.value)} aria-label={label}>
        <option value="">{label}…</option>
        {options.filter((o) => o !== row.status).map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
      </select>
      <ConfirmDialog open={Boolean(target)} title="Confirm status change" busy={busy} onCancel={() => setTarget(null)} onConfirm={confirm}
        tone={target === 'archived' || target === 'suspended' ? 'danger' : 'primary'}
        message={`Change status from "${row.status}" to "${target}"? This action is recorded in the audit log.`} confirmLabel="Change status" />
    </>
  );
}

export default function AdminTerminals() {
  const opts = useApi('/admin/options');
  const vt = (opts.data?.vehicleTypes || []).map((v) => ({ value: v.id, label: v.name }));
  return (
    <ResourceManager
      title="Terminals" subtitle="Manage terminal records, verified coordinates and supported vehicle types."
      endpoint="/admin/terminals" entityName="terminal" createLabel="Add terminal" searchPlaceholder="Search name, address, barangay"
      notice={<Alert tone="info" className="mb-4">Only include terminals within Naic, Cavite. Enter coordinates only when they have been verified on site; a terminal cannot be marked &ldquo;verified&rdquo; without them. Editing a demo record&apos;s verification status removes its DEMO flag.</Alert>}
      filters={[
        { name: 'status', label: 'Status', options: ['active', 'inactive', 'archived'].map((s) => ({ value: s, label: s })) },
        { name: 'verification', label: 'Verification', options: ['verified', 'unverified', 'demo'].map((s) => ({ value: s, label: s })) },
      ]}
      columns={[
        { key: 'name', label: 'Terminal', render: (t) => <div><Link to={`/terminals/${t.id}`} className="font-semibold hover:text-brand">{t.name}</Link><p className="text-xs text-muted">{t.address}</p></div> },
        { key: 'coords', label: 'Coordinates', render: (t) => t.latitude != null ? <span className="text-xs">{Number(t.latitude).toFixed(5)}, {Number(t.longitude).toFixed(5)}</span> : <span className="text-xs text-muted">Not set</span> },
        { key: 'route_count', label: 'Routes' },
        { key: 'verification_status', label: 'Verification', render: (t) => <div><VerificationBadge status={t.verification_status} /><p className="mt-0.5 text-xs text-muted">{formatDate(t.verified_at)}</p></div> },
        { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
      ]}
      rowActions={(row, reload) => <StatusChanger row={row} endpoint="/admin/terminals" options={['active', 'inactive', 'archived']} onDone={reload} />}
      fields={[
        { name: 'name', label: 'Terminal name', required: true, span: 2, maxLength: 150 },
        { name: 'address', label: 'Address / documented location', required: true, span: 2, maxLength: 255 },
        { name: 'barangay', label: 'Barangay', maxLength: 100 },
        { name: 'operating_hours', label: 'Operating hours', maxLength: 120 },
        { name: 'latitude', label: 'Latitude (verified)', type: 'number', step: 'any', min: -90, max: 90, hint: 'e.g. 14.3186' },
        { name: 'longitude', label: 'Longitude (verified)', type: 'number', step: 'any', min: -180, max: 180, hint: 'e.g. 120.7660' },
        { name: 'vehicle_type_ids', label: 'Supported vehicle types', type: 'multicheck', options: vt, span: 2 },
        { name: 'verification_status', label: 'Verification status', type: 'select', placeholder: false, options: [{ value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' }, { value: 'demo', label: 'Demo' }] },
        { name: 'verified_at', label: 'Verification date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', placeholder: false, options: ['active', 'inactive', 'archived'].map((s) => ({ value: s, label: s })) },
        { name: 'description', label: 'Description / notes', type: 'textarea', span: 2, maxLength: 3000 },
      ]}
      emptyForm={{ name: '', address: '', barangay: '', operating_hours: '', latitude: '', longitude: '', vehicle_type_ids: [], verification_status: 'unverified', verified_at: '', status: 'active', description: '' }}
      toForm={(t) => ({ name: t.name, address: t.address, barangay: t.barangay || '', operating_hours: t.operating_hours || '', latitude: t.latitude ?? '', longitude: t.longitude ?? '',
        vehicle_type_ids: t.vehicle_type_ids, verification_status: t.verification_status, verified_at: t.verified_at || '', status: t.status, description: t.description || '' })}
      toPayload={(v) => cleanPayload(v, ['latitude', 'longitude'])}
    />
  );
}
