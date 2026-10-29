import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Info, MapPin, Shuffle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { AvailabilitySummary, ObstructionNotice, ReportDriverButton, RouteCard } from '../../components/transport';
import { Alert, AvailabilityBadge, Badge, DemoBadge, ErrorState, Loading, PageHeader, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import MapView from '../../components/maps/MapView';
import { routeMapData } from './RouteFinder';
import { FARE_TYPES, PASSENGER_CATEGORIES, fareText, formatDate, timeAgo } from '../../utils/format';

export default function RouteDetail() {
  const { id } = useParams();
  const { data: r, loading, error, reload } = useApi(`/routes/${id}`);
  if (loading) return <div className="container-page py-10"><Loading rows={4} /></div>;
  if (error) return <div className="container-page py-10"><ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} /></div>;

  const { markers, path } = routeMapData(r);
  const obstructionMarkers = r.obstructions.filter((o) => o.latitude != null).map((o) => ({ lat: o.latitude, lng: o.longitude, kind: 'obstruction', title: o.title, subtitle: o.location_description }));

  return (
    <div className="container-page py-8">
      <PageHeader
        back={{ to: '/routes', label: 'Back to Route Finder' }}
        title={r.name}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{r.origin} <ArrowRight className="h-4 w-4" /> {r.destination}</span>}
        actions={<ReportDriverButton context={{ route_id: r.id, vehicle_type: r.vehicle_type }} label="Report a Problem" />}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <VehicleTypeChip type={r.vehicle_type} />
        <Badge tone="info">Route {r.code}</Badge>
        <VerificationBadge status={r.verification_status} date={r.verified_at} />
        {r.requires_transfer && <Badge tone="warning"><Shuffle className="h-3 w-3" /> Transfer required</Badge>}
        {r.status !== 'active' && <Badge tone="danger">{r.status}</Badge>}
      </div>

      {r.is_demo && <Alert tone="warning" title="Demonstration route" className="mb-6">This route, its stops and fares are fictional placeholders for development. Do not use them for real travel.</Alert>}

      {r.obstructions.length > 0 && (
        <div className="mb-6 space-y-3">
          {r.obstructions.map((o) => <ObstructionNotice key={o.id} notice={o} />)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-3" aria-labelledby="map-h">
            <h2 id="map-h" className="sr-only">Route map</h2>
            <MapView markers={[...markers, ...obstructionMarkers]} path={path} directions height={380} />
          </section>

          <section className="card p-5" aria-labelledby="stops-h">
            <h2 id="stops-h" className="text-lg">Documented stops</h2>
            {r.stops.length === 0 ? <p className="mt-2 text-sm text-muted">No stops have been documented for this route yet.</p> : (
              <ol className="relative mt-4 space-y-4 border-l-2 border-dashed border-maroon/20 pl-6">
                {r.stops.map((s, i) => (
                  <li key={s.id} className="relative">
                    <span className={`absolute -left-[33px] top-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white ${i === 0 ? 'bg-success' : i === r.stops.length - 1 ? 'bg-brand' : 'bg-maroon'}`}>{s.stop_order}</span>
                    <p className="font-semibold">{s.terminal_id ? <Link to={`/terminals/${s.terminal_id}`} className="hover:text-brand">{s.name}</Link> : s.name}</p>
                    <p className="text-xs text-muted">
                      {[s.is_boarding ? 'Boarding' : null, s.is_dropoff ? 'Drop-off' : null].filter(Boolean).join(' · ') || '—'}
                      {s.terminal_id && ' · Terminal'}{s.notes ? ` · ${s.notes}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section id="alternatives" className="scroll-mt-24" aria-labelledby="alt-h">
            <h2 id="alt-h" className="text-xl">Documented alternative routes</h2>
            {r.alternatives.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{r.obstructions.length ? 'No verified alternative route has been documented for this route yet. Ask terminal personnel for guidance.' : 'No alternatives have been documented for this route.'}</p>
            ) : (
              <div className="mt-3 space-y-4">
                {r.alternatives.map((a) => (
                  <div key={a.id}>
                    {a.alternative_notes && <p className="mb-1.5 text-sm text-muted"><Info className="mr-1 inline h-4 w-4" />{a.alternative_notes}</p>}
                    <RouteCard route={a} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5" aria-labelledby="fare-h">
            <h2 id="fare-h" className="text-lg">Fares</h2>
            {r.fares.length === 0 ? <p className="mt-2 text-sm text-muted">No fare has been published for this route.</p> : (
              <ul className="mt-3 divide-y divide-black/5">
                {r.fares.map((f) => (
                  <li key={f.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{PASSENGER_CATEGORIES[f.passenger_category]}</span>
                      <span className="text-lg font-extrabold text-maroon">{fareText(f)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {FARE_TYPES[f.fare_type]} · Effective {formatDate(f.effective_date)} · <VerificationBadge status={f.verification_status} date={f.verified_at} />
                      {f.verified_at && <> · verified {formatDate(f.verified_at)}</>}
                    </p>
                    {f.notes && <p className="mt-0.5 text-xs text-muted">{f.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
            {r.fare_history.some((f) => !f.is_current) && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-maroon">Fare history</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {r.fare_history.filter((f) => !f.is_current).map((f) => (
                    <li key={f.id}>{PASSENGER_CATEGORIES[f.passenger_category]}: {f.label} (effective {formatDate(f.effective_date)})</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-3 rounded-lg bg-warm p-2.5 text-xs text-muted">Fares may change. Confirm the fare with the driver or conductor before your trip.</p>
          </section>

          <section className="card p-5" aria-labelledby="avail-h">
            <h2 id="avail-h" className="text-lg">Vehicle availability</h2>
            <p className="mb-3 text-xs text-muted">Driver-reported status. Not real-time GPS tracking and not a guarantee that a vehicle is at the terminal.</p>
            <AvailabilitySummary availability={r.availability} />
            {r.availability?.vehicles?.length > 0 && (
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {r.availability.vehicles.map((v) => (
                  <li key={v.vehicle_id} className="flex items-center justify-between gap-2 py-2">
                    <span className="font-semibold">{v.vehicle_identifier}</span>
                    <span className="flex items-center gap-2"><AvailabilityBadge status={v.status} fresh={v.is_fresh} /><span className="text-xs text-muted">{timeAgo(v.reported_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-labelledby="info-h">
            <h2 id="info-h" className="text-lg">Route information</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Boarding terminal</dt><dd className="text-right font-semibold">{r.terminals.find((t) => t.role === 'origin')?.name || r.origin}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Drop-off point</dt><dd className="text-right font-semibold">{r.destination}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Distance</dt><dd className="font-semibold">{r.distance_km ? `${r.distance_km} km` : 'Not recorded'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Transfers</dt><dd className="text-right font-semibold">{r.requires_transfer ? r.transfer_notes || 'Required' : 'None documented'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Last updated</dt><dd className="font-semibold">{formatDate(r.last_updated)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" /> Verified</dt><dd className="font-semibold">{r.verified_at ? formatDate(r.verified_at) : 'Not yet verified'}</dd></div>
            </dl>
            {r.terminals.length > 0 && (
              <div className="mt-4 border-t border-black/5 pt-3">
                <p className="text-sm font-semibold">Associated terminals</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {r.terminals.map((t) => (
                    <li key={t.id} className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" />
                      <Link to={`/terminals/${t.id}`} className="hover:text-brand">{t.name}</Link>
                      <span className="text-xs capitalize text-muted">({t.role})</span>{t.is_demo ? <DemoBadge /> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.description && <p className="mt-4 text-sm text-muted">{r.description}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
