import { DomainEvent } from 'src/events/domain-event.base'

export class PaymentFailedEvent extends DomainEvent {
  readonly eventName = 'payment.failed'

  constructor(
    public readonly paymentId: number,
    public readonly userId: number,
    public readonly reason: string,
  ) {
    super(paymentId)
  }
}
