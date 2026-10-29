import { Link } from 'react-router-dom';
import { CarFront, ClipboardList, Map, Radio } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Alert, AvailabilityBadge, EmptyState, ErrorState, Loading, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { formatDate, timeAgo } from '../../utils/format';

export default function DriverDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/driver/dashboard');
  if (loading) return <Loading rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const vehicles = [...new Set(data.assignments.map((a) => a.vehicle_id))];

  return (
    <div>
      <PageHeader title={`Good day, ${user.full_name.split(' ')[0]}!`} subtitle="Report your vehicle availability and keep your information up to date."
        actions={<Link to="/driver/vehicles" className="btn-primary"><Radio className="h-4 w-4" /> Report availability</Link>} />
      <Alert tone="info" className="mb-6">Availability you report is shown to commuters as <strong>driver-reported</strong> information. Reports older than {data.fresh_window_minutes} minutes are shown as outdated, so please update when your status changes.</Alert>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned vehicles" value={vehicles.length} icon={CarFront} to="/driver/vehicles" />
        <StatCard label="Active assignments" value={data.assignments.length} icon={Map} tone="green" to="/driver/assignments" />
        <StatCard label="Pending update requests" value={data.pending_update_requests} icon={ClipboardList} tone="amber" to="/driver/update-requests" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg">Current assignments</h2>
          {data.assignments.length === 0 ? <div className="mt-3"><EmptyState icon={Map} title="No assignments yet">An administrator will assign your vehicle, route and terminal.</EmptyState></div> : (
            <ul className="mt-3 divide-y divide-black/5">
              {data.assignments.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <p className="font-semibold">{a.vehicle_identifier} <StatusBadge status={a.vehicle_status} /></p>
                  <p className="text-muted">{a.route_code ? `${a.route_code} — ${a.route_name}` : 'No route assigned'}</p>
                  <p className="text-xs text-muted">Terminal: {a.terminal_name || '—'} · Since {formatDate(a.start_date)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="text-lg">Latest availability reports</h2>
          {data.latest_reports.length === 0 ? <p className="mt-3 text-sm text-muted">You haven&apos;t reported availability yet.</p> : (
            <ul className="mt-3 divide-y divide-black/5">
              {data.latest_reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div><p className="font-semibold">{r.vehicle_identifier}</p><p className="text-xs text-muted">{r.terminal_name || 'No terminal'} · {timeAgo(r.reported_at)}</p></div>
                  <AvailabilityBadge status={r.status} fresh={r.is_fresh} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {data.recent_decisions.length > 0 && (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-lg">Recent decisions on your update requests</h2>
            <ul className="mt-3 divide-y divide-black/5">
              {data.recent_decisions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><p className="font-semibold">{d.title}</p>{d.review_notes && <p className="text-xs text-muted">{d.review_notes}</p>}</div>
                  <div className="flex items-center gap-2"><StatusBadge status={d.status} /><span className="text-xs text-muted">{formatDate(d.reviewed_at)}</span></div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
