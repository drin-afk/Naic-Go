import { useState } from 'react';
import { CarFront, History, Pencil, Radio } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { AvailabilityBadge, DemoBadge, EmptyState, ErrorState, Input, Loading, Modal, PageHeader, Pagination, Select, Spinner, StatusBadge, Table, VehicleTypeChip } from '../../components/ui';
import { AVAILABILITY, formatDate, timeAgo } from '../../utils/format';

function AvailabilityModal({ vehicle, terminals, onClose, onSaved }) {
  const toast = useToast();
  const defaultTerminal = vehicle?.assignments?.[0]?.terminal_id || '';
  const { values, set, errors, setErrors } = useForm({ status: 'available', terminal_id: defaultTerminal, note: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/driver/availability', { vehicle_id: vehicle.id, ...values, terminal_id: values.terminal_id || null, note: values.note || null });
      toast.success('Availability reported.'); onSaved();
    } catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Report availability — ${vehicle.identifier}`} size="sm"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" form="avail-form" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Submit report</button></>}>
      <form id="avail-form" onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="label">Status</legend>
          <div className="grid gap-2">
            {Object.entries(AVAILABILITY).map(([k, v]) => (
              <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${values.status === k ? 'border-brand bg-brand-50' : 'border-black/10'}`}>
                <input type="radio" name="status" value={k} checked={values.status === k} onChange={set('status')} className="text-brand focus:ring-brand" />
                <span className="font-semibold">{v.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Select label="Current terminal (optional)" value={values.terminal_id} onChange={set('terminal_id')} error={errors.terminal_id}>
          <option value="">Not at a terminal</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Input label="Note (optional)" value={values.note} onChange={set('note')} maxLength={255} placeholder="e.g. Back in service after lunch" />
        <p className="text-xs text-muted">This is shown to commuters as a driver report with a timestamp. It is not GPS tracking.</p>
      </form>
    </Modal>
  );
}

function EditModal({ vehicle, onClose, onSaved }) {
  const toast = useToast();
  const { values, set, errors, setErrors } = useForm({ description: vehicle.description || '', color: vehicle.color || '', capacity: vehicle.capacity || '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.patch(`/driver/vehicles/${vehicle.id}`, { ...values, capacity: values.capacity === '' ? null : Number(values.capacity) }); toast.success('Vehicle updated.'); onSaved(); }
    catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Edit ${vehicle.identifier}`} size="sm"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" form="veh-form" disabled={busy}>Save</button></>}>
      <form id="veh-form" onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted">The plate/body number, type and status are managed by the administrator. Submit an update request if they are wrong.</p>
        <Input label="Description" value={values.description} onChange={set('description')} error={errors.description} maxLength={255} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Color" value={values.color} onChange={set('color')} error={errors.color} maxLength={40} />
          <Input label="Passenger capacity" type="number" min="1" max="120" value={values.capacity} onChange={set('capacity')} error={errors.capacity} />
        </div>
      </form>
    </Modal>
  );
}

export default function DriverVehicles() {
  const { data, loading, error, reload } = useApi('/driver/vehicles');
  const options = useApi('/driver/options');
  const [page, setPage] = useState(1);
  const history = useApi('/driver/availability', { page });
  const [reporting, setReporting] = useState(null);
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <PageHeader title="My vehicles" subtitle="Vehicles currently assigned to you by the administrator." />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={CarFront} title="No vehicles assigned">Once an administrator assigns a vehicle to you, it will appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((v) => (
            <div key={v.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><VehicleTypeChip type={v.vehicle_type} /><StatusBadge status={v.status} /><DemoBadge show={v.is_demo} /></div>
                  <h2 className="mt-2 text-xl">{v.identifier}</h2>
                  <p className="text-sm text-muted">{[v.description, v.color, v.capacity && `${v.capacity} seats`].filter(Boolean).join(' · ') || 'No description'}</p>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(v)}><Pencil className="h-4 w-4" /> Edit</button>
              </div>
              <div className="mt-4 rounded-xl bg-warm p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-muted">Latest report</p>
                {v.latest_status ? <p className="mt-1 flex items-center gap-2"><AvailabilityBadge status={v.latest_status} /> <span className="text-xs text-muted">{timeAgo(v.latest_reported_at)}</span></p> : <p className="mt-1 text-muted">No reports yet</p>}
              </div>
              {v.assignments.map((a) => <p key={a.id} className="mt-2 text-xs text-muted">Route: {a.route_code || '—'} · Terminal: {a.terminal_name || '—'}</p>)}
              <button className="btn-primary mt-4 w-full" onClick={() => setReporting(v)} disabled={v.status !== 'active'}><Radio className="h-4 w-4" /> Report availability</button>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg"><History className="h-5 w-5 text-brand" /> Availability history</h2>
        {history.loading ? <Loading rows={2} /> : history.error ? <ErrorState error={history.error} onRetry={history.reload} /> : (
          <>
            <Table rows={history.data} empty="No availability reports yet." columns={[
              { key: 'vehicle_identifier', label: 'Vehicle' },
              { key: 'status', label: 'Status', render: (r) => <AvailabilityBadge status={r.status} /> },
              { key: 'terminal_name', label: 'Terminal' },
              { key: 'note', label: 'Note' },
              { key: 'reported_at', label: 'Reported', render: (r) => formatDate(r.reported_at, true) },
            ]} />
            <Pagination meta={history.meta} onPage={setPage} />
          </>
        )}
      </section>

      {reporting && <AvailabilityModal vehicle={reporting} terminals={options.data?.terminals || []} onClose={() => setReporting(null)} onSaved={() => { setReporting(null); reload(); history.reload(); }} />}
      {editing && <EditModal vehicle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
