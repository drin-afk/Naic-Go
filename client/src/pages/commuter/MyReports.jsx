import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileWarning, Flag } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination, ReportStatusBadge, Table, VehicleTypeChip } from '../../components/ui';
import { REPORT_STATUSES, formatDate } from '../../utils/format';

export default function MyReports() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const status = sp.get('status') || '';
  const page = sp.get('page') || 1;
  const { data, meta, loading, error, reload } = useApi('/commuter/reports', { status: status || undefined, page });

  return (
    <div>
      <PageHeader title="My reports" subtitle="Only you and authorized NaicGo administrators can see these reports."
        actions={<Link to="/commuter/reports/new" className="btn-primary"><Flag className="h-4 w-4" /> New report</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(REPORT_STATUSES).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setSp(k ? { status: k } : {})} className={`btn-sm btn ${status === k ? 'bg-maroon text-white' : 'bg-white text-ink ring-1 ring-black/10 hover:bg-black/5'}`}>{l}</button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={FileWarning} title="No reports found" action={<Link to="/commuter/reports/new" className="btn-primary">Report a Driver</Link>} />
      ) : (
        <>
          <Table rows={data} onRowClick={(r) => navigate(`/commuter/reports/${r.id}`)} columns={[
            { key: 'reference_no', label: 'Reference', render: (r) => <Link to={`/commuter/reports/${r.id}`} className="font-semibold text-maroon hover:underline">{r.reference_no}</Link> },
            { key: 'category', label: 'Category', render: (r) => r.category_label },
            { key: 'vehicle', label: 'Vehicle', render: (r) => <span className="flex flex-col gap-1"><VehicleTypeChip type={r.vehicle_type} />{r.vehicle_identifier && <span className="text-xs text-muted">{r.vehicle_identifier}</span>}</span> },
            { key: 'incident_date', label: 'Incident date', render: (r) => formatDate(r.incident_date) },
            { key: 'created_at', label: 'Submitted', render: (r) => formatDate(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <ReportStatusBadge status={r.status} /> },
          ]} />
          <Pagination meta={meta} onPage={(p) => setSp({ ...(status ? { status } : {}), page: String(p) })} />
        </>
      )}
    </div>
  );
}
