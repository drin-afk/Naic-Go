# NaicGo REST API

Base URL (development): `http://localhost:5000/api` — the React app calls it as `/api` through the Vite proxy.

## Conventions

- **Authentication:** `POST /auth/login` sets an HTTP-only, `SameSite=Lax` cookie `naicgo_session` (JWT, default 8 h). Browsers send it automatically; JavaScript cannot read it. `Secure` is enabled in production.
- **Authorization:** role and account status are re-read from MySQL on every request — never taken from the client.
- **Success:** `{ "success": true, "data": …, "meta": { page, pageSize, total, totalPages } }` (`meta` only on paginated lists)
- **Errors:** `{ "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }] }`
- **Pagination:** `?page=1&pageSize=20` (max 100–200 depending on endpoint)
- **Status codes:** 200 OK · 201 Created · 400 Bad request · 401 Not authenticated · 403 Forbidden · 404 Not found (also returned for other users' private records) · 409 Conflict/duplicate · 413 Too large · 422 Validation failed · 429 Rate limited · 503 Database unavailable
- **Rate limits:** 1000 req/15 min per IP overall; auth 20/15 min; password reset 5/h; complaints 5/h.
- **CSRF defence:** state-changing requests with an `Origin` header must come from `CLIENT_ORIGIN`.

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | API + database status |

## Authentication `/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register-commuter` | — | `full_name, username, email, password, confirm_password, accept_terms, contact_number?` | Creates active commuter, logs in, sends verification link |
| POST | `/auth/register-driver` | — | above + `vehicle_type (tricycle\|jeepney\|bus), operator_name?, association_name?, vehicle_details?` | Creates **pending** driver; admins notified |
| POST | `/auth/login` | — | `identifier` (username or email), `password` | Generic error for unknown user / wrong password |
| POST | `/auth/logout` | — | — | Clears cookie |
| GET | `/auth/me` | any | — | Current user + unread notification count |
| POST | `/auth/forgot-password` | — | `email` | Always same response; 30-min single-use token |
| POST | `/auth/reset-password` | — | `token, password, confirm_password` | |
| POST | `/auth/verify-email` | — | `token` | 24-hour token |
| POST | `/auth/resend-verification` | any | — | |
| PATCH | `/auth/password` | any | `current_password, new_password, confirm_password` | |

Password rule: ≥ 8 characters with uppercase, lowercase and a number.

## Public transportation (no login)

| Method | Path | Query | Description |
|---|---|---|---|
| GET | `/overview` | — | Landing counts, featured terminals, popular destinations, `contains_demo_data` |
| GET | `/places` | `q` | Autocomplete of terminal/stop/origin/destination names |
| GET | `/vehicle-types` | — | Tricycle, jeepney, bus with route/terminal counts |
| GET | `/terminals` | `q, type, sort (name\|routes\|updated\|verified), page, pageSize` | Active terminals |
| GET | `/terminals/:id` | — | Terminal + vehicle types, routes (with availability), destinations, availability, active notices |
| GET | `/routes` | `from, to, type, terminal, maxFare, available=true` | **Route finder.** Returns `{ results, connections, suggestions }` |
| GET | `/routes/:id` | — | Route + ordered stops, terminals, current fares, fare history, availability, notices, documented alternatives |
| GET | `/routes/:id/alternatives` | — | Active verified obstructions + documented alternatives |
| GET | `/fares` | `type, q, route_id` | Current published fares |
| GET | `/availability` | `route_id, terminal_id, type` | Latest driver report per vehicle with `is_fresh` |
| GET | `/road-obstructions` | `include_resolved=true` | Published, verified notices with documented alternatives |

### Route finder logic

- A route matches when `from` matches its origin or a documented stop/terminal **before** the stop matching `to` (direction-aware).
- `connections` combine two documented routes only where they share a documented stop or the same terminal; they are labelled as requiring a transfer.
- `suggestions` (only when nothing matches) list documented routes touching either place.
- Nothing is invented: no data → empty arrays.
- Each result's `availability` = `{ available, unavailable, temporarily_suspended, outdated, latest_report_at, vehicles[] }`. Reports older than `AVAILABILITY_FRESH_MINUTES` count as `outdated`.

Example:

```
GET /api/routes?from=Town%20Proper&to=Highway%20Junction&type=jeepney
```

```json
{
  "success": true,
  "data": {
    "results": [{
      "id": 1, "code": "DEMO-J01", "name": "Town Proper – Highway Junction (Jeepney)",
      "vehicle_type": "jeepney", "is_demo": true, "verification_status": "demo",
      "match": { "kind": "direct", "boarding": "DEMO Terminal A – Town Proper", "dropoff": "DEMO Terminal C – Highway Junction" },
      "fare": { "fare_type": "range", "amount_min": 14, "amount_max": 20, "label": "₱14.00 – ₱20.00" },
      "stops": [ … ], "terminals": [ … ], "availability": { "available": 1, "outdated": 0, … }, "obstructions": []
    }],
    "connections": [], "suggestions": []
  },
  "meta": { "count": 1, "query": { "from": "Town Proper", "to": "Highway Junction", "type": "jeepney", "terminal": null } }
}
```

## Notifications (any logged-in user)

| Method | Path | Description |
|---|---|---|
| GET | `/notifications?unread=true&page=` | Own notifications (`meta.unread`) |
| PATCH | `/notifications/:id/read` | Mark own notification read |
| POST | `/notifications/read-all` | Mark all read |

## Commuter `/commuter` (role: commuter, active)

| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/commuter/profile` | — | Profile + report counts |
| PATCH | `/commuter/profile` | `full_name?, contact_number?, preferred_contact?` | |
| GET | `/commuter/reports` | `status, page` | **Own** reports only |
| POST | `/commuter/reports` | `multipart/form-data`: `vehicle_type*, category*, incident_date*, description* (20–3000), incident_time?, vehicle_identifier?, driver_identifier?, route_id?, terminal_id?, vehicle_id?, preferred_contact?, contact_detail?, evidence[]` (≤ 3 files, ≤ 5 MB, JPG/PNG/WEBP/PDF) | Returns `{ id, reference_no: "NG-YYYYMMDD-XXXXXX", status: "submitted" }` |
| GET | `/commuter/reports/:id` | — | Own report, public history (no internal notes), own evidence list |
| POST | `/commuter/reports/:id/responses` | `multipart`: `message`, `evidence[]?` | Adds info; `info_requested → under_review` |
| GET | `/commuter/reports/:id/evidence/:fileId` | — | Own evidence file |

Complaint categories: `scam_fraud, overcharging, misconduct_harassment, unsafe_driving, route_deviation, discrimination, other`.
Statuses: `submitted, under_review, info_requested, resolved, closed, rejected`.

Ownership is enforced in SQL (`WHERE id = ? AND commuter_id = ?`); requests for other users' reports return **404**. `admin_notes`, `driver_id`, `driver_response` and the assigned admin are never returned to commuters. A duplicate (same commuter, date, category, vehicle, route within 24 h) returns **409** with the existing reference.

## Driver `/driver` (role: driver)

| Method | Path | Requires approval | Description |
|---|---|---|---|
| GET | `/driver/profile` | No | Profile and approval state |
| PATCH | `/driver/profile` | No | `full_name?, contact_number?, operator_name?, association_name?` |
| GET | `/driver/dashboard` | Yes | Assignments, latest reports, pending requests, recent decisions |
| GET | `/driver/assignments` | Yes | Active + past assignments |
| GET | `/driver/vehicles` | Yes | Vehicles with an active assignment to this driver |
| PATCH | `/driver/vehicles/:id` | Yes | `description?, color?, capacity?` — only assigned vehicles |
| GET | `/driver/availability` | Yes | Own availability history |
| POST | `/driver/availability` | Yes | `vehicle_id, status (available\|unavailable\|temporarily_suspended), terminal_id?, note?` |
| GET | `/driver/update-requests` | Yes | Own requests |
| POST | `/driver/update-requests` | Yes | `entity_type (route\|fare\|terminal\|vehicle\|other), entity_id?, title, proposed_changes, reason?` (for `fare`, `entity_id` is the route) |
| GET | `/driver/options` | Yes | Active routes/terminals for forms |

Drivers never receive complaint data.

## Administrator `/admin` (role: admin)

All write actions are recorded in `audit_logs`.

| Area | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard`, `GET /admin/options` |
| Terminals | `GET /admin/terminals?q&status&verification`, `POST /admin/terminals`, `PUT /admin/terminals/:id`, `PATCH /admin/terminals/:id/status {status: active\|inactive\|archived}` |
| Routes | `GET /admin/routes?q&type&status`, `GET /admin/routes/:id`, `POST /admin/routes`, `PUT /admin/routes/:id`, `PATCH /admin/routes/:id/status` — body includes `stops[] {name, terminal_id?, latitude?, longitude?, is_boarding, is_dropoff}`, `terminals[] {terminal_id, role}`, `alternative_route_ids[]` (replaced in one transaction) |
| Fares | `GET /admin/fares?route_id&current&verification&q`, `POST /admin/fares` (new current fare moves previous to history), `PUT /admin/fares/:id` |
| Vehicles | `GET /admin/vehicles`, `POST /admin/vehicles`, `PUT /admin/vehicles/:id`, `PATCH /admin/vehicles/:id/status`, `GET /admin/vehicles/:id/availability` |
| Assignments | `GET /admin/assignments?active&driver_id&vehicle_id&q`, `POST /admin/assignments`, `PATCH /admin/assignments/:id/end` |
| Drivers | `GET /admin/drivers?approval&status&type&q`, `POST /admin/drivers/:id/approve {reason?}`, `POST /admin/drivers/:id/reject {reason}` |
| Users | `GET /admin/users?role&status&q`, `PATCH /admin/users/:id/status {status: active\|suspended\|inactive, reason?}` (not for admins or self) |
| Update requests | `GET /admin/update-requests?status&entity_type`, `PATCH /admin/update-requests/:id {status: approved\|rejected\|correction_requested, review_notes}` |
| Passenger reports | `GET /admin/reports?status&category&type&assigned(me\|none)&from&to&q`, `GET /admin/reports/:id`, `PATCH /admin/reports/:id`, `GET /admin/reports/:id/evidence/:fileId` |
| Obstructions | `GET /admin/obstructions?verification&resolution&q`, `POST /admin/obstructions`, `PUT /admin/obstructions/:id` (only `verified` can be published) |
| Analytics | `GET /admin/analytics` (list), `GET /admin/analytics/:type?from&to&format=csv` — types: `terminals, routes, categories, driver_registrations, availability, fare_changes, complaints, obstructions` |
| Audit logs | `GET /admin/audit-logs?action&entity_type&actor&from&to` |

### `PATCH /admin/reports/:id`

```json
{
  "status": "info_requested",
  "public_note": "Please upload a photo of the receipt.",
  "admin_notes": "Called terminal dispatcher; awaiting log.",
  "assigned_admin_id": 1,
  "vehicle_id": 3,
  "driver_id": null,
  "driver_response": "Driver states the fare included a special trip.",
  "resolution_summary": "…",
  "rejection_reason": "…"
}
```

Allowed transitions: submitted → under_review / info_requested / rejected / closed · under_review → info_requested / resolved / rejected / closed · info_requested → under_review / resolved / rejected / closed · resolved → closed / under_review · closed → under_review · rejected → under_review.
Rules: `rejected` needs `rejection_reason`; `resolved` needs `resolution_summary`; `info_requested` needs `public_note`. Private notes are appended with author/time, never overwritten.

## Security summary

bcrypt (cost 12) password hashes · JWT in HTTP-only cookie · server-side RBAC and ownership checks · express-validator on every input · parameterized SQL only (`?` placeholders) · Helmet headers · CORS restricted to `CLIENT_ORIGIN` · Origin check on writes · rate limiting · evidence validated by magic bytes, renamed to random UUIDs, stored outside any static folder with `0600` permissions and served only through authorized endpoints with `nosniff` and a sandbox CSP · CSV exports neutralise formula injection · audit logs strip any key resembling a password/token/secret.
