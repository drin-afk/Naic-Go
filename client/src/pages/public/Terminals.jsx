import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, LayoutGrid, Map as MapIcon, Search } from 'lucide-react';
import { useApi, useDebounce } from '../../hooks/useApi';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import MapView from '../../components/maps/MapView';
import { VEHICLE_TYPES, formatDate } from '../../utils/format';

export default function Terminals() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [view, setView] = useState('grid');
  const dq = useDebounce(q, 300);
  const params = { q: dq || undefined, type: sp.get('type') || undefined, sort: sp.get('sort') || 'name', page: sp.get('page') || 1 };
  const { data, meta, loading, error, reload } = useApi('/terminals', params);
  const set = (k, v) => { const n = Object.fromEntries(sp.entries()); if (v) n[k] = v; else delete n[k]; if (k !== 'page') delete n.page; setSp(n); };

  const markers = (data || []).filter((t) => t.latitude != null).map((t) => ({ lat: t.latitude, lng: t.longitude, kind: 'terminal', title: t.name, subtitle: t.barangay, href: `/terminals/${t.id}` }));

  return (
    <div className="container-page py-8">
      <PageHeader title="Terminal Directory" subtitle="Public transportation terminals in Naic, Cavite." />
      <div className="card mb-6 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search terminal name, address or barangay" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search terminals" />
        </div>
        <select className="input" value={sp.get('type') || ''} onChange={(e) => set('type', e.target.value)} aria-label="Filter by transportation type">
          <option value="">All transportation</option>
          {VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
        </select>
        <select className="input" value={sp.get('sort') || 'name'} onChange={(e) => set('sort', e.target.value)} aria-label="Sort terminals">
          <option value="name">Sort: Name (A–Z)</option>
          <option value="routes">Sort: Most routes</option>
          <option value="updated">Sort: Recently updated</option>
          <option value="verified">Sort: Recently verified</option>
        </select>
        <div className="flex rounded-xl border border-black/10 p-1" role="group" aria-label="View">
          <button className={`btn-sm btn ${view === 'grid' ? 'bg-maroon text-white' : 'text-ink'}`} onClick={() => setView('grid')} aria-pressed={view === 'grid'}><LayoutGrid className="h-4 w-4" /> List</button>
          <button className={`btn-sm btn ${view === 'map' ? 'bg-maroon text-white' : 'text-ink'}`} onClick={() => setView('map')} aria-pressed={view === 'map'}><MapIcon className="h-4 w-4" /> Map</button>
        </div>
      </div>

      {loading ? <Loading rows={3} /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={Building2} title="No terminals found">Try a different search term or remove the filter.</EmptyState>
      ) : view === 'map' ? (
        <div className="card p-3"><MapView markers={markers} height={520} /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((t) => (
              <Link key={t.id} to={`/terminals/${t.id}`} className="card flex flex-col p-5 transition hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base">{t.name}</h2>
                  <VerificationBadge status={t.verification_status} date={t.verified_at} />
                </div>
                <p className="mt-1 text-sm text-muted">{t.address}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{t.vehicle_types.map((v) => <VehicleTypeChip key={v} type={v} />)}</div>
                <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                  <span className="font-semibold text-maroon">{t.route_count} route{t.route_count === 1 ? '' : 's'}</span>
                  <span>{t.verified_at ? `Verified ${formatDate(t.verified_at)}` : `Updated ${formatDate(t.updated_at)}`}</span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination meta={meta} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </div>
  );
}
