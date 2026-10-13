import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, Paperclip, ShieldCheck, Trash2 } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, Input, PageHeader, Select, Spinner, Textarea } from '../../components/ui';
import { COMPLAINT_CATEGORIES, VEHICLE_TYPES, todayISO } from '../../utils/format';

const MAX_FILES = 3;
const MAX_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function EvidencePicker({ files, setFiles }) {
  const toast = useToast();
  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const next = [...files];
    for (const f of picked) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name}: only JPG, PNG, WEBP or PDF files are allowed.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} is larger than ${MAX_MB} MB.`); continue; }
      if (next.length >= MAX_FILES) { toast.error(`You can attach up to ${MAX_FILES} files.`); break; }
      next.push(f);
    }
    setFiles(next);
  };
  return (
    <div>
      <p className="label">Supporting evidence (optional)</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/15 bg-warm px-4 py-6 text-center text-sm text-muted hover:border-brand/50">
        <Paperclip className="h-5 w-5 text-brand" aria-hidden />
        <span><span className="font-semibold text-brand">Choose files</span> — photos or a PDF receipt</span>
        <span className="text-xs">Up to {MAX_FILES} files, {MAX_MB} MB each. Files are private and only visible to administrators.</span>
        <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" className="sr-only" onChange={add} />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/10">
              <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{f.name}</span><span className="text-xs text-muted">{(f.size / 1024).toFixed(0)} KB</span></span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:text-accent" aria-label={`Remove ${f.name}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportNew() {
  const [sp] = useSearchParams();
  const toast = useToast();
  const routes = useApi('/routes');
  const terminals = useApi('/terminals', { pageSize: 100 });
  const { values, set, errors, setErrors } = useForm({
    vehicle_type: VEHICLE_TYPES.some((v) => v.code === sp.get('vehicle_type')) ? sp.get('vehicle_type') : '',
    vehicle_identifier: '', driver_identifier: '',
    route_id: sp.get('route_id') || '', terminal_id: sp.get('terminal_id') || '', vehicle_id: sp.get('vehicle_id') || '',
    incident_date: todayISO(), incident_time: '', category: '', description: '', preferred_contact: 'email', contact_detail: '',
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const routeOptions = useMemo(() => (routes.data?.results || []).filter((r) => !values.vehicle_type || r.vehicle_type === values.vehicle_type), [routes.data, values.vehicle_type]);

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!values.vehicle_type) local.vehicle_type = 'Select the transportation type.';
    if (!values.category) local.category = 'Select a category.';
    if (!values.incident_date) local.incident_date = 'Enter the incident date.';
    if (values.description.trim().length < 20) local.description = 'Please describe what happened (at least 20 characters).';
    setErrors(local);
    if (Object.keys(local).length) return;

    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
    files.forEach((f) => fd.append('evidence', f));
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/commuter/reports', fd);
      setDone(data.data);
      toast.success('Report submitted.');
      window.scrollTo(0, 0);
    } catch (err) {
      const p = parseError(err); setErrors(p.fieldErrors || {}); setError(p.message);
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-2xl">Your report has been submitted</h1>
          <p className="mt-2 text-sm text-muted">Keep this reference number for follow-ups:</p>
          <p className="mx-auto mt-3 w-fit rounded-xl bg-maroon-50 px-5 py-3 font-mono text-xl font-bold tracking-wider text-maroon">{done.reference_no}</p>
          <p className="mt-4 text-sm text-muted">An administrator will review it. You&apos;ll get a notification whenever the status changes.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to={`/commuter/reports/${done.id}`} className="btn-primary">View report</Link>
            <Link to="/commuter/dashboard" className="btn-secondary">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const prefilled = sp.get('route_id') || sp.get('terminal_id') || sp.get('vehicle_id');
  return (
    <div className="max-w-3xl">
      <PageHeader title="Report a driver or problem" subtitle="Tell us what happened. Fields marked * are required; you don't need to know the driver's name or plate number." />
      <Alert tone="info" className="mb-5" title="Fair and private review">
        <span className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Reports are treated as allegations until reviewed by an administrator. Your identity is not shared with the driver.</span>
      </Alert>
      {prefilled && <Alert tone="warning" className="mb-5">Details from the page you came from were pre-filled for convenience. This does not assume that a particular driver is responsible — please correct anything that doesn&apos;t match.</Alert>}
      <form onSubmit={submit} className="card space-y-5 p-6" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Transportation type" value={values.vehicle_type} onChange={set('vehicle_type')} error={errors.vehicle_type} required>
            <option value="">Select…</option>{VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
          </Select>
          <Select label="Complaint category" value={values.category} onChange={set('category')} error={errors.category} required>
            <option value="">Select…</option>{COMPLAINT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Plate / body number (if known)" value={values.vehicle_identifier} onChange={set('vehicle_identifier')} error={errors.vehicle_identifier} maxLength={60} />
          <Input label="Driver name or description (if known)" value={values.driver_identifier} onChange={set('driver_identifier')} error={errors.driver_identifier} maxLength={120} />
          <Select label="Related route (optional)" value={values.route_id} onChange={set('route_id')} error={errors.route_id}>
            <option value="">Not sure / not listed</option>{routeOptions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
          </Select>
          <Select label="Related terminal (optional)" value={values.terminal_id} onChange={set('terminal_id')} error={errors.terminal_id}>
            <option value="">Not sure / not listed</option>{(terminals.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Incident date" type="date" max={todayISO()} value={values.incident_date} onChange={set('incident_date')} error={errors.incident_date} required />
          <Input label="Approximate time" type="time" value={values.incident_time} onChange={set('incident_time')} error={errors.incident_time} />
        </div>
        <Textarea label="What happened?" value={values.description} onChange={set('description')} error={errors.description} required maxLength={3000}
          hint={`${values.description.length}/3000 — include the fare charged, where you boarded, and any other helpful details.`} rows={6} />
        <EvidencePicker files={files} setFiles={setFiles} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Preferred contact for follow-up" value={values.preferred_contact} onChange={set('preferred_contact')}>
            <option value="email">Email (account email)</option><option value="phone">Phone</option><option value="none">In-app notifications only</option>
          </Select>
          {values.preferred_contact === 'phone' && <Input label="Phone number" value={values.contact_detail} onChange={set('contact_detail')} error={errors.contact_detail} maxLength={120} />}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-black/5 pt-5 sm:flex-row sm:justify-end">
          <Link to="/commuter/reports" className="btn-ghost">Cancel</Link>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Submit report</button>
        </div>
      </form>
    </div>
  );
}
