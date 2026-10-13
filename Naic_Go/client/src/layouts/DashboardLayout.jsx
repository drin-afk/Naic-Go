import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Bell, Bus, CarFront, ClipboardCheck, ClipboardList, Construction, FileWarning, Flag, Home, Link2,
  LogOut, Map, Menu, ScrollText, Search, Settings, ShieldCheck, Tag, UserCircle, Users, X,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const MENUS = {
  commuter: [
    { to: '/commuter/dashboard', label: 'Dashboard', icon: Home },
    { to: '/routes', label: 'Find a Route', icon: Search },
    { to: '/commuter/reports/new', label: 'Report a Driver', icon: Flag },
    { to: '/commuter/reports', label: 'My Reports', icon: FileWarning, end: true },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/commuter/profile', label: 'Profile & Security', icon: UserCircle },
  ],
  driver: [
    { to: '/driver/dashboard', label: 'Dashboard', icon: Home },
    { to: '/driver/vehicles', label: 'My Vehicles', icon: CarFront },
    { to: '/driver/assignments', label: 'Assignments', icon: Map },
    { to: '/driver/update-requests', label: 'Update Requests', icon: ClipboardList },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/driver/profile', label: 'Profile & Security', icon: UserCircle },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { section: 'Transportation' },
    { to: '/admin/terminals', label: 'Terminals', icon: Map },
    { to: '/admin/routes', label: 'Routes', icon: Activity },
    { to: '/admin/fares', label: 'Fares', icon: Tag },
    { to: '/admin/vehicles', label: 'Vehicles', icon: Bus },
    { to: '/admin/assignments', label: 'Assignments', icon: Link2 },
    { to: '/admin/obstructions', label: 'Road Obstructions', icon: Construction },
    { section: 'People & Safety' },
    { to: '/admin/drivers', label: 'Drivers', icon: ShieldCheck },
    { to: '/admin/update-requests', label: 'Update Requests', icon: ClipboardCheck },
    { to: '/admin/reports', label: 'Passenger Reports', icon: FileWarning },
    { to: '/admin/users', label: 'User Accounts', icon: Users },
    { section: 'Oversight' },
    { to: '/admin/analytics', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/admin/profile', label: 'Account Security', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout, unread, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); refresh(); }, [location.pathname, refresh]);

  const menu = MENUS[user?.role] || [];
  const roleLabel = { commuter: 'Commuter', driver: 'Driver', admin: 'Administrator' }[user?.role];
  const doLogout = async () => { await logout(); navigate('/'); };

  const Sidebar = (
    <nav className="flex h-full flex-col" aria-label="Dashboard">
      <div className="flex h-16 items-center border-b border-white/10 px-5"><Logo light to="/" /></div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {menu.map((m, i) => m.section ? (
          <p key={i} className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/45">{m.section}</p>
        ) : (
          <NavLink key={m.to} to={m.to} end={m.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white text-maroon' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
            <m.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden /> <span className="flex-1">{m.label}</span>
            {m.to === '/notifications' && unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-white">{unread}</span>}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" aria-hidden /> Log out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-warm">
      <a href="#dash-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-maroon lg:block">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-maroon shadow-lift">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 text-white/80" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {Sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-black/5 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
            <span className="rounded-full bg-maroon-50 px-3 py-1 text-xs font-bold text-maroon">{roleLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative rounded-lg p-2 text-ink/70 hover:bg-black/5" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.full_name}</p>
              <p className="text-xs text-muted">@{user?.username}</p>
            </div>
          </div>
        </header>
        <main id="dash-main" className="px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
