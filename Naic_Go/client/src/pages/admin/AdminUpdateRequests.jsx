import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { parseError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, ErrorState, Loading, Modal, PageHeader, Pagination, Spinner, StatusBadge, Textarea } from '../../components/ui';
import { formatDate, titleCase } from '../../utils/format';

const manageLink = { route: (id) => `/routes/${id}`, fare: () => '/admin/fares', terminal: (id) => `/terminals/${id}`, vehicle: () => '/admin/vehicles' };

export default function AdminUpdateRequests() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/admin/update-requests', { status: status || undefined, page });
  const [review, setReview] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try { await api.patch(`/admin/update-requests/${review.id}`, { status: decision, review_notes: notes || undefined }); toast.success('Decision recorded.'); setReview(null); setNotes(''); reload(); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Information update requests" subtitle="Changes proposed by drivers. Approved changes are applied by an administrator through the management pages." />
      <div className="mb-4 flex flex-wrap gap-1">
        {[['pending', 'Pending'], ['correction_requested', 'Correction requested'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => { setStatus(k); setPage(1); }} className={`btn-sm btn ${status === k ? 'bg-maroon text-white' : 'bg-white ring-1 ring-black/10 hover:bg-black/5'}`}>{l}</button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState title="No requests in this view" /> : (
        <>
          <ul className="space-y-3">
            {data.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted">{titleCase(r.entity_type)}{r.entity_id ? ` #${r.entity_id}` : ''} · by {r.driver_name} · {formatDate(r.created_at, true)}</p>
                    <h2 className="mt-1 text-base">{r.title}</h2>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{r.proposed_changes}</p>
                {r.reason && <p className="mt-1 text-xs text-muted">Reason / source: {r.reason}</p>}
                {r.review_notes && <p className="mt-2 text-xs text-muted">Review ({r.reviewer_name}, {formatDate(r.reviewed_at)}): {r.review_notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {['pending', 'correction_requested'].includes(r.status) && <button className="btn-primary btn-sm" onClick={() => { setReview(r); setDecision('approved'); }}>Review</button>}
                  {r.entity_id && manageLink[r.entity_type] && <Link to={manageLink[r.entity_type](r.entity_id)} className="btn-secondary btn-sm">Open record</Link>}
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
      <Modal open={Boolean(review)} onClose={() => setReview(null)} title="Review update request"
        footer={<><button className="btn-ghost" onClick={() => setReview(null)}>Cancel</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />} Record decision</button></>}>
        {review && (
          <div className="space-y-4">
            <div className="rounded-xl bg-warm p-3 text-sm"><p className="font-semibold">{review.title}</p><p className="mt-1 whitespace-pre-line">{review.proposed_changes}</p></div>
            <fieldset>
              <legend className="label">Decision</legend>
              {[['approved', 'Approve'], ['correction_requested', 'Request correction'], ['rejected', 'Reject']].map(([k, l]) => (
                <label key={k} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="radio" name="decision" value={k} checked={decision === k} onChange={() => setDecision(k)} className="text-brand" /> {l}</label>
              ))}
            </fieldset>
            <Textarea label={decision === 'approved' ? 'Notes (optional)' : 'Notes for the driver (required)'} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
            {decision === 'approved' && <Alert tone="warning">Approval records the decision only. Apply the verified change in the relevant management page so it is entered and audited by an administrator.</Alert>}
          </div>
        )}
      </Modal>
    </div>
  );
}
