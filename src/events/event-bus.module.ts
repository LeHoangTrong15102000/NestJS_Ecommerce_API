import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { PaymentNotificationHandler } from 'src/events/handlers/payment-notification.handler'
import { PaymentFailureHandler } from 'src/events/handlers/payment-failure.handler'
import { UserWelcomeHandler } from 'src/events/handlers/user-welcome.handler'
import { PriceAlertHandler } from 'src/events/handlers/price-alert.handler'
import { WebsocketModule } from 'src/websockets/websocket.module'
import { WishlistModule } from 'src/routes/wishlist/wishlist.module'

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Wildcard support for event name patterns
      wildcard: false,
      // Delimiter for namespaced events
      delimiter: '.',
      // Max listeners per event
      maxListeners: 20,
      // Verbose memory leak warnings
      verboseMemoryLeak: false,
      // Ignore errors thrown in event handlers
      ignoreErrors: false,
    }),
    WebsocketModule,
    WishlistModule,
  ],
  providers: [
    PaymentNotificationHandler,
    PaymentFailureHandler,
    UserWelcomeHandler,
    PriceAlertHandler,
  ],
  exports: [EventEmitterModule],
})
export class EventBusModule {}
