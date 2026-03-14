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

1. **MySQL only** — TypeORM is configured with the MySQL driver. Switching to PostgreSQL requires changing the driver and a few raw-query expressions.

---

## Assumptions

1. **"Manager" means location-manager** — a manager account is linked to one or more locations and can only act on shifts/assignments within those locations. The requirement said "manager role" without specifying scope; location-scoping was assumed.
2. **Swap requests require a named recipient** — the spec described swaps but didn't specify whether they were open-market or peer-to-peer. Peer-to-peer (staff nominates who takes their shift) was implemented as it's safer for scheduling integrity.
3. **Drop requests go to any available qualified staff** — once a manager approves a drop, the shift is unassigned and re-published for reassignment rather than automatically filled.
4. **Fairness score formula** — based on standard deviation of premium-shift ratios across staff (Fri/Sat after 17:00). Score of 1.0 = perfectly equal distribution; 0.0 = maximally unequal. `crossLocation=true` aggregates ratios across all locations for multi-location staff.
5. **Audit log is append-only** — no delete or edit endpoint is exposed for audit entries. This was treated as a hard requirement even though the spec didn't explicitly say immutable.
6. **JWT access token is in-memory only** — storing the access token in a cookie or localStorage introduces XSS or CSRF risk. In-memory storage with a silent-refresh pattern was chosen as the most secure default.
7. **Public landing page at `/`** — the spec listed a dashboard as the main entry point but didn't address unauthenticated visitors. A public marketing-style landing page was added at `/`; the dashboard requires login.

---

## Intentional Ambiguities — Decisions Documented

The following scenarios were deliberately unspecified. Here is how each was resolved:

### 1. De-certifying a staff member from a location

Existing assignments are preserved — removing a location certification does not cancel or delete any shift assignments already in place. The constraint checker only fires on new assignment attempts, so historical data is untouched. The rationale: retroactive cancellation of already-confirmed shifts would cause more operational disruption than a manager manually reviewing and removing individual assignments. A warning banner on the staff profile page is the appropriate UX signal.

### 2. "Desired hours" vs. availability windows

Desired hours is treated as a scheduling preference / fairness target, not a hard cap. Availability windows are the hard constraint: if a shift falls outside a staff member's availability window, the constraint checker raises an `error`-severity violation and blocks assignment. Desired hours only produce a `warning` when a staff member is projected to exceed their preferred weekly total — managers can override without a reason.

### 3. Consecutive-day counting — 1-hour shift vs. 11-hour shift

A shift counts as a worked day regardless of duration. The consecutive-day rule is designed to prevent fatigue from sustained multi-day stretches, and even a short shift represents a day a staff member was required to report for duty. This is consistent with most jurisdictions' labour-law interpretation of "day worked."

### 4. Shift edited after swap approval but before the shift occurs

The system allows the shift to be edited (time, skill, location) by a manager. The approved swap assignment is preserved but both the original requester and the recipient receive an in-app notification that the shift details changed. If the edit changes the required skill and the new assignee no longer has that skill, the constraint checker will flag the mismatch on the next check — the manager is responsible for re-evaluating. No automatic revocation of the swap was implemented because it would create a confusing loop of re-approval.

### 5. Location spanning a timezone boundary

Each location has a single IANA timezone identifier. The system does not model split-timezone scenarios. If a restaurant physically straddles a state line, the operator should choose the timezone for the side where the majority of operations occur (e.g., the kitchen or main dining room). All shift times and constraint checks — including rest-period gaps between shifts at different locations — are resolved through UTC conversion using each location's assigned timezone, so cross-location rest calculations remain accurate even for staff who work at locations in different timezones.

---

## Project Structure

```text
shift-sync/
├── .gitignore
├── README.md
│
├── backend/                                        # NestJS API — http://localhost:3001
│   ├── .env.example
│   ├── .gitignore
│   ├── .prettierrc
│   ├── eslint.config.mjs
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.controller.spec.ts
│   │   ├── app.service.ts
│   │   ├── seed.ts                                 # Database seeder (run once after install)
│   │   ├── analytics/
│   │   │   ├── analytics.controller.ts
│   │   │   ├── analytics.module.ts
│   │   │   └── analytics.service.ts
│   │   ├── audit/
│   │   │   ├── audit.controller.ts
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.service.ts
│   │   │   └── entities/
│   │   │       └── audit-log.entity.ts
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── local-auth.guard.ts
│   │   │   ├── local.strategy.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   ├── bookmarks/
│   │   │   ├── bookmarks.controller.ts
│   │   │   ├── bookmarks.module.ts
│   │   │   ├── bookmarks.service.ts
│   │   │   ├── dto/
│   │   │   │   └── create-bookmark.dto.ts
│   │   │   └── entities/
│   │   │       └── bookmark.entity.ts
│   │   ├── common/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── timezone.util.ts
│   │   │   └── guards/
│   │   │       └── sse-jwt.guard.ts
│   │   ├── config/
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   ├── jwt.config.ts
│   │   │   └── validation.schema.ts
│   │   ├── drop-requests/
│   │   │   ├── drop-requests.controller.ts
│   │   │   ├── drop-requests.module.ts
│   │   │   ├── drop-requests.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-drop-request.dto.ts
│   │   │   │   └── review-drop.dto.ts
│   │   │   └── entities/
│   │   │       └── drop-request.entity.ts
│   │   ├── email/
│   │   │   ├── email.module.ts
│   │   │   └── email.service.ts
│   │   ├── locations/
│   │   │   ├── locations.controller.ts
│   │   │   ├── locations.module.ts
│   │   │   ├── locations.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-location.dto.ts
│   │   │   │   └── update-location.dto.ts
│   │   │   └── entities/
│   │   │       └── location.entity.ts
│   │   ├── log-book/
│   │   │   ├── log-book.controller.ts
│   │   │   ├── log-book.module.ts
│   │   │   ├── log-book.service.ts
│   │   │   ├── dto/
│   │   │   │   └── create-log-entry.dto.ts
│   │   │   └── entities/
│   │   │       └── log-entry.entity.ts
│   │   ├── menu/
│   │   │   ├── menu.controller.ts
│   │   │   ├── menu.module.ts
│   │   │   ├── menu.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-menu-item.dto.ts
│   │   │   │   └── update-menu-item.dto.ts
│   │   │   └── entities/
│   │   │       └── menu-item.entity.ts
│   │   ├── notifications/
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.gateway.ts            # Socket.IO WebSocket gateway
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts
│   │   │   └── entities/
│   │   │       └── notification.entity.ts
│   │   ├── reservations/
│   │   │   ├── reservations.controller.ts
│   │   │   ├── reservations.module.ts
│   │   │   ├── reservations.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-reservation.dto.ts
│   │   │   │   └── update-reservation.dto.ts
│   │   │   └── entities/
│   │   │       └── reservation.entity.ts
│   │   ├── scheduler/
│   │   │   ├── scheduler.module.ts
│   │   │   └── scheduler.service.ts                # Cron jobs (expired drop requests, etc.)
│   │   ├── shifts/
│   │   │   ├── constraint-checker.service.ts       # Scheduling constraint validation
│   │   │   ├── shifts.controller.ts
│   │   │   ├── shifts.module.ts
│   │   │   ├── shifts.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── assign-staff.dto.ts
│   │   │   │   ├── create-shift.dto.ts
│   │   │   │   ├── publish-week.dto.ts
│   │   │   │   └── update-shift.dto.ts
│   │   │   └── entities/
│   │   │       ├── shift-assignment.entity.ts
│   │   │       └── shift.entity.ts
│   │   ├── skills/
│   │   │   ├── skills.controller.ts
│   │   │   ├── skills.module.ts
│   │   │   ├── skills.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-skill.dto.ts
│   │   │   │   └── update-skill.dto.ts
│   │   │   └── entities/
│   │   │       └── skill.entity.ts
│   │   ├── swap-requests/
│   │   │   ├── swap-requests.controller.ts
│   │   │   ├── swap-requests.module.ts
│   │   │   ├── swap-requests.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-swap-request.dto.ts
│   │   │   │   └── review-swap.dto.ts
│   │   │   └── entities/
│   │   │       └── swap-request.entity.ts
│   │   ├── time-off-requests/
│   │   │   ├── time-off-requests.controller.ts
│   │   │   ├── time-off-requests.module.ts
│   │   │   ├── time-off-requests.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-time-off-request.dto.ts
│   │   │   │   └── review-time-off.dto.ts
│   │   │   └── entities/
│   │   │       └── time-off-request.entity.ts
│   │   └── users/
│   │       ├── users.controller.ts
│   │       ├── users.module.ts
│   │       ├── users.service.ts
│   │       ├── dto/
│   │       │   ├── change-password.dto.ts
│   │       │   ├── set-availability.dto.ts
│   │       │   └── update-user.dto.ts
│   │       └── entities/
│   │           ├── availability-exception.entity.ts
│   │           ├── availability.entity.ts
│   │           └── user.entity.ts
│   └── test/
│       ├── app.e2e-spec.ts
│       └── jest-e2e.json
│
└── frontend/                                       # Next.js 16 App Router — http://localhost:3000
    ├── .env.example
    ├── .gitignore
    ├── components.json
    ├── eslint.config.mjs
    ├── next-env.d.ts
    ├── next.config.ts
    ├── package.json
    ├── postcss.config.mjs
    ├── proxy.ts                                    # Next.js v16 middleware — auth session guard
    ├── tsconfig.json
    ├── app/
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── icon.svg
    │   ├── layout.tsx                              # Root layout
    │   ├── not-found.tsx
    │   ├── page.tsx                                # Public landing page
    │   ├── providers.tsx                           # React Query + theme providers
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   └── login/
    │   │       └── page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx                          # Sidebar shell + protected route wrapper
    │       ├── analytics/
    │       │   └── page.tsx                        # Hours distribution, fairness score, overtime
    │       ├── audit/
    │       │   └── page.tsx                        # Immutable audit log with CSV export
    │       ├── dashboard/
    │       │   └── page.tsx                        # Live stats overview
    │       ├── locations/
    │       │   ├── page.tsx                        # Location list
    │       │   └── [id]/
    │       │       ├── loading.tsx
    │       │       └── page.tsx                    # 3D floor plan viewer + Edit layout (admin)
    │       ├── log-book/
    │       │   └── page.tsx                        # Operational shift log
    │       ├── menu/
    │       │   └── page.tsx                        # Digital menu management
    │       ├── my-schedule/
    │       │   └── page.tsx                        # Staff personal schedule
    │       ├── notifications/
    │       │   └── page.tsx
    │       ├── pickup/
    │       │   └── page.tsx                        # Available shifts for staff to pick up
    │       ├── reservations/
    │       │   └── page.tsx                        # Reservations board
    │       ├── schedule/
    │       │   └── page.tsx                        # Weekly schedule builder (manager/admin)
    │       ├── settings/
    │       │   ├── page.tsx                        # Profile & notification settings
    │       │   └── availability/
    │       │       └── page.tsx                    # Weekly availability + one-off exceptions
    │       ├── skills/
    │       │   └── page.tsx                        # Skills management (admin)
    │       ├── staff/
    │       │   └── page.tsx                        # Staff directory
    │       ├── swap-requests/
    │       │   └── page.tsx                        # Swap request workflows
    │       └── time-off/
    │           └── page.tsx                        # Time-off request management
    ├── components/
    │   ├── login-form.tsx
    │   ├── floor-plan/
    │   │   ├── floor-plan-canvas.tsx               # SSR-safe dynamic import wrapper
    │   │   ├── floor-plan-editor.tsx               # Admin drag-and-drop 2D zone editor
    │   │   ├── floor-plan-scene.tsx                # React Three Fiber 3D orthographic scene
    │   │   ├── floor-plan-types.ts
    │   │   ├── floor-zone.tsx                      # Individual 3D zone mesh + label
    │   │   ├── zone-config.ts                      # Default hardcoded zone layout (fallback)
    │   │   └── zone-detail-panel.tsx               # Selected zone staff panel
    │   ├── layout/
    │   │   └── app-sidebar.tsx                     # Navigation sidebar
    │   ├── schedule/
    │   │   ├── assign-dialog.tsx                   # Staff assignment modal with constraint preview
    │   │   └── shift-card.tsx                      # Shift card with assignment slots
    │   ├── ui/                                     # shadcn/ui primitives
    │   │   ├── accordion.tsx
    │   │   ├── alert-dialog.tsx
    │   │   ├── alert.tsx
    │   │   ├── aspect-ratio.tsx
    │   │   ├── avatar.tsx
    │   │   ├── badge.tsx
    │   │   ├── breadcrumb.tsx
    │   │   ├── button-group.tsx
    │   │   ├── button.tsx
    │   │   ├── calendar.tsx
    │   │   ├── card.tsx
    │   │   ├── carousel.tsx
    │   │   ├── chart.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── collapsible.tsx
    │   │   ├── combobox.tsx
    │   │   ├── command.tsx
    │   │   ├── context-menu.tsx
    │   │   ├── data-table.tsx
    │   │   ├── date-picker.tsx
    │   │   ├── dialog.tsx
    │   │   ├── direction.tsx
    │   │   ├── drawer.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── empty.tsx
    │   │   ├── error-boundary.tsx
    │   │   ├── field.tsx
    │   │   ├── hover-card.tsx
    │   │   ├── input-group.tsx
    │   │   ├── input-otp.tsx
    │   │   ├── input.tsx
    │   │   ├── item.tsx
    │   │   ├── kbd.tsx
    │   │   ├── label.tsx
    │   │   ├── menubar.tsx
    │   │   ├── native-select.tsx
    │   │   ├── navigation-menu.tsx
    │   │   ├── page-transition.tsx
    │   │   ├── pagination.tsx
    │   │   ├── popover.tsx
    │   │   ├── progress.tsx
    │   │   ├── radio-group.tsx
    │   │   ├── resizable.tsx
    │   │   ├── scroll-area.tsx
    │   │   ├── select.tsx
    │   │   ├── separator.tsx
    │   │   ├── sheet.tsx
    │   │   ├── sidebar.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── slider.tsx
    │   │   ├── sonner.tsx
    │   │   ├── spinner.tsx
    │   │   ├── status-badge.tsx
    │   │   ├── switch.tsx
    │   │   ├── table.tsx
    │   │   ├── tabs.tsx
    │   │   ├── textarea.tsx
    │   │   ├── toggle-group.tsx
    │   │   ├── toggle.tsx
    │   │   └── tooltip.tsx
    │   └── welcome/                                # Public landing page 3D scene components
    │       ├── login-scene.tsx
    │       ├── scene-bar.tsx
    │       ├── scene-config.ts
    │       ├── scene-lighting.tsx
    │       ├── scene-models.tsx
    │       ├── scene-room.tsx
    │       └── welcome-scene.tsx
    ├── contexts/
    │   ├── auth-context.tsx                        # JWT in-memory token + silent refresh
    │   └── notifications-context.tsx              # Socket.IO real-time notification feed
    ├── hooks/
    │   ├── use-live-stats.ts                       # SSE analytics stream hook
    │   ├── use-mobile.ts
    │   └── use-sse.ts                              # Generic SSE subscription hook
    ├── lib/
    │   ├── api.ts                                  # Axios API client with all endpoint wrappers
    │   ├── socket.ts                               # Socket.IO client singleton
    │   ├── types.ts                                # Shared TypeScript domain types
    │   └── utils.ts                                # Tailwind class merge utility
    └── public/
        ├── file.svg
        ├── globe.svg
        ├── next.svg
        ├── vercel.svg
        ├── window.svg
        └── models/                                 # GLTF/GLB 3D models for landing page scene
            ├── bar-stool.glb
            ├── bottle.glb
            ├── ceiling-fan.glb
            ├── chair.glb
            ├── cocktail-glass.glb
            ├── column.glb
            ├── hanging-plant-a.glb
            ├── hanging-plant-b.glb
            ├── hanging-plant-c.glb
            ├── lantern.glb
            ├── palm-tree.glb
            ├── table.glb
            ├── tropical-plant.glb
            └── wine-glass.glb
```
