import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Info } from 'lucide-react';
import { GOOGLE_MAP_ID, NAIC_CENTER, googleMapsDirectionsUrl, hasGoogleMaps, loadGoogleMaps } from './mapsLoader';

/**
 * Map with Google Maps when configured, otherwise an OpenStreetMap (Leaflet) fallback.
 *
 * markers: [{ lat, lng, kind: 'terminal'|'stop'|'origin'|'destination'|'obstruction', title, subtitle, href }]
 * path:    [{ lat, lng }] documented stop sequence (drawn as a dashed line — NOT a road path)
 * directions: true to request Google road directions between the first and last path points.
 */
const COLORS = { terminal: '#641C2B', stop: '#77727A', origin: '#25845A', destination: '#A52A3A', obstruction: '#D99A27' };
const LABELS = { terminal: 'Terminal', stop: 'Documented stop', origin: 'Boarding point', destination: 'Drop-off point', obstruction: 'Road obstruction notice' };

const valid = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
const toLL = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });

function svgPin(color) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.4 15 39 15 39s14-13.6 14-24.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`
  )}`;
}

function infoNode(m) {
  // Built with DOM APIs (textContent) so record text can never inject HTML.
  const div = document.createElement('div');
  div.style.cssText = 'font-family:inherit;max-width:220px;padding:2px';
  const t = document.createElement('strong'); t.textContent = m.title || LABELS[m.kind]; div.appendChild(t);
  if (m.subtitle) { const s = document.createElement('div'); s.textContent = m.subtitle; s.style.cssText = 'font-size:12px;color:#77727A;margin-top:2px'; div.appendChild(s); }
  const k = document.createElement('div'); k.textContent = LABELS[m.kind] || ''; k.style.cssText = 'font-size:11px;color:#641C2B;margin-top:4px;font-weight:600'; div.appendChild(k);
  if (m.href) { const a = document.createElement('a'); a.href = m.href; a.textContent = 'View details →'; a.style.cssText = 'display:block;margin-top:6px;font-size:12px;color:#A52A3A;font-weight:600'; div.appendChild(a); }
  return div;
}

export default function MapView({ markers = [], path = [], directions = false, height = 380, zoom = 14, className = '', showLegend = true }) {
  const el = useRef(null);
  const [mode, setMode] = useState(hasGoogleMaps() ? 'loading' : 'fallback');
  const [notice, setNotice] = useState(hasGoogleMaps() ? null : 'Google Maps is not configured. Showing an OpenStreetMap fallback map.');
  const [dirStatus, setDirStatus] = useState(null);
  const pts = markers.filter(valid);
  const line = path.filter(valid).map(toLL);
  const key = JSON.stringify([pts.map((m) => [m.lat, m.lng, m.kind, m.title]), line, directions]);

  // ---------------- Google Maps ----------------
  useEffect(() => {
    if (mode === 'fallback') return undefined;
    let cancelled = false;
    let overlays = [];
    loadGoogleMaps().then((g) => {
      if (cancelled || !el.current) return;
      setMode('google');
      const map = new g.Map(el.current, {
        center: pts[0] ? toLL(pts[0]) : NAIC_CENTER, zoom, mapId: GOOGLE_MAP_ID || undefined,
        streetViewControl: false, mapTypeControl: false, fullscreenControl: true,
      });
      const info = new g.InfoWindow();
      const bounds = new g.LatLngBounds();
      pts.forEach((m) => {
        const marker = new g.Marker({
          map, position: toLL(m), title: m.title,
          icon: { url: svgPin(COLORS[m.kind] || COLORS.terminal), scaledSize: new g.Size(30, 40), anchor: new g.Point(15, 39) },
        });
        marker.addListener('click', () => { info.setContent(infoNode(m)); info.open({ map, anchor: marker }); });
        overlays.push(marker);
        bounds.extend(toLL(m));
      });
      if (line.length > 1) {
        overlays.push(new g.Polyline({
          map, path: line, strokeOpacity: 0, strokeColor: '#641C2B',
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 }, offset: '0', repeat: '14px' }],
        }));
        line.forEach((p) => bounds.extend(p));
      }
      if (pts.length + line.length > 1) map.fitBounds(bounds, 48);

      if (directions && line.length > 1) {
        setDirStatus('loading');
        const svc = new g.DirectionsService();
        const renderer = new g.DirectionsRenderer({ map, suppressMarkers: true, preserveViewport: true,
          polylineOptions: { strokeColor: '#A52A3A', strokeOpacity: 0.55, strokeWeight: 5 } });
        overlays.push(renderer);
        svc.route({
          origin: line[0], destination: line[line.length - 1],
          waypoints: line.slice(1, -1).slice(0, 23).map((p) => ({ location: p, stopover: false })),
          travelMode: g.TravelMode.DRIVING,
        }).then((r) => { if (!cancelled) { renderer.setDirections(r); setDirStatus('ok'); } })
          .catch((e) => { if (!cancelled) setDirStatus(`Road directions unavailable: ${e?.code || e?.message || 'request failed'}. Check that the Directions API is enabled for your key.`); });
      }
    }).catch((err) => {
      if (cancelled) return;
      setMode('fallback');
      setNotice(`${err.message} Showing an OpenStreetMap fallback map instead.`);
    });
    return () => { cancelled = true; overlays.forEach((o) => o.setMap?.(null)); overlays = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'fallback', key]);

  // ---------------- Leaflet fallback ----------------
  useEffect(() => {
    if (mode !== 'fallback' || !el.current) return undefined;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(pts[0] ? toLL(pts[0]) : NAIC_CENTER, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const layers = [];
    pts.forEach((m) => {
      const cm = L.circleMarker(toLL(m), {
        radius: m.kind === 'stop' ? 6 : 9, color: '#fff', weight: 2, fillColor: COLORS[m.kind] || COLORS.terminal, fillOpacity: 1,
      }).bindPopup(infoNode(m)).bindTooltip(m.title || '', { direction: 'top' });
      cm.addTo(map); layers.push(cm);
    });
    if (line.length > 1) layers.push(L.polyline(line, { color: '#641C2B', weight: 3, dashArray: '6 8' }).addTo(map));
    if (layers.length > 1) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [32, 32] });
    setTimeout(() => map.invalidateSize(), 50);
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, key]);

  const extUrl = line.length > 1 ? googleMapsDirectionsUrl(line[0], line[line.length - 1]) : pts.length === 1 ? googleMapsDirectionsUrl(null, toLL(pts[0])) : null;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-maroon-50">
        <div ref={el} style={{ height }} className="w-full" role="region" aria-label="Map" />
        {mode === 'loading' && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</div>}
        {pts.length === 0 && line.length === 0 && mode !== 'loading' && (
          <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-muted shadow">
            No verified coordinates are recorded for these items yet.
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-muted">
        {notice && <p className="flex items-start gap-1.5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{notice}</p>}
        {line.length > 1 && <p>Dashed line = documented stop sequence (straight segments, not the exact road path).</p>}
        {dirStatus === 'ok' && <p>Shaded red line = Google road directions between the first and last stop. Road directions are not necessarily the path the public vehicle follows.</p>}
        {dirStatus && dirStatus !== 'ok' && dirStatus !== 'loading' && <p className="text-warning-700">{dirStatus}</p>}
        {showLegend && pts.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {[...new Set(pts.map((m) => m.kind))].map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[k] }} />{LABELS[k]}</span>
            ))}
          </div>
        )}
        {extUrl && (
          <a href={extUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            Open in Google Maps <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
