import { SetMetadata } from '@nestjs/common'

export type RateLimitTier = 'auth' | 'write' | 'read' | 'public'

export const RATE_LIMIT_TIER_KEY = 'rate_limit_tier'

/**
 * Apply a named rate-limit tier to a controller or handler.
 *
 * Tiers:
 *   auth   — 5 req/min per IP  (login, register, forgot-password, OTP)
 *   write  — 10 req/min per user ID  (POST/PUT/DELETE on orders, payments, products)
 *   read   — 60 req/min per user ID  (GET on products, orders, categories, brands)
 *   public — unlimited  (health, metrics, swagger)
 */
export const RateLimit = (tier: RateLimitTier) => SetMetadata(RATE_LIMIT_TIER_KEY, tier)
