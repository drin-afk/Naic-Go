# NaicGo — Windows Setup Guide

Tested target: Windows 10/11, Node.js 20 or 22 LTS, XAMPP 8.x (MariaDB 10.4+), Visual Studio Code.

---

## 1. Install the prerequisites

| Software | Where | Notes |
|---|---|---|
| Node.js LTS (20 or 22) | https://nodejs.org | Includes `npm`. Verify: `node -v` and `npm -v` |
| XAMPP | https://www.apachefriends.org | Only **MySQL** is required. Apache is only needed for phpMyAdmin |
| Visual Studio Code | https://code.visualstudio.com | Optional but recommended |

> `bcrypt` ships prebuilt Windows binaries for current Node LTS versions, so no C++ build tools are normally needed. If `npm install` reports a `node-gyp` error, install the **"Desktop development with C++"** workload from Visual Studio Build Tools and run `npm install` again.

## 2. Start MySQL

1. Open **XAMPP Control Panel** (run as administrator the first time).
2. Click **Start** beside **MySQL** (and **Apache** if you want phpMyAdmin).
3. The MySQL port should show **3306**.

## 3. Create the database

Open **Command Prompt** in the project folder (e.g. `C:\Projects\naicgo`).

```bat
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
```

> If your MySQL root user has a password, add `-p` and type it when asked:
> `C:\xampp\mysql\bin\mysql.exe -u root -p < database\schema.sql`

⚠️ `schema.sql` **drops and recreates** `naicgo_db`. Do not re-run it on a database that holds real research data.

### Optional: demonstration data

```bat
C:\xampp\mysql\bin\mysql.exe -u root naicgo_db < database\seed.sql
```

This inserts fictional terminals, routes, stops, fares, vehicles and one road notice, all labelled **DEMO**.

### Alternative: phpMyAdmin

1. Browse to http://localhost/phpmyadmin
2. **Import** tab → choose `database/schema.sql` → **Import** (no database needs to be selected first).
3. Select `naicgo_db` → **Import** → choose `database/seed.sql` (optional).

## 4. Configure and start the backend

```bat
cd server
copy .env.example .env
```

Open `server\.env` and set at least:

| Variable | Value |
|---|---|
| `DB_USER` / `DB_PASSWORD` | XAMPP default: `root` / *(empty)* |
| `JWT_SECRET` | A long random string. Generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGIN` | `http://localhost:5173` (default) |

Install dependencies:

```bat
npm install
```

### Create the administrator account (required)

Administrators can **never** be created through public registration. Run:

```bat
npm run create-admin
```

You will be asked for a username, email, full name and a password (hidden while typing; minimum 10 characters with upper, lower case and a number). Non-interactive form:

```bat
npm run create-admin -- --username admin --email admin@naicgo.local --name "NaicGo Administrator"
```

### Optional: demo user accounts

Requires `seed.sql` to have been imported.

```bat
npm run seed:demo-users
```

Creates (password `Demo@12345` unless `DEMO_PASSWORD` is set):

| Username | Role | State |
|---|---|---|
| `demo_commuter` | Commuter | Active |
| `demo_jeep_driver` | Driver | Approved, assigned to DEMO-JEEP-001/002 |
| `demo_tric_driver` | Driver | Approved, assigned to DEMO-TRI-001/002 |
| `demo_pending_driver` | Driver | Pending approval |

It also adds sample availability reports (one deliberately outdated).

### Start the API

```bat
npm run dev
```

You should see:

```
NaicGo API listening on http://localhost:5000 (development)
Connected to MySQL database "naicgo_db" at 127.0.0.1:3306
```

Check http://localhost:5000/api/health → `{"success":true,"data":{"api":"ok","database":"ok",...}}`

## 5. Configure and start the frontend

Open a **second** Command Prompt:

```bat
cd client
copy .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**.

The Vite dev server proxies `/api` to `http://localhost:5000`, so the session cookie stays same-origin. Keep `VITE_API_BASE_URL=/api`.

## 6. Google Maps (optional but recommended)

Without a key, NaicGo shows an **OpenStreetMap fallback map** (Leaflet) with terminal markers and documented stop sequences, plus "Open in Google Maps" links. Road directions require Google.

1. Go to https://console.cloud.google.com → create/select a project.
2. **Billing** must be enabled on the project (Google requires a billing account for Maps Platform; monthly free usage credit applies).
3. **APIs & Services → Library** → enable:
   - **Maps JavaScript API** (required for the map)
   - **Directions API** (required for road directions drawn on route maps). NaicGo calls it through the JavaScript `DirectionsService`. If your project cannot enable the legacy Directions API, the map still works and the page shows a "Road directions unavailable" note.
   - Places API is **not** used.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Restrict the key:
   - *Application restrictions* → **Websites** → add `http://localhost:5173/*` (and your production domain later).
   - *API restrictions* → restrict to **Maps JavaScript API** and **Directions API**.
6. Put it in `client\.env`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your-restricted-browser-key
   ```
7. Restart `npm run dev` in the client folder.

> Only a **browser-restricted** key goes in the client `.env` — everything prefixed `VITE_` is visible in the browser bundle. Never put server secrets there.

## 7. Email (optional)

Password-reset and email-verification links are emailed when SMTP is configured in `server\.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`). In development **without SMTP**, the links are printed in the API terminal window — copy them into the browser.

Set `REQUIRE_EMAIL_VERIFICATION=true` to require commuters to verify their email before submitting complaints.

## 8. Run the automated API tests

With MySQL running and **both** `schema.sql` and `seed.sql` imported:

```bat
cd server
npm test
```

The tests create uniquely named accounts and remove them afterwards.

## 9. Verify persistence

1. Register a commuter and submit a report.
2. Stop both servers (`Ctrl + C`), stop and restart MySQL in XAMPP.
3. Start the API and client again, log in, and confirm the report is still listed.
4. In phpMyAdmin, open `naicgo_db` → `driver_reports` to see the stored row (and `users.password_hash` containing a `$2b$…` bcrypt hash, never the plain password).

## 10. Replacing demo data with verified data

1. Log in as the administrator.
2. **Terminals**: edit each demo terminal (or add new ones) with verified names, addresses and on-site coordinates, set *Verification* to **Verified** and the verification date. Changing verification from *Demo* removes the DEMO flag.
3. **Routes**: update stops in travel order, link stops to terminals, set alternatives.
4. **Fares**: add verified fares (the previous current fare automatically becomes historical).
5. Archive any remaining demo records, or delete them in phpMyAdmin:
   ```sql
   DELETE FROM road_obstruction_reports WHERE is_demo = 1;
   DELETE FROM routes WHERE is_demo = 1;      -- cascades stops, fares, alternatives
   DELETE FROM terminals WHERE is_demo = 1;
   DELETE FROM vehicles WHERE is_demo = 1;
   ```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not connect to MySQL (ECONNREFUSED)` | Start MySQL in XAMPP; check `DB_PORT` (3306) |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER`/`DB_PASSWORD` in `server\.env` |
| `ER_BAD_DB_ERROR` | Import `database\schema.sql` |
| MySQL won't start in XAMPP (port 3306 busy) | Another MySQL service is running — stop it in *Services* or change the port in XAMPP and `DB_PORT` |
| UI shows "Cannot reach the NaicGo server" | Start the API (`npm run dev` in `server`) |
| Logged out immediately after login / "Request origin not allowed" | Keep `VITE_API_BASE_URL=/api` so requests go through the Vite proxy, and make sure `CLIENT_ORIGIN` in `server\.env` matches the URL you open (e.g. `http://localhost:5173`) |
| Map shows fallback even with a key | Check the browser console; confirm billing, enabled APIs and the referrer restriction includes `http://localhost:5173/*` |
| `Too many login attempts` | Rate limit (20 per 15 min). Wait or restart the API in development |

## Production notes

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, real `CLIENT_ORIGIN`, and serve over **HTTPS** (cookies become `Secure`).
- Build the client with `npm run build` and serve `client/dist` from a web server that proxies `/api` to the Node process; set `TRUST_PROXY=true` behind a reverse proxy.
- Create a dedicated MySQL user with only the privileges NaicGo needs instead of `root`.
- Back up `naicgo_db` and `server/storage/evidence` regularly.
