import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi, useDebounce } from '../../hooks/useApi';
import { Alert, DemoBadge, ErrorState, Loading, PageHeader, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import { FARE_TYPES, PASSENGER_CATEGORIES, VEHICLE_TYPES, fareText, formatDate } from '../../utils/format';

export default function FareGuide() {
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const { data, loading, error, reload } = useApi('/fares', { type: type || undefined, q: dq || undefined });

  return (
    <div className="container-page py-8">
      <PageHeader title="Fare Guide" subtitle="Published fares for documented routes, with fare type, effective date and verification status." />
      <Alert tone="warning" title="Fares can change" className="mb-6">
        Always confirm the fare with the driver, conductor or terminal personnel. &ldquo;Requires confirmation&rdquo; means no fixed fare has been verified for that route.
      </Alert>
      <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search route, origin or destination" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search fares" />
        </div>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Transportation type">
          <option value="">All transportation</option>
          {VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Route</th><th>Type</th><th>Origin → Destination</th><th>Passenger</th><th>Fare type</th><th className="text-right">Fare</th><th>Effective</th><th>Verification</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {data.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap"><Link to={`/routes/${f.route_id}`} className="font-semibold hover:text-brand">{f.route_code}</Link> {f.is_demo && <DemoBadge />}</td>
                  <td><VehicleTypeChip type={f.vehicle_type} /></td>
                  <td className="min-w-[220px] text-muted">{f.origin} → {f.destination}</td>
                  <td>{PASSENGER_CATEGORIES[f.passenger_category]}</td>
                  <td className="whitespace-nowrap">{FARE_TYPES[f.fare_type]}</td>
                  <td className="whitespace-nowrap text-right font-bold text-maroon">{fareText(f)}</td>
                  <td className="whitespace-nowrap">{formatDate(f.effective_date)}</td>
                  <td className="whitespace-nowrap"><VerificationBadge status={f.verification_status} />{f.verified_at && <span className="ml-1 text-xs text-muted">{formatDate(f.verified_at)}</span>}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={8} className="py-10 text-center text-muted">No fares match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
