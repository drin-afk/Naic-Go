import { useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import api, { parseError } from '../../services/api';
import { useApi, useDebounce, useForm } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Checkbox, ErrorState, Input, Loading, Modal, PageHeader, Pagination, Select, Spinner, Table, Textarea } from '../../components/ui';

/** Render a list of field definitions bound to a useForm() instance. */
export function FormFields({ fields, form }) {
  const { values, set, errors, setValues } = form;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.hidden?.(values)).map((f) => {
        const common = { label: f.label, error: errors[f.name], required: f.required, hint: f.hint, className: f.span === 2 ? 'sm:col-span-2' : '' };
        if (f.type === 'select') {
          return (
            <Select key={f.name} {...common} value={values[f.name] ?? ''} onChange={set(f.name)}>
              {f.placeholder !== false && <option value="">{f.placeholder || 'Select…'}</option>}
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          );
        }
        if (f.type === 'textarea') return <Textarea key={f.name} {...common} value={values[f.name] ?? ''} onChange={set(f.name)} maxLength={f.maxLength} rows={f.rows || 3} />;
        if (f.type === 'checkbox') return <div key={f.name} className={`${common.className} self-end`}><Checkbox label={f.label} checked={Boolean(values[f.name])} onChange={set(f.name)} error={errors[f.name]} /></div>;
        if (f.type === 'multicheck') {
          const cur = values[f.name] || [];
          return (
            <fieldset key={f.name} className={common.className}>
              <legend className="label">{f.label}</legend>
              <div className="flex flex-wrap gap-3">
                {f.options.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded text-brand" checked={cur.includes(o.value)}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value) }))} />
                    {o.label}
                  </label>
                ))}
              </div>
              {errors[f.name] && <p className="mt-1 text-xs text-accent">{errors[f.name]}</p>}
            </fieldset>
          );
        }
        return <Input key={f.name} {...common} type={f.type || 'text'} step={f.step} min={f.min} max={f.max} maxLength={f.maxLength} value={values[f.name] ?? ''} onChange={set(f.name)} placeholder={f.placeholder} />;
      })}
    </div>
  );
}

/** Convert '' to null and numeric strings to numbers for selected keys. */
export function cleanPayload(values, numeric = []) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === '') out[k] = null;
    else if (numeric.includes(k) && v !== null && v !== undefined) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

function EditorModal({ title, fields, initial, onClose, onSubmit }) {
  const form = useForm(initial);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await onSubmit(form.values); }
    catch (err) { const p = parseError(err); form.setErrors(p.fieldErrors || {}); setError(p.message); toast.error(p.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" form="rm-form" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Save</button></>}>
      <form id="rm-form" onSubmit={submit} noValidate>
        {error && <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-sm text-brand-700" role="alert">{error}</p>}
        <FormFields fields={typeof fields === 'function' ? fields(form.values) : fields} form={form} />
      </form>
    </Modal>
  );
}

export default function ResourceManager({
  title, subtitle, endpoint, columns, filters = [], searchPlaceholder = 'Search…', fields, emptyForm, toForm, toPayload = (v) => v,
  rowActions, canCreate = true, canEdit = true, createLabel = 'Add new', notice, entityName = 'record',
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [filterValues, setFilterValues] = useState({});
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi(endpoint, { q: dq || undefined, page, ...filterValues });
  const [editing, setEditing] = useState(null); // null | 'new' | row

  const save = async (values) => {
    const payload = toPayload(values);
    if (editing === 'new') await api.post(endpoint, payload);
    else await api.put(`${endpoint}/${editing.id}`, payload);
    toast.success(`${entityName[0].toUpperCase()}${entityName.slice(1)} saved.`);
    setEditing(null);
    reload();
  };

  const allColumns = [...columns];
  if (canEdit || rowActions) {
    allColumns.push({
      key: '_actions', label: 'Actions', className: 'text-right whitespace-nowrap',
      render: (row) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {rowActions?.(row, reload)}
          {canEdit && <button className="btn-secondary btn-sm" onClick={() => setEditing(row)} aria-label={`Edit ${entityName}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>}
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canCreate && <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {createLabel}</button>} />
      {notice}
      <div className="card mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search" />
        </div>
        {filters.map((f) => (
          <select key={f.name} className="input md:w-48" value={filterValues[f.name] || ''} aria-label={f.label}
            onChange={(e) => { setFilterValues((x) => ({ ...x, [f.name]: e.target.value || undefined })); setPage(1); }}>
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <Table rows={data || []} columns={allColumns} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
      {editing && (
        <EditorModal
          title={editing === 'new' ? `${createLabel}` : `Edit ${entityName}`}
          fields={fields}
          initial={editing === 'new' ? emptyForm : toForm(editing)}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}
    </div>
  );
}
