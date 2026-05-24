import { CallHandler, ExecutionContext } from '@nestjs/common'
import { of, throwError } from 'rxjs'
import { MetricsInterceptor } from '../metrics.interceptor'
import { MetricsService } from '../metrics.service'

const createMockMetricsService = () => ({
  httpRequestsTotal: {
    inc: jest.fn(),
  },
  httpRequestDurationSeconds: {
    observe: jest.fn(),
  },
  httpRequestsInFlight: {
    inc: jest.fn(),
    dec: jest.fn(),
  },
})

const createMockExecutionContext = (path: string, method = 'GET', statusCode = 200): ExecutionContext => {
  const req = {
    method,
    path,
    route: { path },
  }
  const res = { statusCode }

  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext
}

const createMockCallHandler = (value: unknown = {}): CallHandler => ({
  handle: () => of(value),
})

const createErrorCallHandler = (error: Error): CallHandler => ({
  handle: () => throwError(() => error),
})

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor
  let mockMetricsService: ReturnType<typeof createMockMetricsService>

  beforeEach(() => {
    mockMetricsService = createMockMetricsService()
    interceptor = new MetricsInterceptor(mockMetricsService as unknown as MetricsService)
  })

  describe('self-exclusion', () => {
    it('should skip recording for /metrics route', (done) => {
      const ctx = createMockExecutionContext('/metrics')
      const handler = createMockCallHandler()

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsInFlight.inc).not.toHaveBeenCalled()
          expect(mockMetricsService.httpRequestsTotal.inc).not.toHaveBeenCalled()
          expect(mockMetricsService.httpRequestDurationSeconds.observe).not.toHaveBeenCalled()
          done()
        },
      })
    })
  })

  describe('normal request recording', () => {
    it('should increment in-flight gauge on entry', (done) => {
      const ctx = createMockExecutionContext('/products')
      const handler = createMockCallHandler()

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsInFlight.inc).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should decrement in-flight gauge after completion', (done) => {
      const ctx = createMockExecutionContext('/products')
      const handler = createMockCallHandler()

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsInFlight.dec).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should record http_requests_total with correct labels', (done) => {
      const ctx = createMockExecutionContext('/products/:id', 'GET', 200)
      const handler = createMockCallHandler()

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/products/:id',
            status_code: '200',
          })
          done()
        },
      })
    })

    it('should use route pattern not actual URL', (done) => {
      const req = {
        method: 'GET',
        path: '/products/123',
        route: { path: '/products/:id' },
      }
      const res = { statusCode: 200 }
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext

      interceptor.intercept(ctx, createMockCallHandler()).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ route: '/products/:id' }),
          )
          done()
        },
      })
    })

    it('should record duration observation', (done) => {
      const ctx = createMockExecutionContext('/products')
      const handler = createMockCallHandler()

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestDurationSeconds.observe).toHaveBeenCalledTimes(1)
          const [labels, duration] = (mockMetricsService.httpRequestDurationSeconds.observe as jest.Mock).mock.calls[0]
          expect(labels).toMatchObject({ method: 'GET', route: '/products' })
          expect(typeof duration).toBe('number')
          expect(duration).toBeGreaterThanOrEqual(0)
          done()
        },
      })
    })
  })

  describe('error handling', () => {
    it('should decrement in-flight gauge on error', (done) => {
      const ctx = createMockExecutionContext('/products')
      const handler = createErrorCallHandler(new Error('test error'))

      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          expect(mockMetricsService.httpRequestsInFlight.dec).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })

    it('should record metrics on error', (done) => {
      const ctx = createMockExecutionContext('/products')
      const handler = createErrorCallHandler(new Error('test error'))

      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledTimes(1)
          done()
        },
      })
    })
  })
})
