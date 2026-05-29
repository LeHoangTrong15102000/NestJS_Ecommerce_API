import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { PaymentFailedEvent } from 'src/events/definitions'
import { generateRoomUserId } from 'src/shared/helpers'
import { PaymentGateway } from 'src/websockets/payment.gateway'

@Injectable()
export class PaymentFailureHandler {
  constructor(
    @InjectPinoLogger(PaymentFailureHandler.name) private readonly logger: PinoLogger,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  @OnEvent('payment.failed', { async: true })
  async handle(event: PaymentFailedEvent): Promise<void> {
    try {
      this.paymentGateway.server.to(generateRoomUserId(event.userId)).emit('payment', {
        status: 'failed',
        reason: event.reason,
      })
      this.logger.info({ eventId: event.eventId, userId: event.userId }, 'Payment failure notification sent')
    } catch (error) {
      // Handlers never throw — log and continue
      this.logger.error({ error, eventId: event.eventId }, 'Failed to send payment failure notification')
    }
  }
}
