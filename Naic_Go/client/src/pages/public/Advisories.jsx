import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { ObstructionNotice } from '../../components/transport';
import { Alert, Badge, EmptyState, ErrorState, Loading, PageHeader, VehicleTypeChip } from '../../components/ui';
import MapView from '../../components/maps/MapView';

export default function Advisories() {
  const [includeResolved, setIncludeResolved] = useState(false);
  const { data, loading, error, reload } = useApi('/road-obstructions', { include_resolved: includeResolved ? 'true' : undefined });
  const markers = (data || []).filter((o) => o.latitude != null).map((o) => ({ lat: o.latitude, lng: o.longitude, kind: 'obstruction', title: o.title, subtitle: o.location_description }));

  return (
    <div className="container-page py-8">
      <PageHeader title="Road Advisories" subtitle="Verified road obstruction notices and documented alternative routes." />
      <Alert tone="info" className="mb-6">
        Notices are published only after review by NaicGo administrators. NaicGo does not detect road closures automatically or monitor live traffic.
      </Alert>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="rounded text-brand focus:ring-brand" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
        Include notices resolved in the last 7 days
      </label>
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No active road notices">There are no verified obstruction notices right now.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            {data.map((o) => (
              <div key={o.id} className="space-y-3">
                <ObstructionNotice notice={o} />
                {o.affected_route_id && (
                  <div className="card p-4">
                    <p className="text-sm">Affected route: <Link to={`/routes/${o.affected_route_id}`} className="link">{o.route_code} — {o.route_name}</Link></p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Documented alternatives</p>
                    {o.alternatives.length === 0 ? <p className="mt-1 text-sm text-muted">No verified alternative is documented. Ask terminal personnel for guidance.</p> : (
                      <ul className="mt-2 space-y-2">
                        {o.alternatives.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warm p-3 text-sm">
                            <div>
                              <div className="flex items-center gap-2"><VehicleTypeChip type={a.vehicle_type} /><span className="font-semibold">{a.code}</span>{a.has_obstruction && <Badge tone="warning">Also has a notice</Badge>}</div>
                              <p className="mt-1">{a.name}</p>
                              <p className="text-xs text-muted">{a.terminals.map((t) => t.name).join(' · ')} · {a.fare_label}</p>
                            </div>
                            <Link to={`/routes/${a.id}`} className="btn-secondary btn-sm">Details <ArrowRight className="h-3.5 w-3.5" /></Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start"><div className="card p-3"><MapView markers={markers} height={460} /></div></div>
        </div>
      )}
    </div>
  );
}
