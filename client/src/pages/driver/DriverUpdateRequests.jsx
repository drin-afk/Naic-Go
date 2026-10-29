import { useState } from 'react';
import { Plus } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, ErrorState, Input, Loading, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../../components/ui';
import { formatDate, titleCase } from '../../utils/format';

export default function DriverUpdateRequests() {
  const { data, loading, error, reload } = useApi('/driver/update-requests');
  const options = useApi('/driver/options');
  const vehicles = useApi('/driver/vehicles');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const empty = { entity_type: 'route', entity_id: '', title: '', proposed_changes: '', reason: '' };
  const { values, setValues, set, errors, setErrors } = useForm(empty);
  const [busy, setBusy] = useState(false);

  const entityOptions = {
    route: (options.data?.routes || []).map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` })),
    fare: (options.data?.routes || []).map((r) => ({ id: r.id, label: `Fare for ${r.code} — ${r.name}` })),
    terminal: (options.data?.terminals || []).map((t) => ({ id: t.id, label: t.name })),
    vehicle: (vehicles.data || []).map((v) => ({ id: v.id, label: v.identifier })),
    other: [],
  }[values.entity_type];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // For fare requests the selected record is the route whose fare should change.
      const body = { ...values, entity_id: values.entity_id ? Number(values.entity_id) : null };
      await api.post('/driver/update-requests', body);
      toast.success('Update request submitted for review.');
      setOpen(false); setValues(empty); reload();
    } catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Information update requests" subtitle="Propose corrections to routes, fares, terminals or your vehicle. An administrator reviews every request before anything is published."
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New request</button>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState title="No update requests yet" action={<button className="btn-primary" onClick={() => setOpen(true)}>Submit a request</button>}>
          Noticed a wrong fare, a new stop, or a terminal change? Let the administrator know.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-xs font-semibold uppercase text-muted">{titleCase(r.entity_type)} · {formatDate(r.created_at)}</p><h2 className="mt-1 text-base">{r.title}</h2></div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{r.proposed_changes}</p>
              {r.reason && <p className="mt-1 text-xs text-muted">Reason: {r.reason}</p>}
              {r.review_notes && <Alert tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} className="mt-3" title={`Administrator notes (${formatDate(r.reviewed_at)})`}>{r.review_notes}</Alert>}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New update request"
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" form="ur-form" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Submit</button></>}>
        <form id="ur-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Update is about" value={values.entity_type} onChange={(e) => setValues((v) => ({ ...v, entity_type: e.target.value, entity_id: '' }))}>
              <option value="route">A route</option><option value="fare">A fare</option><option value="terminal">A terminal</option><option value="vehicle">My vehicle</option><option value="other">Something else</option>
            </Select>
            {values.entity_type !== 'other' && (
              <Select label="Which record?" value={values.entity_id} onChange={set('entity_id')} error={errors.entity_id}>
                <option value="">Select…</option>{entityOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            )}
          </div>
          <Input label="Short title" value={values.title} onChange={set('title')} error={errors.title} maxLength={150} required />
          <Textarea label="Proposed changes" value={values.proposed_changes} onChange={set('proposed_changes')} error={errors.proposed_changes} maxLength={3000} required
            placeholder="Describe exactly what should change, e.g. 'Regular fare from Terminal A to Terminal C is now ₱15–₱22 since 1 Oct'." />
          <Input label="Reason or source (optional)" value={values.reason} onChange={set('reason')} error={errors.reason} maxLength={500} placeholder="e.g. new fare matrix posted at terminal" />
        </form>
      </Modal>
    </div>
  );
}
