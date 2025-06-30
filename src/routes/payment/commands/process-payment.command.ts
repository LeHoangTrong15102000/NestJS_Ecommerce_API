import { Injectable } from '@nestjs/common'
import { ICommand, ICommandHandler } from '../interfaces/command.interface'
import { Payment, PaymentStatus } from '../models/payment.model'
import {
  Result,
  PaymentNotFoundError,
  PaymentAlreadyProcessedError,
  InsufficientFundsError,
} from '../types/result.type'

// Command để process payment
export class ProcessPaymentCommand implements ICommand<Payment> {
  readonly _commandBrand?: never

  constructor(
    public readonly paymentId: string,
    public readonly userId: number,
  ) {}
}

// CommandHandler với business logic phức tạp cho payment processing
@Injectable()
export class ProcessPaymentCommandHandler implements ICommandHandler<ProcessPaymentCommand, Payment> {
  constructor() // private readonly paymentRepository: PaymentRepository,
  // private readonly paymentGatewayService: PaymentGatewayService,
  // private readonly walletService: WalletService,
  // private readonly eventBus: EventBus,
  // private readonly notificationService: NotificationService,
  {}

  async handle(command: ProcessPaymentCommand): Promise<Result<Payment>> {
    try {
      // 1. Tìm payment trong database
      const payment = await this.findPayment(command.paymentId)
      if (!payment) {
        return Result.failure(new PaymentNotFoundError(command.paymentId))
      }

      // 2. Validate business rules
      if (payment.status !== PaymentStatus.PENDING) {
        return Result.failure(new PaymentAlreadyProcessedError(command.paymentId))
      }

      if (payment.userId !== command.userId) {
        return Result.failure(new Error('Unauthorized to process this payment'))
      }

      // 3. Check user balance (trong hệ thống payment thực tế)
      const hasEnoughFunds = await this.checkUserFunds(payment.userId, payment.amount)
      if (!hasEnoughFunds) {
        // Update payment status to failed
        const failedPayment = await this.updatePaymentStatus(payment, PaymentStatus.FAILED, 'Insufficient funds')

        // Publish failed event
        // await this.eventBus.publish(new PaymentFailedEvent(payment, 'Insufficient funds'))

        return Result.failure(new InsufficientFundsError())
      }

      // 4. Process payment through gateway
      const processResult = await this.processWithGateway(payment)
      if (!processResult.success) {
        const failedPayment = await this.updatePaymentStatus(payment, PaymentStatus.FAILED, processResult.error)

        // Publish failed event
        // await this.eventBus.publish(new PaymentFailedEvent(payment, processResult.error))

        return Result.failure(new Error(processResult.error))
      }

      // 5. Update payment status to completed
      const completedPayment = await this.updatePaymentStatus(
        payment,
        PaymentStatus.COMPLETED,
        undefined,
        processResult.transactionId,
      )

      // 6. Deduct from user wallet
      // await this.walletService.deduct(payment.userId, payment.amount)

      // 7. Publish success events
      // await this.eventBus.publish(new PaymentCompletedEvent(completedPayment))

      // 8. Send notification
      // await this.notificationService.sendPaymentSuccessNotification(payment.userId, completedPayment)

      return Result.success(completedPayment)
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  // Simulate database operations
  private async findPayment(paymentId: string): Promise<Payment | null> {
    // Simulate async database call
    await Promise.resolve()

    // For demo purposes - normally từ database
    if (paymentId === 'invalid') {
      return null
    }

    return {
      id: paymentId,
      userId: 1,
      orderId: 'order-123',
      amount: 100,
      currency: 'USD',
      status: PaymentStatus.PENDING,
      method: 'CREDIT_CARD' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private async checkUserFunds(userId: number, amount: number): Promise<boolean> {
    // Simulate checking user wallet/bank account
    await Promise.resolve()

    // For demo - assume user có đủ tiền nếu amount <= 1000
    return amount <= 1000
  }

  private async processWithGateway(
    payment: Payment,
  ): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    // Simulate payment gateway processing
    await Promise.resolve()

    // Simulate 10% chance of gateway failure
    const success = Math.random() > 0.1

    if (success) {
      return {
        success: true,
        transactionId: `txn_${Date.now()}_${payment.id}`,
      }
    } else {
      return {
        success: false,
        error: 'Payment gateway temporarily unavailable',
      }
    }
  }

  private async updatePaymentStatus(
    payment: Payment,
    status: PaymentStatus,
    failedReason?: string,
    transactionId?: string,
  ): Promise<Payment> {
    // Simulate database update
    await Promise.resolve()

    return {
      ...payment,
      status,
      failedReason,
      transactionId,
      processedAt: new Date(),
      updatedAt: new Date(),
    }
  }
}
