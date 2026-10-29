# NaicGo

**Development of a Web-Based Public Transportation Terminal Route Guide for Commuters in Naic, Cavite**

NaicGo centralizes information about public transportation terminals, documented routes, destinations, fares, driver-reported vehicle availability and registered drivers in Naic, Cavite. It supports four user experiences:

| Experience | What they can do |
|---|---|
| **Guest commuter** | Search routes, browse terminals, fares, transport categories, road advisories and maps — no account needed |
| **Registered commuter** | Everything a guest can do, plus submit private driver complaints with evidence, receive reference numbers, track status and get notifications |
| **Registered driver** | After administrator approval: view assignments and vehicles, report availability (Available / Unavailable / Temporarily Suspended), edit permitted vehicle details, submit information update requests |
| **Administrator** | Manage terminals, routes (ordered stops, terminals, alternatives), fares (with history), vehicles, assignments, obstruction notices; approve drivers; review update requests and passenger reports; analytics with CSV export; audit logs |

## Technology

- **Frontend:** React 18 + Vite, Tailwind CSS, React Router, Axios, Lucide icons, Google Maps JavaScript API (Leaflet/OpenStreetMap fallback)
- **Backend:** Node.js + Express REST API, bcrypt, JWT in HTTP-only cookies, express-validator, Helmet, express-rate-limit, CORS, Multer
- **Database:** MySQL/MariaDB via XAMPP (`naicgo_db`), mysql2 with parameterized queries

## Project structure

```
naicgo/
├── client/                 React + Vite frontend
│   ├── src/
│   │   ├── components/     UI kit, transport widgets, maps (Google + fallback)
│   │   ├── context/        Auth + toast providers
│   │   ├── hooks/          useApi, useForm, useDebounce
│   │   ├── layouts/        Public and dashboard layouts
│   │   ├── pages/          public/, auth/, commuter/, driver/, admin/, shared/
│   │   ├── routes/         ProtectedRoute
│   │   ├── services/       Axios API client
│   │   ├── styles/         Tailwind entry
│   │   └── utils/          Formatting and labels
│   └── .env.example
├── server/                 Express REST API
│   ├── src/
│   │   ├── config/         env + MySQL pool
│   │   ├── controllers/    auth, public, commuter, driver, admin*
│   │   ├── middleware/     auth/RBAC, validation, rate limits, uploads, errors
│   │   ├── routes/         All /api routes
│   │   ├── services/       Route search, availability
│   │   ├── validators/     express-validator rule sets
│   │   ├── utils/          audit, notifications, tokens, mailer, evidence storage
│   │   ├── scripts/        createAdmin.js, seedDemoUsers.js
│   │   ├── app.js
│   │   └── server.js
│   ├── storage/evidence/   Private complaint evidence (never served statically)
│   ├── tests/api.test.js   Integration tests (node:test + supertest)
│   └── .env.example
├── database/
│   ├── schema.sql          23 tables, FKs, indexes, constraints
│   └── seed.sql            OPTIONAL demonstration data (clearly labelled DEMO)
└── docs/
    ├── setup-guide.md      Windows + XAMPP step-by-step
    ├── api-documentation.md
    └── testing-checklist.md
```

## Quick start (Windows)

See **[docs/setup-guide.md](docs/setup-guide.md)** for the full guide. Summary:

```bat
REM 1. Start MySQL in the XAMPP Control Panel, then import the schema (and optional demo data)
cd C:\path\to\naicgo
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
C:\xampp\mysql\bin\mysql.exe -u root naicgo_db < database\seed.sql

REM 2. Backend (edit JWT_SECRET in .env after copying)
cd server
copy .env.example .env
npm install
npm run create-admin
npm run seed:demo-users
npm run dev

REM 3. Frontend (in a new terminal)
cd client
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 (API runs on http://localhost:5000).
```

## Data integrity

- All seed records are **fictional demonstration data**, flagged `is_demo = 1` / `verification_status = 'demo'` and shown with a **DEMO** badge. Replace them with researcher-verified data before evaluation.
- Vehicle availability is **driver-reported**, timestamped and marked *outdated* after `AVAILABILITY_FRESH_MINUTES`. It is not GPS tracking.
- Google road directions are labelled as distinct from researcher-documented public transport stop sequences.
- Failed API calls show error states — the UI never substitutes placeholder data.

## Scope and limitations

Limited to documented terminals and routes within Naic, Cavite for tricycles, jeepneys and buses. NaicGo does **not** provide real-time GPS tracking, live traffic monitoring, guaranteed arrival times, automatic road-closure detection, guaranteed vehicle counts, or unverified routes outside the municipality.
