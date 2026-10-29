# NaicGo Testing Checklist & Evaluation Matrix

**How to use:** run each procedure on a fresh install (schema + seed + `npm run seed:demo-users` + one admin). Record the *Actual result* and mark **Pass/Fail**. Leave both blank until the test has really been executed — do not pre-fill results.

Automated coverage: `cd server && npm test` runs the integration tests in `server/tests/api.test.js` against MySQL (IDs marked **[A]** below have automated equivalents). Record the console summary as evidence.

Study objectives referenced: **O1** accessible transportation information · **O2** route & fare discovery · **O3** driver information updates · **O4** map-based navigation · **O5** passenger reporting · **O6** usability, security & reliability.

| ID | Obj | Objective of test | Procedure | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|---|
| T01 | O1 | Guest can search without login **[A]** | Logged out, open `/`, enter "Town Proper" → "Highway Junction", Search | Results page lists DEMO-J01 with fare, terminals, availability; no login prompt | | |
| T02 | O2 | Direction-aware matching **[A]** | Search "Town Proper" → "Highway Junction" | DEMO-J01 shown; return route DEMO-J02 **not** shown | | |
| T03 | O2 | No invented results **[A]** | Search "Nonexistent Place" → "Nowhere" | Empty state with guidance; no fake routes | | |
| T04 | O2 | Transportation type filter **[A]** | On Route Finder choose *Tricycle* | Only tricycle routes listed | | |
| T05 | O2 | Fare & availability filters | Set max fare ₱20, then tick "recent available report" | Only routes meeting criteria; requires-confirmation fares hidden when max fare set | | |
| T06 | O1 | Terminal browsing | Open `/terminals`, search, filter by type, sort, switch to Map view | Matching cards; map shows markers; detail page opens | | |
| T07 | O1 | Terminal detail | Open a terminal | Address, coordinates or "Not yet verified", routes, destinations, driver-reported availability, verification date | | |
| T08 | O2 | Fare display **[A]** | Open `/fares` and a route detail | Fare type, passenger category, effective & verification dates, history; "fares may change" notice | | |
| T09 | O1 | Transport category pages | Open `/transport/jeepney`, `/tricycle`, `/bus`; switch tabs | Routes, terminals, fares, availability for that type only; no driver personal data shown | | |
| T10 | O5 | Commuter registration **[A]** | Register with valid data | Account created, redirected to dashboard | | |
| T11 | O6 | Registration validation **[A]** | Submit weak password, mismatched confirmation, duplicate username/email, unchecked terms | Field-level errors; duplicates rejected (409) | | |
| T12 | O6 | Password hashing **[A]** | In phpMyAdmin view `users.password_hash` | Starts with `$2b$`; plaintext never stored | | |
| T13 | O6 | Login / logout **[A]** | Log in, then log out | Session established; after logout dashboard redirects to login; `/api/auth/me` = 401 | | |
| T14 | O6 | Invalid credentials **[A]** | Wrong password for existing user; unknown username | Same generic message both times | | |
| T15 | O6 | Admin cannot be self-registered **[A]** | POST register-commuter with `"role":"admin"` (e.g. via browser devtools) | Account created as commuter | | |
| T16 | O3 | Driver registration pending **[A]** | Register a driver | Redirect to "awaiting approval"; driver dashboard API returns 403 | | |
| T17 | O3 | Driver approval **[A]** | Admin → Drivers → Approve | Driver gets notification and dashboard access; audit log entry `driver.approved` | | |
| T18 | O3 | Driver rejection | Reject with/without reason | Reason required; driver sees reason, cannot log in | | |
| T19 | O6 | Role-based access **[A]** | As commuter request `/api/admin/dashboard` and `/api/driver/dashboard`; as guest `/api/commuter/reports` | 403, 403, 401; UI routes redirect | | |
| T20 | O3 | Availability reporting **[A]** | Driver reports *Available* for assigned vehicle; tries an unassigned vehicle ID via API | Saved and visible on route/terminal pages with timestamp; unassigned → 403 | | |
| T21 | O3 | Outdated availability | View a vehicle whose last report is older than `AVAILABILITY_FRESH_MINUTES` | Shown as "Outdated report", not as available | | |
| T22 | O3 | Driver vehicle edit limits | Driver edits description/color/capacity | Saved; identifier/type/status cannot be changed by driver | | |
| T23 | O3 | Driver update request & review | Driver submits fare update; admin approves / requests correction / rejects | Status and notes visible to driver; notification sent; audit entry | | |
| T24 | O1 | Terminal CRUD | Admin adds, edits, deactivates, archives a terminal | Changes persist; archived terminal hidden publicly; "verified" requires coordinates | | |
| T25 | O2 | Route CRUD with stops | Admin creates route with 3 stops, reorders, links terminals and an alternative | Route detail shows ordered stops, terminals, alternative | | |
| T26 | O2 | Fare update with history | Admin adds new current fare for a route | New fare current; previous appears in fare history; audit `fare.created` | | |
| T27 | O3 | Vehicle & assignment | Admin adds vehicle, assigns approved driver, ends assignment | Mismatched vehicle/route type rejected; ended assignment kept as history | | |
| T28 | O5 | Complaint submission & reference **[A]** | Commuter submits report with optional fields blank | Reference `NG-YYYYMMDD-XXXXXX` shown; status Submitted; admins notified | | |
| T29 | O5 | Duplicate complaint guard **[A]** | Submit identical report again | 409 with existing reference | | |
| T30 | O5 | Guest report prompt | Logged out, click "Report a Driver" on a route page; log in from the prompt | Prompt explains account requirement; after login form opens prefilled with the route | | |
| T31 | O5 | Complaint privacy & ownership **[A]** | Commuter B requests Commuter A's `/api/commuter/reports/{id}` | 404; no data leaked | | |
| T32 | O5 | Evidence upload restrictions **[A]** | Upload a renamed `.exe` as `.jpg`; a 6 MB image; 4 files | Rejected with clear messages | | |
| T33 | O5 | Evidence privacy | Copy an evidence request URL and open it logged out / as driver | 401 / 403; files not reachable via any static URL | | |
| T34 | O5 | Admin complaint review **[A]** | Admin moves report to Under Review with private note and public message; then Rejected without reason | Commuter sees status and public message, never the private note; rejection without reason → 422 | | |
| T35 | O5 | Info request loop | Admin sets *Additional Information Requested*; commuter replies with file | Status returns to Under Review; admin notified; history shows both entries | | |
| T36 | O5 | Drivers cannot see complaints **[A]** | As driver request admin/commuter report endpoints | 403 | | |
| T37 | O4 | Road obstruction notice | Admin creates obstruction (pending) and tries to publish; then verifies and publishes | Publishing pending → error; verified notice appears on Advisories and affected route | | |
| T38 | O4 | Alternative route display **[A]** | Open DEMO-T01 detail / Advisories | Notice plus documented alternative DEMO-T03 with terminals and fare; message when none documented | | |
| T39 | O4 | Google Maps integration | Set restricted key; open route detail | Markers, dashed documented stop line, red road-directions line labelled as Google directions; legend | | |
| T40 | O4 | Map fallback | Remove key, restart client | OpenStreetMap fallback with notice; "Open in Google Maps" link works | | |
| T41 | O6 | MySQL persistence **[A]** | Create records, restart API and MySQL | Records remain | | |
| T42 | O6 | Invalid/missing input | Send malformed JSON, missing fields, invalid IDs (`/api/routes/abc`) | 400/422 with messages; no stack traces | | |
| T43 | O6 | SQL injection attempt | Search `' OR 1=1 --` in terminal/route search | Treated as text; no error, no extra data | | |
| T44 | O6 | Rate limiting | 21 rapid failed logins | 429 message | | |
| T45 | O6 | Audit logs | Perform approvals, fare edits, status changes, suspensions | Entries listed with actor, time, details; no passwords/tokens | | |
| T46 | O6 | Analytics & CSV | Run each report with date range; export CSV | Correct rows; CSV opens in Excel; complaints CSV has no personal data | | |
| T47 | O6 | Responsive layout | Test at 360 px, 768 px, 1280 px widths | Navigation collapses; tables scroll; forms usable | | |
| T48 | O6 | Accessibility basics | Navigate key flows with keyboard only; check focus rings, skip link, labels; run Lighthouse accessibility | All controls reachable; visible focus; labelled inputs; score recorded | | |
| T49 | O6 | Password recovery | Forgot password → use link (console in dev) → reset → reuse link | Reset works once; reused/expired link rejected | | |
| T50 | O6 | Suspended account | Admin suspends commuter while logged in | Next request returns 401; login shows suspended message | | |

## Usability evaluation (suggested)

After task-based testing, administrate a standard instrument such as the **System Usability Scale (SUS)** or an ISO/IEC 25010-based questionnaire to commuter, driver and administrator respondents. Suggested tasks:

1. Find a route and its fare from a given starting point to a destination.
2. Locate the boarding terminal on the map.
3. Check whether vehicles were recently reported available.
4. (Commuter) Submit a report and find its status.
5. (Driver) Report availability and submit a fare correction.
6. (Admin) Approve a driver, update a fare and resolve a report.

Record completion rate, time on task, errors and SUS score per respondent group.
