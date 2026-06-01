# Architecture

## Overview

NestJS Ecommerce API is a monolith-first REST API built with NestJS 11, Prisma 6, and PostgreSQL 17. It follows a layered architecture: controller → service → repository → Prisma. All modules live under `src/routes/` and share infrastructure from `src/shared/`.

## Module Map

| Module              | Path                                        | Responsibility                                                    |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| Auth                | `src/routes/auth/`                          | Registration, login, OTP, 2FA (TOTP), Google OAuth, token refresh |
| Language            | `src/routes/language/`                      | Supported locale management (en, vi, …)                           |
| Role                | `src/routes/role/`                          | RBAC role definitions and permission assignment                   |
| Permission          | `src/routes/permission/`                    | HTTP method + path permission records                             |
| Profile             | `src/routes/profile/`                       | Authenticated user's own profile read/update                      |
| User                | `src/routes/user/`                          | Admin user management (CRUD)                                      |
| Media               | `src/routes/media/`                         | File upload to S3 / local storage                                 |
| Brand               | `src/routes/brand/`                         | Product brand management                                          |
| BrandTranslation    | `src/routes/brand/brand-translation/`       | i18n translations for brands                                      |
| Category            | `src/routes/category/`                      | Product category tree                                             |
| CategoryTranslation | `src/routes/category/category-translation/` | i18n translations for categories                                  |
| Product             | `src/routes/product/`                       | Product + SKU catalog                                             |
| ProductTranslation  | `src/routes/product/product-translation/`   | i18n translations for products                                    |
| Cart                | `src/routes/cart/`                          | Shopping cart (add/update/remove SKUs)                            |
| Order               | `src/routes/order/`                         | Order lifecycle (pending → confirmed → cancelled)                 |
| Payment             | `src/routes/payment/`                       | Payment creation, webhook handling, 24h auto-cancel via BullMQ    |
| Conversation        | `src/routes/conversation/`                  | Chat conversation management                                      |
| Review              | `src/routes/review/`                        | Product reviews tied to completed orders                          |
| Address             | `src/routes/address/`                       | User shipping addresses (max 10 per user)                         |
| Voucher             | `src/routes/voucher/`                       | Discount voucher creation, collection, and application            |
| AIAssistant         | `src/routes/ai-assistant/`                  | Anthropic Claude integration for product Q&A                      |
| Wishlist            | `src/routes/wishlist/`                      | Wishlist items, collections, price alerts                         |

### Infrastructure Modules

| Module          | Path                  | Responsibility                                                                   |
| --------------- | --------------------- | -------------------------------------------------------------------------------- |
| SharedModule    | `src/shared/`         | PrismaService, TokenService, HashingService, guards, filters, pipes, decorators  |
| WebsocketModule | `src/websockets/`     | Socket.io gateways: `/chat` (EnhancedChatGateway) and `payment` (PaymentGateway) |
| EventBusModule  | `src/events/`         | Domain event definitions and handlers (EventEmitter2)                            |
| MetricsModule   | `src/shared/metrics/` | Prometheus metrics via `prom-client`                                             |
| HealthModule    | `src/health/`         | `@nestjs/terminus` health endpoint at `/health`                                  |
| RateLimitModule | `src/rate-limit/`     | Per-IP rate limiting (RateLimitGuard)                                            |
| Queues          | `src/queues/`         | BullMQ consumers: PaymentConsumer, WishlistConsumer                              |
| Cronjobs        | `src/cronjobs/`       | Scheduled tasks: refresh token cleanup, wishlist price check                     |

## Request Lifecycle

Every HTTP request passes through the following NestJS pipeline in order:

```
Incoming Request
      │
      ▼
  Middleware
  ├── x-request-id echo (sets response header)
  └── DeprecationMiddleware (adds Deprecation header on old API versions)
      │
      ▼
  Guards (global, registered in AppModule)
  ├── RateLimitGuard     — per-IP rate limiting (checked first)
  └── AuthenticationGuard — dispatches to AccessTokenGuard or PaymentAPIKeyGuard
                            based on @Auth() decorator metadata
      │
      ▼
  Interceptors
  ├── MetricsInterceptor  — records request count, duration, in-flight gauge
  └── ZodSerializerInterceptor — strips undeclared fields from response
      │
      ▼
  Pipes
  └── CustomZodValidationPipe — validates request body/query/params with Zod schemas
      │
      ▼
  Route Handler (Controller method)
      │
      ▼
  Exception Filters (executed in reverse registration order)
  ├── HttpExceptionFilter     — handles HttpException + ZodSerializationException
  └── CatchEverythingFilter   — fallback for Prisma errors and unknown exceptions
```

## Data Layer

```
HTTP Request
    │
    ▼
Controller  (validates input via Zod DTOs, calls service)
    │
    ▼
Service     (business logic, cache invalidation, event emission)
    │
    ▼
Repository  (Prisma queries, typed with model types from *.model.ts)
    │
    ▼
PrismaService → PostgreSQL
```

### File Naming Convention

Each module follows a consistent file structure:

```
<module>/
├── <module>.module.ts      # NestJS module definition
├── <module>.controller.ts  # HTTP handlers, @ZodResponse decorators
├── <module>.service.ts     # Business logic
├── <module>.repo.ts        # Prisma queries
├── <module>.dto.ts         # Zod schemas for request/response (nestjs-zod)
├── <module>.model.ts       # TypeScript types inferred from Zod schemas
├── <module>.error.ts       # Module-specific exception constants
└── __tests__/
    ├── <module>.controller.spec.ts
    ├── <module>.service.spec.ts
    └── <module>.repo.spec.ts
```

## Global Infrastructure

### Logging

`nestjs-pino` wraps Pino for structured JSON logging. In development, `pino-pretty` formats output with colors. Every request gets a `reqId` (from `x-request-id` header or auto-generated UUID). Log levels are set automatically: 5xx → error, 4xx → warn, 2xx/3xx → info.

### Caching

`@nestjs/cache-manager` backed by Redis (via `@keyv/redis`). Cache keys follow the pattern `role:<roleId>` for RBAC role permissions (TTL: 1 hour). Services invalidate their own cache keys on mutation.

### Validation

All request validation uses Zod schemas defined in `*.dto.ts` files. `nestjs-zod` bridges Zod with NestJS pipes and Swagger. Response serialization also uses Zod via `@ZodResponse()` decorator — undeclared fields are stripped automatically.

### Internationalization

`nestjs-i18n` with locale files in `src/i18n/`. Language resolved from `Accept-Language` header or `?lang=` query param. Fallback: `en`.

### Metrics

Prometheus metrics exposed at `GET /metrics` via `prom-client`. `MetricsInterceptor` records `http_requests_total`, `http_request_duration_seconds`, and `http_requests_in_flight`.

## Background Processing

### BullMQ Queues

Producers live in feature modules co-located with the business logic that enqueues jobs. Consumers live in `src/queues/` as standalone workers.

| Queue      | Producer                                                | Consumer           | Jobs                              |
| ---------- | ------------------------------------------------------- | ------------------ | --------------------------------- |
| `payment`  | `OrderProducer` (enqueues), `PaymentProducer` (removes) | `PaymentConsumer`  | `cancel-payment` (24h delay)      |
| `wishlist` | `WishlistProducer`                                      | `WishlistConsumer` | `price-check`, `send-price-alert` |

Queue and job name constants are centralized in `src/shared/constants/queue.constant.ts`.

### Cron Jobs

| Job                         | Schedule | Purpose                                         |
| --------------------------- | -------- | ----------------------------------------------- |
| `RemoveRefreshTokenCronjob` | Daily    | Purge expired refresh tokens from DB            |
| `WishlistPriceCheckCronjob` | Daily    | Check product prices against user target prices |

## Domain Events

Domain events (Phase 9) use `@nestjs/event-emitter` (EventEmitter2) for in-process pub/sub. Events are fire-and-forget for post-transaction side effects.

Event definitions live in `src/events/definitions/`. Handlers live in `src/events/handlers/`. All events extend `DomainEvent` base class from `src/events/domain-event.base.ts`.

Current events: `PaymentCompletedEvent`, `PaymentFailedEvent`, `ProductPriceChangedEvent`, `UserRegisteredEvent`.

See [event-system.md](./event-system.md) for full details.
