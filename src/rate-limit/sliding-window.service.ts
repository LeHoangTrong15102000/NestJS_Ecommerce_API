import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import envConfig from 'src/shared/config'

export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** Unix timestamp (seconds) when the oldest request in the window expires */
  resetAt: number
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  auth: { limit: 5, windowMs: 60_000 },
  write: { limit: 10, windowMs: 60_000 },
  read: { limit: 60, windowMs: 60_000 },
  public: { limit: Infinity, windowMs: 60_000 },
}

/**
 * Lua script for atomic sliding-window rate limiting using a Redis sorted set.
 *
 * KEYS[1] = sorted set key  (rl:{tier}:{identifier})
 * ARGV[1] = current timestamp in ms
 * ARGV[2] = window size in ms
 * ARGV[3] = limit
 * ARGV[4] = TTL for the key in seconds (window * 2 for safety)
 *
 * Returns: [allowed (0|1), count_after_add, oldest_score_or_0]
 */
const SLIDING_WINDOW_SCRIPT = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local window     = tonumber(ARGV[2])
local limit      = tonumber(ARGV[3])
local ttl        = tonumber(ARGV[4])
local cutoff     = now - window

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

-- Count current entries
local count = redis.call('ZCARD', key)

if count >= limit then
  -- Over limit — get oldest entry to compute reset time
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_score = oldest[2] and tonumber(oldest[2]) or now
  return {0, count, oldest_score}
end

-- Under limit — add this request
redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
redis.call('EXPIRE', key, ttl)

local new_count = count + 1
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_score = oldest[2] and tonumber(oldest[2]) or now
return {1, new_count, oldest_score}
`

@Injectable()
export class SlidingWindowService implements OnModuleDestroy {
  private readonly logger = new Logger(SlidingWindowService.name)
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis(envConfig.REDIS_URL, {
      connectTimeout: 15000,
      commandTimeout: 5000,
      retryStrategy: (times: number) => {
        if (times > 10) {
          this.logger.error(`Rate-limit Redis: max retries (${times}) reached`)
          return null
        }
        return Math.min(times * 200, 5000)
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    this.redis.on('connect', () => this.logger.log('Rate-limit Redis connected'))
    this.redis.on('error', (err) => this.logger.error('Rate-limit Redis error', err))
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit()
      this.logger.log('Rate-limit Redis disconnected gracefully')
    } catch (err) {
      this.logger.error('Error disconnecting rate-limit Redis', err)
    }
  }

  async check(tier: string, identifier: string): Promise<RateLimitResult> {
    const config = RATE_LIMIT_TIERS[tier] ?? RATE_LIMIT_TIERS['read']

    // Public tier is always allowed — skip Redis call
    if (config.limit === Infinity) {
      return { allowed: true, limit: Infinity, remaining: Infinity, resetAt: 0 }
    }

    const key = `rl:${tier}:${identifier}`
    const now = Date.now()
    const ttlSeconds = Math.ceil((config.windowMs * 2) / 1000)

    try {
      const result = (await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(now),
        String(config.windowMs),
        String(config.limit),
        String(ttlSeconds),
      )) as [number, number, number]

      const [allowed, count, oldestScore] = result
      const resetAt = Math.ceil((oldestScore + config.windowMs) / 1000)

      return {
        allowed: allowed === 1,
        limit: config.limit,
        remaining: Math.max(0, config.limit - count),
        resetAt,
      }
    } catch (err) {
      // On Redis failure, fail open (allow the request) to avoid blocking all traffic
      this.logger.error('Rate-limit Redis eval failed, failing open', err)
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        resetAt: Math.ceil((now + config.windowMs) / 1000),
      }
    }
  }
}
