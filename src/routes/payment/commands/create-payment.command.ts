import { Injectable } from '@nestjs/common'
import { ICommand, ICommandHandler } from '../interfaces/command.interface'
import { Payment, PaymentMethod, PaymentStatus } from '../models/payment.model'
import { Result } from '../types/result.type'
import { v4 as uuidv4 } from 'uuid'

// Command - chỉ chứa data cần thiết
export class CreatePaymentCommand implements ICommand<Payment> {
  readonly _commandBrand?: never

  constructor(
    public readonly userId: number,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly method: PaymentMethod,
    public readonly metadata?: Record<string, any>,
  ) {}
}

// CommandHandler - chứa business logic
@Injectable()
export class CreatePaymentCommandHandler implements ICommandHandler<CreatePaymentCommand, Payment> {
  constructor() {} // private readonly auditService: AuditService, // private readonly eventBus: EventBus, // private readonly paymentRepository: PaymentRepository, // Inject payment repository và các services cần thiết

  async handle(command: CreatePaymentCommand): Promise<Result<Payment>> {
    try {
      // 1. Validate business rules
      if (command.amount <= 0) {
        return Result.failure(new Error('Amount must be greater than 0'))
      }

      if (!this.isValidCurrency(command.currency)) {
        return Result.failure(new Error('Invalid currency'))
      }

      // 2. Create payment entity
      const payment: Payment = {
        id: uuidv4(),
        userId: command.userId,
        orderId: command.orderId,
        amount: command.amount,
        currency: command.currency,
        status: PaymentStatus.PENDING,
        method: command.method,
        metadata: command.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // 3. Persist to database (simulated async operation)
      await Promise.resolve() // Simulate async operation
      // const savedPayment = await this.paymentRepository.create(payment)

      // 4. Publish domain event
      // await this.eventBus.publish(new PaymentCreatedEvent(payment))

      // 5. Audit log
      // await this.auditService.log('PAYMENT_CREATED', payment.id, command.userId)

      // For demo, return the payment object
      return Result.success(payment)
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  private isValidCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'VND', 'JPY', 'GBP']
    return validCurrencies.includes(currency.toUpperCase())
  }
}
