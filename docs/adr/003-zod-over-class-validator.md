# ADR-003: Zod over class-validator

**Date:** 2024-01-01
**Status:** Accepted

## Context

NestJS's default validation approach uses `class-validator` decorators on DTO classes combined with `ValidationPipe`. We needed to choose a validation library for request/response validation.

## Decision

Use **Zod** for all validation, bridged to NestJS via `nestjs-zod`.

The pattern:

1. Define Zod schemas in `*.model.ts` files
2. Infer TypeScript types with `z.infer<typeof Schema>`
3. Create NestJS-compatible DTO classes with `createZodDto(Schema)` in `*.dto.ts` files
4. Use `@ZodResponse({ type: ResDTO })` on controller methods for response validation
5. `CustomZodValidationPipe` (global) validates incoming requests

## Alternatives Considered

### class-validator + class-transformer (NestJS default)

**Rejected because:**

- Decorator-based validation is verbose and harder to compose
- Type inference is weaker — TypeScript types must be maintained separately from validation rules
- `class-transformer` has known security issues with prototype pollution (requires careful configuration)
- Schema reuse is awkward (inheritance vs. composition)
- No built-in support for discriminated unions, refinements, or transforms

### Joi

**Rejected because:**

- No TypeScript-first design — types are inferred but less precise than Zod
- Larger bundle size
- Less active community compared to Zod
- `nestjs-zod` doesn't support Joi; would need custom pipe

### Yup

**Rejected because:**

- Similar issues to Joi
- Slower than Zod
- Less precise TypeScript inference

## Consequences

### Positive

- Single source of truth: Zod schema defines both validation rules and TypeScript types
- Excellent TypeScript inference — `z.infer<>` gives precise types without duplication
- Composable: schemas can be merged, extended, and transformed with `.merge()`, `.extend()`, `.transform()`
- `nestjs-zod` provides `createZodDto()`, `ZodSerializerInterceptor`, and `@ZodResponse()` for seamless NestJS integration
- Response validation strips undeclared fields automatically (security benefit)
- Zod v4 (used in this project) has improved performance and smaller bundle size

### Negative / Trade-offs

- `nestjs-zod` is a third-party bridge — it adds a dependency and may lag behind NestJS major versions
- Swagger integration requires `nestjs-zod`'s `patchNestJsSwagger()` call in `main.ts`
- Developers familiar with `class-validator` need to learn Zod's API
- Error messages from Zod are in a different format than `class-validator` — the `CustomZodValidationPipe` normalizes them
- Some NestJS ecosystem libraries assume `class-validator` DTOs and may not work with Zod DTOs
