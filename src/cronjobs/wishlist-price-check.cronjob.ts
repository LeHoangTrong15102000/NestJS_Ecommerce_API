import { Injectable } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { Cron, CronExpression } from '@nestjs/schedule'
import { WishlistProducer } from 'src/routes/wishlist/wishlist.producer'

@Injectable()
export class WishlistPriceCheckCronjob {
  private isRunning = false

  constructor(
    @InjectPinoLogger(WishlistPriceCheckCronjob.name) private readonly logger: PinoLogger,
    private readonly wishlistProducer: WishlistProducer,
  ) {}

  /**
   * Run price check daily at 2 AM
   * This will queue the price check job to be processed by WishlistConsumer
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handlePriceCheck() {
    // Prevent concurrent executions
    if (this.isRunning) {
      this.logger.warn('Price check cron job is already running, skipping...')
      return
    }

    this.isRunning = true
    this.logger.info('Triggering daily wishlist price check...')

    try {
      await this.wishlistProducer.addPriceCheckJob()
      this.logger.info('Price check job queued successfully')
    } catch (error) {
      this.logger.error('Failed to queue price check job:', error)
    } finally {
      this.isRunning = false
    }
  }
}
