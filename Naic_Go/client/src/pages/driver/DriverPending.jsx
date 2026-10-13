import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Clock, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Loading } from '../../components/ui';
import { formatDate, vehicleName } from '../../utils/format';

export default function DriverPending() {
  const { user, refresh, logout } = useAuth();
  const { data, loading } = useApi('/driver/profile');
  useEffect(() => { refresh(); }, [refresh]);
  if (user?.approval_status === 'approved' && user?.status === 'active') return <Navigate to="/driver/dashboard" replace />;
  const rejected = data?.approval_status === 'rejected';

  return (
    <div className="container-page max-w-xl py-14">
      <div className="card p-8 text-center">
        {rejected ? <XCircle className="mx-auto h-12 w-12 text-accent" /> : <Clock className="mx-auto h-12 w-12 text-warning" />}
        <h1 className="mt-4 text-2xl">{rejected ? 'Application not approved' : 'Your driver account is awaiting approval'}</h1>
        {loading ? <div className="mt-4"><Loading rows={1} /></div> : data && (
          <div className="mt-4 rounded-xl bg-warm p-4 text-left text-sm">
            <p><span className="text-muted">Name:</span> <strong>{data.full_name}</strong></p>
            <p><span className="text-muted">Transportation:</span> <strong>{vehicleName(data.vehicle_type)}</strong></p>
            <p><span className="text-muted">Registered:</span> <strong>{formatDate(data.created_at)}</strong></p>
            {data.approval_reason && <p className="mt-2"><span className="text-muted">Administrator note:</span> {data.approval_reason}</p>}
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          {rejected ? 'Please contact the NaicGo administrator if you believe this was a mistake.'
            : 'An administrator will verify your details and assign your vehicle and route. Driver features unlock once you are approved — check back later.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="btn-secondary">Back to NaicGo</Link>
          <button className="btn-ghost" onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
