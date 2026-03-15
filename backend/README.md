# ShiftSync — Backend

NestJS REST API for the ShiftSync multi-location restaurant scheduling platform.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| ORM | TypeORM 0.3 |
| Database | MySQL 8 |
| Auth | Passport JWT (access + refresh tokens) |
| Real-time | Socket.IO via NestJS WebSocket Gateway |
| Scheduling | `@nestjs/schedule` cron jobs |
| Events | `@nestjs/event-emitter` for decoupled module communication |
| Validation | `class-validator` + `class-transformer` |
| Email | Nodemailer (SMTP) |
| Docs | Swagger (`@nestjs/swagger`) at `/api` |

## Quick Start

```bash
cp .env.example .env
npm install
npm run seed
npm run start:dev
```

Swagger UI available at `http://localhost:3001/api`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode with hot reload |
| `npm run start:prod` | Production (compiled) |
| `npm run build` | Compile to `dist/` |
| `npm run test` | Unit tests (Jest) — 329 tests, all passing |
| `npm run test:cov` | Coverage report |
| `npm run lint` | ESLint check |
| `npm run seed` | Reset DB and seed demo data |

## Module Overview

| Module | Responsibility |
| --- | --- |
| `auth` | JWT login, refresh cookie, token rotation |
| `users` | User CRUD, availability, weekly slots, exceptions |
| `shifts` | Shifts, assignments, constraint checker, auto-schedule, copy-week |
| `swap-requests` | Peer-to-peer shift swap workflow |
| `drop-requests` | Staff drop + open-market pickup workflow |
| `time-off-requests` | Time-off with overlap detection |
| `timesheets` | Clock in/out, manager review, payroll CSV export |
| `notifications` | In-app + email notifications + WebSocket gateway |
| `messages` | Direct messages + announcements with real-time WS delivery |
| `certifications` | Cert tracking with expiry alerts |
| `checklists` | Opening/closing checklists per shift |
| `scheduler` | All cron jobs and scheduled intervals |
| `analytics` | Hours distribution, fairness score, overtime (SSE stream) |
| `audit` | Append-only audit log with CSV export |
| `locations` | Location CRUD with timezone + floor-plan zone management |
| `settings` | Key-value system settings (payroll, scheduling defaults) |
| `fair-workweek` | Predictive scheduling compliance tracking |
| `menu` | Digital menu items, categories, tags, today's highlights |
| `reservations` | Guest reservations with automatic no-show detection |
| `schedule-templates` | Save, load, and apply reusable weekly schedule templates |
| `log-book` | Operational shift log entries per location |
| `shift-feedback` | Post-shift staff feedback collection |
| `skills` | Skill taxonomy CRUD used for constraint checking |
| `bookmarks` | Staff personal item bookmarks |
| `email` | SMTP email service with styled HTML templates |

## Auth Flow

1. `POST /auth/login` — returns a short-lived access token (JSON) + httpOnly refresh cookie
2. All protected routes require `Authorization: Bearer <access_token>`
3. `POST /auth/refresh` — issues a new access token using the refresh cookie
4. Access tokens expire in 15 min; refresh tokens in 7 days

## WebSocket Gateway (`/ws`)

The `NotificationsGateway` handles all real-time communication. Clients authenticate via `auth.token` on handshake; unauthenticated connections are disconnected immediately.

**Rooms joined on connect:**

- `user:<id>` — every authenticated user
- `location:<id>` — managers for each of their assigned locations
- `admin` — admin users only

**Server → client events:**

| Event | Payload | Description |
| --- | --- | --- |
| `notification:new` | `Notification` | New in-app notification |
| `message:new` | `{ messageId, senderId, recipientId, type, locationId }` | New DM or announcement delivered to sender + recipient immediately |
| `typing:start` | `{ userId }` | Forwarded to the recipient when sender starts typing |
| `typing:stop` | `{ userId }` | Forwarded to the recipient when sender stops typing |
| `schedule:updated` | `{ locationId, shiftId, weekStart }` | Schedule changed for a location |
| `assignment:conflict` | `{ shiftId, staffId, message }` | Constraint violation on assignment |

**Client → server events:**

| Event | Payload | Description |
| --- | --- | --- |
| `typing:start` | `recipientId` | Notify recipient that sender is typing |
| `typing:stop` | `recipientId` | Notify recipient that sender stopped typing |
| `join_location` | `locationId` | Join a location room (validated against user's access) |

## Environment Variables

Copy `.env.example` to `.env` and fill in the blanks. All variables are validated at startup by Joi.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port the server listens on |
| `NODE_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:3000` | Used for CORS and email links |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USERNAME` | — | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_DATABASE` | `shift_sync` | Database name |
| `JWT_SECRET` | — | Secret for signing access tokens (≥ 32 chars) |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | — | Secret for refresh tokens (≥ 32 chars, different from JWT_SECRET) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `SMTP_HOST` | — | Email server host |
| `SMTP_PORT` | `587` | Email server port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | From address (e.g. `"ShiftSync <noreply@shiftsync.dev>"`) |
