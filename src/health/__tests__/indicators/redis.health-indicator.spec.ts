import { HealthCheckError } from '@nestjs/terminus'
import { RedisHealthIndicator } from '../../indicators/redis.health-indicator'

// Mock ioredis
const mockRedisInstance = {
  status: 'ready',
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
}

jest.mock('ioredis', () => {
  return function () {
    return mockRedisInstance
  }
})

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator

  beforeEach(() => {
    jest.clearAllMocks()
    mockRedisInstance.status = 'ready'
    mockRedisInstance.ping.mockResolvedValue('PONG')
    indicator = new RedisHealthIndicator()
  })

  afterEach(async () => {
    await indicator.onModuleDestroy()
  })

  describe('isHealthy', () => {
    it('should return status up when Redis responds to PING', async () => {
      const result = await indicator.isHealthy('redis')

      expect(result).toEqual({ redis: { status: 'up' } })
      expect(mockRedisInstance.ping).toHaveBeenCalledTimes(1)
    })

    it('should throw HealthCheckError when Redis does not respond', async () => {
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError)
    })

    it('should include error message in HealthCheckError', async () => {
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      try {
        await indicator.isHealthy('redis')
        fail('Expected HealthCheckError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError)
        const healthError = error as HealthCheckError
        expect(healthError.causes).toMatchObject({
          redis: { status: 'down' },
        })
      }
    })

    it('should connect if not ready', async () => {
      mockRedisInstance.status = 'connecting'

      await indicator.isHealthy('redis')

      expect(mockRedisInstance.connect).toHaveBeenCalledTimes(1)
    })

    it('should use the provided key in the result', async () => {
      const result = await indicator.isHealthy('my_redis')

      expect(result).toHaveProperty('my_redis')
      expect(result['my_redis'].status).toBe('up')
    })
  })

  describe('onModuleDestroy', () => {
    it('should quit the Redis connection', async () => {
      await indicator.onModuleDestroy()

      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1)
    })
  })
})
