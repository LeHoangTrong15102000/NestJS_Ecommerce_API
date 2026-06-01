# ADR-001: Monolith-First Architecture

**Date:** 2024-01-01
**Status:** Accepted

## Context

When starting the NestJS Ecommerce API, we needed to decide on the overall architectural style. The main options were:

1. Microservices from day one
2. Monolith-first, extract services later if needed

The project is a learning/portfolio project with a single development team. The domain is an e-commerce platform with well-understood bounded contexts (auth, catalog, orders, payments, chat).

## Decision

Build a monolith-first architecture. All modules live in a single NestJS application under `src/routes/`. Shared infrastructure (Prisma, Redis, BullMQ) is centralized in `src/shared/`.

The codebase is structured to make future extraction easier:

- Each module is self-contained with its own controller, service, repository, DTOs, and error definitions
- Cross-module dependencies go through shared repositories (`src/shared/repositories/`) rather than direct service injection
- Domain events (`src/events/`) decouple side effects from business logic, mimicking the event-driven patterns used in microservices

## Alternatives Considered

### Microservices from day one

**Rejected because:**

- Significant operational overhead (service discovery, inter-service communication, distributed tracing, separate deployments)
- Premature optimization — the domain boundaries are not yet proven in production
- Harder to develop and test locally (multiple processes, network calls between services)
- The team is small; microservices multiply coordination costs

### Modular monolith with NestJS modules as service boundaries

This is essentially what we built. NestJS modules provide clear boundaries. The difference from "true" microservices is that everything runs in one process and shares a database.

## Consequences

### Positive

- Simple local development: one `docker compose up -d` + one `pnpm run start:dev`
- Single database transaction spans the entire request — no distributed transaction complexity
- Easy to refactor across module boundaries (same codebase, same IDE)
- Fast test execution (no network calls between services)
- Straightforward deployment (single container)

### Negative / Trade-offs

- All modules share the same database — schema changes affect all modules
- A bug in one module can crash the entire application
- Scaling requires scaling the entire monolith, not individual hot paths
- If the team grows significantly, merge conflicts in shared files (`app.module.ts`, `prisma/schema.prisma`) become friction

### Migration Path

If a module needs to be extracted to a microservice:

1. The module already has a clear boundary (its own controller/service/repo)
2. Replace direct Prisma calls with an HTTP/gRPC client
3. Move the module's Prisma models to the new service's schema
4. Use the existing domain events as the async communication contract
