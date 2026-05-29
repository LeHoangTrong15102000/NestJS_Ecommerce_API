import { DomainEvent } from 'src/events/domain-event.base'

export class UserRegisteredEvent extends DomainEvent {
  readonly eventName = 'user.registered'

  constructor(
    public readonly userId: number,
    public readonly email: string,
  ) {
    super(userId)
  }
}
