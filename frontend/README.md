# ShiftSync — Frontend

Next.js 16 client for the ShiftSync multi-location restaurant scheduling platform.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Real-time | Socket.IO client |
| 3D / Floor plan | React Three Fiber + Three.js |
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
app/              Next.js App Router (auth + dashboard route groups)
components/       Reusable UI components (ui/, layout/, schedule/, floor-plan/)
contexts/         React context providers (auth, notifications)
hooks/            Custom hooks (SSE, mobile detection)
lib/              API client, TypeScript types, utilities
public/           Static assets
```

See individual folder READMEs for details:

- [`app/README.md`](app/README.md)
- [`components/README.md`](components/README.md)
- [`contexts/README.md`](contexts/README.md)
- [`hooks/README.md`](hooks/README.md)
- [`lib/README.md`](lib/README.md)

## Role-Based Access

Three active roles — `admin`, `manager`, `staff` — each see a filtered navigation and role-adaptive page content. Pages that are restricted to specific roles show a `ShieldAlert` screen if accessed by an unauthorized role directly via URL.

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |
