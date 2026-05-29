import { randomUUID } from 'crypto'

/**
 * Abstract base class for all domain events.
 * Events are fire-and-forget for post-transaction side effects.
 */
export abstract class DomainEvent {
  readonly eventId: string
  readonly occurredAt: Date
  readonly aggregateId: string
  abstract readonly eventName: string

  constructor(aggregateId: string | number) {
    this.eventId = randomUUID()
    this.occurredAt = new Date()
    this.aggregateId = String(aggregateId)
  }
}
