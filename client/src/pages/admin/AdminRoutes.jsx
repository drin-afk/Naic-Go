import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import ResourceManager, { FormFields } from './ResourceManager';
import { StatusChanger } from './AdminTerminals';
import { Alert, Loading, Modal, Spinner, StatusBadge, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';

const blankStop = () => ({ name: '', terminal_id: '', latitude: '', longitude: '', is_boarding: true, is_dropoff: true });

function RouteEditor({ routeId, options, onClose, onSaved }) {
  const toast = useToast();
  const existing = useApi(routeId ? `/admin/routes/${routeId}` : null, undefined, { skip: !routeId });
  if (routeId && existing.loading) return <Modal open onClose={onClose} title="Edit route"><Loading rows={3} /></Modal>;
  const r = existing.data;
  const initial = r ? {
    code: r.code, name: r.name, origin: r.origin, destination: r.destination, vehicle_type_id: r.vehicle_type_id, distance_km: r.distance_km ?? '',
    description: r.description || '', requires_transfer: r.requires_transfer, transfer_notes: r.transfer_notes || '', status: r.status,
    verification_status: r.verification_status, verified_at: r.verified_at || '',
    stops: r.stops.map((s) => ({ name: s.name, terminal_id: s.terminal_id || '', latitude: s.latitude ?? '', longitude: s.longitude ?? '', is_boarding: Boolean(s.is_boarding), is_dropoff: Boolean(s.is_dropoff) })),
    terminals: r.terminals.map((t) => ({ terminal_id: t.id, role: t.role })),
    alternative_route_ids: r.alternative_route_ids,
  } : {
    code: '', name: '', origin: '', destination: '', vehicle_type_id: '', distance_km: '', description: '', requires_transfer: false, transfer_notes: '',
    status: 'active', verification_status: 'unverified', verified_at: '', stops: [blankStop(), blankStop()], terminals: [], alternative_route_ids: [],
  };
  return <RouteForm initial={initial} routeId={routeId} options={options} onClose={onClose} onSaved={onSaved} toast={toast} />;
}

function RouteForm({ initial, routeId, options, onClose, onSaved, toast }) {
  const form = useForm(initial);
  const { values, setValues } = form;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const terminalOpts = options.terminals.map((t) => ({ value: t.id, label: t.name }));

  const setStop = (i, k, v) => setValues((x) => ({ ...x, stops: x.stops.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const moveStop = (i, d) => setValues((x) => {
    const stops = [...x.stops]; const j = i + d; if (j < 0 || j >= stops.length) return x;
    [stops[i], stops[j]] = [stops[j], stops[i]]; return { ...x, stops };
  });
  const pickTerminalForStop = (i, id) => {
    const t = options.terminals.find((x) => String(x.id) === String(id));
    setValues((x) => ({ ...x, stops: x.stops.map((s, j) => (j === i ? { ...s, terminal_id: id, name: s.name || t?.name || '' } : s)) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    // Derive route_terminals from stops linked to terminals (first = origin, last = destination).
    const linked = values.stops.map((s, i) => ({ ...s, i })).filter((s) => s.terminal_id);
    const terminals = linked.map((s) => ({
      terminal_id: Number(s.terminal_id),
      role: s.i === 0 ? 'origin' : s.i === values.stops.length - 1 ? 'destination' : 'intermediate',
    }));
    const payload = {
      ...values,
      vehicle_type_id: num(values.vehicle_type_id), distance_km: num(values.distance_km), verified_at: values.verified_at || null,
      description: values.description || null, transfer_notes: values.transfer_notes || null,
      stops: values.stops.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim(), terminal_id: num(s.terminal_id), latitude: num(s.latitude), longitude: num(s.longitude) })),
      terminals,
      alternative_route_ids: values.alternative_route_ids.map(Number),
    };
    try {
      if (routeId) await api.put(`/admin/routes/${routeId}`, payload); else await api.post('/admin/routes', payload);
      toast.success('Route saved.'); onSaved();
    } catch (err) { const p = parseError(err); form.setErrors(p.fieldErrors || {}); setError(p.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={routeId ? 'Edit route' : 'Add route'} size="xl"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" form="route-form" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Save route</button></>}>
      <form id="route-form" onSubmit={submit} className="space-y-6" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormFields form={form} fields={[
          { name: 'code', label: 'Route code', required: true, maxLength: 30, hint: 'Letters, numbers and dashes' },
          { name: 'vehicle_type_id', label: 'Transportation type', type: 'select', required: true, options: options.vehicleTypes.map((v) => ({ value: v.id, label: v.name })) },
          { name: 'name', label: 'Route name', required: true, span: 2, maxLength: 150 },
          { name: 'origin', label: 'Origin', required: true, maxLength: 150 },
          { name: 'destination', label: 'Destination', required: true, maxLength: 150 },
          { name: 'distance_km', label: 'Distance (km)', type: 'number', step: '0.01', min: 0 },
          { name: 'status', label: 'Status', type: 'select', placeholder: false, options: ['active', 'inactive', 'suspended', 'archived'].map((s) => ({ value: s, label: s })) },
          { name: 'verification_status', label: 'Verification', type: 'select', placeholder: false, options: [{ value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' }, { value: 'demo', label: 'Demo' }] },
          { name: 'verified_at', label: 'Verification date', type: 'date' },
          { name: 'requires_transfer', label: 'This route requires a transfer', type: 'checkbox' },
          { name: 'transfer_notes', label: 'Transfer notes', maxLength: 255, hidden: (v) => !v.requires_transfer },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, maxLength: 3000 },
        ]} />

        <fieldset>
          <legend className="text-base font-bold">Ordered stops</legend>
          <p className="mb-3 text-xs text-muted">List stops in travel order. Link a stop to a terminal when it is one; terminals linked here become the route&apos;s associated terminals. Coordinates are optional and should only be entered when verified.</p>
          <div className="space-y-2">
            {values.stops.map((s, i) => (
              <div key={i} className="grid items-end gap-2 rounded-xl border border-black/10 bg-warm p-3 md:grid-cols-[28px_1.4fr_1.2fr_0.8fr_0.8fr_auto]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-maroon text-xs font-bold text-white">{i + 1}</span>
                <div><label className="label text-xs" htmlFor={`stop-name-${i}`}>Stop name</label><input id={`stop-name-${i}`} className="input py-2" value={s.name} onChange={(e) => setStop(i, 'name', e.target.value)} maxLength={150} /></div>
                <div><label className="label text-xs" htmlFor={`stop-term-${i}`}>Terminal (optional)</label>
                  <select id={`stop-term-${i}`} className="input py-2" value={s.terminal_id} onChange={(e) => pickTerminalForStop(i, e.target.value)}>
                    <option value="">— none —</option>{terminalOpts.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select></div>
                <div><label className="label text-xs" htmlFor={`stop-lat-${i}`}>Lat</label><input id={`stop-lat-${i}`} type="number" step="any" className="input py-2" value={s.latitude} onChange={(e) => setStop(i, 'latitude', e.target.value)} /></div>
                <div><label className="label text-xs" htmlFor={`stop-lng-${i}`}>Lng</label><input id={`stop-lng-${i}`} type="number" step="any" className="input py-2" value={s.longitude} onChange={(e) => setStop(i, 'longitude', e.target.value)} /></div>
                <div className="flex gap-1">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => moveStop(i, -1)} aria-label="Move stop up" disabled={i === 0}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => moveStop(i, 1)} aria-label="Move stop down" disabled={i === values.stops.length - 1}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm text-accent" onClick={() => setValues((x) => ({ ...x, stops: x.stops.filter((_, j) => j !== i) }))} aria-label="Remove stop"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="flex gap-4 text-xs md:col-span-6 md:pl-9">
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded text-brand" checked={s.is_boarding} onChange={(e) => setStop(i, 'is_boarding', e.target.checked)} /> Boarding point</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded text-brand" checked={s.is_dropoff} onChange={(e) => setStop(i, 'is_dropoff', e.target.checked)} /> Drop-off point</label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setValues((x) => ({ ...x, stops: [...x.stops, blankStop()] }))}><Plus className="h-4 w-4" /> Add stop</button>
        </fieldset>

        <fieldset>
          <legend className="text-base font-bold">Documented alternative routes</legend>
          <p className="mb-2 text-xs text-muted">Shown to commuters when this route is affected by a verified obstruction.</p>
          <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-black/10 p-3 sm:grid-cols-2">
            {options.routes.filter((x) => x.id !== routeId).map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded text-brand" checked={values.alternative_route_ids.map(Number).includes(x.id)}
                  onChange={(e) => setValues((v) => ({ ...v, alternative_route_ids: e.target.checked ? [...v.alternative_route_ids, x.id] : v.alternative_route_ids.filter((id) => Number(id) !== x.id) }))} />
                {x.code} — {x.name}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function AdminRoutes() {
  const opts = useApi('/admin/options');
  const [editing, setEditing] = useState(null);
  const [version, setVersion] = useState(0);
  return (
    <>
      <ResourceManager key={version}
        title="Routes" subtitle="Documented routes with ordered stops, terminals, alternatives and verification."
        endpoint="/admin/routes" entityName="route" canCreate={false} canEdit={false} searchPlaceholder="Search code, name, origin, destination"
        notice={<div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setEditing('new')} disabled={!opts.data}><Plus className="h-4 w-4" /> Add route</button></div>}
        filters={[
          { name: 'type', label: 'Type', options: [{ value: 'tricycle', label: 'Tricycle' }, { value: 'jeepney', label: 'Jeepney' }, { value: 'bus', label: 'Bus' }] },
          { name: 'status', label: 'Status', options: ['active', 'inactive', 'suspended', 'archived'].map((s) => ({ value: s, label: s })) },
        ]}
        columns={[
          { key: 'code', label: 'Route', render: (r) => <div><Link to={`/routes/${r.id}`} className="font-semibold hover:text-brand">{r.code}</Link><p className="text-xs text-muted">{r.name}</p></div> },
          { key: 'vehicle_type', label: 'Type', render: (r) => <VehicleTypeChip type={r.vehicle_type} /> },
          { key: 'od', label: 'Origin → Destination', render: (r) => <span className="text-xs">{r.origin} → {r.destination}</span> },
          { key: 'stop_count', label: 'Stops' },
          { key: 'current_fares', label: 'Fares', render: (r) => r.current_fares || <span className="text-xs text-warning-700">None</span> },
          { key: 'verification_status', label: 'Verification', render: (r) => <div><VerificationBadge status={r.verification_status} /><p className="text-xs text-muted">{formatDate(r.verified_at)}</p></div> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
        rowActions={(row, reload) => <>
          <StatusChanger row={row} endpoint="/admin/routes" options={['active', 'inactive', 'suspended', 'archived']} onDone={reload} />
          <button className="btn-secondary btn-sm" onClick={() => setEditing(row.id)} disabled={!opts.data}>Edit</button>
        </>}
      />
      {editing && opts.data && (
        <RouteEditor routeId={editing === 'new' ? null : editing} options={opts.data} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setVersion((v) => v + 1); opts.reload(); }} />
      )}
    </>
  );
}
