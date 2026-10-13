import axios from 'axios';

/**
 * Axios instance. Authentication uses an HTTP-only cookie set by the API,
 * so no token is ever stored in localStorage or readable by JavaScript.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 20000,
});

/** Normalise errors into { status, message, fieldErrors } so pages can show them consistently. */
export function parseError(err) {
  if (!err) return { status: 0, message: 'Unknown error.' };
  if (err.response) {
    const { status, data } = err.response;
    const fieldErrors = {};
    (data?.errors || []).forEach((e) => { if (e.field) fieldErrors[e.field] = e.message; });
    return {
      status,
      message: data?.message || (status === 404 ? 'Not found.' : 'The request could not be completed.'),
      fieldErrors,
    };
  }
  if (err.code === 'ECONNABORTED') return { status: 0, message: 'The server took too long to respond. Please try again.' };
  return { status: 0, message: 'Cannot reach the NaicGo server. Check that the API is running and try again.' };
}

/** Download a file (CSV / evidence) from an authenticated endpoint. */
export async function downloadFile(url, params, fallbackName = 'download') {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Open an authenticated file (e.g. evidence image) in a new tab via a blob URL. */
export async function openFile(url) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  window.open(href, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

export default api;
