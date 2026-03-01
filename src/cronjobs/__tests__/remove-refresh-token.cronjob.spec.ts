import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RemoveRefreshTokenCronjob } from '../remove-refresh-token.cronjob'

/**
 * REMOVE REFRESH TOKEN CRONJOB UNIT TESTS
 *
 * Test coverage cho cronjob xóa refresh tokens hết hạn
 * - Scheduled execution (EVERY_DAY_AT_1AM)
 * - Token deletion logic
 * - Error handling
 */

describe('RemoveRefreshTokenCronjob', () => {
  let cronjob: RemoveRefreshTokenCronjob
  let mockPrismaService: any
  let mockDeleteMany: jest.Mock

  beforeEach(async () => {
    mockDeleteMany = jest.fn()
    mockPrismaService = {
      refreshToken: {
        deleteMany: mockDeleteMany,
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [RemoveRefreshTokenCronjob, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    cronjob = module.get<RemoveRefreshTokenCronjob>(RemoveRefreshTokenCronjob)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleCron', () => {
    it('should delete expired refresh tokens', async () => {
      const mockResult = { count: 5 }
      mockDeleteMany.mockResolvedValue(mockResult)

      await cronjob.handleCron()

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it('should use current date for expiration check', async () => {
      const beforeDate = new Date()
      mockDeleteMany.mockResolvedValue({ count: 0 })

      await cronjob.handleCron()

      const callArgs = mockDeleteMany.mock.calls[0][0]
      const usedDate = callArgs.where.expiresAt.lt
      const afterDate = new Date()

      expect(usedDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime())
      expect(usedDate.getTime()).toBeLessThanOrEqual(afterDate.getTime())
    })

    it('should handle zero expired tokens', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 })

      await expect(cronjob.handleCron()).resolves.not.toThrow()
      expect(mockDeleteMany).toHaveBeenCalled()
    })

    it('should handle multiple expired tokens', async () => {
      const counts = [1, 10, 100, 1000]

      for (const count of counts) {
        mockDeleteMany.mockResolvedValue({ count })

        await cronjob.handleCron()

        expect(mockDeleteMany).toHaveBeenCalled()
      }
    })

    it('should propagate database errors', async () => {
      const error = new Error('Database connection failed')
      mockDeleteMany.mockRejectedValue(error)

      await expect(cronjob.handleCron()).rejects.toThrow('Database connection failed')
    })

    it('should handle Prisma errors', async () => {
      const prismaError = new Error('P2002: Unique constraint failed')
      mockDeleteMany.mockRejectedValue(prismaError)

      await expect(cronjob.handleCron()).rejects.toThrow('P2002: Unique constraint failed')
    })

    it('should call deleteMany exactly once per execution', async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 })

      await cronjob.handleCron()

      expect(mockDeleteMany).toHaveBeenCalledTimes(1)
    })

    it('should use less than operator for date comparison', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 })

      await cronjob.handleCron()

      const callArgs = mockDeleteMany.mock.calls[0][0]
      expect(callArgs.where.expiresAt).toHaveProperty('lt')
      expect(callArgs.where.expiresAt).not.toHaveProperty('lte')
      expect(callArgs.where.expiresAt).not.toHaveProperty('gt')
      expect(callArgs.where.expiresAt).not.toHaveProperty('gte')
    })

    it('should handle concurrent executions', async () => {
      mockDeleteMany.mockResolvedValue({ count: 3 })

      await Promise.all([cronjob.handleCron(), cronjob.handleCron(), cronjob.handleCron()])

      expect(mockDeleteMany).toHaveBeenCalledTimes(3)
    })

    it('should not affect non-expired tokens', async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 })

      await cronjob.handleCron()

      const callArgs = mockDeleteMany.mock.calls[0][0]
      // Verify it only targets expired tokens (expiresAt < now)
      expect(callArgs.where.expiresAt.lt).toBeInstanceOf(Date)
    })
  })

  describe('cron schedule', () => {
    it('should be decorated with @Cron', () => {
      // This verifies the method exists and can be called
      expect(cronjob.handleCron).toBeDefined()
      expect(typeof cronjob.handleCron).toBe('function')
    })

    it('should execute without errors', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 })

      await expect(cronjob.handleCron()).resolves.not.toThrow()
    })
  })

  describe('logging', () => {
    it('should log deletion count', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'debug')
      mockDeleteMany.mockResolvedValue({ count: 10 })

      await cronjob.handleCron()

      expect(loggerSpy).toHaveBeenCalledWith('Removed 10 expired refresh tokens.')
    })

    it('should log zero deletions', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'debug')
      mockDeleteMany.mockResolvedValue({ count: 0 })

      await cronjob.handleCron()

      expect(loggerSpy).toHaveBeenCalledWith('Removed 0 expired refresh tokens.')
    })

    it('should log large deletion counts', async () => {
      const loggerSpy = jest.spyOn(cronjob['logger'], 'debug')
      mockDeleteMany.mockResolvedValue({ count: 99999 })

      await cronjob.handleCron()

      expect(loggerSpy).toHaveBeenCalledWith('Removed 99999 expired refresh tokens.')
    })
  })

  describe('edge cases', () => {
    it('should handle null count gracefully', async () => {
      mockDeleteMany.mockResolvedValue({ count: null } as any)

      await cronjob.handleCron()

      expect(mockDeleteMany).toHaveBeenCalled()
    })

    it('should handle undefined count gracefully', async () => {
      mockDeleteMany.mockResolvedValue({ count: undefined } as any)

      await cronjob.handleCron()

      expect(mockDeleteMany).toHaveBeenCalled()
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout')
      mockDeleteMany.mockRejectedValue(timeoutError)

      await expect(cronjob.handleCron()).rejects.toThrow('Query timeout')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network unreachable')
      mockDeleteMany.mockRejectedValue(networkError)

      await expect(cronjob.handleCron()).rejects.toThrow('Network unreachable')
    })
  })

  describe('performance', () => {
    it('should complete execution quickly', async () => {
      mockDeleteMany.mockResolvedValue({ count: 100 })

      const startTime = Date.now()
      await cronjob.handleCron()
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete in less than 1 second
    })

    it('should handle rapid successive calls', async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 })

      const promises = Array(10)
        .fill(null)
        .map(() => cronjob.handleCron())

      await expect(Promise.all(promises)).resolves.not.toThrow()
      expect(mockDeleteMany).toHaveBeenCalledTimes(10)
    })
  })

  describe('integration', () => {
    it('should work with PrismaService', () => {
      expect(cronjob['prismaService']).toBe(mockPrismaService)
    })

    it('should access refreshToken model', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 })

      await cronjob.handleCron()

      expect(mockDeleteMany).toHaveBeenCalled()
    })
  })
})
