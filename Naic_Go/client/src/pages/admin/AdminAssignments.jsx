import { useState } from 'react';
import api, { parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import ResourceManager, { cleanPayload } from './ResourceManager';
import { Alert, Badge, ConfirmDialog } from '../../components/ui';
import { formatDate, todayISO } from '../../utils/format';

function EndButton({ row, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!row.is_active) return null;
  const end = async () => {
    setBusy(true);
    try { await api.patch(`/admin/assignments/${row.id}/end`); toast.success('Assignment ended.'); setOpen(false); onDone(); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>End</button>
      <ConfirmDialog open={open} title="End assignment" tone="danger" busy={busy} onCancel={() => setOpen(false)} onConfirm={end} confirmLabel="End assignment"
        message={`End ${row.driver_name}'s assignment to ${row.vehicle_identifier}? The record is kept in the assignment history.`} />
    </>
  );
}

export default function AdminAssignments() {
  const opts = useApi('/admin/options');
  const o = opts.data || { drivers: [], vehicles: [], routes: [], terminals: [] };
  return (
    <ResourceManager
      title="Assignments" subtitle="Link approved drivers to vehicles, routes and terminals. Ended assignments are kept as history."
      endpoint="/admin/assignments" entityName="assignment" createLabel="New assignment" canEdit={false} searchPlaceholder="Search driver, vehicle or route"
      notice={<Alert tone="info" className="mb-4">Drivers can only report availability for vehicles with an active assignment. The vehicle type must match the route&apos;s transportation type.</Alert>}
      filters={[{ name: 'active', label: 'State', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Ended' }] }]}
      columns={[
        { key: 'driver_name', label: 'Driver', render: (a) => <span className="font-semibold">{a.driver_name}</span> },
        { key: 'vehicle_identifier', label: 'Vehicle' },
        { key: 'route', label: 'Route', render: (a) => a.route_code || '—' },
        { key: 'terminal_name', label: 'Terminal' },
        { key: 'period', label: 'Period', render: (a) => <span className="text-xs">{formatDate(a.start_date)} – {a.end_date ? formatDate(a.end_date) : 'present'}</span> },
        { key: 'assigned_by_name', label: 'Assigned by' },
        { key: 'is_active', label: 'State', render: (a) => <Badge tone={a.is_active ? 'success' : 'neutral'}>{a.is_active ? 'Active' : 'Ended'}</Badge> },
      ]}
      rowActions={(row, reload) => <EndButton row={row} onDone={reload} />}
      fields={[
        { name: 'driver_id', label: 'Approved driver', type: 'select', required: true, options: o.drivers.map((d) => ({ value: d.id, label: `${d.full_name} (${d.vehicle_type})` })) },
        { name: 'vehicle_id', label: 'Vehicle', type: 'select', required: true, options: o.vehicles.filter((v) => v.status === 'active').map((v) => ({ value: v.id, label: `${v.identifier} (${v.vehicle_type})` })) },
        { name: 'route_id', label: 'Route (optional)', type: 'select', placeholder: 'None', options: o.routes.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` })) },
        { name: 'terminal_id', label: 'Terminal (optional)', type: 'select', placeholder: 'None', options: o.terminals.map((t) => ({ value: t.id, label: t.name })) },
        { name: 'start_date', label: 'Start date', type: 'date', required: true },
        { name: 'end_date', label: 'End date (optional)', type: 'date' },
        { name: 'notes', label: 'Notes', span: 2, maxLength: 255 },
      ]}
      emptyForm={{ driver_id: '', vehicle_id: '', route_id: '', terminal_id: '', start_date: todayISO(), end_date: '', notes: '' }}
      toForm={(a) => a}
      toPayload={(v) => cleanPayload(v, ['driver_id', 'vehicle_id', 'route_id', 'terminal_id'])}
    />
  );
}
