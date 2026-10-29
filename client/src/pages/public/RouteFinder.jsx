import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Map as MapIcon, SearchX, Shuffle, SlidersHorizontal } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { RouteCard, RouteSearchForm, AvailabilitySummary } from '../../components/transport';
import { Alert, Badge, EmptyState, ErrorState, Loading, VehicleTypeChip } from '../../components/ui';
import MapView from '../../components/maps/MapView';
import { VEHICLE_TYPES, fareText } from '../../utils/format';

export function routeMapData(route) {
  const stops = route?.stops || [];
  const markers = stops.filter((s) => s.latitude != null).map((s, i, arr) => ({
    lat: s.latitude, lng: s.longitude, title: s.name,
    kind: i === 0 ? 'origin' : i === arr.length - 1 ? 'destination' : s.terminal_id ? 'terminal' : 'stop',
    subtitle: `Stop ${s.stop_order}${s.terminal_name ? ' · Terminal' : ''}`,
    href: s.terminal_id ? `/terminals/${s.terminal_id}` : undefined,
  }));
  const path = stops.filter((s) => s.latitude != null).map((s) => ({ lat: s.latitude, lng: s.longitude }));
  return { markers, path };
}

export default function RouteFinder() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const [showFilters, setShowFilters] = useState(false);
  const [mapRouteId, setMapRouteId] = useState(null);
  const { data, loading, error, reload } = useApi('/routes', params);
  const terminals = useApi('/terminals', { pageSize: 100 });

  const update = (patch) => {
    const next = { ...params, ...patch };
    Object.keys(next).forEach((k) => (next[k] === '' || next[k] == null || next[k] === false) && delete next[k]);
    setSp(next);
  };

  const results = data?.results || [];
  const mapRoute = useMemo(() => results.find((r) => r.id === mapRouteId) || results[0], [results, mapRouteId]);
  const { markers, path } = routeMapData(mapRoute);
  const hasQuery = params.from || params.to;

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl">Route Finder</h1>
      <p className="mt-1 text-muted">Search documented public transportation routes in Naic, Cavite.</p>

      <div className="card mt-6 p-5">
        <RouteSearchForm compact initial={params} onSearch={(q) => setSp({ ...q, ...(params.terminal ? { terminal: params.terminal } : {}) })} />
        <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-maroon lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <SlidersHorizontal className="h-4 w-4" /> {showFilters ? 'Hide' : 'Show'} filters
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className={`${showFilters ? 'block' : 'hidden'} space-y-5 lg:block`} aria-label="Filters">
          <div className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Filters</h2>
            <fieldset className="mt-4">
              <legend className="label">Transportation type</legend>
              <div className="space-y-1.5">
                {[{ code: '', name: 'All types' }, ...VEHICLE_TYPES].map((v) => (
                  <label key={v.code} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="type" className="text-brand focus:ring-brand" checked={(params.type || '') === v.code} onChange={() => update({ type: v.code })} />
                    {v.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-5">
              <label htmlFor="f-terminal" className="label">Preferred terminal</label>
              <select id="f-terminal" className="input" value={params.terminal || ''} onChange={(e) => update({ terminal: e.target.value })}>
                <option value="">Any terminal</option>
                {(terminals.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="mt-5">
              <label htmlFor="f-fare" className="label">Maximum regular fare (₱)</label>
              <input id="f-fare" type="number" min="0" step="1" className="input" value={params.maxFare || ''} placeholder="Any"
                onChange={(e) => update({ maxFare: e.target.value })} />
              <p className="mt-1 text-xs text-muted">Routes whose fare must be confirmed are hidden when set.</p>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 rounded text-brand focus:ring-brand" checked={params.available === 'true'} onChange={(e) => update({ available: e.target.checked ? 'true' : '' })} />
              <span>Only routes with a recent &ldquo;available&rdquo; driver report</span>
            </label>
            {Object.keys(params).length > 0 && <button className="btn-ghost btn-sm mt-4 w-full" onClick={() => setSp({})}>Clear all</button>}
          </div>
        </aside>

        {/* Results */}
        <section aria-live="polite">
          {loading ? <Loading rows={3} /> : error ? <ErrorState error={error} onRetry={reload} /> : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  <strong className="text-ink">{results.length}</strong> documented route{results.length === 1 ? '' : 's'}
                  {params.from && <> from <strong className="text-ink">{params.from}</strong></>}
                  {params.to && <> to <strong className="text-ink">{params.to}</strong></>}
                </p>
              </div>

              {results.length > 0 && (
                <div className="card mb-5 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
                    <p className="flex items-center gap-2 text-sm font-semibold"><MapIcon className="h-4 w-4 text-brand" /> Map: {mapRoute?.code} — {mapRoute?.name}</p>
                    {results.length > 1 && (
                      <select className="input w-auto py-1.5 text-xs" value={mapRoute?.id} onChange={(e) => setMapRouteId(Number(e.target.value))} aria-label="Route shown on map">
                        {results.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                      </select>
                    )}
                  </div>
                  <MapView markers={markers} path={path} directions height={300} />
                </div>
              )}

              <div className="space-y-4">{results.map((r) => <RouteCard key={r.id} route={r} />)}</div>

              {data.connections?.length > 0 && (
                <div className="mt-8">
                  <h2 className="flex items-center gap-2 text-xl"><Shuffle className="h-5 w-5 text-warning" /> Connections with a transfer</h2>
                  <p className="mt-1 text-sm text-muted">Combinations of two documented routes that share a documented stop or terminal. Confirm the transfer point and both fares before travelling.</p>
                  <div className="mt-4 space-y-4">
                    {data.connections.map((c, i) => (
                      <div key={i} className="card p-5">
                        <Badge tone="warning">Transfer at {c.transfer_at}</Badge>
                        <ol className="mt-3 grid gap-3 md:grid-cols-2">
                          {c.legs.map((l, j) => (
                            <li key={l.id} className="rounded-xl border border-black/5 bg-warm p-4">
                              <p className="text-xs font-bold uppercase text-muted">Leg {j + 1}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2"><VehicleTypeChip type={l.vehicle_type} /><span className="text-xs font-semibold text-muted">{l.code}</span></div>
                              <p className="mt-2 text-sm font-semibold">{l.match.boarding} <ArrowRight className="inline h-3.5 w-3.5" /> {l.match.dropoff}</p>
                              <p className="mt-1 text-sm text-maroon font-bold">{fareText(l.fare)}</p>
                              <div className="mt-2"><AvailabilitySummary availability={l.availability} compact /></div>
                              <Link to={`/routes/${l.id}`} className="link mt-2 inline-block text-xs">Route details</Link>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.length === 0 && !data.connections?.length && (
                <EmptyState icon={SearchX} title={hasQuery ? 'No documented route matches your search' : 'No routes match these filters'}>
                  {hasQuery
                    ? 'NaicGo only shows routes that researchers have documented. Try a nearby terminal or stop name, remove filters, or check the suggestions below.'
                    : 'Try removing some filters.'}
                </EmptyState>
              )}

              {data.suggestions?.length > 0 && (
                <div className="mt-6">
                  <Alert tone="info" title="Documented routes serving one of these places">
                    These routes pass through your starting point or destination but do not connect both. They may help you plan part of the trip.
                  </Alert>
                  <div className="mt-4 space-y-4">{data.suggestions.map((r) => <RouteCard key={r.id} route={r} />)}</div>
                </div>
              )}
            </>
          )}
          <p className="mt-8 text-xs text-muted">
            Fares and availability may change — confirm with the driver, conductor or terminal personnel. Availability is driver-reported and not GPS tracking.
          </p>
        </section>
      </div>
    </div>
  );
}
