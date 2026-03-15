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

## Folder Structure

```text
app/
  page.tsx                  Public landing / reservation page
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
    locations/[id]/         2D floor-plan viewer + zone editor (admin)
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
  schedule/                 Shift cards + assignment dialog
  ui/                       shadcn/ui primitives + custom components
                            (includes NetworkStatusBanner, TimePicker, DatePicker…)

contexts/
  auth-context.tsx          JWT in-memory token + 14-min silent refresh
  messages-context.tsx      Global DM inbox, unread count, active thread, WS sync
  notifications-context.tsx Socket.IO real-time notification feed

hooks/
  use-live-stats.ts         SSE analytics stream hook
  use-mobile.ts             Mobile breakpoint detection
  use-network-status.ts     Online/offline + socket quality + reconnect state
  use-sse.ts                Generic SSE subscription hook
  use-typing-indicator.ts   Emit + receive typing:start/stop socket events

lib/
  api/                      Per-resource Axios API modules
  socket.ts                 Socket.IO client singleton
  types.ts                  Shared TypeScript domain types
  utils.ts                  cn(), safeFormat(), parseTimeMinutes()
```

## Role-Based Access

Three active roles — `admin`, `manager`, `staff` — each see a filtered navigation and role-adaptive page content. Pages restricted to specific roles show a `ShieldAlert` screen if accessed directly via URL by an unauthorized role.

## Real-Time Features

- **Messages** — new DMs delivered instantly via `message:new` socket event; inbox, thread, and header unread badge all update without polling.
- **Typing indicators** — `typing:start` / `typing:stop` events show an animated three-dot bubble in active threads (both the global sheet and the full messages page).
- **Network status banner** — fixed bottom-left toast that appears when the browser goes offline, detects a slow connection, or the socket is reconnecting.
- **Notifications** — pushed via `notification:new` socket event as they are created on the backend.

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |
