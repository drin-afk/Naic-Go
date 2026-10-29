import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, MessageSquarePlus } from 'lucide-react';
import api, { openFile, parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, ErrorState, Loading, PageHeader, ReportStatusBadge, Spinner, Textarea, VehicleTypeChip } from '../../components/ui';
import { EvidencePicker } from './ReportNew';
import { REPORT_STATUSES, formatDate, titleCase } from '../../utils/format';

export function Timeline({ items }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-maroon/15 pl-6">
      {items.map((h) => (
        <li key={h.id} className="relative">
          <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${h.is_internal ? 'bg-muted' : 'bg-brand'}`} />
          <p className="text-sm font-semibold">
            {h.to_status && h.from_status !== h.to_status ? `Status: ${REPORT_STATUSES[h.to_status]?.label || h.to_status}` : titleCase(h.action)}
            {h.is_internal ? <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">Internal</span> : null}
          </p>
          {h.note && <p className="mt-0.5 whitespace-pre-line text-sm text-ink/80">{h.note}</p>}
          <p className="mt-0.5 text-xs text-muted">{h.actor || h.actor_name || 'System'} · {formatDate(h.created_at, true)}</p>
        </li>
      ))}
    </ol>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: r, loading, error, reload } = useApi(`/commuter/reports/${id}`);
  const [msg, setMsg] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const respond = async (e) => {
    e.preventDefault();
    if (msg.trim().length < 5) return toast.error('Please write a short message (at least 5 characters).');
    const fd = new FormData();
    fd.append('message', msg);
    files.forEach((f) => fd.append('evidence', f));
    setBusy(true);
    try { await api.post(`/commuter/reports/${id}/responses`, fd); toast.success('Information added to your report.'); setMsg(''); setFiles([]); reload(); }
    catch (err) { toast.error(parseError(err).message); } finally { setBusy(false); }
  };

  if (loading) return <Loading rows={4} />;
  if (error) return <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />;
  const closed = ['closed', 'rejected'].includes(r.status);

  return (
    <div className="max-w-4xl">
      <PageHeader back={{ to: '/commuter/reports', label: 'My reports' }} title={`Report ${r.reference_no}`} subtitle={`Submitted ${formatDate(r.created_at, true)}`}
        actions={<ReportStatusBadge status={r.status} />} />
      {r.status === 'info_requested' && <Alert tone="warning" title="The administrator needs more information" className="mb-5">See the latest update below and reply using the form at the bottom of this page.</Alert>}
      {r.status === 'resolved' && r.resolution_summary && <Alert tone="success" title="Resolution" className="mb-5">{r.resolution_summary}</Alert>}
      {r.status === 'rejected' && r.rejection_reason && <Alert tone="danger" title="Reason for rejection" className="mb-5">{r.rejection_reason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="card p-5">
          <h2 className="text-lg">Report details</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div><dt className="text-muted">Category</dt><dd className="font-semibold">{r.category_label}</dd></div>
            <div><dt className="text-muted">Transportation</dt><dd><VehicleTypeChip type={r.vehicle_type} /></dd></div>
            <div><dt className="text-muted">Plate / body number</dt><dd className="font-semibold">{r.vehicle_identifier || 'Not provided'}</dd></div>
            <div><dt className="text-muted">Driver description</dt><dd className="font-semibold">{r.driver_identifier || 'Not provided'}</dd></div>
            <div><dt className="text-muted">Route / terminal</dt><dd className="font-semibold">{[r.route_code && `${r.route_code} — ${r.route_name}`, r.terminal_name].filter(Boolean).join(' · ') || 'Not specified'}</dd></div>
            <div><dt className="text-muted">Incident</dt><dd className="font-semibold">{formatDate(r.incident_date)}{r.incident_time ? ` at ${r.incident_time.slice(0, 5)}` : ''}</dd></div>
            <div><dt className="text-muted">Description</dt><dd className="whitespace-pre-line">{r.description}</dd></div>
          </dl>
          {r.evidence.length > 0 && (
            <div className="mt-4 border-t border-black/5 pt-3">
              <p className="text-sm font-semibold">Your evidence</p>
              <ul className="mt-2 space-y-1.5">
                {r.evidence.map((f) => (
                  <li key={f.id}><button className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" onClick={() => openFile(`/commuter/reports/${r.id}/evidence/${f.id}`).catch((e) => toast.error(parseError(e).message))}>
                    <FileText className="h-4 w-4" /> {f.original_name}</button></li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-4 text-lg">Status history</h2>
          <Timeline items={r.history} />
        </section>
      </div>

      {!closed && (
        <form onSubmit={respond} className="card mt-6 space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-lg"><MessageSquarePlus className="h-5 w-5 text-brand" /> Add information</h2>
          <Textarea label="Message to the administrator" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} rows={4} />
          <EvidencePicker files={files} setFiles={setFiles} />
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Send</button>
        </form>
      )}
    </div>
  );
}
