import { useState } from 'react';
import { useApi, useDebounce } from '../../hooks/useApi';
import { ErrorState, Loading, PageHeader, Pagination, Table } from '../../components/ui';
import { formatDate, titleCase } from '../../utils/format';

function Details({ text }) {
  if (!text) return <span className="text-muted">—</span>;
  let pretty = text;
  try { pretty = JSON.stringify(JSON.parse(text), null, 1); } catch { /* keep raw */ }
  return <details><summary className="cursor-pointer text-xs font-semibold text-maroon">View</summary><pre className="mt-1 max-w-md whitespace-pre-wrap break-all rounded bg-warm p-2 text-[11px]">{pretty}</pre></details>;
}

export default function AdminAuditLogs() {
  const [f, setF] = useState({ action: '', entity_type: '', actor: '', from: '', to: '' });
  const df = { ...f, action: useDebounce(f.action, 300), actor: useDebounce(f.actor, 300) };
  const [page, setPage] = useState(1);
  const params = Object.fromEntries(Object.entries({ ...df, page }).filter(([, v]) => v));
  const { data, meta, loading, error, reload } = useApi('/admin/audit-logs', params);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Administrative and security-relevant actions. Passwords and tokens are never logged." />
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-5">
        <input className="input" placeholder="Action (e.g. fare)" value={f.action} onChange={set('action')} aria-label="Action" />
        <select className="input" value={f.entity_type} onChange={set('entity_type')} aria-label="Entity type">
          <option value="">All entities</option>
          {['user', 'terminal', 'route', 'fare', 'vehicle', 'vehicle_assignment', 'driver_report', 'driver_update_request', 'road_obstruction', 'report'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
        </select>
        <input className="input" placeholder="Actor name" value={f.actor} onChange={set('actor')} aria-label="Actor" />
        <input type="date" className="input" value={f.from} onChange={set('from')} aria-label="From" />
        <input type="date" className="input" value={f.to} onChange={set('to')} aria-label="To" />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <Table rows={data} columns={[
            { key: 'created_at', label: 'Time', className: 'whitespace-nowrap', render: (l) => formatDate(l.created_at, true) },
            { key: 'actor', label: 'Actor', render: (l) => (l.actor_name ? <div><p className="font-semibold">{l.actor_name}</p><p className="text-xs text-muted">{l.actor_role}</p></div> : <span className="text-muted">System / anonymous</span>) },
            { key: 'action', label: 'Action', render: (l) => <code className="rounded bg-maroon-50 px-1.5 py-0.5 text-xs text-maroon">{l.action}</code> },
            { key: 'entity', label: 'Entity', render: (l) => (l.entity_type ? `${l.entity_type}${l.entity_id ? ` #${l.entity_id}` : ''}` : '—') },
            { key: 'details', label: 'Details', render: (l) => <Details text={l.details} /> },
            { key: 'ip_address', label: 'IP', render: (l) => <span className="text-xs">{l.ip_address || '—'}</span> },
          ]} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
