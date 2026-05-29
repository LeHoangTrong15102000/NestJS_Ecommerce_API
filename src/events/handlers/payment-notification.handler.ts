import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { PaymentCompletedEvent } from 'src/events/definitions'
import { PaymentGateway } from 'src/websockets/payment.gateway'

@Injectable()
export class PaymentNotificationHandler {
  constructor(
    @InjectPinoLogger(PaymentNotificationHandler.name) private readonly logger: PinoLogger,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  @OnEvent('payment.completed', { async: true })
  async handle(event: PaymentCompletedEvent): Promise<void> {
    try {
      this.paymentGateway.emitPaymentSuccess(event.userId)
      this.logger.info({ eventId: event.eventId, userId: event.userId }, 'Payment success notification sent')
    } catch (error) {
      // Handlers never throw — log and continue
      this.logger.error(
        { error, eventId: event.eventId },
        'Failed to send payment success notification',
      )
    }
  }
}
