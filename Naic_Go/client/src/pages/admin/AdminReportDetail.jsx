import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, Lock } from 'lucide-react';
import api, { downloadFile, openFile, parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, ErrorState, Loading, PageHeader, ReportStatusBadge, Select, Spinner, Textarea, VehicleTypeChip } from '../../components/ui';
import { Timeline } from '../commuter/ReportDetail';
import { REPORT_STATUSES, formatDate } from '../../utils/format';

export default function AdminReportDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const { data: r, loading, error, reload } = useApi(`/admin/reports/${id}`);
  const opts = useApi('/admin/options');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (r) setForm({
      status: r.status, public_note: '', admin_notes: '', resolution_summary: r.resolution_summary || '', rejection_reason: r.rejection_reason || '',
      driver_response: r.driver_response || '', assigned_admin_id: r.assigned_admin_id || '', vehicle_id: r.vehicle_id || '', driver_id: r.driver_id || '',
    });
  }, [r]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = async (e) => {
    e.preventDefault();
    const body = {};
    const num = (v) => (v === '' ? null : Number(v));
    if (form.status !== r.status) body.status = form.status;
    if (form.public_note.trim()) body.public_note = form.public_note.trim();
    if (form.admin_notes.trim()) body.admin_notes = form.admin_notes.trim();
    for (const k of ['resolution_summary', 'rejection_reason', 'driver_response']) if ((form[k] || '') !== (r[k] || '')) body[k] = form[k];
    for (const k of ['assigned_admin_id', 'vehicle_id', 'driver_id']) if (num(form[k]) !== (r[k] ?? null)) body[k] = num(form[k]);
    if (!Object.keys(body).length) return toast.info('No changes to save.');
    setBusy(true);
    try { await api.patch(`/admin/reports/${id}`, body); toast.success('Report updated.'); reload(); }
    catch (err) { const p = parseError(err); setErrors(p.fieldErrors || {}); toast.error(p.message); } finally { setBusy(false); }
  };

  if (loading || !form) return error ? <ErrorState error={error} onRetry={reload} /> : <Loading rows={4} />;
  const allowed = [r.status, ...r.allowed_transitions];
  const o = opts.data || { admins: [], vehicles: [], drivers: [] };

  return (
    <div>
      <PageHeader back={{ to: '/admin/reports', label: 'Passenger reports' }} title={`Report ${r.reference_no}`}
        subtitle={`${r.category_label} · submitted ${formatDate(r.created_at, true)}`} actions={<ReportStatusBadge status={r.status} />} />
      <Alert tone="info" className="mb-6">Treat this report as an allegation until reviewed. Linking a driver or vehicle records an association you have verified — it is never shown publicly and does not by itself establish wrongdoing.</Alert>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg">Incident</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Transportation</dt><dd><VehicleTypeChip type={r.vehicle_type} /></dd></div>
              <div><dt className="text-muted">Incident date & time</dt><dd className="font-semibold">{formatDate(r.incident_date)}{r.incident_time ? ` · ${r.incident_time.slice(0, 5)}` : ''}</dd></div>
              <div><dt className="text-muted">Plate / body no. (as reported)</dt><dd className="font-semibold">{r.vehicle_identifier || 'Not provided'}</dd></div>
              <div><dt className="text-muted">Driver description (as reported)</dt><dd className="font-semibold">{r.driver_identifier || 'Not provided'}</dd></div>
              <div><dt className="text-muted">Route</dt><dd className="font-semibold">{r.route_code ? <Link className="hover:text-brand" to={`/routes/${r.route_id}`}>{r.route_code} — {r.route_name}</Link> : '—'}</dd></div>
              <div><dt className="text-muted">Terminal</dt><dd className="font-semibold">{r.terminal_name || '—'}</dd></div>
              <div><dt className="text-muted">Linked vehicle (verified)</dt><dd className="font-semibold">{r.linked_vehicle_identifier || 'None'}</dd></div>
              <div><dt className="text-muted">Linked driver (verified)</dt><dd className="font-semibold">{r.linked_driver_name || 'None'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Description</dt><dd className="mt-1 whitespace-pre-line rounded-xl bg-warm p-3">{r.description}</dd></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-lg"><Lock className="h-4 w-4 text-muted" /> Complainant (confidential)</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Name</dt><dd className="font-semibold">{r.commuter_name}</dd></div>
              <div><dt className="text-muted">Email</dt><dd className="font-semibold">{r.commuter_email}</dd></div>
              <div><dt className="text-muted">Preferred contact</dt><dd className="font-semibold capitalize">{r.preferred_contact}{r.contact_detail ? ` · ${r.contact_detail}` : ''}</dd></div>
              <div><dt className="text-muted">Profile phone</dt><dd className="font-semibold">{r.commuter_contact || '—'}</dd></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-lg">Evidence</h2>
            {r.evidence.length === 0 ? <p className="mt-2 text-sm text-muted">No files attached.</p> : (
              <ul className="mt-3 divide-y divide-black/5">
                {r.evidence.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span>{f.original_name} <span className="text-xs text-muted">({f.mime_type}, {(f.size_bytes / 1024).toFixed(0)} KB, {formatDate(f.created_at, true)})</span></span>
                    <span className="flex gap-1.5">
                      <button className="btn-secondary btn-sm" onClick={() => openFile(`/admin/reports/${r.id}/evidence/${f.id}`).catch((e) => toast.error(parseError(e).message))}><Eye className="h-3.5 w-3.5" /> View</button>
                      <button className="btn-ghost btn-sm" onClick={() => downloadFile(`/admin/reports/${r.id}/evidence/${f.id}`, undefined, f.original_name).catch((e) => toast.error(parseError(e).message))}><Download className="h-3.5 w-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {r.admin_notes && (
            <section className="card p-5">
              <h2 className="text-lg">Investigation notes (private)</h2>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-warm p-3 font-sans text-sm">{r.admin_notes}</pre>
            </section>
          )}

          {r.related_reports.length > 0 && (
            <section className="card p-5">
              <h2 className="text-lg">Other reports mentioning this vehicle</h2>
              <p className="text-xs text-muted">Context for review only — not evidence of wrongdoing.</p>
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {r.related_reports.map((x) => (
                  <li key={x.id}><Link to={`/admin/reports/${x.id}`} className="flex justify-between gap-2 py-2 hover:text-brand"><span>{x.reference_no} · {x.category_label}</span><ReportStatusBadge status={x.status} /></Link></li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-4 text-lg">Full history (audit trail)</h2>
            <Timeline items={r.history} />
          </section>
        </div>

        <form onSubmit={save} className="card h-fit space-y-4 p-5 xl:sticky xl:top-24">
          <h2 className="text-lg">Review & update</h2>
          <Select label="Status" value={form.status} onChange={set('status')} error={errors.status}>
            {allowed.map((s) => <option key={s} value={s}>{REPORT_STATUSES[s].label}</option>)}
          </Select>
          <Select label="Assigned administrator" value={form.assigned_admin_id} onChange={set('assigned_admin_id')}>
            <option value="">Unassigned</option>{o.admins.map((a) => <option key={a.id} value={a.id}>{a.full_name}{a.id === user.id ? ' (me)' : ''}</option>)}
          </Select>
          <Textarea label={form.status === 'info_requested' && r.status !== 'info_requested' ? 'Message to commuter (required)' : 'Message to commuter (optional)'} value={form.public_note} onChange={set('public_note')} error={errors.public_note} rows={3} maxLength={2000}
            hint="Visible to the commuter and sent as a notification." />
          {form.status === 'rejected' && <Textarea label="Rejection reason (required)" value={form.rejection_reason} onChange={set('rejection_reason')} error={errors.rejection_reason} rows={2} maxLength={500} />}
          {['resolved', 'closed'].includes(form.status) || r.resolution_summary ? (
            <Textarea label={form.status === 'resolved' ? 'Resolution summary (required)' : 'Resolution summary'} value={form.resolution_summary} onChange={set('resolution_summary')} error={errors.resolution_summary} rows={3} maxLength={3000} hint="Visible to the commuter." />
          ) : null}
          <Textarea label="Add investigation note (private)" value={form.admin_notes} onChange={set('admin_notes')} rows={3} maxLength={5000} hint="Appended with your name and time. Never shown to commuters or drivers." />
          <Textarea label="Driver's response (recorded by administrator)" value={form.driver_response} onChange={set('driver_response')} rows={3} maxLength={3000} hint="Give the driver a fair chance to respond through an administrator-managed process." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Select label="Link verified vehicle" value={form.vehicle_id} onChange={set('vehicle_id')}>
              <option value="">None</option>{o.vehicles.map((v) => <option key={v.id} value={v.id}>{v.identifier}</option>)}
            </Select>
            <Select label="Link verified driver" value={form.driver_id} onChange={set('driver_id')}>
              <option value="">None</option>{o.drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </Select>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Save changes</button>
        </form>
      </div>
    </div>
  );
}
