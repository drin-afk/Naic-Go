const { query } = require('../config/db');
const { ApiError, asyncHandler, ok, paginate, pageMeta, likeTerm } = require('../utils/http');
const routeService = require('../services/route.service');
const availability = require('../services/availability.service');

const TYPES = ['tricycle', 'jeepney', 'bus'];
const typeParam = (req) => (TYPES.includes(req.query.type) ? req.query.type : undefined);

exports.vehicleTypes = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT vt.id, vt.code, vt.name, vt.description,
            (SELECT COUNT(*) FROM routes r WHERE r.vehicle_type_id = vt.id AND r.status = 'active') AS route_count,
            (SELECT COUNT(*) FROM terminal_vehicle_types tvt JOIN terminals t ON t.id = tvt.terminal_id
              WHERE tvt.vehicle_type_id = vt.id AND t.status = 'active') AS terminal_count
       FROM vehicle_types vt ORDER BY vt.id`
  );
  ok(res, rows);
});

/* ------------------------------- Terminals ------------------------------- */

exports.listTerminals = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 24);
  const where = ["t.status = 'active'"];
  const params = [];
  if (req.query.q) {
    where.push('(t.name LIKE ? OR t.address LIKE ? OR t.barangay LIKE ?)');
    const l = likeTerm(req.query.q); params.push(l, l, l);
  }
  const type = typeParam(req);
  if (type) {
    where.push('EXISTS (SELECT 1 FROM terminal_vehicle_types x JOIN vehicle_types y ON y.id = x.vehicle_type_id WHERE x.terminal_id = t.id AND y.code = ?)');
    params.push(type);
  }
  const sorts = { name: 't.name ASC', updated: 't.updated_at DESC', routes: 'route_count DESC, t.name ASC', verified: 't.verified_at DESC, t.name ASC' };
  const order = sorts[req.query.sort] || sorts.name;
  const whereSql = where.join(' AND ');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM terminals t WHERE ${whereSql}`, params);
  const rows = await query(
    `SELECT t.id, t.name, t.address, t.barangay, t.latitude, t.longitude, t.operating_hours,
            t.verification_status, t.verified_at, t.is_demo, t.updated_at,
            (SELECT GROUP_CONCAT(vt.code ORDER BY vt.id) FROM terminal_vehicle_types tvt
               JOIN vehicle_types vt ON vt.id = tvt.vehicle_type_id WHERE tvt.terminal_id = t.id) AS vehicle_types,
            (SELECT COUNT(DISTINCT r.id) FROM routes r
               WHERE r.status = 'active' AND (EXISTS (SELECT 1 FROM route_terminals rt WHERE rt.route_id = r.id AND rt.terminal_id = t.id)
                  OR EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id = r.id AND rs.terminal_id = t.id))) AS route_count
       FROM terminals t WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  ok(res, rows.map((t) => ({ ...t, is_demo: Boolean(t.is_demo), vehicle_types: t.vehicle_types ? t.vehicle_types.split(',') : [] })),
    pageMeta(page, pageSize, total));
});

exports.getTerminal = asyncHandler(async (req, res) => {
  const [t] = await query(
    `SELECT id, name, address, barangay, latitude, longitude, description, operating_hours, status,
            verification_status, verified_at, is_demo, updated_at
       FROM terminals WHERE id = ? AND status = 'active'`, [req.params.id]);
  if (!t) throw ApiError.notFound('Terminal not found.');
  const types = await query(
    'SELECT vt.code, vt.name FROM terminal_vehicle_types tvt JOIN vehicle_types vt ON vt.id = tvt.vehicle_type_id WHERE tvt.terminal_id = ? ORDER BY vt.id',
    [t.id]);
  const routes = await routeService.loadRoutes({ terminalId: t.id });
  const avail = await availability.byRoutes(routes.map((r) => r.id));
  const destinations = [...new Set(routes.map((r) => r.destination))];
  const obstructions = await routeService.activeObstructions(routes.map((r) => r.id));
  ok(res, {
    ...t,
    is_demo: Boolean(t.is_demo),
    vehicle_types: types,
    routes: routes.map((r) => ({ ...r, availability: avail.get(r.id) })),
    destinations,
    availability: await availability.byTerminal(t.id),
    obstructions,
  });
});

/* -------------------------------- Routes -------------------------------- */

exports.searchRoutes = asyncHandler(async (req, res) => {
  const from = String(req.query.from || '').trim().slice(0, 120);
  const to = String(req.query.to || '').trim().slice(0, 120);
  const terminalId = parseInt(req.query.terminal, 10) || undefined;
  const maxFare = parseFloat(req.query.maxFare) || undefined;
  const availableOnly = req.query.available === 'true';
  const { results, connections } = await routeService.search({ from, to, type: typeParam(req), terminalId, maxFare, availableOnly });
  const obstructions = await routeService.activeObstructions(results.map((r) => r.id));
  const out = results.map((r) => ({ ...r, obstructions: obstructions.filter((o) => o.affected_route_id === r.id) }));

  // When nothing matches, offer documented routes that touch either place so the commuter has a next step.
  let suggestions = [];
  if (!out.length && !connections.length && (from || to)) {
    const all = await routeService.loadRoutes({ type: typeParam(req) });
    suggestions = all.filter((r) =>
      [from, to].filter(Boolean).some((p) => routeService.placeMatches(p, r.origin, r.destination, ...r.stops.map((s) => s.name)))
    ).slice(0, 6);
  }
  ok(res, { results: out, connections, suggestions }, { count: out.length, query: { from, to, type: typeParam(req) || null, terminal: terminalId || null } });
});

exports.getRoute = asyncHandler(async (req, res) => {
  const [route] = await routeService.loadRoutes({ ids: [req.params.id] });
  if (!route) throw ApiError.notFound('Route not found.');
  const [avail, obstructions, alternatives, fareHistory] = await Promise.all([
    availability.byRoutes([route.id]),
    routeService.activeObstructions([route.id]),
    routeService.alternatives(route.id),
    query(
      `SELECT id, passenger_category, fare_type, amount_min, amount_max, effective_date, verification_status, verified_at, is_current
         FROM fares WHERE route_id = ? ORDER BY effective_date DESC, id DESC LIMIT 20`, [route.id]),
  ]);
  ok(res, {
    ...route,
    availability: avail.get(route.id),
    obstructions,
    alternatives,
    fare_history: fareHistory.map((f) => ({ ...f, label: routeService.fareLabel(f), is_current: Boolean(f.is_current) })),
  });
});

exports.routeAlternatives = asyncHandler(async (req, res) => {
  const [route] = await routeService.loadRoutes({ ids: [req.params.id] });
  if (!route) throw ApiError.notFound('Route not found.');
  const obstructions = await routeService.activeObstructions([route.id]);
  const alternatives = await routeService.alternatives(route.id);
  ok(res, {
    route: { id: route.id, code: route.code, name: route.name },
    obstructions,
    alternatives,
    message: alternatives.length ? null : 'No verified alternative route has been documented for this route yet.',
  });
});

/* --------------------------------- Fares --------------------------------- */

exports.listFares = asyncHandler(async (req, res) => {
  const where = ["r.status = 'active'", 'f.is_current = 1'];
  const params = [];
  const type = typeParam(req);
  if (type) { where.push('vt.code = ?'); params.push(type); }
  if (req.query.q) {
    where.push('(r.name LIKE ? OR r.code LIKE ? OR r.origin LIKE ? OR r.destination LIKE ?)');
    const l = likeTerm(req.query.q); params.push(l, l, l, l);
  }
  if (req.query.route_id) { where.push('r.id = ?'); params.push(parseInt(req.query.route_id, 10) || 0); }
  const rows = await query(
    `SELECT f.id, f.route_id, f.passenger_category, f.fare_type, f.amount_min, f.amount_max, f.effective_date,
            f.source, f.verification_status, f.verified_at, f.notes, f.updated_at,
            r.code AS route_code, r.name AS route_name, r.origin, r.destination, r.is_demo,
            vt.code AS vehicle_type, vt.name AS vehicle_type_name
       FROM fares f JOIN routes r ON r.id = f.route_id JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
      WHERE ${where.join(' AND ')}
      ORDER BY vt.id, r.code, FIELD(f.passenger_category,'regular','student','senior_pwd')
      LIMIT 500`, params);
  ok(res, rows.map((f) => ({ ...f, is_demo: Boolean(f.is_demo), label: routeService.fareLabel(f) })));
});

/* ------------------------------ Availability ----------------------------- */

exports.listAvailability = asyncHandler(async (req, res) => {
  const data = await availability.list({
    routeId: parseInt(req.query.route_id, 10) || undefined,
    terminalId: parseInt(req.query.terminal_id, 10) || undefined,
    type: typeParam(req),
  });
  ok(res, { ...data, disclaimer: 'Driver-reported availability. This is not GPS tracking and does not guarantee a vehicle is physically present.' });
});

/* ---------------------------- Road obstructions -------------------------- */

exports.listObstructions = asyncHandler(async (req, res) => {
  const includeResolved = req.query.include_resolved === 'true';
  const rows = await query(
    `SELECT o.id, o.title, o.location_description, o.latitude, o.longitude, o.description, o.affected_route_id,
            o.reported_at, o.verification_status, o.resolution_status, o.is_demo, o.updated_at,
            r.code AS route_code, r.name AS route_name
       FROM road_obstruction_reports o LEFT JOIN routes r ON r.id = o.affected_route_id
      WHERE o.is_published = 1 AND o.verification_status = 'verified'
        ${includeResolved ? "AND (o.resolution_status = 'active' OR o.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))" : "AND o.resolution_status = 'active'"}
      ORDER BY o.resolution_status, o.reported_at DESC LIMIT 100`);
  const routeIds = [...new Set(rows.map((r) => r.affected_route_id).filter(Boolean))];
  const altMap = {};
  for (const id of routeIds) {
    const alts = await routeService.alternatives(id);
    altMap[id] = alts.map((a) => ({ id: a.id, code: a.code, name: a.name, vehicle_type: a.vehicle_type, fare_label: a.fare_label,
      terminals: a.terminals.map((t) => ({ id: t.id, name: t.name })), notes: a.alternative_notes, has_obstruction: a.obstructions.length > 0 }));
  }
  ok(res, rows.map((o) => ({ ...o, is_demo: Boolean(o.is_demo), alternatives: o.affected_route_id ? altMap[o.affected_route_id] || [] : [] })));
});

/* ---------------------------- Landing / helpers -------------------------- */

exports.overview = asyncHandler(async (req, res) => {
  const [[counts], featured, destinations, demo] = await Promise.all([
    query(`SELECT
        (SELECT COUNT(*) FROM terminals WHERE status = 'active') AS terminals,
        (SELECT COUNT(*) FROM routes WHERE status = 'active') AS routes,
        (SELECT COUNT(*) FROM vehicle_types) AS vehicle_types,
        (SELECT COUNT(*) FROM road_obstruction_reports WHERE is_published = 1 AND verification_status='verified' AND resolution_status='active') AS active_notices`),
    query(`SELECT t.id, t.name, t.barangay, t.verification_status, t.is_demo,
              (SELECT GROUP_CONCAT(vt.code ORDER BY vt.id) FROM terminal_vehicle_types tvt JOIN vehicle_types vt ON vt.id = tvt.vehicle_type_id WHERE tvt.terminal_id = t.id) AS vehicle_types,
              (SELECT COUNT(*) FROM route_terminals rt WHERE rt.terminal_id = t.id) AS route_count
         FROM terminals t WHERE t.status = 'active' ORDER BY (t.verification_status = 'verified') DESC, route_count DESC, t.name LIMIT 6`),
    query(`SELECT r.destination AS name, COUNT(*) AS route_count, MAX(r.is_demo) AS is_demo,
              MAX(r.verification_status = 'verified') AS has_verified
         FROM routes r WHERE r.status = 'active' GROUP BY r.destination ORDER BY has_verified DESC, route_count DESC, name LIMIT 8`),
    query(`SELECT (SELECT COUNT(*) FROM terminals WHERE is_demo = 1) + (SELECT COUNT(*) FROM routes WHERE is_demo = 1) AS n`),
  ]);
  ok(res, {
    counts,
    featured_terminals: featured.map((t) => ({ ...t, is_demo: Boolean(t.is_demo), vehicle_types: t.vehicle_types ? t.vehicle_types.split(',') : [] })),
    popular_destinations: destinations.map((d) => ({ ...d, is_demo: Boolean(d.is_demo), has_verified: Boolean(d.has_verified) })),
    contains_demo_data: demo[0].n > 0,
  });
});

/** Autocomplete for the search boxes: documented stop names, terminals, origins and destinations. */
exports.places = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const l = likeTerm(q);
  const rows = await query(
    `SELECT name, 'terminal' AS kind FROM terminals WHERE status = 'active' AND (? = '' OR name LIKE ? OR barangay LIKE ?)
     UNION SELECT DISTINCT s.name, 'stop' FROM route_stops s JOIN routes r ON r.id = s.route_id AND r.status = 'active' WHERE (? = '' OR s.name LIKE ?)
     UNION SELECT DISTINCT origin, 'place' FROM routes WHERE status = 'active' AND (? = '' OR origin LIKE ?)
     UNION SELECT DISTINCT destination, 'place' FROM routes WHERE status = 'active' AND (? = '' OR destination LIKE ?)
     LIMIT 40`,
    [q, l, l, q, l, q, l, q, l]
  );
  const seen = new Set();
  ok(res, rows.filter((r) => (seen.has(r.name) ? false : seen.add(r.name))).slice(0, 15));
});
