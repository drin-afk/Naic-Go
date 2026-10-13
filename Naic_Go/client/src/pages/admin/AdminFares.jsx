import { useApi } from '../../hooks/useApi';
import ResourceManager, { cleanPayload } from './ResourceManager';
import { Alert, Badge, VerificationBadge } from '../../components/ui';
import { FARE_TYPES, PASSENGER_CATEGORIES, formatDate } from '../../utils/format';

export default function AdminFares() {
  const opts = useApi('/admin/options');
  const routes = (opts.data?.routes || []).map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));
  return (
    <ResourceManager
      title="Fares" subtitle="Fare amounts and ranges with effective dates, sources and verification. History is preserved."
      endpoint="/admin/fares" entityName="fare" createLabel="Add fare" searchPlaceholder="Search route code or name"
      notice={<Alert tone="info" className="mb-4">Adding a new <strong>current</strong> fare automatically moves the previous current fare for the same route and passenger category into history. Use <em>Edit</em> only to correct mistakes.</Alert>}
      filters={[
        { name: 'route_id', label: 'Route', options: routes },
        { name: 'current', label: 'State', options: [{ value: 'true', label: 'Current' }, { value: 'false', label: 'Historical' }] },
        { name: 'verification', label: 'Verification', options: ['verified', 'unverified', 'demo'].map((s) => ({ value: s, label: s })) },
      ]}
      columns={[
        { key: 'route', label: 'Route', render: (f) => <div><p className="font-semibold">{f.route_code}</p><p className="text-xs text-muted">{f.route_name}</p></div> },
        { key: 'passenger_category', label: 'Passenger', render: (f) => PASSENGER_CATEGORIES[f.passenger_category] },
        { key: 'fare', label: 'Fare', render: (f) => <div><p className="font-bold text-maroon">{f.label}</p><p className="text-xs text-muted">{FARE_TYPES[f.fare_type]}</p></div> },
        { key: 'effective_date', label: 'Effective', render: (f) => formatDate(f.effective_date) },
        { key: 'verification', label: 'Verification', render: (f) => <div className="space-y-1"><VerificationBadge status={f.verification_status} />{f.needs_reverification && f.is_current && <Badge tone="warning">Re-verify</Badge>}<p className="text-xs text-muted">{formatDate(f.verified_at)}</p></div> },
        { key: 'is_current', label: 'State', render: (f) => <Badge tone={f.is_current ? 'success' : 'neutral'}>{f.is_current ? 'Current' : 'Historical'}</Badge> },
        { key: 'source', label: 'Source', render: (f) => <span className="text-xs">{f.source || '—'}</span> },
      ]}
      fields={(v) => [
        { name: 'route_id', label: 'Route', type: 'select', required: true, options: routes, span: 2 },
        { name: 'passenger_category', label: 'Passenger category', type: 'select', placeholder: false, options: Object.entries(PASSENGER_CATEGORIES).map(([value, label]) => ({ value, label })) },
        { name: 'fare_type', label: 'Fare type', type: 'select', required: true, options: Object.entries(FARE_TYPES).map(([value, label]) => ({ value, label })) },
        { name: 'amount_min', label: v.fare_type === 'range' ? 'Minimum amount (₱)' : 'Amount (₱)', type: 'number', step: '0.25', min: 0, hidden: (x) => x.fare_type === 'requires_confirmation' || !x.fare_type },
        { name: 'amount_max', label: 'Maximum amount (₱)', type: 'number', step: '0.25', min: 0, hidden: (x) => x.fare_type !== 'range' },
        { name: 'effective_date', label: 'Effective date', type: 'date' },
        { name: 'source', label: 'Source', maxLength: 255, hint: 'e.g. LTFRB fare matrix, terminal posting, interview' },
        { name: 'verification_status', label: 'Verification', type: 'select', placeholder: false, options: [{ value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' }, { value: 'demo', label: 'Demo' }] },
        { name: 'verified_at', label: 'Verification date', type: 'date' },
        { name: 'is_current', label: 'Publish as the current fare', type: 'checkbox' },
        { name: 'notes', label: 'Notes', maxLength: 255, span: 2 },
      ]}
      emptyForm={{ route_id: '', passenger_category: 'regular', fare_type: '', amount_min: '', amount_max: '', effective_date: '', source: '', verification_status: 'unverified', verified_at: '', is_current: true, notes: '' }}
      toForm={(f) => ({ route_id: f.route_id, passenger_category: f.passenger_category, fare_type: f.fare_type, amount_min: f.amount_min ?? '', amount_max: f.amount_max ?? '',
        effective_date: f.effective_date || '', source: f.source || '', verification_status: f.verification_status, verified_at: f.verified_at || '', is_current: f.is_current, notes: f.notes || '' })}
      toPayload={(v) => cleanPayload(v, ['route_id', 'amount_min', 'amount_max'])}
    />
  );
}
