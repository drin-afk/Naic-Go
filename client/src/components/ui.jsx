import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bike, Bus, CarFront, ChevronLeft, ChevronRight, FlaskConical, Inbox, Loader2, ShieldCheck, ShieldQuestion, X,
} from 'lucide-react';
import { AVAILABILITY, REPORT_STATUSES, titleCase } from '../utils/format';

/* ------------------------------ Feedback ------------------------------ */

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand ${className}`} aria-hidden />;
}

export function Loading({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-maroon-50 p-3 text-maroon"><Icon className="h-7 w-7" aria-hidden /></div>
      <h3 className="text-lg">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center border-accent/20 px-6 py-10 text-center" role="alert">
      <div className="mb-3 rounded-2xl bg-accent-50 p-3 text-accent"><AlertTriangle className="h-7 w-7" aria-hidden /></div>
      <h3 className="text-lg">We couldn&apos;t load this information</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn-secondary mt-5" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className = '' }) {
  const tones = {
    info: 'border-maroon/15 bg-maroon-50 text-maroon',
    warning: 'border-warning/30 bg-warning-50 text-warning-700',
    danger: 'border-accent/30 bg-accent-50 text-brand-700',
    success: 'border-success/30 bg-success-50 text-success',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]} ${className}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-0.5 text-ink/80' : 'text-ink/80'}>{children}</div>
    </div>
  );
}

/* ------------------------------- Badges ------------------------------- */

const TONES = {
  success: 'bg-success-50 text-success ring-success/20',
  warning: 'bg-warning-50 text-warning-700 ring-warning/30',
  danger: 'bg-accent-50 text-brand-700 ring-accent/20',
  accent: 'bg-brand-50 text-brand ring-brand/20',
  info: 'bg-maroon-50 text-maroon ring-maroon/15',
  neutral: 'bg-black/5 text-muted ring-black/10',
};

export function Badge({ tone = 'neutral', children, className = '', title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function ReportStatusBadge({ status }) {
  const s = REPORT_STATUSES[status] || { label: titleCase(status), tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function DemoBadge({ show = true }) {
  if (!show) return null;
  return (
    <Badge tone="warning" title="Demonstration record — not verified real-world information">
      <FlaskConical className="h-3 w-3" aria-hidden /> DEMO
    </Badge>
  );
}

export function VerificationBadge({ status, date }) {
  if (status === 'verified') return <Badge tone="success" title={date ? `Verified ${date}` : 'Verified'}><ShieldCheck className="h-3 w-3" aria-hidden /> Verified</Badge>;
  if (status === 'demo') return <DemoBadge />;
  return <Badge tone="neutral"><ShieldQuestion className="h-3 w-3" aria-hidden /> Unverified</Badge>;
}

export function StatusBadge({ status }) {
  const map = { active: 'success', approved: 'success', verified: 'success', pending: 'warning', inactive: 'neutral', archived: 'neutral',
    suspended: 'danger', rejected: 'danger', resolved: 'success', correction_requested: 'accent' };
  return <Badge tone={map[status] || 'neutral'}>{titleCase(status)}</Badge>;
}

export function AvailabilityBadge({ status, fresh = true }) {
  if (!fresh) return <Badge tone="neutral" title="This driver report is older than the freshness window">Outdated report</Badge>;
  const a = AVAILABILITY[status] || { label: titleCase(status), tone: 'neutral' };
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

export function VehicleIcon({ type, className = 'h-5 w-5' }) {
  if (type === 'bus') return <Bus className={className} aria-hidden />;
  if (type === 'tricycle') return <Bike className={className} aria-hidden />;
  return <CarFront className={className} aria-hidden />;
}

export function VehicleTypeChip({ type }) {
  const name = { tricycle: 'Tricycle', jeepney: 'Jeepney', bus: 'Bus' }[type] || type;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-50 px-2 py-1 text-xs font-semibold text-maroon">
      <VehicleIcon type={type} className="h-3.5 w-3.5" /> {name}
    </span>
  );
}

/* ------------------------------- Forms -------------------------------- */

export function Field({ label, error, hint, required, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="text-accent"> *</span>}</label>}
      {child}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-accent" role="alert">{error}</p>}
    </div>
  );
}

export function Input({ label, error, hint, required, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id) => <input id={id} className={`input ${error ? 'input-error' : ''}`} aria-invalid={Boolean(error)} required={required} {...props} />}
    </Field>
  );
}

export function Select({ label, error, hint, required, className, children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id) => <select id={id} className={`input ${error ? 'input-error' : ''}`} aria-invalid={Boolean(error)} required={required} {...props}>{children}</select>}
    </Field>
  );
}

export function Textarea({ label, error, hint, required, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id) => <textarea id={id} className={`input min-h-[110px] ${error ? 'input-error' : ''}`} aria-invalid={Boolean(error)} required={required} {...props} />}
    </Field>
  );
}

export function Checkbox({ label, error, ...props }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand focus:ring-brand" {...props} />
        <span>{label}</span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-accent" role="alert">{error}</p>}
    </div>
  );
}

/* ------------------------------ Overlays ------------------------------ */

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`flex max-h-[92vh] w-full ${widths[size]} flex-col rounded-t-2xl bg-white shadow-lift sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 id="modal-title" className="text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-black/5" aria-label="Close dialog"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-black/5 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', busy, onConfirm, onCancel, children }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={<>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} {confirmLabel}
        </button>
      </>}>
      <p className="text-sm text-muted">{message}</p>
      {children && <div className="mt-4">{children}</div>}
    </Modal>
  );
}

/* ------------------------------ Layout bits --------------------------- */

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-brand"><ChevronLeft className="h-4 w-4" />{back.label}</Link>}
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'maroon', hint, to }) {
  const tones = { maroon: 'bg-maroon-50 text-maroon', red: 'bg-brand-50 text-brand', green: 'bg-success-50 text-success', amber: 'bg-warning-50 text-warning-700' };
  const body = (
    <div className="card flex items-start gap-4 p-5 transition hover:shadow-lift">
      {Icon && <div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden /></div>}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold text-ink">{value ?? '—'}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl">{body}</Link> : body;
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-muted">Page {meta.page} of {meta.totalPages} · {meta.total} records</p>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
        <button className="btn-secondary btn-sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

export function Table({ columns, rows, empty = 'No records found.', rowKey = 'id', onRowClick }) {
  if (!rows?.length) return <div className="card px-6 py-10 text-center text-sm text-muted">{empty}</div>;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr>{columns.map((c) => <th key={c.key || c.label} scope="col" className={c.className}>{c.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-black/5 bg-white">
            {rows.map((r) => (
              <tr key={r[rowKey]} className={onRowClick ? 'cursor-pointer hover:bg-warm' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => <td key={c.key || c.label} className={c.className}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
