# ShiftSync — Multi-Location Restaurant Scheduling

A full-stack shift scheduling platform for **Coastal Eats**, a multi-location restaurant group. Managers publish shifts, assign staff, handle swap/drop requests, and monitor fairness across locations — all in one place.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10, TypeORM, MySQL 8, Socket.IO, Passport JWT |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | JWT access tokens (in-memory) + httpOnly refresh cookies (7 days) |

---

## Prerequisites

- Node.js 20+
- MySQL 8 running locally
- npm

---

## Setup

### 1. Clone

```bash
git clone https://github.com/maina-david/shift-sync.git
cd shift-sync
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set your database credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=shift_sync
```

Create the database, then install and run:

```bash
mysql -u root -p -e "CREATE DATABASE shift_sync;"
npm install
npm run start:dev
```

The API will be available at **http://localhost:3001**.

#### Seed the database

```bash
# In a second terminal, while the backend is running:
cd backend
npx ts-node src/seed.ts
```

This populates 4 locations, 10 users, shifts across a 4-week window, swap/drop requests, time-off entries, notifications, reservations, and audit log entries.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.local already points to http://localhost:3001 — no changes needed
npm install
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Running (quick reference)

```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

---

## Login Credentials

All seeded accounts share the same password: **`Coastal2024!`**

| Role | Name | Email | Access |
|---|---|---|---|
| **Admin** | Sarah Chen | `admin@coastal.com` | Full access across all locations — users, shifts, analytics, audit log, settings |
| **Manager** | Marcus Johnson | `marcus@coastal.com` | Manages North Beach & Midtown East — shifts, assignments, swap/drop approvals |
| **Manager** | Priya Patel | `priya@coastal.com` | Manages Westside & Santa Monica — shifts, assignments, swap/drop approvals |
| **Staff** | Alice Thompson | `alice@coastal.com` | North Beach — views own shifts, requests swaps/drops, time-off |
| **Staff** | Bob Martinez | `bob@coastal.com` | North Beach / Midtown East — part-time, 30 h/week desired |
| **Staff** | Carol Williams | `carol@coastal.com` | Midtown East — has a seeded 7-consecutive-day scheduling edge case |
| **Staff** | Dave Park | `dave@coastal.com` | Westside — 35 h/week desired |
| **Staff** | Emma Rodriguez | `emma@coastal.com` | Westside — 25 h/week desired, part-time |
| **Staff** | Frank Chen | `frank@coastal.com` | Santa Monica — 20 h/week, notifications disabled |
| **Staff** | Grace Kim | `grace@coastal.com` | North Beach — 40 h/week desired |

### Role capabilities at a glance

**Admin** — everything below plus: create/edit/deactivate users, view all locations' audit logs, export CSVs, access system analytics.

**Manager** — publish/edit/delete shifts at their assigned locations, assign staff, approve or deny swap and drop requests, approve time-off, view location analytics and audit log.

**Staff** — view their own schedule, submit swap requests (with a proposed recipient), submit drop requests, request time-off, receive in-app notifications.

---

## Features

- **Multi-location scheduling** — shifts scoped to locations; managers see only their locations
- **Constraint-checked assignment** — blocks double-booking, skill mismatches, consecutive-day breaches, and weekly hour overruns; managers can override with a reason
- **Swap & drop workflows** — staff-initiated, manager-approved; pessimistic locks prevent race conditions
- **Time-off management** — overlap detection against existing assignments and other time-off requests
- **Real-time notifications** — Socket.IO broadcasts to authenticated users on assignment, approval, and denial events
- **Labour analytics** — hours distribution, fairness score (0–1 scale with Excellent/Good/Fair/Poor label), overtime breakdown per location
- **Audit log** — immutable ledger of every scheduling action, filterable by location, entity type, and date range; CSV export
- **Operations panel** — shift log book, digital menu, reservations board, personal bookmarks
- **3D floor-plan viewer** — interactive Three.js scene per location
- **Public landing page** — `/` is accessible without login

---

## Known Limitations

1. **Email delivery is not wired up** — SMTP credentials in `.env` are optional. The `MailService` is injected but email sending is disabled by default (no real mailer in dev). Notification events fire in-app only.
2. **No refresh-token rotation** — the refresh token is reused for its full 7-day lifetime. A production system should rotate it on every use and maintain a revocation list.
3. **Fairness scoring is location-scoped only** — cross-location fairness (staff who work at multiple locations) is not aggregated into a single score.
4. **3D floor plan is static** — table/room positions are hardcoded per location. There is no admin UI to rearrange the floor plan.
5. **Consecutive-day constraint counts only within the seeded window** — the `countConsecutiveDays` helper starts its lookback from the current dataset; it does not account for shifts outside the seeded date range.
6. **No pagination on large lists** — the shifts, audit log, and staff directory endpoints return up to 200 rows. For large datasets, server-side pagination should be added.
7. **MySQL only** — TypeORM is configured with the MySQL driver. Switching to PostgreSQL requires changing the driver and a few raw-query expressions.

---

## Assumptions

1. **"Manager" means location-manager** — a manager account is linked to one or more locations and can only act on shifts/assignments within those locations. The requirement said "manager role" without specifying scope; location-scoping was assumed.
2. **Swap requests require a named recipient** — the spec described swaps but didn't specify whether they were open-market or peer-to-peer. Peer-to-peer (staff nominates who takes their shift) was implemented as it's safer for scheduling integrity.
3. **Drop requests go to any available qualified staff** — once a manager approves a drop, the shift is unassigned and re-published for reassignment rather than automatically filled.
4. **Fairness score formula** — defined as `assignedHours / desiredHoursPerWeek`, clamped to [0, 1]. "Desired hours" is a per-user setting; where requirements were silent on the formula, this ratio was used as the most intuitive measure.
5. **Audit log is append-only** — no delete or edit endpoint is exposed for audit entries. This was treated as a hard requirement even though the spec didn't explicitly say immutable.
6. **JWT access token is in-memory only** — storing the access token in a cookie or localStorage introduces XSS or CSRF risk. In-memory storage with a silent-refresh pattern was chosen as the most secure default.
7. **Public landing page at `/`** — the spec listed a dashboard as the main entry point but didn't address unauthenticated visitors. A public marketing-style landing page was added at `/`; the dashboard requires login.

---

## Project Structure

```
shift-sync/
├── backend/          # NestJS API (port 3001)
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── locations/
│   │   ├── shifts/
│   │   ├── swap-requests/
│   │   ├── drop-requests/
│   │   ├── time-off/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── operations/
│   │   └── seed.ts
│   └── .env.example
└── frontend/         # Next.js 16 App Router (port 3000)
    ├── app/
    │   ├── (auth)/       # login page
    │   ├── (dashboard)/  # protected routes
    │   └── page.tsx      # public landing page
    ├── contexts/
    ├── lib/
    ├── components/
    └── .env.example
```
