import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request, Response } from 'express'
import crypto from 'crypto'
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import { AccessTokenPayload } from 'src/shared/types/jwt.type'
import envConfig from 'src/shared/config'
import { RATE_LIMIT_TIER_KEY, RateLimitTier } from './decorators/rate-limit.decorator'
import { SKIP_RATE_LIMIT_KEY } from './decorators/skip-rate-limit.decorator'
import { SlidingWindowService } from './sliding-window.service'

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly slidingWindow: SlidingWindowService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @SkipRateLimit() on handler or class
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (skip) return true

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    // Internal API key bypass — service-to-service calls
    if (envConfig.INTERNAL_API_KEY) {
      const internalKey = request.headers['x-internal-key']
      if (typeof internalKey === 'string') {
        const a = Buffer.from(internalKey)
        const b = Buffer.from(envConfig.INTERNAL_API_KEY)
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true
        }
      }
    }

    // Determine tier from @RateLimit() decorator (handler first, then class)
    const tier = this.reflector.getAllAndOverride<RateLimitTier | undefined>(RATE_LIMIT_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Determine identifier and effective tier
    const user: AccessTokenPayload | undefined = (request as any)[REQUEST_USER_KEY]
    const effectiveTier = this.resolveEffectiveTier(tier, user, request)
    const identifier = this.resolveIdentifier(effectiveTier, user, request)

    // Skip Redis call for public tier
    if (effectiveTier === 'public') return true

    const result = await this.slidingWindow.check(effectiveTier, identifier)

    // Set rate limit response headers
    if (result.limit !== Infinity) {
      response.setHeader('X-RateLimit-Limit', String(result.limit))
      response.setHeader('X-RateLimit-Remaining', String(result.remaining))
      response.setHeader('X-RateLimit-Reset', String(result.resetAt))
    }

    if (!result.allowed) {
      const retryAfter = Math.max(0, result.resetAt - Math.floor(Date.now() / 1000))
      response.setHeader('Retry-After', String(retryAfter))
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    return true
  }

  private resolveEffectiveTier(
    tier: RateLimitTier | undefined,
    user: AccessTokenPayload | undefined,
    request: Request,
  ): RateLimitTier {
    if (tier) return tier
    // No explicit tier — fall back based on auth state
    // Authenticated → read tier; unauthenticated → read tier (IP-based)
    return 'read'
  }

  private resolveIdentifier(tier: RateLimitTier, user: AccessTokenPayload | undefined, request: Request): string {
    if (tier === 'auth') {
      // Auth endpoints always use IP
      return this.getClientIp(request)
    }
    if (user?.userId) {
      return `user:${user.userId}`
    }
    // Unauthenticated — fall back to IP
    return this.getClientIp(request)
  }

  private getClientIp(request: Request): string {
    // req.ips is populated by Express when trust proxy is enabled
    const ips = (request as any).ips as string[] | undefined
    return ips?.length ? ips[0] : ((request as any).ip ?? 'unknown')
  }
}
