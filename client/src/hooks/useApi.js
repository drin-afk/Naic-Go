import { useCallback, useEffect, useRef, useState } from 'react';
import api, { parseError } from '../services/api';

/**
 * Fetch JSON from the NaicGo API.
 * Failed requests surface as `error` — they are NEVER replaced with placeholder data.
 */
export function useApi(url, params, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: !skip, error: null });
  const key = JSON.stringify(params || {});
  const mounted = useRef(false);
  const requestId = useRef(0);
  // Set true on every mount (React StrictMode mounts, unmounts and re-mounts in development).
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (skip || !url) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const id = ++requestId.current; // ignore responses from older, superseded requests
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      if (mounted.current && id === requestId.current) {
        setState({ data: res.data.data, meta: res.data.meta || null, loading: false, error: null });
      }
    } catch (err) {
      if (mounted.current && id === requestId.current) {
        setState({ data: null, meta: null, loading: false, error: parseError(err) });
      }
    }
  }, [url, key, skip]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Simple form state with server-side field error support. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (name) => (e) => {
    const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((x) => ({ ...x, [name]: v }));
    if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
  };
  return { values, setValues, errors, setErrors, set };
}
