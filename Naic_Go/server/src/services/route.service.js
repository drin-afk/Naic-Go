const { query } = require('../config/db');
const availability = require('./availability.service');

/**
 * Route data access + search.
 * The dataset for one municipality is small (tens to hundreds of routes), so routes and their
 * stops are loaded once per request and matched in JavaScript, which keeps the matching rules
 * (direction, stop order, transfers) readable and easy to verify for the research team.
 */

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(demo[^)]*\)/g, ' ')
  .replace(/\bdemo\b/g, ' ')
  .replace(/[^a-z0-9ñ ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** True if user text matches a place label (either contains the other, or all query words appear). */
function placeMatches(queryText, ...labels) {
  const q = norm(queryText);
  if (!q) return false;
  const words = q.split(' ').filter((w) => w.length > 1);
  return labels.some((label) => {
    const l = norm(label);
    if (!l) return false;
    if (l.includes(q) || (q.length >= 4 && q.includes(l))) return true;
    return words.length > 0 && words.every((w) => l.includes(w));
  });
}

function fareLabel(f) {
  if (!f) return 'No published fare';
  if (f.fare_type === 'requires_confirmation') return 'Confirm with driver/conductor';
  if (f.fare_type === 'fixed') return `₱${Number(f.amount_min).toFixed(2)}`;
  return `₱${Number(f.amount_min).toFixed(2)} – ₱${Number(f.amount_max).toFixed(2)}`;
}

/** Load active routes (optionally filtered) with stops, terminals and current fares. */
async function loadRoutes({ type, terminalId, ids, includeInactive = false } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push("r.status = 'active'");
  if (type) { where.push('vt.code = ?'); params.push(type); }
  if (ids) { where.push('r.id IN (?)'); params.push(ids.length ? ids : [0]); }
  if (terminalId) {
    where.push(`(EXISTS (SELECT 1 FROM route_terminals rt WHERE rt.route_id = r.id AND rt.terminal_id = ?)
               OR EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id = r.id AND rs.terminal_id = ?))`);
    params.push(terminalId, terminalId);
  }
  const routes = await query(
    `SELECT r.id, r.code, r.name, r.origin, r.destination, r.distance_km, r.description, r.requires_transfer,
            r.transfer_notes, r.status, r.verification_status, r.verified_at, r.is_demo, r.updated_at,
            vt.id AS vehicle_type_id, vt.code AS vehicle_type, vt.name AS vehicle_type_name
       FROM routes r JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY r.code`,
    params
  );
  if (!routes.length) return [];
  const routeIds = routes.map((r) => r.id);

  const [stops, terms, fares] = await Promise.all([
    query(
      `SELECT s.id, s.route_id, s.stop_order, s.name, s.terminal_id, s.latitude, s.longitude, s.is_boarding, s.is_dropoff, s.notes,
              t.name AS terminal_name, t.barangay AS terminal_barangay
         FROM route_stops s LEFT JOIN terminals t ON t.id = s.terminal_id
        WHERE s.route_id IN (?) ORDER BY s.route_id, s.stop_order`, [routeIds]),
    query(
      `SELECT rt.route_id, rt.role, t.id, t.name, t.barangay, t.latitude, t.longitude, t.status, t.verification_status, t.is_demo
         FROM route_terminals rt JOIN terminals t ON t.id = rt.terminal_id
        WHERE rt.route_id IN (?) ORDER BY FIELD(rt.role,'origin','intermediate','destination'), t.name`, [routeIds]),
    query(
      `SELECT id, route_id, passenger_category, fare_type, amount_min, amount_max, effective_date, source,
              verification_status, verified_at, notes, updated_at
         FROM fares WHERE route_id IN (?) AND is_current = 1
        ORDER BY FIELD(passenger_category,'regular','student','senior_pwd')`, [routeIds]),
  ]);

  const byRoute = (rows) => rows.reduce((m, r) => ((m[r.route_id] ||= []).push(r), m), {});
  const s = byRoute(stops), t = byRoute(terms), f = byRoute(fares);
  return routes.map((r) => {
    const routeFares = (f[r.id] || []).map((x) => ({ ...x, label: fareLabel(x) }));
    const regular = routeFares.find((x) => x.passenger_category === 'regular') || null;
    const lastUpdate = [r.updated_at, ...routeFares.map((x) => x.updated_at)].filter(Boolean).sort().pop();
    return {
      ...r,
      requires_transfer: Boolean(r.requires_transfer),
      is_demo: Boolean(r.is_demo),
      stops: s[r.id] || [],
      terminals: t[r.id] || [],
      fares: routeFares,
      fare: regular,
      fare_label: fareLabel(regular),
      last_updated: lastUpdate,
    };
  });
}

/** Index of the first stop matching `from` and last stop matching `to`. Origin/destination text also count. */
function locate(route, text, mode) {
  const stops = route.stops;
  if (mode === 'from') {
    if (placeMatches(text, route.origin)) return { order: stops[0]?.stop_order ?? 0, stop: stops[0] || { name: route.origin } };
    const st = stops.find((x) => placeMatches(text, x.name, x.terminal_name, x.terminal_barangay));
    return st ? { order: st.stop_order, stop: st } : null;
  }
  if (placeMatches(text, route.destination)) {
    const last = stops[stops.length - 1];
    return { order: last?.stop_order ?? 1e6, stop: last || { name: route.destination } };
  }
  const st = [...stops].reverse().find((x) => placeMatches(text, x.name, x.terminal_name, x.terminal_barangay));
  return st ? { order: st.stop_order, stop: st } : null;
}

const stopKey = (s) => (s.terminal_id ? `t:${s.terminal_id}` : `n:${norm(s.name)}`);

/**
 * Search documented routes.
 * - Direct routes: `from` occurs before `to` along the documented stop order.
 * - Connections: two documented routes that share a documented stop/terminal (only when both
 *   inputs are given). These are labelled as connections that require a transfer.
 */
async function search({ from, to, type, terminalId, maxFare, availableOnly }) {
  const routes = await loadRoutes({ type, terminalId });
  const direct = [];
  for (const r of routes) {
    const a = from ? locate(r, from, 'from') : null;
    const b = to ? locate(r, to, 'to') : null;
    if (from && !a) continue;
    if (to && !b) continue;
    if (a && b && !(a.order < b.order)) continue;
    direct.push({
      ...r,
      match: { kind: r.requires_transfer ? 'documented_transfer' : 'direct',
        boarding: a?.stop?.name || r.origin, dropoff: b?.stop?.name || r.destination },
    });
  }

  let connections = [];
  if (from && to) {
    const all = type || terminalId ? await loadRoutes({}) : routes;
    const firstLegs = all.map((r) => ({ r, a: locate(r, from, 'from') })).filter((x) => x.a);
    const secondLegs = all.map((r) => ({ r, b: locate(r, to, 'to') })).filter((x) => x.b);
    const directIds = new Set(direct.map((d) => d.id));
    for (const { r: r1, a } of firstLegs) {
      for (const { r: r2, b } of secondLegs) {
        if (r1.id === r2.id || directIds.has(r1.id) || directIds.has(r2.id)) continue;
        if (type && r1.vehicle_type !== type && r2.vehicle_type !== type) continue;
        const after = r1.stops.filter((s) => s.stop_order > a.order);
        const before = new Map(r2.stops.filter((s) => s.stop_order < b.order).map((s) => [stopKey(s), s]));
        const shared = after.find((s) => before.has(stopKey(s)));
        if (!shared) continue;
        connections.push({
          kind: 'connection',
          transfer_at: shared.terminal_name || shared.name,
          legs: [
            { ...r1, match: { boarding: a.stop.name, dropoff: shared.name } },
            { ...r2, match: { boarding: before.get(stopKey(shared)).name, dropoff: b.stop.name } },
          ],
        });
        if (connections.length >= 6) break;
      }
      if (connections.length >= 6) break;
    }
  }

  // Attach driver-reported availability.
  const ids = [...new Set([...direct.map((r) => r.id), ...connections.flatMap((c) => c.legs.map((l) => l.id))])];
  const avail = await availability.byRoutes(ids);
  const withAvail = (r) => ({ ...r, availability: avail.get(r.id) });
  let results = direct.map(withAvail);
  connections = connections.map((c) => ({ ...c, legs: c.legs.map(withAvail) }));

  if (maxFare) {
    results = results.filter((r) => r.fare && r.fare.fare_type !== 'requires_confirmation' && Number(r.fare.amount_min) <= maxFare);
  }
  if (availableOnly) {
    results = results.filter((r) => r.availability && r.availability.available > 0);
  }
  results.sort((x, y) => (x.match.kind === 'direct' ? 0 : 1) - (y.match.kind === 'direct' ? 0 : 1)
    || (Number(x.fare?.amount_min) || 9999) - (Number(y.fare?.amount_min) || 9999));

  return { results, connections };
}

/** Published, verified, unresolved obstruction notices affecting the given routes. */
async function activeObstructions(routeIds) {
  if (!routeIds.length) return [];
  return query(
    `SELECT id, title, location_description, latitude, longitude, description, affected_route_id, reported_at,
            verification_status, resolution_status, is_demo, updated_at
       FROM road_obstruction_reports
      WHERE is_published = 1 AND verification_status = 'verified' AND resolution_status = 'active'
        AND affected_route_id IN (?)
      ORDER BY reported_at DESC`,
    [routeIds]
  );
}

/** Documented alternatives for a route. */
async function alternatives(routeId) {
  const rows = await query('SELECT alternative_route_id, notes FROM route_alternatives WHERE route_id = ?', [routeId]);
  if (!rows.length) return [];
  const alts = await loadRoutes({ ids: rows.map((r) => r.alternative_route_id) });
  const avail = await availability.byRoutes(alts.map((a) => a.id));
  const obstr = await activeObstructions(alts.map((a) => a.id));
  return alts.map((a) => ({
    ...a,
    alternative_notes: rows.find((r) => r.alternative_route_id === a.id)?.notes || null,
    availability: avail.get(a.id),
    obstructions: obstr.filter((o) => o.affected_route_id === a.id),
  }));
}

module.exports = { loadRoutes, search, alternatives, activeObstructions, fareLabel, placeMatches, norm };
