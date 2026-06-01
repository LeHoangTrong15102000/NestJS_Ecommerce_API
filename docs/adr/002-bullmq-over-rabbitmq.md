# ADR-002: BullMQ over RabbitMQ / Kafka

**Date:** 2024-01-01
**Status:** Accepted

## Context

The application needs a background job queue for:

1. Delayed payment cancellation (cancel unpaid orders after 24 hours)
2. Wishlist price alert notifications
3. Potential future use: email sending, report generation, data exports

We needed to choose a queue/messaging system.

## Decision

Use **BullMQ** backed by Redis (the same Redis instance already used for caching).

BullMQ is integrated via `@nestjs/bullmq`. Producers live in feature modules (`src/routes/payment/payment.producer.ts`). Consumers live in `src/queues/` as standalone workers. Queue and job name constants are centralized in `src/shared/constants/queue.constant.ts`.

## Alternatives Considered

### RabbitMQ

**Rejected because:**

- Requires a separate infrastructure service (another container to manage)
- More complex setup: exchanges, bindings, routing keys, dead-letter queues
- Overkill for the current use cases (delayed jobs, simple background tasks)
- NestJS's `@nestjs/microservices` RabbitMQ transport adds abstraction overhead

### Apache Kafka

**Rejected because:**

- Designed for high-throughput event streaming, not job queues
- Significant operational complexity (ZooKeeper or KRaft, partition management, consumer groups)
- Retention-based model doesn't map cleanly to "process this job once and remove it"
- Far too heavy for a single-team e-commerce project

### Bull (v3, predecessor to BullMQ)

**Rejected because:**

- BullMQ is the actively maintained successor with better TypeScript support
- BullMQ has a cleaner API with `WorkerHost` base class
- Bull v3 is in maintenance mode

### Database-backed queues (e.g., pg-boss)

**Rejected because:**

- Adds load to the primary PostgreSQL database
- Redis is already in the stack for caching — reusing it for queues avoids adding another dependency

## Consequences

### Positive

- No additional infrastructure: Redis is already required for caching and Socket.io adapter
- BullMQ has excellent NestJS integration via `@nestjs/bullmq`
- Built-in retry with exponential backoff, job delay, job deduplication (by job ID)
- Bull Board UI available for job monitoring (not yet added, but easy to add)
- Delayed jobs are a first-class feature — the 24h payment cancel delay is a single `delay` option

### Negative / Trade-offs

- Redis is now a critical dependency: if Redis goes down, both caching and queues fail
- BullMQ is not a true message broker — no fan-out, no topic subscriptions, no cross-service messaging
- If the application ever needs cross-service messaging (microservices), BullMQ would need to be supplemented or replaced
- Job data is stored in Redis memory — large payloads should be avoided (store IDs, not full objects)
