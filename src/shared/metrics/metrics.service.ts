import { Injectable, OnModuleInit } from '@nestjs/common'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../../package.json') as { version: string }

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry: Registry

  readonly httpRequestsTotal: Counter<string>
  readonly httpRequestDurationSeconds: Histogram<string>
  readonly httpRequestsInFlight: Gauge<string>
  readonly appInfo: Gauge<string>

  constructor() {
    this.registry = new Registry()

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    })

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    })

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [this.registry],
    })

    this.appInfo = new Gauge({
      name: 'app_info',
      help: 'Application information',
      labelNames: ['version', 'node_env'],
      registers: [this.registry],
    })
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry })

    this.appInfo.labels(packageJson.version, process.env.NODE_ENV ?? 'development').set(1)
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }

  getContentType(): string {
    return this.registry.contentType
  }
}
