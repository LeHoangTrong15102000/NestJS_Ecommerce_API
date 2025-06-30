import { Injectable } from '@nestjs/common'
import { IQuery, IQueryHandler } from '../interfaces/query.interface'
import { Payment, PaymentStatus } from '../models/payment.model'

// Query để lấy payment detail
export class GetPaymentQuery implements IQuery<Payment | null> {
  readonly _queryBrand?: never

  constructor(
    public readonly paymentId: string,
    public readonly userId: number, // Để check authorization
  ) {}
}

// QueryHandler chỉ focus vào việc đọc dữ liệu
@Injectable()
export class GetPaymentQueryHandler implements IQueryHandler<GetPaymentQuery, Payment | null> {
  constructor() {} // private readonly cacheService: CacheService, // private readonly paymentReadRepository: PaymentReadRepository,

  async handle(query: GetPaymentQuery): Promise<Payment | null> {
    // 1. Check cache first
    // const cached = await this.cacheService.get(`payment:${query.paymentId}`)
    // if (cached) return JSON.parse(cached)

    // 2. Query from read database (có thể là read replica)
    const payment = await this.findPaymentById(query.paymentId)

    if (!payment) {
      return null
    }

    // 3. Check authorization
    if (payment.userId !== query.userId) {
      return null // Hoặc throw unauthorized error
    }

    // 4. Cache result
    // await this.cacheService.set(`payment:${query.paymentId}`, JSON.stringify(payment), 300)

    return payment
  }

  // Simulate read from database
  private async findPaymentById(paymentId: string): Promise<Payment | null> {
    // Simulate async database read
    await Promise.resolve()

    // For demo - return mock data
    if (paymentId === 'pay_123') {
      return {
        id: paymentId,
        userId: 1,
        orderId: 'order-456',
        amount: 250,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        method: 'CREDIT_CARD' as any,
        transactionId: 'txn_1735567890_pay_123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        processedAt: new Date('2024-01-01'),
        metadata: {
          cardLast4: '1234',
          cardType: 'VISA',
        },
      }
    }

    return null
  }
}
