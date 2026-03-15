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

Key modules: `shifts`, `users`, `notifications`, `swap-requests`, `drop-requests`, `timesheets`, `scheduler`.

## Auth Flow

1. `POST /auth/login` — returns a short-lived access token (JSON) + httpOnly refresh cookie
2. All protected routes require `Authorization: Bearer <access_token>`
3. `POST /auth/refresh` — issues a new access token using the refresh cookie
4. Access tokens expire in 15 min; refresh tokens in 7 days

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
