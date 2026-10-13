export const VEHICLE_TYPES = [
  { code: 'tricycle', name: 'Tricycle' },
  { code: 'jeepney', name: 'Jeepney' },
  { code: 'bus', name: 'Bus' },
];
export const vehicleName = (code) => VEHICLE_TYPES.find((v) => v.code === code)?.name || code || '—';

export const COMPLAINT_CATEGORIES = [
  { value: 'scam_fraud', label: 'Suspected scam or fraud' },
  { value: 'overcharging', label: 'Overcharging or fare dispute' },
  { value: 'misconduct_harassment', label: 'Driver misconduct or harassment' },
  { value: 'unsafe_driving', label: 'Unsafe driving' },
  { value: 'route_deviation', label: 'Failure to follow the documented route' },
  { value: 'discrimination', label: 'Discrimination or mistreatment' },
  { value: 'other', label: 'Other transportation-related concern' },
];
export const categoryLabel = (v) => COMPLAINT_CATEGORIES.find((c) => c.value === v)?.label || v;

export const REPORT_STATUSES = {
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under Review', tone: 'warning' },
  info_requested: { label: 'Additional Information Requested', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const AVAILABILITY = {
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
  temporarily_suspended: { label: 'Temporarily Suspended', tone: 'warning' },
};

export const PASSENGER_CATEGORIES = { regular: 'Regular', student: 'Student', senior_pwd: 'Senior / PWD' };
export const FARE_TYPES = { fixed: 'Fixed amount', range: 'Range', requires_confirmation: 'Requires confirmation' };

export const peso = (n) => (n === null || n === undefined || n === '' ? '—' : `₱${Number(n).toFixed(2)}`);

export function fareText(f) {
  if (!f) return 'No published fare';
  if (f.label) return f.label;
  if (f.fare_type === 'requires_confirmation') return 'Confirm with driver/conductor';
  if (f.fare_type === 'fixed') return peso(f.amount_min);
  return `${peso(f.amount_min)} – ${peso(f.amount_max)}`;
}

/** MySQL returns "YYYY-MM-DD HH:MM:SS" (local time). Parse without UTC shifting. */
export function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return new Date(s);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

export function formatDate(s, withTime = false) {
  const d = parseDate(s);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return '—';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(s);
}

export const minutesLabel = (m) => (m == null ? '—' : m < 60 ? `${m} min` : `${Math.round(m / 60)} hr`);

export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
