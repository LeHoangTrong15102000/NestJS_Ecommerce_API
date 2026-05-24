import { HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { HealthCheckResult } from '@nestjs/terminus'
import { Response } from 'express'
import { HealthController } from '../health.controller'
import { HealthService } from '../health.service'

describe('HealthController', () => {
  let controller: HealthController
  let healthService: HealthService

  const mockHealthService = {
    checkAll: jest.fn(),
    checkLiveness: jest.fn(),
    checkReadiness: jest.fn(),
  }

  const mockResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    return res as Response
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile()

    controller = module.get<HealthController>(HealthController)
    healthService = module.get<HealthService>(HealthService)

    jest.clearAllMocks()
  })

  describe('check (GET /health)', () => {
    it('should return 200 when all services are healthy', async () => {
      const healthyResponse = {
        status: 'ok' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'up' as const, responseTime: 5 },
          redis: { status: 'up' as const, responseTime: 2 },
        },
      }

      mockHealthService.checkAll.mockResolvedValue(healthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(healthService.checkAll).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
      expect(res.json).toHaveBeenCalledWith(healthyResponse)
    })

    it('should return 503 when database is down', async () => {
      const unhealthyResponse = {
        status: 'error' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'down' as const, responseTime: 2000, error: 'Connection timeout' },
          redis: { status: 'up' as const, responseTime: 2 },
        },
      }

      mockHealthService.checkAll.mockResolvedValue(unhealthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
      expect(res.json).toHaveBeenCalledWith(unhealthyResponse)
    })

    it('should return 503 when Redis is down', async () => {
      const unhealthyResponse = {
        status: 'error' as const,
        timestamp: '2026-03-11T10:00:00.000Z',
        uptime: 123.456,
        checks: {
          database: { status: 'up' as const, responseTime: 5 },
          redis: { status: 'down' as const, responseTime: 1000, error: 'Redis connection failed' },
        },
      }

      mockHealthService.checkAll.mockResolvedValue(unhealthyResponse)

      const res = mockResponse()
      await controller.check(res)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
      expect(res.json).toHaveBeenCalledWith(unhealthyResponse)
    })
  })

  describe('liveness (GET /health/liveness)', () => {
    it('should return status ok', async () => {
      mockHealthService.checkLiveness.mockResolvedValue({ status: 'ok' })

      const result = await controller.liveness()

      expect(healthService.checkLiveness).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ status: 'ok' })
    })
  })

  describe('readiness (GET /health/readiness)', () => {
    it('should return Terminus health check result when all pass', async () => {
      const terminusResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          bullmq: { status: 'up' },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          bullmq: { status: 'up' },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
      }

      mockHealthService.checkReadiness.mockResolvedValue(terminusResult)

      const result = await controller.readiness()

      expect(healthService.checkReadiness).toHaveBeenCalledTimes(1)
      expect(result).toEqual(terminusResult)
    })

    it('should propagate errors from checkReadiness', async () => {
      const error = new Error('Service unavailable')
      mockHealthService.checkReadiness.mockRejectedValue(error)

      await expect(controller.readiness()).rejects.toThrow('Service unavailable')
    })
  })
})
