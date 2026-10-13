import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, Construction, Flag, MapPin, Search, Shuffle, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useApi';
import { Badge, DemoBadge, Modal, VehicleTypeChip, VerificationBadge } from './ui';
import { VEHICLE_TYPES, fareText, formatDate, minutesLabel, timeAgo } from '../utils/format';

/* ------------------------- Place input with suggestions ------------------------- */

export function PlaceInput({ label, value, onChange, placeholder, icon: Icon = MapPin, dark = false }) {
  const id = useId();
  const listId = `${id}-list`;
  const q = useDebounce(value, 250);
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get('/places', { params: { q } }).then((r) => alive && setOptions(r.data.data)).catch(() => alive && setOptions([]));
    return () => { alive = false; };
  }, [q]);
  return (
    <div>
      <label htmlFor={id} className={`label ${dark ? 'text-white/90' : ''}`}>{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id={id} list={listId} className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
        <datalist id={listId}>{options.map((o) => <option key={o.name} value={o.name} />)}</datalist>
      </div>
    </div>
  );
}

/* --------------------------------- Search form --------------------------------- */

export function RouteSearchForm({ initial = {}, compact = false, onSearch }) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(initial.from || '');
  const [to, setTo] = useState(initial.to || '');
  const [type, setType] = useState(initial.type || '');
  useEffect(() => { setFrom(initial.from || ''); setTo(initial.to || ''); setType(initial.type || ''); }, [initial.from, initial.to, initial.type]);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from.trim()) params.set('from', from.trim());
    if (to.trim()) params.set('to', to.trim());
    if (type) params.set('type', type);
    if (onSearch) onSearch(Object.fromEntries(params));
    else navigate(`/routes?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? 'md:grid-cols-[1fr_1fr_170px_auto]' : 'sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto]'} items-end`} role="search">
      <PlaceInput label="Starting point" value={from} onChange={setFrom} placeholder="e.g. Town Proper" />
      <PlaceInput label="Destination" value={to} onChange={setTo} placeholder="e.g. Coastal Barangay" icon={Flag} />
      <div>
        <label htmlFor="type-select" className="label">Transportation</label>
        <select id="type-select" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {VEHICLE_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-primary h-[42px] px-6"><Search className="h-4 w-4" aria-hidden /> Search</button>
    </form>
  );
}

/* ------------------------------ Availability summary --------------------------- */

export function AvailabilitySummary({ availability, compact = false }) {
  if (!availability || !availability.vehicles?.length) {
    return <p className="text-xs text-muted">No driver availability reports yet.</p>;
  }
  const a = availability;
  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {a.available > 0 && <Badge tone="success">{a.available} reported available</Badge>}
        {a.temporarily_suspended > 0 && <Badge tone="warning">{a.temporarily_suspended} suspended</Badge>}
        {a.unavailable > 0 && <Badge tone="neutral">{a.unavailable} unavailable</Badge>}
        {a.outdated > 0 && <Badge tone="neutral" title={`Older than ${minutesLabel(a.fresh_window_minutes)}`}>{a.outdated} outdated report{a.outdated > 1 ? 's' : ''}</Badge>}
      </div>
      {!compact && (
        <p className="mt-1.5 flex items-center gap-1 text-muted">
          <Clock className="h-3 w-3" aria-hidden /> Latest driver report {timeAgo(a.latest_report_at)} · driver-reported, not GPS tracking
        </p>
      )}
    </div>
  );
}

/* --------------------------------- Route card --------------------------------- */

export function RouteCard({ route }) {
  const r = route;
  return (
    <article className="card p-5 transition hover:shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <VehicleTypeChip type={r.vehicle_type} />
            <span className="text-xs font-semibold text-muted">{r.code}</span>
            {r.match?.kind === 'direct' && <Badge tone="success">Direct</Badge>}
            {(r.requires_transfer || r.match?.kind === 'documented_transfer') && <Badge tone="warning"><Shuffle className="h-3 w-3" /> Transfer required</Badge>}
            <VerificationBadge status={r.verification_status} date={r.verified_at} />
          </div>
          <h3 className="text-lg leading-snug">{r.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <span>{r.match?.boarding || r.origin}</span><ArrowRight className="h-3.5 w-3.5" aria-hidden /><span>{r.match?.dropoff || r.destination}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted">Regular fare</p>
          <p className="text-lg font-extrabold text-maroon">{fareText(r.fare)}</p>
        </div>
      </div>

      {r.obstructions?.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-xs text-warning-700">
          <Construction className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span><strong>Verified road notice:</strong> {r.obstructions[0].title}. <Link to={`/routes/${r.id}#alternatives`} className="font-semibold underline">See documented alternatives</Link></span>
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          {r.terminals?.length > 0 && (
            <p className="text-xs text-muted"><span className="font-semibold text-ink">Terminals:</span> {r.terminals.map((t) => t.name).join(' · ')}</p>
          )}
          <p className="text-xs text-muted">
            {r.stops?.length ? `${r.stops.length} documented stops` : 'No stops documented'}{r.distance_km ? ` · ${r.distance_km} km` : ''} · Updated {formatDate(r.last_updated)}
          </p>
          <AvailabilitySummary availability={r.availability} compact />
        </div>
        <Link to={`/routes/${r.id}`} className="btn-secondary btn-sm">Route details <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
}

/* ----------------------------- Obstruction notice ----------------------------- */

export function ObstructionNotice({ notice }) {
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{notice.title}</p>
            <Badge tone="success">Verified notice</Badge>
            {notice.resolution_status === 'resolved' && <Badge tone="neutral">Resolved</Badge>}
            <DemoBadge show={notice.is_demo} />
          </div>
          <p className="mt-1 text-ink/80">{notice.description}</p>
          <p className="mt-1 text-xs text-muted">Location: {notice.location_description} · Reported {formatDate(notice.reported_at, true)}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Report a driver button --------------------------- */

/**
 * Guests see a friendly prompt to sign in; the report context (route/terminal/vehicle) is preserved
 * in the redirect URL so they can continue after authenticating.
 */
export function ReportDriverButton({ context = {}, className = 'btn-secondary', label = 'Report a Driver' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const params = new URLSearchParams(Object.entries(context).filter(([, v]) => v != null && v !== ''));
  const target = `/commuter/reports/new${params.toString() ? `?${params}` : ''}`;

  const click = () => {
    if (user?.role === 'commuter') navigate(target);
    else setOpen(true);
  };

  return (
    <>
      <button type="button" className={className} onClick={click}><Flag className="h-4 w-4" aria-hidden /> {label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sign in to report a driver" size="sm">
        {user && user.role !== 'commuter' ? (
          <p className="text-sm text-muted">Passenger reports can only be submitted from a commuter account. Please log out and sign in with a commuter account.</p>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-maroon-50 p-3 text-sm text-maroon">
              <Users className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>To keep reports accountable and protect everyone involved, formal complaints require a free commuter account. Route searching stays open to everyone.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={`/login?redirect=${encodeURIComponent(target)}`} className="btn-primary flex-1">Log In</Link>
              <Link to={`/register?redirect=${encodeURIComponent(target)}`} className="btn-secondary flex-1">Create Account</Link>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
