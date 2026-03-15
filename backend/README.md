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
| Real-time | Socket.IO via NestJS Gateway |
| Scheduling | `@nestjs/schedule` (10 cron jobs) |
| Validation | `class-validator` + `class-transformer` |
| Email | Nodemailer (SMTP) |
| Docs | Swagger (`@nestjs/swagger`) at `/api` |

## Quick Start

```bash
cp .env.example .env
npm install
npm run migration:run
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
| `npm run test` | Unit tests (Jest) |
| `npm run test:cov` | Coverage report |
| `npm run seed` | Reset DB and seed demo data |

## Module Overview

See [`src/README.md`](src/README.md) for the full module index.

Key modules: `shifts`, `users`, `notifications`, `swap-requests`, `drop-requests`, `timesheets`, `scheduler`.

## Auth Flow

1. `POST /auth/login` — returns a short-lived access token (JSON) + httpOnly refresh cookie
2. All protected routes require `Authorization: Bearer <access_token>`
3. `POST /auth/refresh` — issues a new access token using the refresh cookie
4. Access tokens expire in 15 min; refresh tokens in 7 days

## Environment Variables

| Variable | Description |
| --- | --- |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default 3306) |
| `DB_USER` | MySQL user |
| `DB_PASS` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `7d`) |
| `SMTP_HOST` | Email server host |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `FRONTEND_URL` | Used for CORS and email links |
