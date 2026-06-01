# ADR-004: Pino Structured Logging

**Date:** 2024-01-01
**Status:** Accepted

## Context

NestJS ships with a built-in logger that writes plain text to stdout. For a production application, we need structured logging (JSON) that integrates with log aggregation systems (Datadog, Loki, CloudWatch, etc.) and supports log levels, request correlation, and performance.

## Decision

Use **Pino** via `nestjs-pino` for all application logging.

Configuration in `AppModule`:

- JSON output in production
- `pino-pretty` colored output in development
- Auto-generated `reqId` from `x-request-id` header (or UUID if not present)
- Log level set automatically: 5xx → error, 4xx → warn, 2xx/3xx → info
- Request serializer strips sensitive fields (only logs method, url, query, params)
- Response serializer logs only statusCode

Inject the logger in services and guards with `@InjectPinoLogger(ClassName.name)`.

## Alternatives Considered

### NestJS built-in Logger

**Rejected because:**

- Plain text output — not parseable by log aggregation tools
- No structured fields (no JSON)
- No request correlation out of the box
- Slower than Pino (synchronous writes)

### Winston

**Rejected because:**

- More configuration required for structured JSON output
- Slower than Pino (Pino is the fastest Node.js logger by benchmark)
- `nestjs-winston` integration is less seamless than `nestjs-pino`
- Winston's transport system adds complexity for simple use cases

### Morgan (HTTP request logging only)

**Rejected because:**

- Only logs HTTP requests, not application-level events
- Plain text format
- Would need to be combined with another logger for application logs

## Consequences

### Positive

- Pino is the fastest Node.js logger — minimal performance overhead
- JSON output is directly ingestible by Datadog, Loki, CloudWatch, Splunk
- `nestjs-pino` provides `@InjectPinoLogger()` decorator for per-class loggers with automatic context
- `pino-pretty` makes development logs readable without changing production config
- Request correlation via `reqId` makes it easy to trace a request across log lines
- `x-request-id` header is echoed in responses (via middleware in `AppModule`) for client-side correlation

### Negative / Trade-offs

- Pino writes asynchronously — in rare crash scenarios, the last few log lines may be lost
- JSON logs are harder to read in raw form without `pino-pretty` or a log viewer
- `nestjs-pino` wraps Pino's API — some advanced Pino features require accessing the underlying instance
- Developers must use `@InjectPinoLogger()` instead of NestJS's `Logger` — a minor learning curve
