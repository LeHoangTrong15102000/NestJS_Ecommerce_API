import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Request } from 'express'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { MetricsService } from './metrics.service'

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>()
    const res = context.switchToHttp().getResponse<{ statusCode: number }>()

    const route: string = (req.route as { path?: string } | undefined)?.path ?? req.path

    // Skip recording metrics for the /metrics endpoint itself
    if (route === '/metrics') {
      return next.handle()
    }

    const startTime = process.hrtime.bigint()
    this.metricsService.httpRequestsInFlight.inc()

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(req.method, route, res.statusCode, startTime)
        },
        error: () => {
          this.recordMetrics(req.method, route, res.statusCode || 500, startTime)
        },
      }),
    )
  }

  private recordMetrics(method: string, route: string, statusCode: number, startTime: bigint): void {
    this.metricsService.httpRequestsInFlight.dec()

    const durationNs = process.hrtime.bigint() - startTime
    const durationSeconds = Number(durationNs) / 1e9
    const labels = { method, route, status_code: String(statusCode) }

    this.metricsService.httpRequestsTotal.inc(labels)
    this.metricsService.httpRequestDurationSeconds.observe(labels, durationSeconds)
  }
}
