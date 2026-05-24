import { HealthCheckError } from '@nestjs/terminus'
import { PrismaService } from 'src/shared/services/prisma.service'
import { PrismaHealthIndicator } from '../../indicators/prisma.health-indicator'

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator
  let mockPrismaService: { $queryRaw: jest.Mock }

  beforeEach(() => {
    mockPrismaService = {
      $queryRaw: jest.fn(),
    }
    indicator = new PrismaHealthIndicator(mockPrismaService as unknown as PrismaService)
  })

  describe('isHealthy', () => {
    it('should return status up when database is reachable', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await indicator.isHealthy('database')

      expect(result).toEqual({ database: { status: 'up' } })
    })

    it('should throw HealthCheckError when database is unreachable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'))

      await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError)
    })

    it('should include error message in HealthCheckError', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'))

      try {
        await indicator.isHealthy('database')
        fail('Expected HealthCheckError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError)
        const healthError = error as HealthCheckError
        expect(healthError.causes).toMatchObject({
          database: { status: 'down' },
        })
      }
    })

    it('should use the provided key in the result', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await indicator.isHealthy('my_database')

      expect(result).toHaveProperty('my_database')
      expect(result['my_database'].status).toBe('up')
    })
  })
})
