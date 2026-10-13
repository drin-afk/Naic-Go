import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Building2, ClipboardCheck, Compass, FlaskConical, Flag, MapPinned, Route as RouteIcon, Scale,
  ShieldCheck, Smartphone, Wallet,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { RouteCard, RouteSearchForm, ReportDriverButton } from '../../components/transport';
import { DemoBadge, EmptyState, ErrorState, Loading, VehicleIcon, VehicleTypeChip, VerificationBadge } from '../../components/ui';
import MapView from '../../components/maps/MapView';
import { fareText, vehicleName } from '../../utils/format';

function SectionTitle({ eyebrow, title, children }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-bold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-muted">{children}</p>}
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-auto" aria-hidden>
      <rect x="2" y="12" width="44" height="18" rx="5" fill="#A52A3A" /><rect x="6" y="15" width="30" height="7" rx="1.5" fill="#fff" opacity=".9" />
      <circle cx="12" cy="31" r="4" fill="#29262A" /><circle cx="38" cy="31" r="4" fill="#29262A" />
      <rect x="52" y="8" width="40" height="22" rx="4" fill="#641C2B" /><rect x="56" y="12" width="32" height="7" rx="1.5" fill="#fff" opacity=".9" />
      <circle cx="60" cy="31" r="4" fill="#29262A" /><circle cx="84" cy="31" r="4" fill="#29262A" />
      <path d="M98 18h12l6 8v4H98z" fill="#D94747" /><circle cx="102" cy="32" r="3.5" fill="#29262A" /><circle cx="114" cy="32" r="3.5" fill="#29262A" />
    </svg>
  );
}

export default function Landing() {
  const overview = useApi('/overview');
  const terminals = useApi('/terminals', { pageSize: 50 });
  const types = useApi('/vehicle-types');
  const routes = useApi('/routes');
  const fares = useApi('/fares');

  const markers = (terminals.data || []).filter((t) => t.latitude != null).map((t) => ({
    lat: t.latitude, lng: t.longitude, kind: 'terminal', title: t.name, subtitle: t.barangay, href: `/terminals/${t.id}`,
  }));

  return (
    <>
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(165,42,58,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(100,28,43,0.08),transparent_50%)]" />
        <div className="container-page relative grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-maroon-50 px-3 py-1 text-xs font-bold text-maroon">
              <MapPinned className="h-3.5 w-3.5" aria-hidden /> Naic, Cavite public transportation guide
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] text-maroon sm:text-5xl lg:text-6xl">
              Your Guide to Getting Around <span className="text-brand">Naic.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Find terminals, explore routes, compare fares, and discover available public transportation in Naic, Cavite.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#find" className="btn-primary px-6 py-3 text-base">Find My Route <ArrowRight className="h-4 w-4" /></a>
              <Link to="/terminals" className="btn-secondary px-6 py-3 text-base">Explore Terminals</Link>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <HeroIllustration />
              <p className="text-sm text-muted">Tricycles · Jeepneys · Buses</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 -z-10 rotate-2 rounded-[2rem] bg-gradient-to-br from-maroon to-accent opacity-90" />
            <div className="rounded-3xl bg-white p-3 shadow-lift">
              <MapView markers={markers} height={400} showLegend={false} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div id="find" className="container-page relative pb-14 scroll-mt-24">
          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">Where are you going?</h2>
              <p className="text-xs text-muted">No account needed to search.</p>
            </div>
            <RouteSearchForm />
          </div>
        </div>
      </section>

      {overview.data?.contains_demo_data && (
        <div className="border-y border-warning/30 bg-warning-50">
          <div className="container-page flex items-start gap-3 py-3 text-sm text-warning-700">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p><strong>Demonstration data:</strong> records marked <DemoBadge /> are fictional placeholders used for development and testing. They do not describe real terminals, routes or fares in Naic.</p>
          </div>
        </div>
      )}

      {/* ---------------------------- How it works --------------------------- */}
      <section className="container-page py-16">
        <SectionTitle eyebrow="How NaicGo works" title="Three steps to your ride" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Compass, title: 'Choose Destination', text: 'Type your starting point and where you want to go — terminal names, stops, or barangays.' },
            { icon: Scale, title: 'Compare Routes', text: 'See documented routes, fares, transfers and driver-reported availability side by side.' },
            { icon: Building2, title: 'Find Your Terminal', text: 'Open the map to locate your boarding terminal and view route details before you leave.' },
          ].map((s, i) => (
            <div key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-5 text-5xl font-extrabold text-maroon-50">{i + 1}</span>
              <div className="w-fit rounded-xl bg-brand p-2.5 text-white"><s.icon className="h-6 w-6" aria-hidden /></div>
              <h3 className="mt-4 text-lg">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------- Transportation categories ------------------- */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow="Transportation" title="Ride the way Naic moves" />
          {types.error ? <ErrorState error={types.error} onRetry={types.reload} /> : (
            <div className="grid gap-5 md:grid-cols-3">
              {(types.data || [{ code: 'tricycle' }, { code: 'jeepney' }, { code: 'bus' }]).map((t) => (
                <Link key={t.code} to={`/transport/${t.code}`} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-maroon-50 p-3 text-maroon group-hover:bg-maroon group-hover:text-white"><VehicleIcon type={t.code} className="h-7 w-7" /></div>
                    <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
                  </div>
                  <h3 className="mt-4 text-xl">{vehicleName(t.code)}</h3>
                  <p className="mt-1 text-sm text-muted">{t.description || ' '}</p>
                  {t.route_count !== undefined && (
                    <p className="mt-3 text-sm font-semibold text-maroon">{t.route_count} documented route{t.route_count === 1 ? '' : 's'} · {t.terminal_count} terminal{t.terminal_count === 1 ? '' : 's'}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* -------------------------- Featured terminals ------------------------ */}
      <section className="container-page py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-accent">Terminals</p>
            <h2 className="mt-2 text-3xl">Featured terminals</h2>
          </div>
          <Link to="/terminals" className="btn-secondary">All terminals <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {overview.loading ? <Loading rows={2} /> : overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} /> :
          overview.data.featured_terminals.length === 0 ? <EmptyState title="No terminals published yet">Terminals will appear here once researchers add verified records.</EmptyState> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.data.featured_terminals.map((t) => (
                <Link key={t.id} to={`/terminals/${t.id}`} className="card p-5 transition hover:shadow-lift">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base">{t.name}</h3>
                    <VerificationBadge status={t.verification_status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{t.barangay || 'Naic, Cavite'}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{t.vehicle_types.map((v) => <VehicleTypeChip key={v} type={v} />)}</div>
                  <p className="mt-3 text-xs font-semibold text-maroon">{t.route_count} associated route{t.route_count === 1 ? '' : 's'}</p>
                </Link>
              ))}
            </div>
          )}

        {overview.data?.popular_destinations?.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl">Popular destinations</h3>
            <p className="mt-1 text-sm text-muted">Destinations served by the most documented routes.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {overview.data.popular_destinations.map((d) => (
                <Link key={d.name} to={`/routes?to=${encodeURIComponent(d.name)}`} className="inline-flex items-center gap-2 rounded-full border border-maroon/15 bg-white px-4 py-2 text-sm font-semibold text-maroon hover:bg-maroon-50">
                  <MapPinned className="h-4 w-4" aria-hidden /> {d.name} <span className="text-xs text-muted">({d.route_count})</span>
                  {d.is_demo && !d.has_verified && <DemoBadge />}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* --------------------------- Route preview --------------------------- */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow="Route search preview" title="Documented routes at a glance">
            Every result comes from the NaicGo database — with fare, terminals, transfers and the latest driver availability report.
          </SectionTitle>
          {routes.loading ? <Loading rows={2} /> : routes.error ? <ErrorState error={routes.error} onRetry={routes.reload} /> :
            routes.data.results.length === 0 ? <EmptyState icon={RouteIcon} title="No routes published yet" /> : (
              <div className="grid gap-4 lg:grid-cols-2">
                {routes.data.results.slice(0, 4).map((r) => <RouteCard key={r.id} route={r} />)}
              </div>
            )}
          <div className="mt-6 text-center"><Link to="/routes" className="btn-primary">Open the Route Finder <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      {/* ----------------------------- Fare guide ---------------------------- */}
      <section className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-accent">Transportation information</p>
            <h2 className="mt-2 text-3xl">Know the fare before you ride</h2>
            <p className="mt-3 text-muted">
              Fares are stored with their type (fixed, range or requires confirmation), passenger category, effective date and verification date, so you can see how current the information is.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><BadgeCheck className="h-5 w-5 text-success" aria-hidden /> Regular, student and senior/PWD fares where documented</li>
              <li className="flex gap-2"><BadgeCheck className="h-5 w-5 text-success" aria-hidden /> Historical fares preserved for transparency</li>
              <li className="flex gap-2"><BadgeCheck className="h-5 w-5 text-success" aria-hidden /> Clear labels for unverified or demonstration values</li>
            </ul>
            <Link to="/fares" className="btn-secondary mt-6">View the full fare guide</Link>
          </div>
          <div className="card overflow-hidden">
            {fares.loading ? <div className="p-5"><Loading rows={2} /></div> : fares.error ? <ErrorState error={fares.error} onRetry={fares.reload} /> : (
              <table className="table-base">
                <thead><tr><th>Route</th><th>Type</th><th>Category</th><th className="text-right">Fare</th></tr></thead>
                <tbody className="divide-y divide-black/5">
                  {fares.data.slice(0, 6).map((f) => (
                    <tr key={f.id}>
                      <td><Link to={`/routes/${f.route_id}`} className="font-semibold hover:text-brand">{f.route_code}</Link> {f.is_demo && <DemoBadge />}</td>
                      <td>{vehicleName(f.vehicle_type)}</td>
                      <td className="capitalize">{f.passenger_category.replace('_', '/')}</td>
                      <td className="text-right font-bold text-maroon">{fareText(f)}</td>
                    </tr>
                  ))}
                  {!fares.data.length && <tr><td colSpan={4} className="py-8 text-center text-muted">No fares published yet.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------- Passenger safety ------------------------- */}
      <section className="bg-maroon py-16 text-white">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-accent-50">Passenger safety</p>
            <h2 className="mt-2 text-3xl text-white">Something went wrong on your trip? Report it.</h2>
            <p className="mt-3 text-white/80">
              Registered commuters can report suspected scams, overcharging, unsafe driving, harassment and other concerns. Each report gets a reference number and can be tracked until it is resolved.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ReportDriverButton className="btn bg-white text-maroon hover:bg-maroon-50" />
              <Link to="/register" className="btn border border-white/30 text-white hover:bg-white/10">Create a free account</Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Flag, t: 'Private reports', d: 'Only you and authorized administrators can see your report and evidence.' },
              { icon: ClipboardCheck, t: 'Tracked to resolution', d: 'Follow status updates: Submitted, Under Review, Resolved and more.' },
              { icon: Scale, t: 'Fair review', d: 'Reports are treated as allegations until reviewed. Drivers are never publicly labelled.' },
              { icon: ShieldCheck, t: 'Protected identity', d: 'Your personal details are not disclosed to drivers.' },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
                <x.icon className="h-6 w-6 text-accent-50" aria-hidden />
                <h3 className="mt-3 text-base text-white">{x.t}</h3>
                <p className="mt-1 text-sm text-white/75">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Benefits ----------------------------- */}
      <section className="container-page py-16">
        <SectionTitle eyebrow="Benefits for commuters" title="Built for everyday trips in Naic" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Compass, t: 'Centralized information', d: 'Terminals, routes, fares and advisories in one place.' },
            { icon: Wallet, t: 'Fare awareness', d: 'Compare published fares to avoid overcharging.' },
            { icon: Smartphone, t: 'Works on any device', d: 'Use it on your phone at the terminal or on your laptop at home.' },
            { icon: RouteIcon, t: 'Plan around obstructions', d: 'See verified road notices and documented alternative routes.' },
          ].map((b) => (
            <div key={b.t} className="card p-6">
              <b.icon className="h-6 w-6 text-brand" aria-hidden />
              <h3 className="mt-3 text-base">{b.t}</h3>
              <p className="mt-1 text-sm text-muted">{b.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-black/5 bg-white p-6">
          <h2 className="text-lg">About the accuracy of this information</h2>
          <p className="mt-2 text-sm text-muted">
            NaicGo publishes information verified by researchers or approved transportation personnel, together with update and verification dates. Fares, routes, terminals and vehicle availability can change and should be confirmed with drivers, conductors or terminal personnel.
            Vehicle availability is <strong>driver-reported</strong> — it is not real-time GPS tracking, and NaicGo does not predict arrival times or detect road closures automatically.
            Map road directions come from Google Maps and may differ from the actual path of public vehicles.
          </p>
        </div>
      </section>
    </>
  );
}
