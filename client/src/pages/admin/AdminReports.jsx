import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi, useDebounce } from '../../hooks/useApi';
import { Alert, ErrorState, Loading, PageHeader, Pagination, ReportStatusBadge, Table, VehicleTypeChip } from '../../components/ui';
import { COMPLAINT_CATEGORIES, REPORT_STATUSES, VEHICLE_TYPES, formatDate } from '../../utils/format';

export default function AdminReports() {
  const navigate = useNavigate();
  const [f, setF] = useState({ status: '', category: '', type: '', assigned: '', from: '', to: '' });
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const params = Object.fromEntries(Object.entries({ ...f, q: dq, page }).filter(([, v]) => v !== '' && v != null));
  const { data, meta, loading, error, reload } = useApi('/admin/reports', params);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };

  return (
    <div>
      <PageHeader title="Passenger reports" subtitle="Confidential complaint review. Reports are allegations until reviewed — record findings fairly and give drivers a chance to respond." />
      <Alert tone="warning" className="mb-4">Complaint details and evidence are restricted to administrators. Do not share complainant identities with drivers. Opening a report is recorded in the audit log.</Alert>
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="relative md:col-span-3 xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Reference, plate, description" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search reports" />
        </div>
        <select className="input" value={f.status} onChange={set('status')} aria-label="Status"><option value="">All statuses</option>{Object.entries(REPORT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select className="input" value={f.category} onChange={set('category')} aria-label="Category"><option value="">All categories</option>{COMPLAINT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <select className="input" value={f.type} onChange={set('type')} aria-label="Vehicle type"><option value="">All vehicles</option>{VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</select>
        <select className="input" value={f.assigned} onChange={set('assigned')} aria-label="Assignment"><option value="">Any assignee</option><option value="me">Assigned to me</option><option value="none">Unassigned</option></select>
        <div className="grid grid-cols-2 gap-2 md:col-span-3 xl:col-span-2">
          <input type="date" className="input" value={f.from} onChange={set('from')} aria-label="Submitted from" />
          <input type="date" className="input" value={f.to} onChange={set('to')} aria-label="Submitted to" />
        </div>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <Table rows={data} empty="No reports match these filters." onRowClick={(r) => navigate(`/admin/reports/${r.id}`)} columns={[
            { key: 'reference_no', label: 'Reference', render: (r) => <Link to={`/admin/reports/${r.id}`} className="font-semibold text-maroon hover:underline">{r.reference_no}</Link> },
            { key: 'category_label', label: 'Category' },
            { key: 'vehicle', label: 'Vehicle', render: (r) => <span className="flex flex-col gap-1"><VehicleTypeChip type={r.vehicle_type} /><span className="text-xs text-muted">{r.vehicle_identifier || 'Unknown'}</span></span> },
            { key: 'where', label: 'Route / terminal', render: (r) => <span className="text-xs">{[r.route_code, r.terminal_name].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'incident_date', label: 'Incident', render: (r) => formatDate(r.incident_date) },
            { key: 'created_at', label: 'Submitted', render: (r) => formatDate(r.created_at) },
            { key: 'assigned_admin', label: 'Assigned', render: (r) => r.assigned_admin || <span className="text-muted">—</span> },
            { key: 'status', label: 'Status', render: (r) => <ReportStatusBadge status={r.status} /> },
          ]} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
