import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { PaymentRepo } from 'src/routes/payment/payment.repo'
import { WebhookPaymentBodyType } from 'src/routes/payment/payment.model'
import { PaymentCompletedEvent } from 'src/events/definitions'
import { MESSAGES } from 'src/shared/constants/app.constant'

@Injectable()
export class PaymentService {
  constructor(
    @InjectPinoLogger(PaymentService.name) private readonly logger: PinoLogger,
    private readonly paymentRepo: PaymentRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async receiver(body: WebhookPaymentBodyType) {
    try {
      const { userId, paymentId } = await this.paymentRepo.receiver(body)

      // Emit domain event — decoupled from WebSocket notification
      this.eventEmitter.emit(
        'payment.completed',
        new PaymentCompletedEvent(paymentId, userId),
      )

      return {
        message: MESSAGES.PAYMENT_RECEIVED,
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment webhook: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
