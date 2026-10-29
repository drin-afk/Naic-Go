import { Link, useParams } from 'react-router-dom';
import { Clock, MapPin, Navigation } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { AvailabilitySummary, ObstructionNotice, ReportDriverButton, RouteCard } from '../../components/transport';
import { Alert, AvailabilityBadge, EmptyState, ErrorState, Loading, PageHeader, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import MapView from '../../components/maps/MapView';
import { googleMapsDirectionsUrl } from '../../components/maps/mapsLoader';
import { formatDate, timeAgo } from '../../utils/format';

export default function TerminalDetail() {
  const { id } = useParams();
  const { data: t, loading, error, reload } = useApi(`/terminals/${id}`);
  if (loading) return <div className="container-page py-10"><Loading rows={4} /></div>;
  if (error) return <div className="container-page py-10"><ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} /></div>;

  const hasCoords = t.latitude != null && t.longitude != null;
  const markers = hasCoords ? [{ lat: t.latitude, lng: t.longitude, kind: 'terminal', title: t.name, subtitle: t.address }] : [];

  return (
    <div className="container-page py-8">
      <PageHeader back={{ to: '/terminals', label: 'All terminals' }} title={t.name}
        subtitle={<span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {t.address}</span>}
        actions={<ReportDriverButton context={{ terminal_id: t.id }} label="Report a Problem" />} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {t.vehicle_types.map((v) => <VehicleTypeChip key={v.code} type={v.code} />)}
        <VerificationBadge status={t.verification_status} date={t.verified_at} />
      </div>
      {t.is_demo && <Alert tone="warning" title="Demonstration terminal" className="mb-6">This terminal and its coordinates are fictional placeholders. Researchers must replace it with verified information.</Alert>}
      {t.obstructions.length > 0 && <div className="mb-6 space-y-3">{t.obstructions.map((o) => <ObstructionNotice key={o.id} notice={o} />)}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="card p-3"><MapView markers={markers} height={340} zoom={16} /></div>
          <section>
            <h2 className="text-xl">Routes from this terminal</h2>
            {t.routes.length === 0 ? <div className="mt-3"><EmptyState title="No documented routes yet" /></div> : (
              <div className="mt-3 space-y-4">{t.routes.map((r) => <RouteCard key={r.id} route={r} />)}</div>
            )}
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg">Terminal information</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Barangay / area</dt><dd className="text-right font-semibold">{t.barangay || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="flex items-center gap-1 text-muted"><Clock className="h-3.5 w-3.5" /> Hours</dt><dd className="text-right font-semibold">{t.operating_hours || 'Not recorded'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Coordinates</dt><dd className="text-right font-semibold">{hasCoords ? `${Number(t.latitude).toFixed(5)}, ${Number(t.longitude).toFixed(5)}` : 'Not yet verified'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Last verification</dt><dd className="font-semibold">{t.verified_at ? formatDate(t.verified_at) : 'Not yet verified'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Last updated</dt><dd className="font-semibold">{formatDate(t.updated_at)}</dd></div>
            </dl>
            {t.description && <p className="mt-3 text-sm text-muted">{t.description}</p>}
            {hasCoords && (
              <a className="btn-primary mt-4 w-full" target="_blank" rel="noopener noreferrer" href={googleMapsDirectionsUrl(null, { lat: t.latitude, lng: t.longitude })}>
                <Navigation className="h-4 w-4" /> Directions to this terminal
              </a>
            )}
          </section>
          <section className="card p-5">
            <h2 className="text-lg">Known destinations</h2>
            {t.destinations.length === 0 ? <p className="mt-2 text-sm text-muted">None documented.</p> : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {t.destinations.map((d) => <li key={d}><Link to={`/routes?from=${encodeURIComponent(t.name)}&to=${encodeURIComponent(d)}`} className="inline-block rounded-full bg-maroon-50 px-3 py-1 text-xs font-semibold text-maroon hover:bg-maroon-100">{d}</Link></li>)}
              </ul>
            )}
          </section>
          <section className="card p-5">
            <h2 className="text-lg">Reported vehicle availability</h2>
            <p className="mb-3 text-xs text-muted">Driver-reported, not GPS tracking.</p>
            <AvailabilitySummary availability={t.availability} />
            {t.availability.vehicles.length > 0 && (
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {t.availability.vehicles.map((v) => (
                  <li key={v.vehicle_id} className="flex items-center justify-between gap-2 py-2">
                    <span className="font-semibold">{v.vehicle_identifier}</span>
                    <span className="flex items-center gap-2"><AvailabilityBadge status={v.status} fresh={v.is_fresh} /><span className="text-xs text-muted">{timeAgo(v.reported_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
