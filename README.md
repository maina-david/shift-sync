# ShiftSync — Multi-Location Restaurant Scheduling

A full-stack shift scheduling and workforce management platform for **Coastal Eats**, a multi-location restaurant group. Managers publish shifts, assign staff, handle swap/drop requests, track timesheets, and monitor fairness across locations — all in one place.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | NestJS 11, TypeORM, MySQL 8, Socket.IO, Passport JWT |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | JWT access tokens (in-memory) + httpOnly refresh cookies (7 days) |
| Email | @nestjs-modules/mailer, STARTTLS SMTP (Mailgun / Postmark / SES / Mailtrap) |
| Real-time | Socket.IO WebSocket gateway — per-user and per-location rooms |

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

Edit `.env` with your database credentials and JWT secrets:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=shift_sync

JWT_SECRET=change_me_to_a_strong_random_secret_at_least_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_me_to_a_different_strong_random_secret_at_least_32_chars
JWT_REFRESH_EXPIRES_IN=7d
```

**Email (optional)** — leave blank to disable; the app skips email delivery gracefully:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SMTP_FROM="ShiftSync <noreply@shiftsync.dev>"
```

Create the database, install and run:

```bash
mysql -u root -p -e "CREATE DATABASE shift_sync;"
npm install
npm run start:dev
```

API available at <http://localhost:3001> · Swagger docs at <http://localhost:3001/api>.

#### Seed the database

```bash
# In a second terminal while the backend is running:
cd backend
npx ts-node src/seed.ts
```

Populates all entities: 4 locations, 11 users (1 admin + 2 managers + 8 staff), shifts across a 4-week window (last/this/next week), weekly availability, availability exceptions, swap requests, drop requests (open/claimed/approved), time-off entries, timesheets, certifications, notifications, reservations, schedule templates, checklists, shift feedback, fair-workweek change logs, audit log entries, messages, bookmarks, and system settings (scheduling + payroll defaults).

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.local already points to http://localhost:3001 — no changes needed
npm install
npm run dev
```

App available at <http://localhost:3000>.

---

## Running (quick reference)

```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

---

## Testing

Backend unit tests use **Jest + `@nestjs/testing`** with mocked repositories and event emitters — no database required.

```bash
cd backend
npm test              # run all tests
npm test -- --watch   # watch mode
```

**317 tests across 27 service spec files — all passing.**

| Area | Spec file | Tests |
| --- | --- | --- |
| Constraint checker | `shifts/constraint-checker.service.spec.ts` | 13 |
| Timesheets | `timesheets/timesheets.service.spec.ts` | 13 |
| Time-off requests | `time-off-requests/time-off-requests.service.spec.ts` | 17 |
| Drop requests | `drop-requests/drop-requests.service.spec.ts` | 18 |
| Swap requests | `swap-requests/swap-requests.service.spec.ts` | 26 |
| Auth | `auth/auth.service.spec.ts` | 13 |
| Shifts & assignments | `shifts/shifts.service.spec.ts` | 17 |
| Notifications routing | `notifications/notifications.service.spec.ts` | 13 |
| Users & availability | `users/users.service.spec.ts` | 14 |
| Analytics | `analytics/analytics.service.spec.ts` | 12 |
| Certifications | `certifications/certifications.service.spec.ts` | 12 |
| Audit log | `audit/audit.service.spec.ts` | 13 |
| Scheduler crons | `scheduler/scheduler.service.spec.ts` | 16 |
| Checklists | `checklists/checklists.service.spec.ts` | 11 |
| Shift feedback | `shift-feedback/shift-feedback.service.spec.ts` | 10 |
| Messages | `messages/messages.service.spec.ts` | 10 |
| Schedule templates | `schedule-templates/schedule-templates.service.spec.ts` | 9 |
| Reservations | `reservations/reservations.service.spec.ts` | 9 |
| Locations | `locations/locations.service.spec.ts` | 10 |
| Settings | `settings/settings.service.spec.ts` | 8 |
| Log book | `log-book/log-book.service.spec.ts` | 8 |
| Fair workweek | `fair-workweek/fair-workweek.service.spec.ts` | 7 |
| Email | `email/email.service.spec.ts` | 6 |
| Skills | `skills/skills.service.spec.ts` | 6 |
| Menu | `menu/menu.service.spec.ts` | 10 |
| Bookmarks | `bookmarks/bookmarks.service.spec.ts` | 5 |
| App controller | `app.controller.spec.ts` | 1 |

---

## Login Credentials

All seeded accounts share the same password: **`Coastal2024!`**

| Role | Name | Email | Access |
| --- | --- | --- | --- |
| **Admin** | Sarah Chen | `admin@coastal.com` | Full access across all locations — users, shifts, analytics, audit log, settings |
| **Manager** | Marcus Johnson | `marcus@coastal.com` | Manages North Beach & Midtown East — shifts, assignments, swap/drop approvals |
| **Manager** | Priya Patel | `priya@coastal.com` | Manages Marina District & Santa Monica — shifts, assignments, swap/drop approvals |
| **Staff** | Alice Thompson | `alice@coastal.com` | North Beach — views own shifts, requests swaps/drops, time-off |
| **Staff** | Bob Martinez | `bob@coastal.com` | North Beach / Midtown East — part-time, 30 h/week desired |
| **Staff** | Carol Williams | `carol@coastal.com` | Midtown East — has a seeded 7-consecutive-day scheduling edge case |
| **Staff** | Dave Park | `dave@coastal.com` | Midtown East / Marina District — 35 h/week desired |
| **Staff** | Emma Rodriguez | `emma@coastal.com` | Marina District / Santa Monica — 25 h/week desired, part-time |
| **Staff** | Frank Chen | `frank@coastal.com` | Santa Monica — 20 h/week, notifications disabled |
| **Staff** | Grace Kim | `grace@coastal.com` | North Beach — 40 h/week desired |

### Role capabilities at a glance

**Admin** — everything below plus: create/edit/deactivate users, view all locations' audit logs, export CSVs, access system analytics, manage system settings.

**Manager** — publish/edit/delete shifts at their assigned locations, assign staff, approve or deny swap and drop requests, approve time-off, review timesheets, view location analytics and audit log.

**Staff** — view their own schedule, submit swap requests (with a proposed recipient), submit drop requests, request time-off, clock in/out, receive in-app and email notifications.

---

## Features

### Scheduling

- **Multi-location scheduling** — shifts scoped to locations; managers see only their locations
- **Constraint-checked assignment** — blocks double-booking, skill mismatches, consecutive-day breaches, and weekly hour overruns; managers can override with a reason
- **Auto-schedule** — one-click weekly schedule generation distributing available staff across configurable time slots per day
- **Copy week** — duplicate an entire week's shifts to a future week; duplicate prevention built in
- **Publish / unpublish** — shifts draft → published individually or as a whole week; staff notified on publish
- **Schedule templates** — save, load, and apply reusable weekly schedule templates per location

### Workforce Requests

- **Swap requests** — staff-initiated peer-to-peer shift swaps; constraint-checked and manager-approved; pessimistic locks prevent race conditions
- **Drop requests** — staff can drop a shift for others to pick up; claimed and manager-approved; pessimistic lock on concurrent claims
- **Time-off requests** — overlap detection against existing assignments and other approved time-off; transaction-protected submission
- **Fair workweek compliance** — tracks predictive scheduling rules, advance notice requirements, and premium shift distribution fairness

### Timesheets & Payroll

- **Clock in / out** — staff clock into assigned shifts; prevents double clock-in via pessimistic lock
- **Timesheet review** — managers approve or reject pending timesheets with optional notes
- **Payroll CSV export** — manager-scoped export (own locations only) with regular hours, overtime at configurable multiplier, and per-staff hourly rate breakdown

### Notifications

- **Real-time in-app** — Socket.IO broadcasts to authenticated users on assignment, approval, denial, and schedule events
- **Email notifications** — per-user opt-in via Settings → Notifications; backed by SMTP with a styled HTML template; gracefully skipped if SMTP is not configured
- **Scheduled alerts** — weekly cert-expiry warnings, stale time-off reminders, unpublished schedule warnings, upcoming shift reminders (2-hour window), swap nudges

### Certifications

- **Certification tracking** — staff and managers record certifications with issued/expiry dates and optional document URL
- **Expiry indicators** — valid / expiring soon / expired badges on every certification card
- **Weekly cron alert** — every Monday managers receive notifications for certs expiring within 30 days

### Operations Panel

- **Shift log book** — operational notes per shift, searchable by location and date
- **Checklists** — opening and closing checklists per shift; items marked complete with timestamp and staff name
- **Digital menu** — full menu management with categories, tags, pricing, today's highlights, and location scoping
- **Reservations board** — guest reservations with automatic no-show marking after 30 minutes
- **Personal bookmarks** — staff bookmark shifts or other items for quick access
- **Direct messages** — staff-to-staff and manager-to-staff internal messaging

### Visibility & Compliance

- **Labour analytics** — hours distribution, fairness score (0–1 scale), overtime breakdown per location; SSE live stream
- **Audit log** — append-only ledger of every scheduling action; filterable by location, entity, and date range; CSV export (admin)
- **3D floor-plan viewer** — interactive Three.js scene per location; admin drag-and-drop zone editor
- **Staff directory** — searchable, filterable by location; hourly rate visible to managers/admins only
- **Public landing page** — `/` accessible without login

---

## Scheduled Jobs

| Schedule | Job |
| --- | --- |
| Daily 00:05 | Mark past ASSIGNED shift-assignments as COMPLETED |
| Daily 07:00 | Send shift reminders to all staff working today |
| Weekdays 09:00 | Remind managers of time-off requests pending > 48 hours |
| Fridays 10:00 | Warn managers if next week's schedule has no published shifts |
| Mondays 08:00 | Alert managers about staff certifications expiring within 30 days |
| Every 30 min | Auto mark reservations as NO_SHOW after 30 min grace period |
| Every 30 min | Send upcoming shift reminders (2-hour window, deduped per day) |
| Every 12 hours | Nudge staff with unanswered swap requests > 12 hours old |
| Every 24 hours | Delete read notifications older than 30 days |
| Every 5 min | Expire open drop requests whose deadline has passed |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3001` | API server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS allowed origin |
| `DB_HOST` | Yes | — | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USERNAME` | Yes | — | MySQL username |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_DATABASE` | Yes | — | MySQL database name |
| `JWT_SECRET` | Yes | — | Access token signing secret (≥32 chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing secret (≥32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `SMTP_HOST` | No | `sandbox.smtp.mailtrap.io` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | No | — | SMTP username — email delivery disabled if blank |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | `ShiftSync <noreply@shiftsync.dev>` | From address |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API base URL |

---

## Known Limitations

1. **MySQL only** — TypeORM is configured with the MySQL driver. Switching to PostgreSQL requires changing the driver and a few raw-query expressions.
2. **No file uploads** — document URLs on certifications are free-text fields; actual file storage (S3, etc.) is not wired.

---

## Assumptions

1. **"Manager" means location-manager** — a manager account is linked to one or more locations and can only act on shifts/assignments within those locations.
2. **Swap requests require a named recipient** — peer-to-peer (staff nominates who takes their shift) rather than open-market, for scheduling integrity.
3. **Drop requests are open-market** — any qualified staff member can claim a drop request; a manager then approves the transfer.
4. **Fairness score formula** — standard deviation of premium-shift ratios across staff (Fri/Sat after 17:00). Score of 1.0 = perfectly equal; 0.0 = maximally unequal. `crossLocation=true` aggregates across all locations for multi-location staff.
5. **Audit log is append-only** — no delete or edit endpoint is exposed for audit entries.
6. **JWT access token is in-memory only** — in-memory storage with a silent-refresh pattern (14-min interval) avoids XSS/CSRF risk from cookie or localStorage storage.
7. **Public landing page at `/`** — the dashboard requires login; a public marketing page is served at the root.

---

## Intentional Ambiguities

### 1. De-certifying a staff member from a location

Existing assignments are preserved — removing a location certification does not cancel confirmed shift assignments. The constraint checker only fires on new assignment attempts.

### 2. "Desired hours" vs. availability windows

Desired hours is a scheduling preference / fairness target, not a hard cap. Availability windows are the hard constraint: if a shift falls outside availability, the constraint checker blocks assignment. Desired hours produce a `warning` when a staff member is projected to exceed their preferred weekly total — managers can override.

### 3. Consecutive-day counting

A shift counts as a worked day regardless of duration. Even a short shift represents a day a staff member was required to report for duty, consistent with most jurisdictions' labour-law interpretation.

### 4. Shift edited after swap approval

The system allows shift edits after a swap is approved. Both parties receive an in-app notification of the change. If the edited shift no longer matches the new assignee's skills, the constraint checker flags it on the next check — no automatic revocation.

### 5. Location spanning a timezone boundary

Each location has a single IANA timezone identifier. If a restaurant straddles a state line, the operator chooses the timezone for the side where the majority of operations occur. All shift times and rest-period gap calculations are resolved via UTC conversion using each location's timezone.

---

## Project Structure

```text
shift-sync/
├── .gitignore
├── README.md
│
├── backend/                                        # NestJS API — http://localhost:3001
│   ├── .env.example
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── seed.ts                                 # Database seeder
│   │   ├── analytics/                              # Hours distribution, fairness score, overtime
│   │   ├── audit/                                  # Append-only audit log with CSV export
│   │   ├── auth/                                   # JWT + httpOnly refresh cookie auth
│   │   │   └── dto/  login.dto.ts, register.dto.ts
│   │   ├── bookmarks/                              # Staff personal bookmarks
│   │   ├── certifications/                         # Staff cert tracking with expiry alerts
│   │   ├── checklists/                             # Opening/closing checklists per shift
│   │   ├── common/                                 # Decorators, guards, timezone utils
│   │   ├── config/                                 # App, DB, JWT config + env validation
│   │   ├── drop-requests/                          # Staff drop + open-market pickup workflow
│   │   ├── email/                                  # SMTP email service + HTML template
│   │   ├── locations/                              # Location CRUD with timezone + floor plan
│   │   ├── log-book/                               # Operational shift log entries
│   │   ├── menu/                                   # Digital menu items with highlights
│   │   ├── messages/                               # Internal direct messaging
│   │   ├── notifications/                          # In-app + email notifications + WS gateway
│   │   ├── reservations/                           # Guest reservations with no-show detection
│   │   ├── scheduler/                              # All cron jobs and scheduled intervals
│   │   ├── settings/                               # Key-value system settings (payroll, etc.)
│   │   ├── shifts/                                 # Shifts, assignments, constraint checker
│   │   │   └── dto/  create, update, assign, publish-week, copy-week, auto-schedule
│   │   ├── skills/                                 # Skill taxonomy CRUD
│   │   ├── swap-requests/                          # Peer-to-peer shift swap workflow
│   │   ├── time-off-requests/                      # Time-off with overlap detection
│   │   ├── timesheets/                             # Clock in/out, review, payroll CSV export
│   │   └── users/                                  # Users, availability, password management
│   └── test/
│
└── frontend/                                       # Next.js 16 App Router — http://localhost:3000
    ├── .env.example
    ├── app/
    │   ├── page.tsx                                # Public landing page (3D scene)
    │   ├── (auth)/login/                           # Login page
    │   └── (dashboard)/
    │       ├── analytics/                          # Hours distribution, fairness, overtime
    │       ├── audit/                              # Audit log with CSV export
    │       ├── certifications/                     # My certs + team certs with expiry badges
    │       ├── checklists/                         # Opening/closing checklist management
    │       ├── dashboard/                          # Live stats overview
    │       ├── fair-workweek/                      # Predictive scheduling compliance
    │       ├── locations/[id]/                     # 3D floor plan viewer + zone editor (admin)
    │       ├── log-book/                           # Operational shift log
    │       ├── menu/                               # Digital menu management
    │       ├── messages/                           # Internal messaging
    │       ├── my-schedule/                        # Staff personal schedule view
    │       ├── notifications/                      # Notification centre
    │       ├── pickup/                             # Available shifts for staff to claim
    │       ├── reservations/                       # Reservations board
    │       ├── schedule/                           # Weekly schedule builder (manager/admin)
    │       ├── schedule-templates/                 # Save and apply schedule templates
    │       ├── settings/                           # Profile, password, notification preferences
    │       │   └── availability/                   # Weekly availability + one-off exceptions
    │       ├── shift-feedback/                     # Post-shift staff feedback
    │       ├── skills/                             # Skills management (admin)
    │       ├── staff/                              # Staff directory
    │       ├── swap-requests/                      # Swap request workflows
    │       ├── time-off/                           # Time-off request management
    │       └── timesheets/                         # Clock in/out + timesheet review
    ├── components/
    │   ├── floor-plan/                             # React Three Fiber 3D scene + zone editor
    │   ├── schedule/                               # Shift cards + assignment dialog
    │   ├── ui/                                     # shadcn/ui primitives
    │   └── welcome/                                # Landing page 3D scene components
    ├── contexts/
    │   ├── auth-context.tsx                        # JWT in-memory token + silent refresh
    │   └── notifications-context.tsx               # Socket.IO real-time notification feed
    ├── hooks/
    │   ├── use-live-stats.ts                       # SSE analytics stream hook
    │   └── use-sse.ts                              # Generic SSE subscription hook
    └── lib/
        ├── api/                                    # Per-resource Axios API modules
        ├── socket.ts                               # Socket.IO client singleton
        ├── types.ts                                # Shared TypeScript domain types
        └── utils.ts                                # Tailwind class merge + safeFormat / parseTimeMinutes helpers
```
