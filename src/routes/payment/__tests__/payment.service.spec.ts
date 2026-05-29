import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { getLoggerToken } from 'nestjs-pino'
import { WebhookPaymentBodyType } from '../payment.model'
import { PaymentRepo } from '../payment.repo'
import { PaymentService } from '../payment.service'

/**
 * PAYMENT SERVICE UNIT TESTS
 *
 * Module này test service layer của Payment
 * Đây là module CRITICAL vì xử lý webhook từ payment gateway
 *
 * Test Coverage:
 * - Webhook receiver processing
 * - Domain event emission via EventEmitter2 (replaces direct PaymentGateway call)
 * - Error handling
 * - Integration với PaymentRepo
 */

describe('PaymentService', () => {
  let service: PaymentService
  let mockPaymentRepo: jest.Mocked<PaymentRepo>
  let mockEventEmitter: jest.Mocked<EventEmitter2>

  // Test data factory
  const createWebhookPayload = (overrides = {}): WebhookPaymentBodyType => ({
    id: 123456,
    gateway: 'VCB',
    transactionDate: '2024-01-15 10:30:00',
    accountNumber: '1234567890',
    code: 'PAY100',
    content: 'Thanh toan don hang PAY100',
    transferType: 'in' as const,
    transferAmount: 500000,
    accumulated: 10000000,
    subAccount: null,
    referenceCode: 'REF123456',
    description: 'Chuyen khoan thanh toan don hang',
    ...overrides,
  })

  beforeEach(async () => {
    // Mock PaymentRepo — receiver now returns { userId, paymentId }
    mockPaymentRepo = {
      receiver: jest.fn(),
    } as any

    // Mock EventEmitter2 — replaces direct PaymentGateway dependency
    mockEventEmitter = {
      emit: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepo, useValue: mockPaymentRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: getLoggerToken(PaymentService.name),
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            trace: jest.fn(),
            setContext: jest.fn(),
            assign: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PaymentService>(PaymentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // RECEIVER METHOD TESTS
  // ============================================

  describe('receiver', () => {
    describe('Success Cases', () => {
      it('should process webhook payment and emit payment.completed domain event', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
        expect(mockPaymentRepo.receiver).toHaveBeenCalledTimes(1)
      })

      it('should emit payment.completed event with correct paymentId and userId', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        await service.receiver(webhookPayload)

        // Assert
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'payment.completed',
          expect.objectContaining({
            paymentId: 100,
            userId: 10,
            eventName: 'payment.completed',
          }),
        )
      })

      it('should handle payment for different users correctly', async () => {
        // Arrange
        const webhookPayload1 = createWebhookPayload({ id: 111 })
        const webhookPayload2 = createWebhookPayload({ id: 222 })

        mockPaymentRepo.receiver
          .mockResolvedValueOnce({ userId: 10, paymentId: 101 })
          .mockResolvedValueOnce({ userId: 20, paymentId: 102 })

        // Act
        await service.receiver(webhookPayload1)
        await service.receiver(webhookPayload2)

        // Assert
        expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(
          1,
          'payment.completed',
          expect.objectContaining({ userId: 10, paymentId: 101 }),
        )
        expect(mockEventEmitter.emit).toHaveBeenNthCalledWith(
          2,
          'payment.completed',
          expect.objectContaining({ userId: 20, paymentId: 102 }),
        )
        expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2)
      })

      it('should return success message after processing', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({
          message: 'Payment received successfully',
        })
      })
    })

    describe('Error Cases', () => {
      it('should propagate error from PaymentRepo', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        const error = new Error('Database error')
        mockPaymentRepo.receiver.mockRejectedValue(error)

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Database error')
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should not emit domain event if repo throws error', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockRejectedValue(new Error('Payment processing failed'))

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow()
        expect(mockEventEmitter.emit).not.toHaveBeenCalled()
      })

      it('should handle timeout-like errors from repo', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockRejectedValue(new Error('Connection timeout'))

        // Act & Assert
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Connection timeout')
        expect(mockEventEmitter.emit).not.toHaveBeenCalled()
      })
    })

    describe('Integration Tests', () => {
      it('should process complete payment flow', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          id: 999,
          transferAmount: 1500000,
          gateway: 'MB Bank',
        })
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 15, paymentId: 200 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert - Verify complete flow
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'payment.completed',
          expect.objectContaining({ userId: 15, paymentId: 200 }),
        )
        expect(result).toEqual({ message: 'Payment received successfully' })
      })

      it('should handle concurrent webhook requests', async () => {
        // Arrange
        const webhooks = [
          createWebhookPayload({ id: 1 }),
          createWebhookPayload({ id: 2 }),
          createWebhookPayload({ id: 3 }),
        ]
        mockPaymentRepo.receiver
          .mockResolvedValueOnce({ userId: 10, paymentId: 1 })
          .mockResolvedValueOnce({ userId: 11, paymentId: 2 })
          .mockResolvedValueOnce({ userId: 12, paymentId: 3 })

        // Act
        const results = await Promise.all(webhooks.map((webhook) => service.receiver(webhook)))

        // Assert
        expect(results).toHaveLength(3)
        expect(mockPaymentRepo.receiver).toHaveBeenCalledTimes(3)
        expect(mockEventEmitter.emit).toHaveBeenCalledTimes(3)
      })
    })

    describe('Edge Cases', () => {
      it('should handle userId = 0', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 0, paymentId: 100 })

        // Act
        await service.receiver(webhookPayload)

        // Assert
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.completed', expect.objectContaining({ userId: 0 }))
      })

      it('should handle very large transaction amounts', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          transferAmount: 999999999999,
        })
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should handle special characters in payment content', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          content: 'Thanh toán đơn hàng #123 - Khách hàng: Nguyễn Văn A',
          description: 'Chuyển khoản có ký tự đặc biệt: @#$%^&*()',
        })
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
      })

      it('should handle null/undefined values in webhook payload', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload({
          subAccount: null,
          code: null,
          accountNumber: null,
        })
        mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

        // Act
        const result = await service.receiver(webhookPayload)

        // Assert
        expect(result).toEqual({ message: 'Payment received successfully' })
        expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(webhookPayload)
      })

      it('should handle duplicate webhook with same transaction id', async () => {
        // Arrange - same payload sent twice
        const webhookPayload = createWebhookPayload({ id: 12345 })
        mockPaymentRepo.receiver.mockResolvedValueOnce({ userId: 10, paymentId: 100 })
        mockPaymentRepo.receiver.mockRejectedValueOnce(new Error('Duplicate transaction'))

        // Act - first call succeeds
        const result1 = await service.receiver(webhookPayload)
        expect(result1).toEqual({ message: 'Payment received successfully' })

        // Act - second call with same id fails at repo level
        await expect(service.receiver(webhookPayload)).rejects.toThrow('Duplicate transaction')
      })

      it('should handle repo returning negative userId', async () => {
        // Arrange
        const webhookPayload = createWebhookPayload()
        mockPaymentRepo.receiver.mockResolvedValue({ userId: -1, paymentId: 100 })

        // Act
        await service.receiver(webhookPayload)

        // Assert - still emits, validation is repo's responsibility
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('payment.completed', expect.objectContaining({ userId: -1 }))
      })
    })
  })

  // ============================================
  // EVENT EMISSION TESTS
  // ============================================

  describe('Event Emission', () => {
    it('should emit exactly one event per receiver call', async () => {
      // Arrange
      const webhookPayload = createWebhookPayload()
      mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

      // Act
      await service.receiver(webhookPayload)

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1)
    })

    it('should emit event with a valid eventId (UUID format)', async () => {
      // Arrange
      const webhookPayload = createWebhookPayload()
      mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

      // Act
      await service.receiver(webhookPayload)

      // Assert
      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock.calls[0][1]
      expect(emittedEvent.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should emit event with occurredAt as a Date', async () => {
      // Arrange
      const webhookPayload = createWebhookPayload()
      mockPaymentRepo.receiver.mockResolvedValue({ userId: 10, paymentId: 100 })

      // Act
      await service.receiver(webhookPayload)

      // Assert
      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock.calls[0][1]
      expect(emittedEvent.occurredAt).toBeInstanceOf(Date)
    })
  })
})
