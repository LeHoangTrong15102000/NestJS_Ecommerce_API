import { DomainEvent } from 'src/events/domain-event.base'

export class ProductPriceChangedEvent extends DomainEvent {
  readonly eventName = 'product.price-changed'

  constructor(
    public readonly productId: number,
    public readonly oldPrice: number,
    public readonly newPrice: number,
  ) {
    super(productId)
  }
}
