# Event System

## Overview

The event system has two layers:

1. **BullMQ** — durable background job queues backed by Redis (for delayed/retryable work)
2. **Domain Events** — in-process pub/sub via EventEmitter2 (for post-transaction side effects)
3. **WebSockets** — real-time push to connected clients via Socket.io

## BullMQ Queues

### Architecture

Producers live in feature modules co-located with the business logic that enqueues jobs. Consumers live in `src/queues/` as standalone workers. Queue and job name constants are centralized in `src/shared/constants/queue.constant.ts`.

Global BullMQ configuration (in `AppModule`):

- Retry policy: 3 attempts, exponential backoff starting at 2 seconds
- Completed jobs: removed after 1 hour (keep last 1000)
- Failed jobs: removed after 24 hours (keep last 5000)

### Payment Queue (`payment`)

**Purpose:** Auto-cancel unpaid orders after 24 hours.

**Producer (enqueue):** `src/routes/order/order.producer.ts` (`OrderProducer`)

**Producer (removal):** `src/routes/payment/payment.producer.ts` (`PaymentProducer`)

When an order is created, `OrderProducer.addCancelPaymentJob(paymentId)` enqueues a `cancel-payment` job with a 24-hour delay. If the payment is completed before the delay fires, the job is removed via `PaymentProducer.removeJob(paymentId)`. `PaymentProducer` only handles job removal — it does not enqueue jobs.

**Consumer:** `src/queues/payment.consumer.ts` (`PaymentConsumer`)

Processes `cancel-payment` jobs:

1. Calls `SharedPaymentRepository.cancelPaymentAndOrder(paymentId)` to cancel both the payment and its associated order
2. Emits `PaymentFailedEvent` domain event (decoupled from WebSocket notification)

**Job flow:**

```
POST /v1/order/create
    │
    ▼
OrderService creates order + payment record
    │
    ▼
OrderProducer.addCancelPaymentJob(paymentId, delay=24h)
    │
    ├── Payment completed before 24h?
    │   └── PaymentProducer.removeJob(paymentId)  ← job removed
    │
    └── 24h elapsed without payment?
        └── PaymentConsumer processes cancel-payment job
            └── Emits PaymentFailedEvent
                └── PaymentFailureHandler → WebSocket push to user
```

### Wishlist Queue (`wishlist`)

**Purpose:** Price alert notifications when product prices drop to user's target price.

**Producer:** `src/routes/wishlist/wishlist.producer.ts` (`WishlistProducer`)

**Consumer:** `src/queues/wishlist.consumer.ts` (`WishlistConsumer`)

Jobs: `price-check`, `send-price-alert`

## Domain Events

Domain events use `@nestjs/event-emitter` (EventEmitter2) for in-process pub/sub. They are fire-and-forget — handlers never throw (errors are logged and swallowed).

### Base Class

`src/events/domain-event.base.ts`

All events extend `DomainEvent`:

```typescript
abstract class DomainEvent {
  readonly eventId: string // UUID
  readonly occurredAt: Date
  readonly aggregateId: string // string representation of the entity ID
  abstract readonly eventName: string
}
```

### Event Definitions

`src/events/definitions/`

| Event                      | Event Name              | Payload                             | Emitted By      |
| -------------------------- | ----------------------- | ----------------------------------- | --------------- |
| `PaymentCompletedEvent`    | `payment.completed`     | `paymentId`, `userId`, `amount`     | PaymentService  |
| `PaymentFailedEvent`       | `payment.failed`        | `paymentId`, `userId`, `reason`     | PaymentConsumer |
| `UserRegisteredEvent`      | `user.registered`       | `userId`, `email`, `name`           | AuthService     |
| `ProductPriceChangedEvent` | `product.price-changed` | `productId`, `oldPrice`, `newPrice` | ProductService  |

### Event Handlers

`src/events/handlers/`

| Handler                      | Listens To              | Action                                                                   |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `PaymentFailureHandler`      | `payment.failed`        | Pushes `payment` WebSocket event with `status: 'failed'` to user's room  |
| `PaymentNotificationHandler` | `payment.completed`     | Pushes `payment` WebSocket event with `status: 'success'` to user's room |
| `UserWelcomeHandler`         | `user.registered`       | Sends welcome email via EmailService                                     |
| `PriceAlertHandler`          | `product.price-changed` | Checks wishlist target prices, enqueues price alert jobs                 |

### Emitting Events

```typescript
// In a service:
this.eventEmitter.emit('payment.failed', new PaymentFailedEvent(paymentId, userId, 'Payment timeout'))
```

### Handling Events

```typescript
@Injectable()
export class MyHandler {
  @OnEvent('payment.failed', { async: true })
  async handle(event: PaymentFailedEvent): Promise<void> {
    // Never throw — log errors and continue
    try {
      // side effect work
    } catch (error) {
      this.logger.error({ error, eventId: event.eventId }, 'Handler failed')
    }
  }
}
```

## WebSocket Gateways

### Chat Gateway (`/chat`)

`src/websockets/enhanced-chat.gateway.ts` — `EnhancedChatGateway`

Namespace: `/chat`

**Authentication:** JWT token passed as `auth.token` in Socket.io handshake options. The connection handler validates the token and attaches `userId` to the socket.

**Rate limiting:** Token bucket per socket per event type (e.g., `send_message`: 10/min, `typing_start`: 30/min).

**Client events (incoming):**

| Event                | Payload                             | Description                |
| -------------------- | ----------------------------------- | -------------------------- |
| `join_conversation`  | `{ conversationId }`                | Join a conversation room   |
| `leave_conversation` | `{ conversationId }`                | Leave a conversation room  |
| `send_message`       | `{ conversationId, content, type }` | Send a message             |
| `edit_message`       | `{ messageId, content }`            | Edit a sent message        |
| `delete_message`     | `{ messageId }`                     | Delete a message           |
| `typing_start`       | `{ conversationId }`                | Broadcast typing indicator |
| `typing_stop`        | `{ conversationId }`                | Stop typing indicator      |
| `mark_as_read`       | `{ conversationId, messageId }`     | Mark messages as read      |
| `react_to_message`   | `{ messageId, emoji }`              | Add emoji reaction         |
| `remove_reaction`    | `{ messageId, emoji }`              | Remove emoji reaction      |

**Server events (outgoing):**

| Event              | Description                   |
| ------------------ | ----------------------------- |
| `new_message`      | New message in a conversation |
| `message_edited`   | Message was edited            |
| `message_deleted`  | Message was deleted           |
| `typing_indicator` | User is typing                |
| `user_online`      | User came online              |
| `user_offline`     | User went offline             |
| `message_read`     | Messages marked as read       |
| `reaction_added`   | Reaction added to message     |
| `reaction_removed` | Reaction removed from message |
| `rate_limited`     | Client exceeded rate limit    |

**Typing cleanup:** Expired typing indicators are cleaned up every 30 seconds via `setInterval`. The interval is cleared on module destroy to prevent memory leaks.

**Online presence:** Tracked in Redis via `ChatRedisService`. Users are marked online on connect and offline when all their sockets disconnect.

### Payment Gateway (`payment`)

`src/websockets/payment.gateway.ts` — `PaymentGateway`

Namespace: `payment`

**Purpose:** Push real-time payment status updates to users.

**Client events (incoming):**

| Event        | Payload  | Description              |
| ------------ | -------- | ------------------------ |
| `send-money` | `string` | Test event (echoes back) |

**Server events (outgoing):**

| Event           | Payload                                      | Description           |
| --------------- | -------------------------------------------- | --------------------- |
| `receive-money` | `{ data: string }`                           | Echo of send-money    |
| `payment`       | `{ status: 'success' \| 'failed', reason? }` | Payment status update |

Payment status events are emitted to a user-specific room (`user:<userId>`) so only the relevant user receives the notification.

## Cron Jobs

| Job                           | Class                       | Schedule | Purpose                                                         |
| ----------------------------- | --------------------------- | -------- | --------------------------------------------------------------- |
| Remove expired refresh tokens | `RemoveRefreshTokenCronjob` | Daily    | Purge expired `RefreshToken` records from DB                    |
| Wishlist price check          | `WishlistPriceCheckCronjob` | Daily    | Trigger price check for all wishlisted items with target prices |
