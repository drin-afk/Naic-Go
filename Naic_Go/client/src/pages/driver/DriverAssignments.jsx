import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Badge, ErrorState, Loading, PageHeader, Table, VehicleTypeChip } from '../../components/ui';
import { formatDate } from '../../utils/format';

export default function DriverAssignments() {
  const { data, loading, error, reload } = useApi('/driver/assignments');
  return (
    <div>
      <PageHeader title="Assignments" subtitle="Vehicle, route and terminal assignments approved by the administrator." />
      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <Table rows={data} empty="You have no assignments yet." columns={[
          { key: 'vehicle', label: 'Vehicle', render: (a) => <span className="flex flex-col gap-1"><strong>{a.vehicle_identifier}</strong><VehicleTypeChip type={a.vehicle_type} /></span> },
          { key: 'route', label: 'Route', render: (a) => a.route_id ? <Link to={`/routes/${a.route_id}`} className="link">{a.route_code} — {a.route_name}</Link> : '—' },
          { key: 'terminal', label: 'Terminal', render: (a) => a.terminal_id ? <Link to={`/terminals/${a.terminal_id}`} className="hover:text-brand">{a.terminal_name}</Link> : '—' },
          { key: 'dates', label: 'Period', render: (a) => `${formatDate(a.start_date)} – ${a.end_date ? formatDate(a.end_date) : 'present'}` },
          { key: 'is_active', label: 'Status', render: (a) => <Badge tone={a.is_active ? 'success' : 'neutral'}>{a.is_active ? 'Active' : 'Ended'}</Badge> },
        ]} />
      )}
    </div>
  );
}
