import { Test, TestingModule } from '@nestjs/testing'
import { getLoggerToken } from 'nestjs-pino'
import { PaymentNotificationHandler } from '../handlers/payment-notification.handler'
import { PaymentFailureHandler } from '../handlers/payment-failure.handler'
import { UserWelcomeHandler } from '../handlers/user-welcome.handler'
import { PriceAlertHandler } from '../handlers/price-alert.handler'
import { PaymentCompletedEvent } from '../definitions/payment-completed.event'
import { PaymentFailedEvent } from '../definitions/payment-failed.event'
import { UserRegisteredEvent } from '../definitions/user-registered.event'
import { ProductPriceChangedEvent } from '../definitions/product-price-changed.event'
import { PaymentGateway } from 'src/websockets/payment.gateway'
import { EmailService } from 'src/shared/services/email.service'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'

// ============================================================
// Shared logger mock factory
// ============================================================
const createLoggerMock = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
})

// ============================================================
// PaymentNotificationHandler
// ============================================================
describe('PaymentNotificationHandler', () => {
  let handler: PaymentNotificationHandler
  let mockPaymentGateway: { emitPaymentSuccess: jest.Mock }
  let mockLogger: ReturnType<typeof createLoggerMock>

  beforeEach(async () => {
    mockPaymentGateway = { emitPaymentSuccess: jest.fn() }
    mockLogger = createLoggerMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentNotificationHandler,
        { provide: PaymentGateway, useValue: mockPaymentGateway },
        { provide: getLoggerToken(PaymentNotificationHandler.name), useValue: mockLogger },
      ],
    }).compile()

    handler = module.get<PaymentNotificationHandler>(PaymentNotificationHandler)
  })

  afterEach(() => jest.clearAllMocks())

  it('should call emitPaymentSuccess with the correct userId', async () => {
    const event = new PaymentCompletedEvent(100, 42)

    await handler.handle(event)

    expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledWith(42)
    expect(mockPaymentGateway.emitPaymentSuccess).toHaveBeenCalledTimes(1)
  })

  it('should log info after successful notification', async () => {
    const event = new PaymentCompletedEvent(100, 42)

    await handler.handle(event)

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId, userId: 42 }),
      'Payment success notification sent',
    )
  })

  it('should catch errors and log without re-throwing', async () => {
    const event = new PaymentCompletedEvent(100, 42)
    mockPaymentGateway.emitPaymentSuccess.mockImplementation(() => {
      throw new Error('WebSocket error')
    })

    // Must not throw
    await expect(handler.handle(event)).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      'Failed to send payment success notification',
    )
  })
})

// ============================================================
// PaymentFailureHandler
// ============================================================
describe('PaymentFailureHandler', () => {
  let handler: PaymentFailureHandler
  let mockServer: { to: jest.Mock }
  let mockPaymentGateway: { server: typeof mockServer }
  let mockLogger: ReturnType<typeof createLoggerMock>

  beforeEach(async () => {
    const mockEmit = jest.fn()
    mockServer = { to: jest.fn().mockReturnValue({ emit: mockEmit }) }
    mockPaymentGateway = { server: mockServer }
    mockLogger = createLoggerMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentFailureHandler,
        { provide: PaymentGateway, useValue: mockPaymentGateway },
        { provide: getLoggerToken(PaymentFailureHandler.name), useValue: mockLogger },
      ],
    }).compile()

    handler = module.get<PaymentFailureHandler>(PaymentFailureHandler)
  })

  afterEach(() => jest.clearAllMocks())

  it('should emit payment failed event to the correct user room', async () => {
    const event = new PaymentFailedEvent(200, 7, 'Payment timeout')

    await handler.handle(event)

    expect(mockServer.to).toHaveBeenCalledWith(`userId-7`)
    const roomEmit = mockServer.to.mock.results[0].value.emit
    expect(roomEmit).toHaveBeenCalledWith('payment', { status: 'failed', reason: 'Payment timeout' })
  })

  it('should log info after successful failure notification', async () => {
    const event = new PaymentFailedEvent(200, 7, 'Payment timeout')

    await handler.handle(event)

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId, userId: 7 }),
      'Payment failure notification sent',
    )
  })

  it('should catch errors and log without re-throwing', async () => {
    const event = new PaymentFailedEvent(200, 7, 'Payment timeout')
    mockServer.to.mockImplementation(() => {
      throw new Error('Socket error')
    })

    await expect(handler.handle(event)).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      'Failed to send payment failure notification',
    )
  })
})

// ============================================================
// UserWelcomeHandler
// ============================================================
describe('UserWelcomeHandler', () => {
  let handler: UserWelcomeHandler
  let mockEmailService: { sendOTP: jest.Mock }
  let mockLogger: ReturnType<typeof createLoggerMock>

  beforeEach(async () => {
    mockEmailService = { sendOTP: jest.fn() }
    mockLogger = createLoggerMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserWelcomeHandler,
        { provide: EmailService, useValue: mockEmailService },
        { provide: getLoggerToken(UserWelcomeHandler.name), useValue: mockLogger },
      ],
    }).compile()

    handler = module.get<UserWelcomeHandler>(UserWelcomeHandler)
  })

  afterEach(() => jest.clearAllMocks())

  it('should send welcome email to the registered user', async () => {
    const event = new UserRegisteredEvent(5, 'user@example.com')
    mockEmailService.sendOTP.mockResolvedValue({ data: {}, error: null })

    await handler.handle(event)

    expect(mockEmailService.sendOTP).toHaveBeenCalledWith({
      email: 'user@example.com',
      code: 'WELCOME',
    })
  })

  it('should log info after successful welcome email', async () => {
    const event = new UserRegisteredEvent(5, 'user@example.com')
    mockEmailService.sendOTP.mockResolvedValue({ data: {}, error: null })

    await handler.handle(event)

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId, userId: 5 }),
      'Welcome email sent',
    )
  })

  it('should log warn when email provider returns an error', async () => {
    const event = new UserRegisteredEvent(5, 'user@example.com')
    mockEmailService.sendOTP.mockResolvedValue({ data: null, error: { message: 'Provider error', name: 'err' } })

    await handler.handle(event)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId, userId: 5 }),
      'Welcome email returned an error from provider',
    )
    // Should not log info
    expect(mockLogger.info).not.toHaveBeenCalled()
  })

  it('should catch thrown errors and log without re-throwing', async () => {
    const event = new UserRegisteredEvent(5, 'user@example.com')
    mockEmailService.sendOTP.mockRejectedValue(new Error('SMTP failure'))

    await expect(handler.handle(event)).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      'Failed to send welcome email',
    )
  })
})

// ============================================================
// PriceAlertHandler
// ============================================================
describe('PriceAlertHandler', () => {
  let handler: PriceAlertHandler
  let mockWishlistRepo: { getItemsForPriceCheck: jest.Mock }
  let mockWishlistProducer: { addSendPriceAlertJob: jest.Mock }
  let mockLogger: ReturnType<typeof createLoggerMock>

  const createWishlistItem = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    notifyOnPriceDrops: true,
    user: { id: 10, email: 'buyer@example.com', name: 'Buyer' },
    product: { id: 99, name: 'Test Product' },
    ...overrides,
  })

  beforeEach(async () => {
    mockWishlistRepo = { getItemsForPriceCheck: jest.fn() }
    mockWishlistProducer = { addSendPriceAlertJob: jest.fn() }
    mockLogger = createLoggerMock()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceAlertHandler,
        { provide: WishlistRepo, useValue: mockWishlistRepo },
        { provide: WishlistProducer, useValue: mockWishlistProducer },
        { provide: getLoggerToken(PriceAlertHandler.name), useValue: mockLogger },
      ],
    }).compile()

    handler = module.get<PriceAlertHandler>(PriceAlertHandler)
  })

  afterEach(() => jest.clearAllMocks())

  it('should enqueue a price alert job for each affected user', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000) // 20% drop
    mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([createWishlistItem()])
    mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue(undefined)

    await handler.handle(event)

    expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledTimes(1)
    expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        userEmail: 'buyer@example.com',
        productId: 99,
        oldPrice: 100000,
        newPrice: 80000,
      }),
    )
  })

  it('should not process when price increases', async () => {
    const event = new ProductPriceChangedEvent(99, 80000, 100000) // price increase

    await handler.handle(event)

    expect(mockWishlistRepo.getItemsForPriceCheck).not.toHaveBeenCalled()
    expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
  })

  it('should not process when price drop is less than 5%', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 97000) // 3% drop

    await handler.handle(event)

    expect(mockWishlistRepo.getItemsForPriceCheck).not.toHaveBeenCalled()
    expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
  })

  it('should not enqueue when no wishlist items match the product', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000)
    // Item is for a different product
    mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([
      createWishlistItem({ product: { id: 999, name: 'Other Product' } }),
    ])

    await handler.handle(event)

    expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
  })

  it('should not enqueue when notifyOnPriceDrops is false', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000)
    mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([
      createWishlistItem({ notifyOnPriceDrops: false }),
    ])

    await handler.handle(event)

    expect(mockWishlistProducer.addSendPriceAlertJob).not.toHaveBeenCalled()
  })

  it('should deduplicate jobs per user when multiple wishlist items belong to the same user', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000)
    mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([
      createWishlistItem({ id: 1 }),
      createWishlistItem({ id: 2 }), // same user id: 10
    ])
    mockWishlistProducer.addSendPriceAlertJob.mockResolvedValue(undefined)

    await handler.handle(event)

    // Only one job per user
    expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledTimes(1)
  })

  it('should continue processing other items when one job enqueue fails', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000)
    mockWishlistRepo.getItemsForPriceCheck.mockResolvedValue([
      createWishlistItem({ id: 1, user: { id: 10, email: 'a@example.com', name: 'A' } }),
      createWishlistItem({ id: 2, user: { id: 11, email: 'b@example.com', name: 'B' } }),
    ])
    mockWishlistProducer.addSendPriceAlertJob
      .mockRejectedValueOnce(new Error('Queue error'))
      .mockResolvedValueOnce(undefined)

    await expect(handler.handle(event)).resolves.toBeUndefined()
    expect(mockWishlistProducer.addSendPriceAlertJob).toHaveBeenCalledTimes(2)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      'Failed to enqueue price alert job for wishlist item',
    )
  })

  it('should catch top-level errors and log without re-throwing', async () => {
    const event = new ProductPriceChangedEvent(99, 100000, 80000)
    mockWishlistRepo.getItemsForPriceCheck.mockRejectedValue(new Error('DB error'))

    await expect(handler.handle(event)).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      'Failed to process product price changed event',
    )
  })
})
