import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi, useDebounce } from '../../hooks/useApi';
import { RouteCard } from '../../components/transport';
import { AvailabilityBadge, EmptyState, ErrorState, Loading, PageHeader, VehicleIcon, VerificationBadge } from '../../components/ui';
import { fareText, timeAgo, vehicleName } from '../../utils/format';

const INTRO = {
  tricycle: 'Tricycles serve short trips within barangays and between terminals and nearby destinations.',
  jeepney: 'Jeepneys run along fixed documented routes between terminals and major stops.',
  bus: 'Buses serve longer trips along major roads. Fares for trips beyond the municipality should be confirmed with the conductor.',
};

export default function TransportCategory() {
  const { type } = useParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [tab, setTab] = useState('routes');
  const valid = ['tricycle', 'jeepney', 'bus'].includes(type);
  const routes = useApi('/routes', { type }, { skip: !valid });
  const terminals = useApi('/terminals', { type, pageSize: 100, q: dq || undefined }, { skip: !valid });
  const fares = useApi('/fares', { type, q: dq || undefined }, { skip: !valid });
  const avail = useApi('/availability', { type }, { skip: !valid });
  if (!valid) return <Navigate to="/404" replace />;

  const match = (r) => !dq || [r.name, r.code, r.origin, r.destination, ...r.stops.map((s) => s.name)].join(' ').toLowerCase().includes(dq.toLowerCase());
  const tabs = [['routes', 'Routes'], ['terminals', 'Terminals'], ['fares', 'Fares'], ['availability', 'Vehicle availability']];

  return (
    <div className="container-page py-8">
      <PageHeader title={<span className="flex items-center gap-3"><span className="rounded-2xl bg-maroon p-2.5 text-white"><VehicleIcon type={type} className="h-7 w-7" /></span>{vehicleName(type)}s</span>}
        subtitle={INTRO[type]} />
      <div className="card mb-5 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`btn-sm btn ${tab === k ? 'bg-maroon text-white' : 'text-ink hover:bg-black/5'}`}>{l}</button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search destination, route or terminal" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
      </div>

      {tab === 'routes' && (routes.loading ? <Loading /> : routes.error ? <ErrorState error={routes.error} onRetry={routes.reload} /> : (
        routes.data.results.filter(match).length === 0 ? <EmptyState title={`No ${vehicleName(type).toLowerCase()} routes found`} /> :
          <div className="grid gap-4 lg:grid-cols-2">{routes.data.results.filter(match).map((r) => <RouteCard key={r.id} route={r} />)}</div>
      ))}

      {tab === 'terminals' && (terminals.loading ? <Loading /> : terminals.error ? <ErrorState error={terminals.error} onRetry={terminals.reload} /> : (
        terminals.data.length === 0 ? <EmptyState title="No terminals found" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {terminals.data.map((t) => (
              <Link key={t.id} to={`/terminals/${t.id}`} className="card p-5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-2"><h2 className="text-base">{t.name}</h2><VerificationBadge status={t.verification_status} /></div>
                <p className="mt-1 text-sm text-muted">{t.address}</p>
                <p className="mt-3 text-xs font-semibold text-maroon">{t.route_count} routes</p>
              </Link>
            ))}
          </div>
        )
      ))}

      {tab === 'fares' && (fares.loading ? <Loading /> : fares.error ? <ErrorState error={fares.error} onRetry={fares.reload} /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Route</th><th>From → To</th><th>Category</th><th className="text-right">Fare</th><th>Verified</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {fares.data.map((f) => (
                <tr key={f.id}>
                  <td><Link className="font-semibold hover:text-brand" to={`/routes/${f.route_id}`}>{f.route_code}</Link></td>
                  <td className="text-muted">{f.origin} → {f.destination}</td>
                  <td className="capitalize">{f.passenger_category.replace('_', '/')}</td>
                  <td className="text-right font-bold text-maroon">{fareText(f)}</td>
                  <td><VerificationBadge status={f.verification_status} /></td>
                </tr>
              ))}
              {!fares.data.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No fares published.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'availability' && (avail.loading ? <Loading /> : avail.error ? <ErrorState error={avail.error} onRetry={avail.reload} /> : (
        <div className="card overflow-x-auto">
          <p className="border-b border-black/5 px-4 py-3 text-xs text-muted">{avail.data.disclaimer} Reports older than {avail.data.fresh_window_minutes} minutes are shown as outdated.</p>
          <table className="table-base">
            <thead><tr><th>Vehicle</th><th>Route</th><th>Terminal</th><th>Status</th><th>Reported</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {avail.data.vehicles.map((v) => (
                <tr key={v.vehicle_id}>
                  <td className="font-semibold">{v.vehicle_identifier}</td>
                  <td>{v.route_id ? <Link className="hover:text-brand" to={`/routes/${v.route_id}`}>{v.route_code}</Link> : '—'}</td>
                  <td>{v.terminal_name || '—'}</td>
                  <td><AvailabilityBadge status={v.status} fresh={v.is_fresh} /></td>
                  <td className="text-muted">{timeAgo(v.reported_at)}</td>
                </tr>
              ))}
              {!avail.data.vehicles.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No driver reports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
