import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

/**
 * Client-side guard for dashboards. This only improves UX — every protected API endpoint
 * independently enforces authentication, roles and ownership on the server.
 */
export default function ProtectedRoute({ roles, requireApproved = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  if (requireApproved && user.role === 'driver' && (user.approval_status !== 'approved' || user.status !== 'active')) {
    return <Navigate to="/driver/pending" replace />;
  }
  return <Outlet />;
}
