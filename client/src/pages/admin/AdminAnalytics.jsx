import { useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { downloadFile, parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, ErrorState, Loading, PageHeader, Table } from '../../components/ui';
import { titleCase } from '../../utils/format';

export default function AdminAnalytics() {
  const toast = useToast();
  const types = useApi('/admin/analytics');
  const [type, setType] = useState('complaints');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const report = useApi(`/admin/analytics/${type}`, { from: from || undefined, to: to || undefined });
  const rows = report.data?.rows || [];
  const columns = rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: titleCase(k), render: (r) => (r[k] === null ? '—' : String(r[k])) })) : [];

  const exportCsv = async () => {
    try { await downloadFile(`/admin/analytics/${type}`, { from: from || undefined, to: to || undefined, format: 'csv' }, `naicgo-${type}.csv`); }
    catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <div>
      <PageHeader title="Reports & analytics" subtitle="Generate reports with date filters and export them as CSV." />
      <Alert tone="info" className="mb-4">Counts reflect records stored in NaicGo, not independently verified real-world totals. The complaints export contains no personal information.</Alert>
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_170px_170px_auto] md:items-end">
        <div>
          <label className="label" htmlFor="rep-type">Report</label>
          <select id="rep-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {(types.data || []).map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="rep-from">From</label><input id="rep-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor="rep-to">To</label><input id="rep-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</button>
      </div>
      {report.loading ? <Loading /> : report.error ? <ErrorState error={report.error} onRetry={report.reload} /> : (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted"><FileBarChart className="h-4 w-4" /> {report.data.title}: <strong className="text-ink">{rows.length}</strong> record(s) · {report.data.from} to {report.data.to}</p>
          <Table rows={rows.map((r, i) => ({ ...r, __k: i }))} rowKey="__k" columns={columns} empty="No records in this period." />
        </>
      )}
    </div>
  );
}
