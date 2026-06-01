# API Patterns

## Overview

This document describes the conventions used across all modules: DTOs, repositories, filters, and response shapes. Follow these patterns when adding new endpoints or modules.

## DTO Pattern (Zod + nestjs-zod)

The project uses Zod for all validation, bridged to NestJS via `nestjs-zod`. There are three layers:

### 1. Model file (`*.model.ts`) — Zod schemas and inferred types

```typescript
// wishlist.model.ts
import { z } from 'zod'

export const AddWishlistItemBodySchema = z.object({
  productId: z.number().int().positive(),
  skuId: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
})

// Infer TypeScript type from schema
export type AddWishlistItemBodyType = z.infer<typeof AddWishlistItemBodySchema>
```

### 2. DTO file (`*.dto.ts`) — NestJS-compatible classes via `createZodDto`

```typescript
// wishlist.dto.ts
import { createZodDto } from 'nestjs-zod'
import { AddWishlistItemBodySchema } from './wishlist.model'

export class AddWishlistItemBodyDTO extends createZodDto(AddWishlistItemBodySchema) {}
```

### 3. Controller — use DTO classes for parameter types, model types for service calls

```typescript
// wishlist.controller.ts
@Post('items')
@ZodResponse({ type: AddWishlistItemResDTO })
async addItem(
  @ActiveUser('userId') userId: number,
  @Body() body: AddWishlistItemBodyDTO,  // ← DTO class for NestJS binding
) {
  return this.wishlistService.addItem(userId, body)  // body is typed as AddWishlistItemBodyType
}
```

### `@ZodResponse({ type: ResDTO })`

Applied to every controller method. `ZodSerializerInterceptor` uses this to strip undeclared fields from the response. If the response doesn't match the schema, `ZodSerializationException` is thrown and logged.

## Repository Pattern

Repositories (`*.repo.ts`) are the only layer that touches Prisma directly. Services call repositories; controllers never call repositories directly.

```typescript
@Injectable()
export class WishlistRepo {
  constructor(private readonly prismaService: PrismaService) {}

  async addItem(userId: number, data: AddWishlistItemBodyType): Promise<AddWishlistItemResType> {
    return this.prismaService.wishlistItem.create({
      data: { userId, ...data },
      include: WISHLIST_ITEM_INCLUDE,
    })
  }
}
```

### Shared Repositories

Cross-module repositories live in `src/shared/repositories/`:

- `SharedUserRepository` — user lookups used by auth and other modules
- `SharedRoleRepository` — role lookups
- `SharedPaymentRepository` — payment operations used by the queue consumer

### Transaction Pattern

For operations that span multiple tables, use Prisma's `$transaction`:

```typescript
async cancelPaymentAndOrder(paymentId: number) {
  return this.prismaService.$transaction(async (tx) => {
    const payment = await tx.payment.update({ where: { id: paymentId }, data: { status: 'CANCELLED' } })
    await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CANCELLED' } })
    return payment
  })
}
```

## Error Pattern

Errors are exported as constants from `*.error.ts` files. There are two styles in the codebase:

### Style 1: NestJS exception instances (most modules)

```typescript
// auth.error.ts
import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'

export const InvalidOTPException = new UnprocessableEntityException([{ message: 'Error.InvalidOTP', path: 'code' }])

export const RefreshTokenAlreadyUsedException = new UnauthorizedException('Error.RefreshTokenAlreadyUsed')
```

Throw by reference (not `new`):

```typescript
throw InvalidOTPException
```

### Style 2: Error object map with `createErrorObject` (address, voucher modules)

```typescript
// address.error.ts
import { HttpStatus } from '@nestjs/common'
import { createErrorObject } from '../../shared/error'

export const ADDRESS_ERRORS = {
  ADDRESS_NOT_FOUND: createErrorObject({
    message: 'Address not found',
    statusCode: HttpStatus.NOT_FOUND,
    errorCode: 'ADDRESS_NOT_FOUND',
  }),
}
```

`createErrorObject` is defined in `src/shared/error.ts` and returns `{ message, statusCode, errorCode }`.

### Shared errors

`src/shared/error.ts` exports:

- `NotFoundRecordException` — generic 404
- `InvalidPasswordException` — 422 with path `password`
- `createErrorObject(...)` — helper for error object maps

## Filter Pattern

Two global exception filters are registered in `AppModule` (in reverse execution order):

1. `HttpExceptionFilter` — handles `HttpException` and `ZodSerializationException`. Logs serialization errors.
2. `CatchEverythingFilter` — fallback for Prisma errors and unknown exceptions. Maps Prisma error codes to HTTP responses.

Filters execute in reverse registration order: `HttpExceptionFilter` runs first (registered second), `CatchEverythingFilter` runs last (registered first).

## Response Shape

### Success responses

Shaped by the `@ZodResponse({ type: ResDTO })` decorator. The response body matches the Zod schema exactly — extra fields are stripped.

### Error responses

**HttpException (4xx/5xx):**

```json
{
  "statusCode": 422,
  "message": [{ "message": "Error.InvalidOTP", "path": "code" }],
  "error": "Unprocessable Entity"
}
```

**Single-message errors:**

```json
{
  "statusCode": 401,
  "message": "Error.RefreshTokenAlreadyUsed"
}
```

**Validation errors (Zod pipe):**

```json
{
  "statusCode": 400,
  "message": [{ "path": ["email"], "message": "Invalid email" }]
}
```

## Pagination Pattern

List endpoints use cursor-based or offset pagination. Query DTOs typically include:

```typescript
const GetItemsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
```

Response DTOs include `data` array and `totalItems` (or similar metadata).

## Caching Pattern

Services use `@nestjs/cache-manager` for read-heavy data:

```typescript
@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepo: WishlistRepo,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getItems(userId: number, query: GetWishlistItemsQueryType) {
    const cacheKey = `wishlist:${userId}:items`
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached

    const result = await this.wishlistRepo.getItems(userId, query)
    await this.cacheManager.set(cacheKey, result, CACHE_TTL)
    return result
  }

  private async invalidateWishlistCache(userId: number) {
    await this.cacheManager.del(`wishlist:${userId}:items`)
  }
}
```

Cache TTL constants are in `src/shared/constants/app.constant.ts`.

## Module Registration Pattern

Every feature module follows this structure:

```typescript
@Module({
  imports: [
    // Optional: BullModule.registerQueue({ name: QUEUE_NAME }) if module has a queue
  ],
  providers: [FeatureService, FeatureRepo],
  controllers: [FeatureController],
  exports: [FeatureService], // only if other modules need it
})
export class FeatureModule {}
```

Modules are registered in `AppModule`'s `imports` array. `SharedModule` is imported globally and provides `PrismaService`, `TokenService`, `HashingService`, etc.

## i18n Pattern

Error messages use i18n keys (e.g., `Error.InvalidOTP`). Translation files live in `src/i18n/`. The `nestjs-i18n` module resolves the language from `Accept-Language` header or `?lang=` query param.

## Soft Delete Pattern

Most entities use soft delete via a `deletedAt` nullable timestamp. Queries filter with `deletedAt: null` to exclude deleted records. The `isActive` field is used for roles and permissions.
