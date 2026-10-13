import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Loading, PageHeader, Pagination } from '../../components/ui';
import { timeAgo } from '../../utils/format';

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, meta, loading, error, reload } = useApi('/notifications', { page, unread: unreadOnly ? 'true' : undefined });
  const { refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const open = async (n) => {
    if (!n.read_at) { try { await api.patch(`/notifications/${n.id}/read`); } catch { /* non-blocking */ } }
    refresh();
    if (n.link) navigate(n.link); else reload();
  };
  const readAll = async () => {
    try { await api.post('/notifications/read-all'); toast.success('All notifications marked as read.'); reload(); refresh(); }
    catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={<>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded text-brand" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} /> Unread only</label>
        <button className="btn-secondary btn-sm" onClick={readAll} disabled={!meta?.unread}><CheckCheck className="h-4 w-4" /> Mark all read</button>
      </>} />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" /> : (
        <>
          <ul className="card divide-y divide-black/5">
            {data.map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-warm ${n.read_at ? '' : 'bg-maroon-50/40'}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-accent'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}{!n.read_at && <span className="sr-only"> (unread)</span>}</span>
                    <span className="mt-0.5 block text-sm text-muted">{n.message}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
