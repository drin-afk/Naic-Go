import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bus, ClipboardCheck, Construction, FileWarning, FlaskConical, Map, Radio, ShieldCheck, Users, UserSquare,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Alert, ErrorState, Loading, PageHeader, ReportStatusBadge, StatCard, VehicleTypeChip } from '../../components/ui';
import { formatDate } from '../../utils/format';

function BarList({ title, rows, color = 'bg-brand' }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="card p-5">
      <h2 className="text-base">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">No data yet.</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex justify-between gap-2 text-sm"><span>{r.label}</span><span className="font-bold">{r.n}</span></div>
              <div className="h-2 rounded-full bg-black/5" role="presentation"><div className={`h-2 rounded-full ${color}`} style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi('/admin/dashboard');
  if (loading) return <Loading rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const m = data.metrics;

  return (
    <div>
      <PageHeader title="Administrator dashboard" subtitle="Overview of NaicGo records, pending reviews and passenger safety reports." />
      {m.demo_records > 0 && (
        <Alert tone="warning" className="mb-6" title="Demonstration records present">
          <span className="flex gap-2"><FlaskConical className="h-4 w-4 shrink-0" />{m.demo_records} terminal/route records are labelled DEMO. Replace them with verified data before the research evaluation.</span>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Terminals" value={m.terminals} icon={Map} to="/admin/terminals" />
        <StatCard label="Documented routes" value={m.routes} icon={Activity} to="/admin/routes" />
        <StatCard label="Registered commuters" value={m.commuters} icon={Users} to="/admin/users?role=commuter" />
        <StatCard label="Registered drivers" value={m.drivers} icon={UserSquare} to="/admin/drivers" />
        <StatCard label="Registered vehicles" value={m.vehicles} icon={Bus} to="/admin/vehicles" />
        <StatCard label="Pending driver registrations" value={m.pending_drivers} icon={ShieldCheck} tone="amber" to="/admin/drivers?approval=pending" />
        <StatCard label="Pending information updates" value={m.pending_updates} icon={ClipboardCheck} tone="amber" to="/admin/update-requests" />
        <StatCard label="Fresh availability reports" value={m.fresh_availability_reports} icon={Radio} tone="green" hint={`Last ${data.fresh_window_minutes} min · ${m.vehicles_reported_24h} vehicles reported in 24 h`} />
        <StatCard label="Pending passenger complaints" value={m.pending_complaints} icon={FileWarning} tone="red" to="/admin/reports" />
        <StatCard label="Active road obstructions" value={m.active_obstructions} icon={Construction} tone="red" hint={`${m.pending_obstructions} awaiting verification`} to="/admin/obstructions" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BarList title="Complaints by status" rows={data.complaints_by_status.map((r) => ({ label: r.label, n: r.n }))} color="bg-maroon" />
        <BarList title="Complaints by category" rows={data.complaints_by_category.map((r) => ({ label: r.label, n: r.n }))} />
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="text-base">Latest passenger reports</h2><Link to="/admin/reports" className="link text-sm">All reports</Link></div>
          {data.recent_reports.length === 0 ? <p className="mt-3 text-sm text-muted">No reports yet.</p> : (
            <ul className="mt-3 divide-y divide-black/5">
              {data.recent_reports.map((r) => (
                <li key={r.id}><Link to={`/admin/reports/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-brand">
                  <span><strong>{r.reference_no}</strong> <span className="text-muted">· {r.category_label}</span></span><ReportStatusBadge status={r.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="text-base">Drivers awaiting approval</h2><Link to="/admin/drivers?approval=pending" className="link text-sm">Review</Link></div>
          {data.pending_drivers.length === 0 ? <p className="mt-3 flex items-center gap-2 text-sm text-muted"><AlertTriangle className="h-4 w-4" /> No pending registrations.</p> : (
            <ul className="mt-3 divide-y divide-black/5">
              {data.pending_drivers.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2.5 text-sm"><span className="font-semibold">{d.full_name}</span><span className="flex items-center gap-2"><VehicleTypeChip type={d.vehicle_type} /><span className="text-xs text-muted">{formatDate(d.created_at)}</span></span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Counts reflect records stored in NaicGo — not independently verified real-world totals.</p>
    </div>
  );
}
