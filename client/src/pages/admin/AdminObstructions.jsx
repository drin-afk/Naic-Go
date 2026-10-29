import { useApi } from '../../hooks/useApi';
import ResourceManager, { cleanPayload } from './ResourceManager';
import { Alert, Badge, DemoBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';

const toLocalInput = (s) => (s ? String(s).replace(' ', 'T').slice(0, 16) : '');

export default function AdminObstructions() {
  const opts = useApi('/admin/options');
  const routes = (opts.data?.routes || []).map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));
  return (
    <ResourceManager
      title="Road obstructions" subtitle="Review obstruction reports and publish verified notices with documented alternatives."
      endpoint="/admin/obstructions" entityName="obstruction report" createLabel="Add obstruction report" searchPlaceholder="Search title or location"
      notice={<Alert tone="info" className="mb-4">Only <strong>verified</strong> reports can be published. Commuters see published notices on route pages and Road Advisories together with the affected route&apos;s documented alternatives (managed in Routes).</Alert>}
      filters={[
        { name: 'verification', label: 'Verification', options: ['pending', 'verified', 'rejected'].map((s) => ({ value: s, label: s })) },
        { name: 'resolution', label: 'Resolution', options: ['active', 'resolved'].map((s) => ({ value: s, label: s })) },
      ]}
      columns={[
        { key: 'title', label: 'Report', render: (o) => <div><p className="font-semibold">{o.title} <DemoBadge show={o.is_demo} /></p><p className="text-xs text-muted">{o.location_description}</p></div> },
        { key: 'route', label: 'Affected route', render: (o) => o.route_code ? <div><p>{o.route_code}</p><p className="text-xs text-muted">{o.documented_alternatives} documented alternative(s)</p></div> : '—' },
        { key: 'reported_at', label: 'Reported', render: (o) => formatDate(o.reported_at, true) },
        { key: 'verification_status', label: 'Verification', render: (o) => <Badge tone={{ verified: 'success', pending: 'warning', rejected: 'danger' }[o.verification_status]}>{o.verification_status}</Badge> },
        { key: 'resolution_status', label: 'Resolution', render: (o) => <Badge tone={o.resolution_status === 'active' ? 'accent' : 'neutral'}>{o.resolution_status}</Badge> },
        { key: 'is_published', label: 'Public', render: (o) => <Badge tone={o.is_published ? 'success' : 'neutral'}>{o.is_published ? 'Published' : 'Hidden'}</Badge> },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true, span: 2, maxLength: 150 },
        { name: 'location_description', label: 'Location', required: true, span: 2, maxLength: 255 },
        { name: 'latitude', label: 'Latitude', type: 'number', step: 'any' },
        { name: 'longitude', label: 'Longitude', type: 'number', step: 'any' },
        { name: 'affected_route_id', label: 'Affected route', type: 'select', options: routes, placeholder: 'None / unknown', span: 2 },
        { name: 'reported_at', label: 'Report time', type: 'datetime-local' },
        { name: 'verification_status', label: 'Verification', type: 'select', placeholder: false, options: ['pending', 'verified', 'rejected'].map((s) => ({ value: s, label: s })) },
        { name: 'resolution_status', label: 'Resolution', type: 'select', placeholder: false, options: ['active', 'resolved'].map((s) => ({ value: s, label: s })) },
        { name: 'is_published', label: 'Publish notice to commuters', type: 'checkbox' },
        { name: 'description', label: 'Description', type: 'textarea', required: true, span: 2, maxLength: 3000 },
        { name: 'admin_notes', label: 'Administrative notes (private)', type: 'textarea', span: 2, maxLength: 3000 },
      ]}
      emptyForm={{ title: '', location_description: '', latitude: '', longitude: '', affected_route_id: '', reported_at: '', verification_status: 'pending', resolution_status: 'active', is_published: false, description: '', admin_notes: '' }}
      toForm={(o) => ({ title: o.title, location_description: o.location_description, latitude: o.latitude ?? '', longitude: o.longitude ?? '', affected_route_id: o.affected_route_id ?? '',
        reported_at: toLocalInput(o.reported_at), verification_status: o.verification_status, resolution_status: o.resolution_status, is_published: o.is_published, description: o.description, admin_notes: o.admin_notes || '' })}
      toPayload={(v) => cleanPayload(v, ['latitude', 'longitude', 'affected_route_id'])}
    />
  );
}
