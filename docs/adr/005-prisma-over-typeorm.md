# ADR-005: Prisma over TypeORM

**Date:** 2024-01-01
**Status:** Accepted

## Context

The application needs an ORM/query builder for PostgreSQL. The two main options in the NestJS ecosystem are TypeORM (the NestJS default) and Prisma.

## Decision

Use **Prisma** as the ORM.

The schema is defined in `prisma/schema.prisma`. Migrations are managed with `prisma migrate dev` (development) and `prisma migrate deploy` (production). The `PrismaService` in `src/shared/services/prisma.service.ts` extends `PrismaClient` and is injected into all repositories.

## Alternatives Considered

### TypeORM

**Rejected because:**

- Decorator-based entity definitions mix schema and business logic
- TypeScript types are less precise — `@Column()` decorators don't enforce type safety at compile time
- Migrations are less reliable — TypeORM's auto-migration can generate incorrect SQL for complex schema changes
- Query builder API is verbose and error-prone for complex joins
- Active Record pattern (entity methods) encourages fat models that are harder to test

### MikroORM

**Rejected because:**

- Smaller community and ecosystem than Prisma
- Less documentation and fewer examples
- Identity map pattern adds complexity
- Less mature NestJS integration

### Knex (query builder, no ORM)

**Rejected because:**

- No schema management — would need a separate migration tool
- No type safety for query results without additional tooling
- More boilerplate for common operations (CRUD)

### Drizzle ORM

**Considered but not chosen at project start:**

- Drizzle was less mature when the project started
- Prisma had better NestJS ecosystem support at the time

## Consequences

### Positive

- Schema-first: `prisma/schema.prisma` is the single source of truth for the database schema
- Generated `PrismaClient` provides fully typed query results — no manual type definitions for DB models
- Prisma Migrate generates deterministic SQL migrations — easy to review and version control
- Excellent NestJS integration: `PrismaService` extends `PrismaClient` directly
- Prisma Studio provides a GUI for browsing data during development
- `prisma generate` runs automatically on `pnpm install` via `postinstall` script
- `prisma-json-types-generator` (in devDependencies) generates TypeScript types for JSON fields

### Negative / Trade-offs

- Prisma generates a large `PrismaClient` — cold start time is slightly higher than raw SQL
- No support for complex SQL features without raw queries (`$queryRaw`, `$executeRaw`)
- Schema changes require running `prisma migrate dev` — cannot use `synchronize: true` like TypeORM
- Prisma's relation loading is explicit (no lazy loading) — all includes must be specified upfront
- `PrismaClient` is a singleton — connection pooling is managed by Prisma, not the application
- Prisma v6 (used in this project) requires Node.js 18+ and has breaking changes from v5
