import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { MetricsModule } from '../metrics.module'

/**
 * Integration tests for GET /metrics.
 *
 * These tests spin up a minimal NestJS application containing only MetricsModule
 * and verify the HTTP-level contract: status code, content-type header, and
 * presence of expected metric names in the Prometheus text output.
 */
describe('GET /metrics (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should return HTTP 200', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(200)
  })

  it('should return Prometheus text content-type', async () => {
    const res = await request(app.getHttpServer()).get('/metrics')
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['content-type']).toContain('version=0.0.4')
  })

  it('should include nodejs_eventloop_lag_seconds in the body', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200)
    expect(res.text).toContain('nodejs_eventloop_lag_seconds')
  })

  it('should include http_requests_total in the body', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200)
    expect(res.text).toContain('http_requests_total')
  })

  it('should include app_info in the body', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200)
    expect(res.text).toContain('app_info')
  })
})
