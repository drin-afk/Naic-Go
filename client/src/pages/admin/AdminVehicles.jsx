import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import ResourceManager, { cleanPayload } from './ResourceManager';
import { StatusChanger } from './AdminTerminals';
import { AvailabilityBadge, DemoBadge, Loading, Modal, StatusBadge, Table, VehicleTypeChip } from '../../components/ui';
import { formatDate, timeAgo } from '../../utils/format';

function HistoryModal({ vehicle, onClose }) {
  const { data, loading } = useApi(`/admin/vehicles/${vehicle.id}/availability`);
  return (
    <Modal open onClose={onClose} title={`Availability history — ${vehicle.identifier}`} size="lg">
      {loading ? <Loading rows={2} /> : (
        <Table rows={data || []} empty="No availability reports." columns={[
          { key: 'status', label: 'Status', render: (r) => <AvailabilityBadge status={r.status} /> },
          { key: 'driver_name', label: 'Reported by' }, { key: 'terminal_name', label: 'Terminal' }, { key: 'note', label: 'Note' },
          { key: 'reported_at', label: 'Time', render: (r) => formatDate(r.reported_at, true) },
        ]} />
      )}
    </Modal>
  );
}

export default function AdminVehicles() {
  const opts = useApi('/admin/options');
  const [hist, setHist] = useState(null);
  const types = (opts.data?.vehicleTypes || []).map((v) => ({ value: v.id, label: v.name }));
  const statuses = ['active', 'inactive', 'suspended', 'archived'];
  return (
    <>
      <ResourceManager
        title="Vehicles" subtitle="Registered vehicles, their drivers and latest driver-reported availability."
        endpoint="/admin/vehicles" entityName="vehicle" createLabel="Add vehicle" searchPlaceholder="Search plate / body number"
        filters={[
          { name: 'type', label: 'Type', options: [{ value: 'tricycle', label: 'Tricycle' }, { value: 'jeepney', label: 'Jeepney' }, { value: 'bus', label: 'Bus' }] },
          { name: 'status', label: 'Status', options: statuses.map((s) => ({ value: s, label: s })) },
        ]}
        columns={[
          { key: 'identifier', label: 'Vehicle', render: (v) => <div><p className="font-semibold">{v.identifier} <DemoBadge show={v.is_demo} /></p><p className="text-xs text-muted">{v.description}</p></div> },
          { key: 'vehicle_type', label: 'Type', render: (v) => <VehicleTypeChip type={v.vehicle_type} /> },
          { key: 'drivers', label: 'Assigned drivers', render: (v) => v.drivers || <span className="text-muted">None</span> },
          { key: 'latest', label: 'Latest report', render: (v) => v.latest_status ? <div><AvailabilityBadge status={v.latest_status} /><p className="text-xs text-muted">{timeAgo(v.latest_reported_at)}</p></div> : <span className="text-xs text-muted">None</span> },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v.status} /> },
        ]}
        rowActions={(row, reload) => <>
          <button className="btn-ghost btn-sm" onClick={() => setHist(row)} aria-label="Availability history"><History className="h-3.5 w-3.5" /></button>
          <StatusChanger row={row} endpoint="/admin/vehicles" options={statuses} onDone={reload} />
        </>}
        fields={[
          { name: 'identifier', label: 'Plate / body number', required: true, maxLength: 40 },
          { name: 'vehicle_type_id', label: 'Vehicle type', type: 'select', required: true, options: types },
          { name: 'description', label: 'Description', maxLength: 255, span: 2 },
          { name: 'color', label: 'Color', maxLength: 40 },
          { name: 'capacity', label: 'Passenger capacity', type: 'number', min: 1, max: 120 },
          { name: 'status', label: 'Status', type: 'select', placeholder: false, options: statuses.map((s) => ({ value: s, label: s })) },
        ]}
        emptyForm={{ identifier: '', vehicle_type_id: '', description: '', color: '', capacity: '', status: 'active' }}
        toForm={(v) => ({ identifier: v.identifier, vehicle_type_id: v.vehicle_type_id, description: v.description || '', color: v.color || '', capacity: v.capacity ?? '', status: v.status })}
        toPayload={(v) => cleanPayload(v, ['vehicle_type_id', 'capacity'])}
      />
      {hist && <HistoryModal vehicle={hist} onClose={() => setHist(null)} />}
    </>
  );
}
