import { Test, TestingModule } from '@nestjs/testing'
import { MetricsService } from '../metrics.service'

describe('MetricsService', () => {
  let service: MetricsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile()

    service = module.get<MetricsService>(MetricsService)
    // Trigger onModuleInit to register default metrics
    service.onModuleInit()
  })

  afterEach(() => {
    // Clear the registry after each test to avoid duplicate metric registration
    service.registry.clear()
  })

  describe('registry', () => {
    it('should have a dedicated registry', () => {
      expect(service.registry).toBeDefined()
    })

    it('should expose content type', () => {
      expect(service.getContentType()).toContain('text/plain')
    })
  })

  describe('http_requests_total counter', () => {
    it('should be registered', () => {
      expect(service.httpRequestsTotal).toBeDefined()
    })

    it('should increment on inc()', async () => {
      const labels = { method: 'GET', route: '/products', status_code: '200' }
      service.httpRequestsTotal.inc(labels)

      const metrics = await service.getMetrics()
      expect(metrics).toContain('http_requests_total')
    })

    it('should track separate label combinations', async () => {
      service.httpRequestsTotal.inc({ method: 'GET', route: '/products', status_code: '200' })
      service.httpRequestsTotal.inc({ method: 'POST', route: '/products', status_code: '201' })
      service.httpRequestsTotal.inc({ method: 'GET', route: '/products', status_code: '200' })

      const metrics = await service.getMetrics()
      expect(metrics).toContain('http_requests_total{method="GET",route="/products",status_code="200"} 2')
      expect(metrics).toContain('http_requests_total{method="POST",route="/products",status_code="201"} 1')
    })
  })

  describe('http_request_duration_seconds histogram', () => {
    it('should be registered', () => {
      expect(service.httpRequestDurationSeconds).toBeDefined()
    })

    it('should record observations', async () => {
      const labels = { method: 'GET', route: '/products', status_code: '200' }
      service.httpRequestDurationSeconds.observe(labels, 0.05)

      const metrics = await service.getMetrics()
      expect(metrics).toContain('http_request_duration_seconds_bucket')
      expect(metrics).toContain('le="0.1"')
      expect(metrics).toContain('le="1"')
    })

    it('should have correct buckets', async () => {
      service.httpRequestDurationSeconds.observe({ method: 'GET', route: '/test', status_code: '200' }, 0.1)

      const metrics = await service.getMetrics()
      // Verify standard buckets are present
      expect(metrics).toContain('le="0.005"')
      expect(metrics).toContain('le="0.01"')
      expect(metrics).toContain('le="0.025"')
      expect(metrics).toContain('le="0.05"')
      expect(metrics).toContain('le="0.1"')
      expect(metrics).toContain('le="0.25"')
      expect(metrics).toContain('le="0.5"')
      expect(metrics).toContain('le="1"')
      expect(metrics).toContain('le="2.5"')
      expect(metrics).toContain('le="5"')
      expect(metrics).toContain('le="10"')
    })
  })

  describe('http_requests_in_flight gauge', () => {
    it('should be registered', () => {
      expect(service.httpRequestsInFlight).toBeDefined()
    })

    it('should increment and decrement', async () => {
      service.httpRequestsInFlight.inc()
      service.httpRequestsInFlight.inc()

      let metrics = await service.getMetrics()
      expect(metrics).toContain('http_requests_in_flight 2')

      service.httpRequestsInFlight.dec()
      metrics = await service.getMetrics()
      expect(metrics).toContain('http_requests_in_flight 1')
    })
  })

  describe('app_info gauge', () => {
    it('should be registered with correct labels', async () => {
      const metrics = await service.getMetrics()
      expect(metrics).toContain('app_info{')
      expect(metrics).toContain('version=')
      expect(metrics).toContain('node_env=')
    })

    it('should have value 1', async () => {
      const metrics = await service.getMetrics()
      // app_info gauge should have value 1
      expect(metrics).toMatch(/app_info\{[^}]+\} 1/)
    })
  })

  describe('getMetrics', () => {
    it('should return prometheus text format', async () => {
      const metrics = await service.getMetrics()
      expect(typeof metrics).toBe('string')
      expect(metrics.length).toBeGreaterThan(0)
    })

    it('should include nodejs default metrics after init', async () => {
      const metrics = await service.getMetrics()
      expect(metrics).toContain('nodejs_eventloop_lag_seconds')
    })
  })
})
