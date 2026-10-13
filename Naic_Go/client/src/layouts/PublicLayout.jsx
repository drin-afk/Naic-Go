import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Logo from '../components/Logo';
import { homeFor, useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/routes', label: 'Find a Route' },
  { to: '/terminals', label: 'Terminals' },
  { to: '/transport/jeepney', label: 'Jeepneys' },
  { to: '/transport/tricycle', label: 'Tricycles' },
  { to: '/transport/bus', label: 'Buses' },
  { to: '/fares', label: 'Fare Guide' },
  { to: '/advisories', label: 'Road Advisories' },
];

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const linkCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-maroon-50 text-maroon' : 'text-ink/80 hover:bg-black/5 hover:text-ink'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={linkCls}>{n.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 xl:flex">
            {user ? (
              <>
                <Link to={homeFor(user)} className="btn-secondary btn-sm"><LayoutDashboard className="h-4 w-4" /> My Dashboard</Link>
                <button className="btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/'); }}><LogOut className="h-4 w-4" /> Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">Log in</Link>
                <Link to="/register" className="btn-primary btn-sm">Create account</Link>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 xl:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" className="border-t border-black/5 bg-white xl:hidden" aria-label="Mobile">
            <div className="container-page flex flex-col gap-1 py-3">
              {NAV.map((n) => <NavLink key={n.to} to={n.to} className={linkCls}>{n.label}</NavLink>)}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-black/5 pt-3">
                {user ? (
                  <>
                    <Link to={homeFor(user)} className="btn-secondary btn-sm">My Dashboard</Link>
                    <button className="btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn-secondary btn-sm">Log in</Link>
                    <Link to="/register" className="btn-primary btn-sm">Create account</Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1"><Outlet /></main>

      <footer className="mt-16 bg-maroon text-white">
        <div className="container-page grid gap-10 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-3 max-w-md text-sm text-white/75">
              NaicGo is a web-based public transportation terminal route guide for commuters in Naic, Cavite — an academic research system.
            </p>
            <p className="mt-3 max-w-md text-xs text-white/60">
              Information may change. Fares, routes and vehicle availability should be confirmed with transportation personnel. Availability is driver-reported, not GPS tracking.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">Explore</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li><Link to="/routes" className="hover:text-white">Route Finder</Link></li>
              <li><Link to="/terminals" className="hover:text-white">Terminal Directory</Link></li>
              <li><Link to="/fares" className="hover:text-white">Fare Guide</Link></li>
              <li><Link to="/advisories" className="hover:text-white">Road Advisories</Link></li>
              <li><Link to="/register/driver" className="hover:text-white">Driver Registration</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">About</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li><Link to="/about" className="hover:text-white">About NaicGo</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms of Use</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-col gap-1 py-4 text-xs text-white/60 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} NaicGo · Development of a Web-Based Public Transportation Terminal Route Guide for Commuters in Naic, Cavite</p>
            <p>Academic research project</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
