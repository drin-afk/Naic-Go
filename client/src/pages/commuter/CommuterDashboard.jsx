import { Link } from 'react-router-dom';
import { ArrowRight, FileWarning, Flag, FolderOpen, Search } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { RouteSearchForm } from '../../components/transport';
import { EmptyState, ErrorState, Loading, PageHeader, ReportStatusBadge, StatCard } from '../../components/ui';
import { EmailVerificationNotice } from '../shared/AccountSecurity';
import { formatDate } from '../../utils/format';

export default function CommuterDashboard() {
  const { user } = useAuth();
  const profile = useApi('/commuter/profile');
  const reports = useApi('/commuter/reports', { pageSize: 5 });
  const s = profile.data?.report_stats;

  return (
    <div>
      <PageHeader title={`Hello, ${user.full_name.split(' ')[0]}!`} subtitle="Plan your trip or follow up on your passenger reports."
        actions={<Link to="/commuter/reports/new" className="btn-primary"><Flag className="h-4 w-4" /> Report a Driver</Link>} />
      <div className="mb-6"><EmailVerificationNotice /></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total reports" value={s?.total} icon={FileWarning} to="/commuter/reports" />
        <StatCard label="Open reports" value={s?.open} icon={FolderOpen} tone="amber" to="/commuter/reports?status=under_review" />
        <StatCard label="Closed / resolved" value={s?.closed} icon={FileWarning} tone="green" />
      </div>
      <section className="card mb-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg"><Search className="h-5 w-5 text-brand" /> Find a route</h2>
        <RouteSearchForm compact />
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg">Recent reports</h2><Link to="/commuter/reports" className="link text-sm">View all</Link></div>
        {reports.loading ? <Loading rows={2} /> : reports.error ? <ErrorState error={reports.error} onRetry={reports.reload} /> : reports.data.length === 0 ? (
          <EmptyState icon={FileWarning} title="No reports yet">If something goes wrong on a trip, you can report it here. Each report gets a reference number.</EmptyState>
        ) : (
          <ul className="card divide-y divide-black/5">
            {reports.data.map((r) => (
              <li key={r.id}>
                <Link to={`/commuter/reports/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-warm">
                  <div><p className="font-semibold">{r.reference_no}</p><p className="text-sm text-muted">{r.category_label} · {formatDate(r.created_at)}</p></div>
                  <div className="flex items-center gap-3"><ReportStatusBadge status={r.status} /><ArrowRight className="h-4 w-4 text-muted" /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
