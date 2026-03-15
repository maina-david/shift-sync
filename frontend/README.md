# ShiftSync — Frontend

Next.js 16 client for the ShiftSync multi-location restaurant scheduling platform.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (radix-vega style) |
| State / Data | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Real-time | Socket.IO client |
| Notifications | Sonner (toast) |
| Icons | Lucide React |

## Quick Start

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint check |
| `npm run test` | Unit tests in watch mode (Vitest) |
| `npm run test:run` | Single test run — 167 tests, all passing |
| `npm run test:coverage` | Coverage report |

## Folder Structure

```text
app/
  page.tsx                  Public landing page
  providers.tsx             TanStack Query + theme + context providers
  (auth)/login/             Login page
  (dashboard)/
    layout.tsx              Shell: sidebar, header, messages sheet, network banner
    analytics/              Hours distribution, fairness, overtime charts
    audit/                  Audit log with CSV export
    certifications/         My certs + team certs with expiry badges
    checklists/             Opening/closing checklist management
    dashboard/              Live stats overview
    fair-workweek/          Predictive scheduling compliance
    locations/[id]/         Location detail + floor-plan zone editor (admin)
    log-book/               Operational shift log
    menu/                   Digital menu management
    messages/               Full-page messaging (DMs + announcements)
    my-schedule/            Staff personal schedule view
    notifications/          Notification centre
    pickup/                 Open shifts for staff to claim
    reservations/           Reservations board
    schedule/               Weekly schedule builder (manager/admin)
    schedule-templates/     Save and apply schedule templates
    settings/               Profile, password, notification preferences
      availability/         Weekly availability + one-off exceptions (TimePicker)
    shift-feedback/         Post-shift staff feedback
    skills/                 Skills management (admin)
    staff/                  Staff directory
    swap-requests/          Swap request workflows
    time-off/               Time-off request management
    timesheets/             Clock in/out + timesheet review

components/
  floor-plan/               2D floor-plan canvas + zone editor
  layout/                   AppSidebar and nav group definitions
  login-form.tsx            Login form component
  schedule/                 Shift cards + assignment dialog
  ui/                       shadcn/ui primitives + custom components
                            (NetworkStatusBanner, TimePicker, DatePicker, …)
  weather-widget.tsx        Location weather widget

contexts/
  auth-context.tsx          JWT in-memory token + 14-min silent refresh
  messages-context.tsx      Global DM inbox, unread count, active thread, WS sync
  notifications-context.tsx Socket.IO real-time notification feed

hooks/
  use-live-stats.ts         SSE hooks for analytics, schedule, and notification streams
  use-mobile.ts             Mobile breakpoint detection
  use-network-status.ts     Online/offline + socket quality + reconnect state
  use-sse.ts                Generic SSE subscription hook
  use-typing-indicator.ts   Emit + receive typing:start/stop socket events

lib/
  api/                      Per-resource Axios API modules
  socket.ts                 Socket.IO client singleton
  types.ts                  Shared TypeScript domain types
  utils.ts                  cn(), safeFormat(), parseTimeMinutes()

proxy.ts                    Next.js middleware — redirects unauthenticated requests to /login
```

## Role-Based Access

Three active roles — `admin`, `manager`, `staff` — each see a filtered navigation and role-adaptive page content. Pages restricted to specific roles show a `ShieldAlert` screen if accessed directly via URL by an unauthorized role.

## Real-Time Features

- **Messages** — new DMs delivered instantly via `message:new` socket event; inbox, thread, and header unread badge all update without polling.
- **Typing indicators** — `typing:start` / `typing:stop` events show an animated three-dot bubble in active threads (both the global sheet and the full messages page).
- **Network status banner** — fixed bottom-left toast that appears when the browser goes offline, detects a slow connection, or the socket is reconnecting.
- **Notifications** — pushed via `notification:new` socket event as they are created on the backend.

## Testing

Tests use **Vitest + React Testing Library** (jsdom) — no browser or running server required.

```bash
npm run test:run       # run once
npm run test           # watch mode
npm run test:coverage  # coverage report (v8)
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

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |
