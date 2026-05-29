import { DomainEvent } from 'src/events/domain-event.base'

export class PaymentCompletedEvent extends DomainEvent {
  readonly eventName = 'payment.completed'

  constructor(
    public readonly paymentId: number,
    public readonly userId: number,
  ) {
    super(paymentId)
  }
}
