import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DiskHealthIndicator, HealthCheckError, MemoryHealthIndicator, TerminusModule } from '@nestjs/terminus'
import request from 'supertest'
import { HealthController } from '../health.controller'
import { HealthService } from '../health.service'
import { BullMQHealthIndicator } from '../indicators/bullmq.health-indicator'
import { PrismaHealthIndicator } from '../indicators/prisma.health-indicator'
import { RedisHealthIndicator } from '../indicators/redis.health-indicator'

/**
 * Integration tests for GET /health/readiness.
 *
 * These tests spin up a minimal NestJS application with TerminusModule and
 * mocked health indicators to verify the HTTP-level contract without requiring
 * real database or Redis connections.
 */
describe('GET /health/readiness (integration)', () => {
  let app: INestApplication
  let mockPrismaIndicator: { isHealthy: jest.Mock }
  let mockRedisIndicator: { isHealthy: jest.Mock }
  let mockBullmqIndicator: { isHealthy: jest.Mock }
  let mockMemoryIndicator: { checkHeap: jest.Mock }
  let mockDiskIndicator: { checkStorage: jest.Mock }

  const buildApp = async (): Promise<INestApplication> => {
    mockPrismaIndicator = { isHealthy: jest.fn() }
    mockRedisIndicator = { isHealthy: jest.fn() }
    mockBullmqIndicator = { isHealthy: jest.fn() }
    mockMemoryIndicator = { checkHeap: jest.fn() }
    mockDiskIndicator = { checkStorage: jest.fn() }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaHealthIndicator, useValue: mockPrismaIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
        { provide: BullMQHealthIndicator, useValue: mockBullmqIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskIndicator },
      ],
    }).compile()

    const nestApp = moduleFixture.createNestApplication()
    await nestApp.init()
    return nestApp
  }

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  describe('when all indicators pass', () => {
    beforeEach(async () => {
      app = await buildApp()

      mockPrismaIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } })
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })
      mockBullmqIndicator.isHealthy.mockResolvedValue({ bullmq: { status: 'up' } })
      mockMemoryIndicator.checkHeap.mockResolvedValue({ memory_heap: { status: 'up' } })
      mockDiskIndicator.checkStorage.mockResolvedValue({ storage: { status: 'up' } })
    })

    it('should return HTTP 200', async () => {
      await request(app.getHttpServer()).get('/health/readiness').expect(200)
    })

    it('should return a Terminus health check body with status ok', async () => {
      const res = await request(app.getHttpServer()).get('/health/readiness').expect(200)

      expect(res.body).toHaveProperty('status', 'ok')
      expect(res.body).toHaveProperty('info')
      expect(res.body).toHaveProperty('details')
    })

    it('should include all indicator keys in the response', async () => {
      const res = await request(app.getHttpServer()).get('/health/readiness').expect(200)

      expect(res.body.info).toHaveProperty('database')
      expect(res.body.info).toHaveProperty('redis')
      expect(res.body.info).toHaveProperty('bullmq')
    })
  })

  describe('when Prisma indicator throws', () => {
    beforeEach(async () => {
      app = await buildApp()

      mockPrismaIndicator.isHealthy.mockRejectedValue(
        new HealthCheckError('Prisma health check failed', {
          database: { status: 'down', message: 'Connection refused' },
        }),
      )
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })
      mockBullmqIndicator.isHealthy.mockResolvedValue({ bullmq: { status: 'up' } })
      mockMemoryIndicator.checkHeap.mockResolvedValue({ memory_heap: { status: 'up' } })
      mockDiskIndicator.checkStorage.mockResolvedValue({ storage: { status: 'up' } })
    })

    it('should return HTTP 503', async () => {
      await request(app.getHttpServer()).get('/health/readiness').expect(503)
    })

    it('should return a Terminus health check body with status error', async () => {
      const res = await request(app.getHttpServer()).get('/health/readiness').expect(503)

      expect(res.body).toHaveProperty('status', 'error')
      expect(res.body).toHaveProperty('error')
    })
  })
})
