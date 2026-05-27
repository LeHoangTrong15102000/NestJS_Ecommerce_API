import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import envConfig from 'src/shared/config'

/**
 * DeprecationMiddleware — redirects unversioned API paths to their /v1/ equivalents.
 *
 * Activated when API_DEPRECATION_REDIRECT=true. This allows existing clients that
 * use unversioned paths (e.g. /auth/login) to continue working during the transition
 * period while the API moves to URI versioning (/v1/auth/login).
 *
 * Excluded paths (never redirected):
 *   /v1/...   — already versioned
 *   /health   — unversioned by design (VERSION_NEUTRAL)
 *   /metrics  — unversioned by design (VERSION_NEUTRAL)
 *   /api      — Swagger UI
 */
@Injectable()
export class DeprecationMiddleware implements NestMiddleware {
  private static readonly EXCLUDED_PREFIXES = ['/v', '/health', '/metrics', '/api']

  use(req: Request, res: Response, next: NextFunction): void {
    if (!envConfig.API_DEPRECATION_REDIRECT) {
      return next()
    }

    const url = req.url ?? req.path ?? ''

    // Skip if already versioned or excluded
    const isExcluded = DeprecationMiddleware.EXCLUDED_PREFIXES.some((prefix) => url.startsWith(prefix))
    if (isExcluded) {
      return next()
    }

    // Redirect /some/path → /v1/some/path (preserve query string)
    const redirectUrl = `/v1${url}`
    res.redirect(308, redirectUrl) // 308 Permanent Redirect preserves method + body
  }
}
