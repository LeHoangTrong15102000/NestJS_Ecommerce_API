import { Test, TestingModule } from '@nestjs/testing'
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus'
import { BullMQHealthIndicator } from '../indicators/bullmq.health-indicator'
import { PrismaHealthIndicator } from '../indicators/prisma.health-indicator'
import { RedisHealthIndicator } from '../indicators/redis.health-indicator'
import { HealthService } from '../health.service'

describe('HealthService', () => {
  let service: HealthService
  let mockHealthCheckService: { check: jest.Mock }
  let mockPrismaIndicator: { isHealthy: jest.Mock }
  let mockRedisIndicator: { isHealthy: jest.Mock }
  let mockBullmqIndicator: { isHealthy: jest.Mock }
  let mockMemoryIndicator: { checkHeap: jest.Mock }
  let mockDiskIndicator: { checkStorage: jest.Mock }

  beforeEach(async () => {
    mockHealthCheckService = { check: jest.fn() }
    mockPrismaIndicator = { isHealthy: jest.fn() }
    mockRedisIndicator = { isHealthy: jest.fn() }
    mockBullmqIndicator = { isHealthy: jest.fn() }
    mockMemoryIndicator = { checkHeap: jest.fn() }
    mockDiskIndicator = { checkStorage: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
        { provide: BullMQHealthIndicator, useValue: mockBullmqIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskIndicator },
      ],
    }).compile()

    service = module.get<HealthService>(HealthService)
    jest.clearAllMocks()
  })

  describe('checkLiveness', () => {
    it('should return status ok immediately', async () => {
      const result = await service.checkLiveness()
      expect(result).toEqual({ status: 'ok' })
    })
  })

  describe('checkReadiness', () => {
    it('should call health.check with all indicators', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' }, redis: { status: 'up' } },
      }
      mockHealthCheckService.check.mockResolvedValue(mockResult)

      const result = await service.checkReadiness()

      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockResult)
    })
  })

  describe('checkAll', () => {
    it('should return status ok when all services are healthy', async () => {
      mockPrismaIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } })
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })

      const result = await service.checkAll()

      expect(result.status).toBe('ok')
      expect(result.checks.database.status).toBe('up')
      expect(result.checks.redis.status).toBe('up')
      expect(result.timestamp).toBeDefined()
      expect(result.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should return status error when database is down', async () => {
      const { HealthCheckError } = await import('@nestjs/terminus')
      mockPrismaIndicator.isHealthy.mockRejectedValue(
        new HealthCheckError('db down', { database: { status: 'down' } }),
      )
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })

      const result = await service.checkAll()

      expect(result.status).toBe('error')
      expect(result.checks.database.status).toBe('down')
      expect(result.checks.redis.status).toBe('up')
    })

    it('should return status error when Redis is down', async () => {
      const { HealthCheckError } = await import('@nestjs/terminus')
      mockPrismaIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } })
      mockRedisIndicator.isHealthy.mockRejectedValue(
        new HealthCheckError('redis down', { redis: { status: 'down' } }),
      )

      const result = await service.checkAll()

      expect(result.status).toBe('error')
      expect(result.checks.database.status).toBe('up')
      expect(result.checks.redis.status).toBe('down')
    })

    it('should include timestamp in ISO format', async () => {
      mockPrismaIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } })
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })

      const result = await service.checkAll()

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should include process uptime', async () => {
      mockPrismaIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } })
      mockRedisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } })

      const result = await service.checkAll()

      expect(typeof result.uptime).toBe('number')
      expect(result.uptime).toBeGreaterThanOrEqual(0)
    })
  })
})
