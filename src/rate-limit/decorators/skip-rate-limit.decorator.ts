import { SetMetadata } from '@nestjs/common'

export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit'

/**
 * Skip rate limiting entirely for a controller or handler.
 * Use on health, metrics, and swagger endpoints.
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true)
