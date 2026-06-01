# Getting Started

This guide takes you from a fresh clone to a running NestJS Ecommerce API in under 10 minutes.

## Prerequisites

| Tool    | Version | Notes                           |
| ------- | ------- | ------------------------------- |
| Node.js | 22.x    | Check with `node -v`            |
| pnpm    | 10.x    | `npm i -g pnpm@10`              |
| Docker  | 24+     | Docker Desktop or Docker Engine |
| Git     | any     |                                 |

The project uses **pnpm** as its package manager (see `packageManager` field in `package.json`). Do not use `npm install` or `yarn`.

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd NestJS_Ecommerce_API
pnpm install
```

`pnpm install` also runs `prisma generate` automatically via the `postinstall` script.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values. The minimum set for local development:

```
DATABASE_URL="postgresql://ecom_user:ecom_password@localhost:5432/ecom_db?schema=public"
ACCESS_TOKEN_SECRET=<at-least-32-chars>
REFRESH_TOKEN_SECRET=<at-least-32-chars>
SECRET_API_KEY=<at-least-32-chars>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
REDIS_HOST=localhost
REDIS_PORT=6379
```

Generate secure secrets with: `openssl rand -base64 32`

### 3. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL 17 and Redis 7. The API container is also defined but you run the app locally with `pnpm run start:dev`.

### 4. Run database migrations

```bash
pnpm exec prisma migrate dev
```

### 5. Seed the database

```bash
pnpm run seed
```

This runs `initialScript/seed-all.ts` which creates all reference data in dependency order:
languages → roles & admin user → brands → categories → products → users → addresses → vouchers → orders → payments → reviews → wishlists → messages → conversations → AI assistant data.

**Seed credentials:**

- Admin email: value of `ADMIN_EMAIL` in your `.env` (default: `admin@example.com`)
- Admin password: value of `ADMIN_PASSWORD` in your `.env`

### 6. Start the development server

```bash
pnpm run start:dev
```

The server starts with hot-reload on port 3000 (configurable via `PORT` env var).

## Verification

After startup, verify the following:

**Health check:**

```
GET http://localhost:3000/health
```

Expected: `{ "status": "ok", ... }`

**Swagger UI:**

```
http://localhost:3000/api
```

The interactive API documentation lists all endpoints.

**Login with seed admin:**

```
POST http://localhost:3000/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

Expected: response with `accessToken` and `refreshToken`.

## Optional: Observability Stack

To start Prometheus, Grafana, and Jaeger alongside the core services:

```bash
docker compose --profile observability up -d
```

| Service    | URL                    |
| ---------- | ---------------------- |
| Grafana    | http://localhost:3001  |
| Prometheus | http://localhost:9090  |
| Jaeger UI  | http://localhost:16686 |

Default `docker compose up -d` (without `--profile observability`) only starts postgres and redis.

## Troubleshooting

### Port 5432 already in use

Another PostgreSQL instance is running locally. Either stop it or change the host port in `docker-compose.yml`:

```yaml
ports:
  - '5433:5432' # map to 5433 on host
```

Then update `DATABASE_URL` in `.env` to use port 5433.

### Port 6379 already in use

Same pattern — change the Redis host port in `docker-compose.yml` and update `REDIS_HOST`/`REDIS_PORT` in `.env`.

### Prisma migration errors

If you see `P3009` (failed migration) or schema drift:

```bash
pnpm exec prisma migrate reset   # drops and recreates the DB
pnpm run seed                    # re-seed after reset
```

### Redis connection refused

Ensure the Redis container is healthy:

```bash
docker compose ps
docker compose logs redis
```

### `pnpm run seed` fails with "relation does not exist"

Migrations have not been applied. Run `pnpm exec prisma migrate dev` first.

### TypeScript path alias errors (`src/...` not resolved)

The project uses `tsconfig-paths`. All `ts-node` scripts already include `-r tsconfig-paths/register`. If you run a script manually, add that flag.

## Next Steps

- Read [architecture.md](./architecture.md) for a module map and request lifecycle
- Read [auth-flow.md](./auth-flow.md) for authentication patterns
- Read [api-patterns.md](./api-patterns.md) for DTO, repository, and filter conventions
- Generate a new module: `pnpm run generate:module <name>`
