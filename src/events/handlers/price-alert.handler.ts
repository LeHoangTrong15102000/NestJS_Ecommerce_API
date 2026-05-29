import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { ProductPriceChangedEvent } from 'src/events/definitions'
import { WishlistRepo } from 'src/routes/wishlist/wishlist.repo'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'

@Injectable()
export class PriceAlertHandler {
  constructor(
    @InjectPinoLogger(PriceAlertHandler.name) private readonly logger: PinoLogger,
    private readonly wishlistRepo: WishlistRepo,
    private readonly wishlistProducer: WishlistProducer,
  ) {}

  @OnEvent('product.price-changed', { async: true })
  async handle(event: ProductPriceChangedEvent): Promise<void> {
    try {
      // Only process price drops
      if (event.newPrice >= event.oldPrice) {
        return
      }

      const priceDropPercentage = ((event.oldPrice - event.newPrice) / event.oldPrice) * 100

      // Only alert on meaningful drops (>= 5%)
      if (priceDropPercentage < 5) {
        return
      }

      // Get all wishlist items for this product that have price drop notifications enabled
      const items = await this.wishlistRepo.getItemsForPriceCheck()
      const affectedItems = items.filter(
        (item) => item.product?.id === event.productId && item.notifyOnPriceDrops,
      )

      if (affectedItems.length === 0) {
        return
      }

      this.logger.info(
        { eventId: event.eventId, productId: event.productId, affectedCount: affectedItems.length },
        'Enqueuing price alert jobs for product price change',
      )

      const processedUsers = new Set<number>()

      for (const item of affectedItems) {
        try {
          // Deduplicate per user per product
          if (processedUsers.has(item.user.id)) {
            continue
          }
          processedUsers.add(item.user.id)

          await this.wishlistProducer.addSendPriceAlertJob({
            userId: item.user.id,
            userEmail: item.user.email,
            userName: item.user.name,
            productId: event.productId,
            productName: item.product?.name || 'Product',
            oldPrice: event.oldPrice,
            newPrice: event.newPrice,
            priceDropPercentage: Math.round(priceDropPercentage * 100) / 100,
            wishlistItemId: item.id,
          })
        } catch (itemError) {
          this.logger.error(
            { error: itemError, eventId: event.eventId, wishlistItemId: item.id },
            'Failed to enqueue price alert job for wishlist item',
          )
        }
      }
    } catch (error) {
      // Handlers never throw — log and continue
      this.logger.error(
        { error, eventId: event.eventId },
        'Failed to process product price changed event',
      )
    }
  }
}
