import { HealthCheckError } from '@nestjs/terminus'
import { BullMQHealthIndicator } from '../../indicators/bullmq.health-indicator'

// Mock ioredis
const mockRedisInstance = {
  status: 'ready',
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  on: jest.fn().mockReturnThis(),
}

jest.mock('ioredis', () => {
  return function () {
    return mockRedisInstance
  }
})

describe('BullMQHealthIndicator', () => {
  let indicator: BullMQHealthIndicator

  beforeEach(() => {
    jest.clearAllMocks()
    mockRedisInstance.status = 'ready'
    mockRedisInstance.ping.mockResolvedValue('PONG')
    indicator = new BullMQHealthIndicator()
  })

  afterEach(async () => {
    await indicator.onModuleDestroy()
  })

  describe('isHealthy', () => {
    it('should return status up when BullMQ connection is active', async () => {
      const result = await indicator.isHealthy('bullmq')

      expect(result).toEqual({ bullmq: { status: 'up' } })
      expect(mockRedisInstance.ping).toHaveBeenCalledTimes(1)
    })

    it('should throw HealthCheckError when BullMQ connection fails', async () => {
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(indicator.isHealthy('bullmq')).rejects.toThrow(HealthCheckError)
    })

    it('should include error message in HealthCheckError', async () => {
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      try {
        await indicator.isHealthy('bullmq')
        fail('Expected HealthCheckError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError)
        const healthError = error as HealthCheckError
        expect(healthError.causes).toMatchObject({
          bullmq: { status: 'down' },
        })
      }
    })

    it('should use the provided key in the result', async () => {
      const result = await indicator.isHealthy('my_bullmq')

      expect(result).toHaveProperty('my_bullmq')
      expect(result['my_bullmq'].status).toBe('up')
    })
  })

  describe('onModuleDestroy', () => {
    it('should quit the Redis connection', async () => {
      await indicator.onModuleDestroy()

      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1)
    })
  })
})
