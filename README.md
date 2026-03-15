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
npm run seed
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

### Backend

Unit tests use **Jest + `@nestjs/testing`** with mocked repositories and event emitters — no database required.

```bash
cd backend
npm test              # run all tests
npm test -- --watch   # watch mode
```

**329 tests across 27 spec files — all passing.**

| Area | Spec file | Tests |
| --- | --- | --- |
| Shifts & assignments | `shifts/shifts.service.spec.ts` | 27 |
| Constraint checker | `shifts/constraint-checker.service.spec.ts` | 17 |
| Swap requests | `swap-requests/swap-requests.service.spec.ts` | 19 |
| Time-off requests | `time-off-requests/time-off-requests.service.spec.ts` | 20 |
| Drop requests | `drop-requests/drop-requests.service.spec.ts` | 17 |
| Timesheets | `timesheets/timesheets.service.spec.ts` | 16 |
| Auth | `auth/auth.service.spec.ts` | 14 |
| Users & availability | `users/users.service.spec.ts` | 16 |
| Checklists | `checklists/checklists.service.spec.ts` | 14 |
| Scheduler crons | `scheduler/scheduler.service.spec.ts` | 17 |
| Certifications | `certifications/certifications.service.spec.ts` | 13 |
| Notifications routing | `notifications/notifications.service.spec.ts` | 12 |
| Audit log | `audit/audit.service.spec.ts` | 12 |
| Analytics | `analytics/analytics.service.spec.ts` | 10 |
| Locations | `locations/locations.service.spec.ts` | 10 |
| Log book | `log-book/log-book.service.spec.ts` | 10 |
| Menu | `menu/menu.service.spec.ts` | 11 |
| Messages | `messages/messages.service.spec.ts` | 11 |
| Reservations | `reservations/reservations.service.spec.ts` | 10 |
| Schedule templates | `schedule-templates/schedule-templates.service.spec.ts` | 10 |
| Shift feedback | `shift-feedback/shift-feedback.service.spec.ts` | 10 |
| Settings | `settings/settings.service.spec.ts` | 9 |
| Fair workweek | `fair-workweek/fair-workweek.service.spec.ts` | 7 |
| Skills | `skills/skills.service.spec.ts` | 6 |
| Email | `email/email.service.spec.ts` | 5 |
| Bookmarks | `bookmarks/bookmarks.service.spec.ts` | 5 |
| App controller | `app.controller.spec.ts` | 1 |

### Frontend

Unit and integration tests use **Vitest + React Testing Library** with jsdom — no browser or running server required.

```bash
cd frontend
npm run test:run       # single run
npm run test           # watch mode
npm run test:coverage  # coverage report
```

**167 tests across 11 test files — all passing.**

| Area | Test file | Tests |
| --- | --- | --- |
| Auth context | `contexts/auth-context.test.tsx` | 13 |
| Notifications context | `contexts/notifications-context.test.tsx` | 19 |
| Messages context | `contexts/messages-context.test.tsx` | 16 |
| Network status hook | `hooks/use-network-status.test.ts` | 17 |
| Typing indicator hook | `hooks/use-typing-indicator.test.ts` | 18 |
| Live stats hooks | `hooks/use-live-stats.test.ts` | 13 |
| SSE hook | `hooks/use-sse.test.ts` | 11 |
| Mobile breakpoint hook | `hooks/use-mobile.test.ts` | 7 |
| TimePicker component | `components/ui/time-picker.test.tsx` | 22 |
| Utility functions | `lib/utils.test.ts` | 17 |
| Proxy middleware | `proxy.test.ts` | 9 |

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
- **Direct messages** — staff-to-staff and manager-to-staff internal messaging; new messages delivered instantly via WebSocket (no polling); typing indicators in both the sidebar sheet and the full messages page

### Visibility & Compliance

- **Labour analytics** — hours distribution, fairness score (0–1 scale), overtime breakdown per location; SSE live stream
- **Audit log** — append-only ledger of every scheduling action; filterable by location, entity, and date range; CSV export (admin)
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

### 6. Concurrent assignment attempts (race condition)

When two managers attempt to assign the same staff member to conflicting shifts simultaneously, a pessimistic lock (`SELECT ... FOR UPDATE`) is held for the duration of the assignment transaction. The first request to acquire the lock completes successfully; the second reads the now-committed assignment and the constraint checker immediately surfaces a double-booking error — the second manager sees an explicit conflict message rather than a silent failure or corrupt state.

### 7. Swap cancellation before manager approval

Staff A can cancel their own swap request at any time while it is still in `PENDING` state (i.e., before a manager approves it). Because no assignment transfer has occurred yet, the cancellation is fully clean — both parties retain their original shifts and both receive an in-app notification. Once a manager has approved the swap (assignments have been exchanged), cancellation is no longer available through the swap workflow; any further change requires the manager to manually re-assign.

---

## Evaluation Scenarios

### 1. The Sunday Night Chaos

*A staff member calls out at 6pm Sunday for a 7pm shift. What is the fastest path to finding coverage?*

Drop requests enforce a 24-hour minimum notice window, so the normal self-service drop flow is unavailable. The fastest manager path:

1. **Schedule page** → navigate to today's date → open the affected shift.
2. **Remove the absent staff member's assignment** — this cancels their assignment and emits an in-app notification to them.
3. **Assign a replacement** — the assignment dialog shows all staff. The constraint checker runs instantly and surfaces any conflicts (double-booking, skill mismatch, availability gap). If a marginal violation exists (e.g., availability ends at 6:30pm), the manager can **override with a reason** and proceed.
4. The replacement receives an **instant Socket.IO push notification** and, if email is enabled in their settings, an email as well.
5. Optionally, **direct-message the replacement** via the Messages page before assigning to confirm verbally — the typing indicator shows when they're responding in real time.

Total UI steps from login: ~5 clicks.

---

### 2. The Overtime Trap

*A manager builds a schedule without realising one employee would hit 52 hours. How does the system help?*

The constraint checker fires on every assignment attempt and compares the staff member's projected weekly hours (existing assignments + new shift duration) against their `desiredHours` setting. Exceeding the threshold produces a **`warning`-level violation** — not a hard block — so the manager sees a yellow flag with the projected total and can proceed with an override reason.

After the schedule is built, two additional surfaces expose the problem:

- **Analytics → Overtime Projection** — lists every staff member projected to exceed 40 hours that week, their total projected hours, and the overtime amount at the configured multiplier (set in Settings → Payroll).
- **Payroll CSV export** — breaks down regular vs overtime hours per staff member, so the cost is visible before payroll runs.

The design choice here is intentional: the constraint checker warns but does not block overtime, because a short-staffed Sunday night may genuinely require it. The manager must consciously override and the decision is recorded in the audit log.

---

### 3. The Timezone Tangle

*A staff member is certified at a Pacific-time location and an Eastern-time location. They set availability as "9am–5pm". What happens?*

Availability windows are stored as plain `HH:MM` strings tied to the day of week — they are **not** UTC-anchored to a timezone, because availability represents when the person is physically free, not a UTC moment.

All shift times are stored in UTC. When the constraint checker evaluates an assignment, it:

1. Converts the shift's UTC start/end into the **location's IANA timezone** to get the local shift time.
2. Compares that local time against the staff member's availability window for that day.

So "9am–5pm" availability means:

- A 9am Pacific shift (17:00 UTC) → local time is 09:00 PT → **within availability** ✓
- A 9am Eastern shift (14:00 UTC) → local time is 09:00 ET → **within availability** ✓
- A 7am Eastern shift (12:00 UTC) → local time is 07:00 ET → **outside availability**, constraint checker blocks ✗

The staff member's availability is interpreted in the timezone of whichever location the shift belongs to. This matches how employees intuitively think — "I'm free 9 to 5" means 9 to 5 wherever I'm working, not 9 to 5 in a fixed reference timezone.

---

### 4. The Simultaneous Assignment

*Two managers both try to assign the same bartender to different locations at the same time. What happens?*

The assignment service acquires a **pessimistic lock** (`SELECT ... FOR UPDATE`) on the staff member's existing assignments for the overlapping time window before committing. This means:

- Manager A's request acquires the lock, passes the constraint check (no conflict yet), and commits the assignment.
- Manager B's request acquires the lock *after* A's transaction commits, re-reads the now-committed assignment, and the constraint checker immediately detects a double-booking → returns `400 Bad Request: Staff member is already assigned to another shift at this time`.

Manager B sees a clear error message in the assignment dialog. No silent data corruption, no partial state. The audit log records Manager A's successful assignment with a timestamp; Manager B's attempt is rejected cleanly at the API layer.

---

### 5. The Fairness Complaint

*An employee claims they never get Saturday night shifts. How does a manager verify or refute this?*

**Analytics → Fairness Report** is the primary tool. It shows each staff member's *premium shift ratio* — the proportion of their total shifts that qualify as premium (Friday or Saturday, starting at or after 17:00). Columns include:

- Total shifts assigned
- Premium shifts assigned
- Premium ratio (%)
- Fairness score contribution

The **fairness score** (0–1 scale) is derived from the standard deviation of premium ratios across all staff at the location. A score near 1.0 means distribution is even; near 0.0 means heavily skewed.

If the complaining employee's premium ratio is materially below the average, the data supports the claim. If their ratio matches or exceeds peers, the complaint is refuted with objective numbers. The `crossLocation=true` flag aggregates premium shifts across all locations for multi-site staff, preventing the edge case where a manager's view is incomplete.

---

### 6. The Regret Swap

*Staff A and B request a swap. The manager hasn't approved it yet. Staff A changes their mind. What are the implications?*

While the swap is in `PENDING` state, **no assignment transfer has occurred** — both parties still hold their original shifts. Staff A can navigate to **Swap Requests → cancel** their pending request at any point before manager approval.

On cancellation:

- The swap moves to `CANCELLED` state.
- Staff A retains their original shift; Staff B retains theirs.
- Both receive an **in-app notification** of the cancellation.
- No manager action is required; the manager's approval queue is cleared of this item.

If the manager had already **approved** the swap (assignments exchanged), Staff A cannot use the swap workflow to reverse it — that window has closed. At that point, the only remedies are a new swap request in the opposite direction, or the manager manually re-assigning via the Schedule page. This is by design: once a manager has reviewed and approved a transfer, unilateral reversal by staff should require another manager decision.

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
    │   ├── page.tsx                                # Public landing page
    │   ├── (auth)/login/                           # Login page
    │   └── (dashboard)/
    │       ├── analytics/                          # Hours distribution, fairness, overtime
    │       ├── audit/                              # Audit log with CSV export
    │       ├── certifications/                     # My certs + team certs with expiry badges
    │       ├── checklists/                         # Opening/closing checklist management
    │       ├── dashboard/                          # Live stats overview
    │       ├── fair-workweek/                      # Predictive scheduling compliance
    │       ├── locations/[id]/                     # Location detail (admin)
    │       ├── log-book/                           # Operational shift log
    │       ├── menu/                               # Digital menu management
    │       ├── messages/                           # Internal messaging (real-time WS)
    │       ├── my-schedule/                        # Staff personal schedule view
    │       ├── notifications/                      # Notification centre
    │       ├── pickup/                             # Available shifts for staff to claim
    │       ├── reservations/                       # Reservations board
    │       ├── schedule/                           # Weekly schedule builder (manager/admin)
    │       ├── schedule-templates/                 # Save and apply schedule templates
    │       ├── settings/                           # Profile, password, notification preferences
    │       │   └── availability/                   # Weekly availability + one-off exceptions (TimePicker)
    │       ├── shift-feedback/                     # Post-shift staff feedback
    │       ├── skills/                             # Skills management (admin)
    │       ├── staff/                              # Staff directory
    │       ├── swap-requests/                      # Swap request workflows
    │       ├── time-off/                           # Time-off request management
    │       └── timesheets/                         # Clock in/out + timesheet review
    ├── components/
    │   ├── floor-plan/                             # 2D floor-plan canvas + zone editor
    │   ├── layout/                                 # AppSidebar and nav group definitions
    │   ├── login-form.tsx                          # Login form component
    │   ├── schedule/                               # Shift cards + assignment dialog
    │   ├── ui/                                     # shadcn/ui primitives + custom TimePicker, DatePicker
    │   └── weather-widget.tsx                      # Location weather widget
    ├── contexts/
    │   ├── auth-context.tsx                        # JWT in-memory token + silent refresh
    │   ├── messages-context.tsx                    # Active chat state + WS message:new listener
    │   └── notifications-context.tsx               # Socket.IO real-time notification feed
    ├── hooks/
    │   ├── use-live-stats.ts                       # SSE analytics / schedule / notification stream hooks
    │   ├── use-mobile.ts                           # Mobile breakpoint detection
    │   ├── use-network-status.ts                   # Online/offline + socket quality + reconnect state
    │   ├── use-sse.ts                              # Generic SSE subscription hook
    │   └── use-typing-indicator.ts                 # Emit typing:start/stop; track partner typing state
    ├── proxy.ts                                    # Next.js middleware — auth-session cookie guard
    └── lib/
        ├── api/                                    # Per-resource Axios API modules
        ├── socket.ts                               # Socket.IO client singleton
        ├── types.ts                                # Shared TypeScript domain types
        └── utils.ts                                # Tailwind class merge + safeFormat / parseTimeMinutes helpers
```
