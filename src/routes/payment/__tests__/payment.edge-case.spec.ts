import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { getLoggerToken } from 'nestjs-pino'
import { PaymentRepo } from '../payment.repo'
import { PaymentService } from '../payment.service'

describe('PaymentService — Edge Cases', () => {
  let service: PaymentService
  let mockPaymentRepo: jest.Mocked<PaymentRepo>
  let mockEventEmitter: jest.Mocked<EventEmitter2>

  const createWebhookBody = (overrides = {}) => ({
    gateway: 'SEPAY',
    transactionDate: new Date().toISOString(),
    accountNumber: '123456789',
    code: null,
    content: 'PAY100',
    transferType: 'in' as const,
    transferAmount: 500000,
    accumulated: 1000000,
    subAccount: null,
    referenceCode: 'REF123',
    description: 'Payment for order',
    id: 1,
    ...overrides,
  })

  beforeEach(async () => {
    mockPaymentRepo = { receiver: jest.fn() } as any
    mockEventEmitter = { emit: jest.fn() } as any

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

  afterEach(() => jest.clearAllMocks())

  describe('receiver — success path', () => {
    it('should process webhook, emit domain event, and return success message', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockResolvedValue({ userId: 42, paymentId: 100 })

      const result = await service.receiver(body)

      expect(mockPaymentRepo.receiver).toHaveBeenCalledWith(body)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'payment.completed',
        expect.objectContaining({ userId: 42, paymentId: 100 }),
      )
      expect(result).toEqual({ message: 'Payment received successfully' })
    })
  })

  describe('receiver — error propagation', () => {
    it('should re-throw Error from repo and log with stack trace', async () => {
      const body = createWebhookBody()
      const error = new Error('Transaction already exists')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Transaction already exists')
      expect(mockEventEmitter.emit).not.toHaveBeenCalled()
    })

    it('should re-throw non-Error from repo and log without stack', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockRejectedValue('string error')

      await expect(service.receiver(body)).rejects.toBe('string error')
      expect(mockEventEmitter.emit).not.toHaveBeenCalled()
    })

    it('should not emit domain event when repo throws', async () => {
      const body = createWebhookBody()
      mockPaymentRepo.receiver.mockRejectedValue(new Error('Cannot find payment'))

      await expect(service.receiver(body)).rejects.toThrow()
      expect(mockEventEmitter.emit).not.toHaveBeenCalled()
    })

    it('should re-throw BadRequestException for price mismatch', async () => {
      const body = createWebhookBody({ transferAmount: 999 })
      const error = new Error('Price not match, expected 500000 but got 999')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Price not match')
    })

    it('should re-throw when no orders found for payment', async () => {
      const body = createWebhookBody()
      const error = new Error('No orders found for payment 100')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('No orders found')
    })

    it('should re-throw when payment id cannot be parsed from content', async () => {
      const body = createWebhookBody({ content: 'INVALID', code: null })
      const error = new Error('Cannot get payment id from content')
      mockPaymentRepo.receiver.mockRejectedValue(error)

      await expect(service.receiver(body)).rejects.toThrow('Cannot get payment id from content')
    })
  })
})
