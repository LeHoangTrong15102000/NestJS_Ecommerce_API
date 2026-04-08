# Hướng dẫn Setup RabbitMQ cho NestJS Ecommerce (Enterprise Pattern)

> Hướng dẫn tích hợp RabbitMQ vào dự án NestJS Ecommerce hiện tại, chạy **song song** với BullMQ đang có. Viết theo đúng conventions và patterns của codebase — Zod config, Prisma, `SharedModule`, producer/consumer separation, docker-compose, v.v.

---

## Mục lục

1. [Kiến trúc tổng quan — BullMQ + RabbitMQ song song](#1-kiến-trúc-tổng-quan--bullmq--rabbitmq-song-song)
2. [Cài đặt dependencies](#2-cài-đặt-dependencies)
3. [Docker Compose — thêm RabbitMQ service](#3-docker-compose--thêm-rabbitmq-service)
4. [Environment variables — cấu hình Zod config](#4-environment-variables--cấu-hình-zod-config)
5. [Prisma Outbox table](#5-prisma-outbox-table)
6. [RabbitMQ Module — kết nối và quản lý](#6-rabbitmq-module--kết-nối-và-quản-lý)
7. [Event Bus Service — Producer](#7-event-bus-service--producer)
8. [Outbox Worker — đảm bảo transactional consistency](#8-outbox-worker--đảm-bảo-transactional-consistency)
9. [Event Consumers — xử lý message](#9-event-consumers--xử-lý-message)
10. [⚠️ QUAN TRỌNG: Hybrid Application trong main.ts](#10-️-quan-trọng-hybrid-application-trong-maints)
11. [Tích hợp vào domain — Order flow ví dụ](#11-tích-hợp-vào-domain--order-flow-ví-dụ)
12. [Dead Letter Queue + Retry](#12-dead-letter-queue--retry)
13. [Health Check](#13-health-check)
14. [Testing](#14-testing)
15. [Phân biệt rõ: BullMQ làm gì, RabbitMQ làm gì](#15-phân-biệt-rõ-bullmq-làm-gì-rabbitmq-làm-gì)
16. [Checklist triển khai](#16-checklist-triển-khai)

---

## 1) Kiến trúc tổng quan — BullMQ + RabbitMQ song song

```
┌──────────────────────────────────────────────────────────────────────┐
│                          NestJS Application                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ BullMQ (giữ nguyên — job nền nội bộ, delay, cron)              │ │
│  │                                                                 │ │
│  │  payment.producer.ts → [payment queue] → payment.consumer.ts   │ │
│  │  wishlist.producer.ts → [wishlist queue] → wishlist.consumer.ts │ │
│  │  cronjobs/ → scheduled jobs                                     │ │
│  │                                                                 │ │
│  │  Transport: Redis (envConfig.REDIS_URL)                         │ │
│  │  Use case: cancel-payment (24h delay), price-check, cron        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ RabbitMQ (mới — cross-service events, transactional outbox)     │ │
│  │                                                                 │ │
│  │  Domain Service                                                 │ │
│  │    └─ Prisma $transaction:                                      │ │
│  │         1. UPDATE domain table                                  │ │
│  │         2. INSERT INTO Outbox                                   │ │
│  │                                                                 │ │
│  │  OutboxWorker (cron 1s)                                         │ │
│  │    └─ Read Outbox → Publish to RabbitMQ → Mark published        │ │
│  │                                                                 │ │
│  │  RabbitMQ Consumers                                             │ │
│  │    └─ order.event.consumer.ts                                   │ │
│  │    └─ inventory.event.consumer.ts                               │ │
│  │    └─ notification.event.consumer.ts                            │ │
│  │                                                                 │ │
│  │  Transport: AMQP (envConfig.RABBITMQ_URL)                       │ │
│  │  Use case: order.created, payment.succeeded, sku.stock_changed  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc phân chia**:
- **BullMQ**: giữ nguyên code hiện tại — delay job, cron job, job nền nội bộ 1 service.
- **RabbitMQ**: event-driven communication — khi domain thay đổi state (`order.created`, `payment.succeeded`), thông báo cho nhiều consumer khác nhau qua Outbox pattern.

---

## 2) Cài đặt dependencies

```bash
pnpm add @nestjs/microservices amqplib amqp-connection-manager
pnpm add -D @types/amqplib
```

| Package | Vai trò |
|---|---|
| `@nestjs/microservices` | NestJS transport layer cho RabbitMQ (ClientProxy, MessagePattern, EventPattern) |
| `amqplib` | AMQP 0-9-1 client cho Node.js |
| `amqp-connection-manager` | Auto-reconnect, channel pooling (được `@nestjs/microservices` dùng nội bộ) |
| `@types/amqplib` | TypeScript definitions |

> Lưu ý: **Không xóa** `@nestjs/bullmq` hay `bullmq`. Hai hệ thống chạy song song.

---

## 3) Docker Compose — thêm RabbitMQ service

### docker-compose.yml (development)

Thêm service `rabbitmq` ngay sau service `redis`:

```yaml
  # RabbitMQ for event-driven messaging
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: ecom-rabbitmq
    hostname: ecom-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: ecom_user
      RABBITMQ_DEFAULT_PASS: ecom_password
      RABBITMQ_DEFAULT_VHOST: ecom_vhost
    ports:
      - '5672:5672'     # AMQP protocol
      - '15672:15672'   # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - ecom-network
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
```

Thêm volume:

```yaml
volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:    # ← thêm dòng này
```

Thêm depends_on cho `api`:

```yaml
  api:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:                          # ← thêm
        condition: service_healthy       # ← thêm
    environment:
      # ... env hiện có ...

      # RabbitMQ Configuration
      RABBITMQ_URL: amqp://ecom_user:ecom_password@rabbitmq:5672/ecom_vhost
```

### docker-compose.prod.yml (production)

```yaml
  # RabbitMQ for event-driven messaging
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: ecom-rabbitmq-prod
    hostname: ecom-rabbitmq-prod
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-ecom_user}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:?RABBITMQ_PASSWORD is required}
      RABBITMQ_DEFAULT_VHOST: ${RABBITMQ_VHOST:-ecom_vhost}
    ports:
      - '${RABBITMQ_PORT:-5672}:5672'
      # Management UI - chỉ expose nếu cần, KHÔNG public ra internet
      # - '${RABBITMQ_MANAGEMENT_PORT:-15672}:15672'
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - ecom-network
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'
```

Thêm volume và depends_on cho `api`:

```yaml
volumes:
  postgres_data:
    # ...
  redis_data:
    # ...
  rabbitmq_data:
    driver: local
    labels:
      com.ecommerce.description: 'RabbitMQ data volume for production'
      com.ecommerce.backup: 'optional'
```

```yaml
  api:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    environment:
      # ... env hiện có ...
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-ecom_user}:${RABBITMQ_PASSWORD}@rabbitmq:5672/${RABBITMQ_VHOST:-ecom_vhost}
```

### Truy cập Management UI

Sau khi `docker compose up`, mở: http://localhost:15672

- Username: `ecom_user`
- Password: `ecom_password`
- Có thể xem queues, exchanges, connections, message rates, DLQ.

---

## 4) Environment variables — cấu hình Zod config

### .env

Thêm vào cuối file `.env`:

```env
# RabbitMQ Configuration
RABBITMQ_URL=amqp://ecom_user:ecom_password@localhost:5672/ecom_vhost
```

### .env.example

Thêm:

```env
# RabbitMQ Configuration
# For development: amqp://user:password@localhost:5672/vhost
# For Docker: amqp://user:password@rabbitmq:5672/vhost
RABBITMQ_URL=amqp://ecom_user:ecom_password@localhost:5672/ecom_vhost
```

### src/shared/config.ts

Thêm `RABBITMQ_URL` vào Zod schema, ngay sau block Redis:

```ts
const configSchema = z.object({
  // ... tất cả config hiện có ...

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),

  // Mux
  // ...
})
```

> Theo đúng pattern hiện tại: Zod validate ở startup → process.exit(1) nếu thiếu. Không dùng `@nestjs/config` / `ConfigService`.

---

## 5) Prisma Outbox table

### Thêm model vào prisma/schema.prisma

```prisma
model Outbox {
  id            String    @id @default(uuid()) @db.Uuid
  aggregateType String    @db.VarChar(100)
  aggregateId   String    @db.VarChar(100)
  eventType     String    @db.VarChar(100)
  /// [OutboxPayload]
  payload       Json
  publishedAt   DateTime?
  createdAt     DateTime  @default(now())

  @@index([publishedAt])
  @@index([createdAt])
}
```

### Chạy migration

```bash
npx prisma migrate dev --name add_outbox_table
```

### Cleanup job (thêm vào cron)

Outbox records đã publish nên được xóa sau 7 ngày để tránh table phình to:

```ts
// Thêm vào cronjobs/ hoặc trong OutboxWorker
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async cleanupOutbox() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const result = await this.prismaService.outbox.deleteMany({
    where: {
      publishedAt: { not: null, lt: sevenDaysAgo },
    },
  })
  this.logger.log(`Cleaned up ${result.count} published outbox records`)
}
```

---

## 6) RabbitMQ Module — kết nối và quản lý

### src/shared/constants/rabbitmq.constant.ts

```ts
// RabbitMQ exchange names
export const ECOM_EXCHANGE = 'ecom.events'
export const ECOM_DLX_EXCHANGE = 'ecom.events.dlx'

// Queue names
export const ORDER_EVENTS_QUEUE = 'order_events_q'
export const PAYMENT_EVENTS_QUEUE = 'payment_events_q'
export const INVENTORY_EVENTS_QUEUE = 'inventory_events_q'
export const NOTIFICATION_EVENTS_QUEUE = 'notification_events_q'
export const MEDIA_EVENTS_QUEUE = 'media_events_q'
export const CACHE_INVALIDATION_QUEUE = 'cache_invalidation_q'

// DLQ names
export const ORDER_EVENTS_DLQ = 'order_events_dlq'
export const PAYMENT_EVENTS_DLQ = 'payment_events_dlq'
export const INVENTORY_EVENTS_DLQ = 'inventory_events_dlq'
export const NOTIFICATION_EVENTS_DLQ = 'notification_events_dlq'

// Event types
export const OrderEvents = {
  CREATED: 'order.created',
  STATUS_CHANGED: 'order.status_changed',
  CANCELLED: 'order.cancelled',
  EXPIRED: 'order.expired',
} as const

export const PaymentEvents = {
  CREATED: 'payment.created',
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
} as const

export const InventoryEvents = {
  STOCK_RESERVED: 'sku.stock_reserved',
  STOCK_RELEASED: 'sku.stock_released',
  STOCK_LOW: 'sku.stock_low',
} as const

export const NotificationEvents = {
  SEND_EMAIL: 'notification.send_email',
  SEND_PUSH: 'notification.send_push',
} as const

export const CacheEvents = {
  INVALIDATE: 'cache.invalidate',
} as const

// RabbitMQ client injection token
export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT'
```

### src/shared/rabbitmq/rabbitmq.module.ts

`ClientsModule.register()` tạo **ClientProxy** — dùng để **publish** message (producer side).

> **Lưu ý quan trọng**: Theo [NestJS docs](https://docs.nestjs.com/microservices/rabbitmq), `exchange` và `exchangeType` chỉ hoạt động khi `wildcards: true` được bật. Không có `wildcards`, NestJS sẽ KHÔNG tạo exchange.

```ts
import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import envConfig from 'src/shared/config'
import { RABBITMQ_CLIENT, ECOM_EXCHANGE, ORDER_EVENTS_QUEUE } from 'src/shared/constants/rabbitmq.constant'
import { EventBusService } from './event-bus.service'
import { OutboxWorker } from './outbox.worker'

@Module({
  imports: [
    ClientsModule.register([
      {
        name: RABBITMQ_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [envConfig.RABBITMQ_URL],
          queue: ORDER_EVENTS_QUEUE,
          queueOptions: {
            durable: true,
          },
          wildcards: true,
          exchange: ECOM_EXCHANGE,
          exchangeType: 'topic',
          persistent: true,
          socketOptions: {
            heartbeatIntervalInSeconds: 30,
          },
        },
      },
    ]),
  ],
  providers: [EventBusService, OutboxWorker],
  exports: [EventBusService],
})
export class RabbitmqModule {}
```

**Giải thích options:**

| Option | Giá trị | Tại sao |
|---|---|---|
| `wildcards` | `true` | **Bắt buộc** để `exchange` và `exchangeType` hoạt động |
| `exchange` | `'ecom.events'` | Tên exchange — NestJS tự tạo nếu chưa có |
| `exchangeType` | `'topic'` | Cho phép routing theo pattern (`order.*`, `payment.*`) |
| `persistent` | `true` | Message survive broker restart |
| `queueOptions.durable` | `true` | Queue survive broker restart |

> **KHÔNG đặt `x-message-ttl` trên queue chính.** TTL trên queue nghĩa là MỌI message (kể cả message bình thường đang chờ xử lý) sẽ bị dead-letter sau thời gian đó. Khi consumer chịu tải nặng → message chờ lâu → bị dead-letter → mất data. TTL chỉ nên dùng cho retry queue riêng (xem Section 12).

### Đăng ký trong AppModule

Thêm `RabbitmqModule` vào imports của `app.module.ts`, ngay sau `BullModule.forRoot(...)`:

```ts
import { RabbitmqModule } from 'src/shared/rabbitmq/rabbitmq.module'

@Module({
  imports: [
    // ... LoggerModule, CacheModule, ScheduleModule ...

    // BullMQ for background job processing (giữ nguyên)
    BullModule.forRoot({ /* ... giữ nguyên ... */ }),

    // RabbitMQ for event-driven messaging (mới)
    RabbitmqModule,

    // ... I18nModule, ThrottlerModule, WebsocketModule, SharedModule ...
  ],
  // ...
})
export class AppModule {}
```

---

## 7) Event Bus Service — Producer

### src/shared/rabbitmq/event-bus.service.ts

```ts
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { RABBITMQ_CLIENT } from 'src/shared/constants/rabbitmq.constant'
import { lastValueFrom, timeout, retry } from 'rxjs'

export interface DomainEvent {
  eventType: string
  aggregateType: string
  aggregateId: string
  payload: Record<string, any>
  metadata?: {
    correlationId?: string
    causationId?: string
    userId?: number
    timestamp?: string
  }
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name)

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  async onModuleInit() {
    try {
      await this.client.connect()
      this.logger.log('RabbitMQ client connected successfully')
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error)
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventWithMeta = {
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        eventId: crypto.randomUUID(),
      },
    }

    try {
      await lastValueFrom(
        this.client.emit(event.eventType, eventWithMeta).pipe(
          timeout(5000),
          retry({ count: 2, delay: 1000 }),
        ),
      )
      this.logger.log(`Event published: ${event.eventType} [${event.aggregateType}:${event.aggregateId}]`)
    } catch (error) {
      this.logger.error(
        `Failed to publish event: ${event.eventType} [${event.aggregateType}:${event.aggregateId}]`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event)
    }
  }
}
```

---

## 8) Outbox Worker — đảm bảo transactional consistency

### src/shared/rabbitmq/outbox.worker.ts

Đây là trái tim của pattern — đọc Outbox chưa publish, gửi lên RabbitMQ, đánh dấu đã publish.

```ts
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from 'src/shared/services/prisma.service'
import { EventBusService } from './event-bus.service'

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name)
  private isProcessing = false

  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventBusService: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async processOutbox() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const pendingEvents = await this.prismaService.outbox.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      })

      if (pendingEvents.length === 0) return

      for (const event of pendingEvents) {
        try {
          await this.eventBusService.publish({
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload as Record<string, any>,
            metadata: {
              correlationId: event.id,
            },
          })

          await this.prismaService.outbox.update({
            where: { id: event.id },
            data: { publishedAt: new Date() },
          })
        } catch (error) {
          this.logger.error(
            `Failed to publish outbox event ${event.id} (${event.eventType}): ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          )
          // Không throw — tiếp tục event tiếp theo, retry ở lần cron sau
        }
      }

      this.logger.debug(`Processed ${pendingEvents.length} outbox events`)
    } catch (error) {
      this.logger.error('Outbox worker error', error instanceof Error ? error.stack : undefined)
    } finally {
      this.isProcessing = false
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupPublished() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const result = await this.prismaService.outbox.deleteMany({
      where: {
        publishedAt: { not: null, lt: sevenDaysAgo },
      },
    })
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} published outbox records`)
    }
  }
}
```

### Tại sao dùng `@Cron(EVERY_SECOND)` thay vì trigger trực tiếp?

| Approach | Ưu điểm | Nhược điểm |
|---|---|---|
| **Poll (cron 1s)** — chọn cách này | Đơn giản, reliable, không có race condition | 1s latency tối đa |
| Direct trigger sau transaction | Latency thấp hơn | Nếu publish fail thì mất event, cần thêm retry logic phức tạp |
| CDC (Debezium) | Zero latency, decoupled | Phức tạp vận hành, cần Kafka Connect |

Với throughput hiện tại (chưa cần hàng triệu event/s), poll 1 giây là đủ tốt.

---

## 9) Event Consumers — xử lý message

### src/queues/order-event.consumer.ts

```ts
import { Controller, Logger, Inject } from '@nestjs/common'
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices'
import { OrderEvents, PaymentEvents } from 'src/shared/constants/rabbitmq.constant'
import { DomainEvent } from 'src/shared/rabbitmq/event-bus.service'
import Redis from 'ioredis'

@Controller()
export class OrderEventConsumer {
  private readonly logger = new Logger(OrderEventConsumer.name)
  private readonly redisClient: Redis

  constructor() {
    // Dùng ioredis trực tiếp (dự án đã có ioredis trong dependencies)
    // Hoặc inject qua provider nếu đã có Redis provider trong SharedModule
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  @EventPattern(OrderEvents.CREATED)
  async handleOrderCreated(@Payload() event: DomainEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef()
    const originalMsg = context.getMessage()

    try {
      const eventId = event.metadata?.eventId
      this.logger.log(`Processing ${event.eventType}: order ${event.aggregateId} [eventId: ${eventId}]`)

      // Idempotency check — dùng Redis SET, KHÔNG dùng Outbox publishedAt
      // (publishedAt = "đã publish lên RabbitMQ" ≠ "đã được consumer xử lý")
      if (eventId) {
        const alreadyProcessed = await this.checkProcessed(eventId)
        if (alreadyProcessed) {
          this.logger.warn(`Event ${eventId} already processed, skipping`)
          channel.ack(originalMsg)
          return
        }
      }

      // Business logic: thông báo cho inventory, payment, etc.
      // (sẽ được mở rộng tùy nghiệp vụ)

      // Đánh dấu đã xử lý TRƯỚC khi ACK — đảm bảo idempotent
      if (eventId) await this.markProcessed(eventId)
      channel.ack(originalMsg)

      this.logger.log(`Processed ${event.eventType}: order ${event.aggregateId}`)
    } catch (error) {
      this.logger.error(
        `Failed to process ${event.eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      )
      // KHÔNG dùng nack(msg, false, true) — sẽ tạo vòng lặp vô hạn
      // Xem Section 12 để hiểu retry strategy đúng
      channel.nack(originalMsg, false, false)
    }
  }

  @EventPattern(PaymentEvents.SUCCEEDED)
  async handlePaymentSucceeded(@Payload() event: DomainEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef()
    const originalMsg = context.getMessage()

    try {
      this.logger.log(`Processing ${event.eventType}: payment for order ${event.payload.orderId}`)

      // Cập nhật order status, gửi notification, etc.

      channel.ack(originalMsg)
    } catch (error) {
      this.logger.error(`Failed to process ${event.eventType}`, error instanceof Error ? error.stack : undefined)
      channel.nack(originalMsg, false, false)
    }
  }

  // ─── Idempotency: dùng Redis SET với TTL ─────────────────────────────────
  //
  // Tại sao KHÔNG dùng Outbox.publishedAt?
  //   publishedAt !== null nghĩa là "event đã publish lên RabbitMQ"
  //   KHÔNG phải "consumer đã xử lý xong"
  //   → Mọi event tới consumer ĐỀU đã published → check luôn = true → skip hết
  //
  // Tại sao dùng Redis?
  //   - Nhanh (O(1) SET/GET)
  //   - TTL tự cleanup (không cần cron xóa)
  //   - Shared giữa nhiều consumer instances
  // ─────────────────────────────────────────────────────────────────────────

  private async checkProcessed(eventId: string): Promise<boolean> {
    const key = `processed_event:${eventId}`
    const exists = await this.redisClient.get(key)
    return exists !== null
  }

  private async markProcessed(eventId: string): Promise<void> {
    const key = `processed_event:${eventId}`
    await this.redisClient.set(key, '1', 'EX', 86400) // TTL 24 giờ
  }
}
```

### Đăng ký consumer trong AppModule

Thêm vào `providers` của `app.module.ts`, ngay sau các BullMQ consumers:

```ts
import { OrderEventConsumer } from 'src/queues/order-event.consumer'

@Module({
  // ...
  providers: [
    // ...

    // BullMQ consumers (giữ nguyên)
    PaymentConsumer,
    WishlistConsumer,

    // RabbitMQ event consumers (mới)
    OrderEventConsumer,

    // Cronjobs (giữ nguyên)
    RemoveRefreshTokenCronjob,
    WishlistPriceCheckCronjob,
  ],
})
export class AppModule {}
```

---

## 10) ⚠️ QUAN TRỌNG: Hybrid Application trong main.ts

> Đây là bước **bắt buộc** mà nếu bỏ qua, toàn bộ RabbitMQ consumer (`@EventPattern`) sẽ **không bao giờ nhận được message** — không có lỗi, không có warning, chỉ là im lặng hoàn toàn.

### Vấn đề: HTTP App thuần không lắng nghe RabbitMQ

`main.ts` hiện tại tạo một HTTP app thuần:

```ts
// Hiện tại — chỉ có HTTP
const app = await NestFactory.create<NestExpressApplication>(AppModule)
await app.listen(3000)
// → Chỉ nhận HTTP requests
// → @EventPattern('order.created') bị IGNORE hoàn toàn ❌
```

Khi dùng `@EventPattern` trong consumer, NestJS cần một **microservice transport** đang chạy để lắng nghe AMQP connection. Không có nó, các decorator này không làm gì cả.

### Giải pháp: Hybrid Application (HTTP + Microservice cùng process)

NestJS hỗ trợ **Hybrid App** — một process duy nhất vừa serve HTTP vừa lắng nghe message broker:

```
Hybrid App:
  NestFactory.create() → HTTP server (Express) ← HTTP clients
  app.connectMicroservice(RMQ transport) → AMQP consumer ← RabbitMQ
  app.startAllMicroservices() → bắt đầu lắng nghe RabbitMQ
  app.listen(3000) → bắt đầu nhận HTTP
```

### Cập nhật src/main.ts

```ts
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'  // ← import thêm
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger as PinoLogger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { WebsocketAdapter } from 'src/websockets/websocket.adapter'
import envConfig from 'src/shared/config'  // ← import thêm
import {
  ECOM_EXCHANGE,
  ORDER_EVENTS_QUEUE,
  ORDER_EVENTS_DLQ,
  PAYMENT_EVENTS_QUEUE,
  NOTIFICATION_EVENTS_QUEUE,
  INVENTORY_EVENTS_QUEUE,
} from 'src/shared/constants/rabbitmq.constant'  // ← import thêm
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  app.useLogger(app.get(PinoLogger))

  // ─── BƯỚC MỚI: Kết nối RabbitMQ microservice transports ─────────────────

  // Transport 1: Main queue — nhận events từ domain (order.created, payment.succeeded, ...)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [envConfig.RABBITMQ_URL],
      queue: ORDER_EVENTS_QUEUE,
      queueOptions: {
        durable: true,
        // KHÔNG đặt x-message-ttl ở đây — sẽ dead-letter message bình thường khi consumer chậm
      },
      wildcards: true,
      exchange: ECOM_EXCHANGE,
      exchangeType: 'topic',
      noAck: false,        // Manual ACK — phải ACK/NACK tường minh
      prefetchCount: 10,   // Tối đa 10 messages đang xử lý đồng thời
      socketOptions: {
        heartbeatIntervalInSeconds: 30,
      },
    },
  })

  // Transport 2: DLQ — nhận dead-lettered messages để log/alert/manual review
  // DLQ consumer cần transport riêng vì message giữ pattern gốc ('order.created'),
  // không match với @EventPattern('dlq') nếu dùng chung transport.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [envConfig.RABBITMQ_URL],
      queue: ORDER_EVENTS_DLQ,
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 5,
    },
  })
  // ──────────────────────────────────────────────────────────────────────────

  // CORS (giữ nguyên)
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3300', 'http://localhost:5173')
  }
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS environment variable must be set in production')
  }
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    maxAge: 86400,
  })

  // Helmet (giữ nguyên)
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
    }),
  )

  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback')

  // Swagger (giữ nguyên)
  const documentBuilder = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription('The API for the ecommerce application')
    .setVersion('1.0')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local Development')

  if (process.env.NODE_ENV === 'production' && process.env.API_URL) {
    documentBuilder.addServer(process.env.API_URL, 'Production')
  }

  const config = documentBuilder
    .addBearerAuth()
    .addApiKey({ name: 'authorization', type: 'apiKey' }, 'payment-api-key')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  })
  const cleanedDocument = cleanupOpenApiDoc(document)
  SwaggerModule.setup('api', app, cleanedDocument, {
    swaggerOptions: { persistAuthorization: true },
  })

  // WebSocket adapter (giữ nguyên)
  try {
    const websocketAdapter = new WebsocketAdapter(app)
    await websocketAdapter.connectToRedis()
    app.useWebSocketAdapter(websocketAdapter)
  } catch (error) {
    const logger = new Logger('Bootstrap')
    logger.error('Failed to initialize WebSocket adapter with Redis', error instanceof Error ? error.stack : error)
    if (process.env.NODE_ENV === 'production') throw error
    logger.warn('WebSocket disabled in development due to Redis connection failure')
  }

  // ─── BƯỚC MỚI: Start microservices TRƯỚC khi listen HTTP ─────────────────
  await app.startAllMicroservices()
  const logger = new Logger('Bootstrap')
  logger.log('RabbitMQ microservice transport started — listening for events')
  // ──────────────────────────────────────────────────────────────────────────

  await app.listen(process.env.PORT ?? 3000)

  app.enableShutdownHooks()

  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']
  for (const signal of signals) {
    process.on(signal, async () => {
      const logger = new Logger('Bootstrap')
      logger.log(`Received ${signal}, starting graceful shutdown...`)
      await app.close()  // Đóng cả HTTP + microservice transports
      logger.log('Application shut down gracefully')
      process.exit(0)
    })
  }
}

bootstrap()
```

### Các điểm thay đổi so với main.ts hiện tại

| Thay đổi | Lý do |
|---|---|
| `import { MicroserviceOptions, Transport }` | Cần cho `connectMicroservice()` |
| `import envConfig` | Dùng `RABBITMQ_URL` từ Zod config (không đọc `process.env` thô) |
| `app.connectMicroservice(...)` | Đăng ký RabbitMQ transport — consumer bắt đầu hoạt động |
| `await app.startAllMicroservices()` | **Bắt buộc** — khởi động tất cả transports đã register |
| Thứ tự: `startAllMicroservices` TRƯỚC `listen` | MQ ready trước HTTP — tránh race condition startup |
| `app.close()` xử lý cả HTTP + MQ | Graceful shutdown: drain queue + close connections |

### Mở rộng: thêm queue cho domain khác

Khi cần thêm queue riêng cho domain khác (ví dụ notification cần prefetchCount cao hơn):

```ts
// Queue 3: Notification events
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [envConfig.RABBITMQ_URL],
    queue: NOTIFICATION_EVENTS_QUEUE,
    queueOptions: { durable: true },
    wildcards: true,
    exchange: ECOM_EXCHANGE,
    exchangeType: 'topic',
    noAck: false,
    prefetchCount: 50,
  },
})

// startAllMicroservices() start TẤT CẢ transports đã register
await app.startAllMicroservices()
```

> **Lưu ý thực tế**: Với dự án hiện tại (monolith đang chuyển sang event-driven), bắt đầu với **2 transport** (main queue + DLQ) là đủ. Thêm queue sau khi có nhu cầu cụ thể.

---

## 11) Tích hợp vào domain — Order flow ví dụ

### Cách sử dụng trong service: ghi DB + Outbox cùng transaction

Ví dụ: khi tạo order, ghi Outbox event trong cùng transaction Prisma.

```ts
// Trong order.repo.ts hoặc order.service.ts
import { OrderEvents } from 'src/shared/constants/rabbitmq.constant'

async createOrder(data: CreateOrderData) {
  return this.prismaService.$transaction(async (tx) => {
    // 1. Tạo payment
    const payment = await tx.payment.create({
      data: { /* ... */ },
    })

    // 2. Tạo order
    const order = await tx.order.create({
      data: { /* ... */ },
    })

    // 3. Xóa cart items
    await tx.cartItem.deleteMany({
      where: { userId: data.userId },
    })

    // 4. Giảm stock
    await tx.$executeRaw`UPDATE "SKU" SET stock = stock - ${data.quantity} WHERE id = ${data.skuId}`

    // 5. Ghi Outbox event (cùng transaction — đảm bảo atomic)
    await tx.outbox.create({
      data: {
        aggregateType: 'Order',
        aggregateId: String(order.id),
        eventType: OrderEvents.CREATED,
        payload: {
          orderId: order.id,
          userId: data.userId,
          paymentId: payment.id,
          items: data.items,
          totalPrice: data.totalPrice,
        },
      },
    })

    return order
  })
}
```

**Luồng hoàn chỉnh**:

```
1. order.service.createOrder()
   └─ Prisma $transaction:
       ├─ INSERT Payment
       ├─ INSERT Order
       ├─ DELETE CartItems
       ├─ UPDATE SKU stock
       └─ INSERT Outbox { eventType: "order.created" }
                                   │
2. OutboxWorker (1s sau)           │
   └─ SELECT FROM Outbox WHERE publishedAt IS NULL
   └─ eventBusService.publish("order.created", payload)
   └─ UPDATE Outbox SET publishedAt = NOW()
                                   │
3. RabbitMQ                        │
   └─ Route "order.created" → order_events_q
                                   │
4. OrderEventConsumer              │
   └─ handleOrderCreated()
       ├─ Idempotency check
       ├─ Notify inventory service
       ├─ Send confirmation email
       └─ ACK message
```

### BullMQ job (giữ nguyên, không thay đổi)

Trong cùng flow, vẫn schedule cancel-payment job qua BullMQ:

```ts
// order.producer.ts — KHÔNG THAY ĐỔI
await this.addCancelPaymentJob(payment.id)
```

Hai hệ thống chạy độc lập, mỗi cái giải quyết bài toán khác nhau.

---

## 12) Dead Letter Queue + Retry

### Tại sao `nack + requeue` đơn giản KHÔNG hoạt động cho retry?

```
❌ SAI — nack(msg, false, true) tạo vòng lặp vô hạn:

  Consumer nhận message → fail → nack(requeue=true)
     ↑                                    │
     └────── message quay lại đầu queue ──┘
     (lặp lại NGAY LẬP TỨC, không delay, không đếm retry)
     → CPU 100%, log spam, không bao giờ dừng
```

RabbitMQ **không đếm retry**. Không có `x-retry-count` tự động. Cần tự implement.

### Chiến lược retry đúng: Header-based retry counting

Cách đơn giản và hiệu quả nhất cho dự án hiện tại — đếm retry qua custom header trong message:

```
Consumer nhận message → fail →
  1. Đọc header x-retry-count (mặc định 0)
  2. Nếu count < MAX_RETRIES:
     → nack(msg, false, false)  ← requeue = FALSE (quan trọng!)
     → Publish lại message MỚI với x-retry-count + 1 và delay
  3. Nếu count >= MAX_RETRIES:
     → nack(msg, false, false)  ← message bị drop khỏi queue
     → Log error + alert team
     → Lưu vào DB để manual review
```

### Cập nhật consumer với retry logic

```ts
// src/shared/rabbitmq/retry.helper.ts
import { RmqContext } from '@nestjs/microservices'
import { Logger } from '@nestjs/common'

const MAX_RETRIES = 3
const RETRY_HEADER = 'x-retry-count'

export interface RetryResult {
  shouldProcess: boolean
  retryCount: number
}

export function getRetryCount(context: RmqContext): number {
  const originalMsg = context.getMessage()
  const headers = originalMsg.properties?.headers || {}
  return parseInt(headers[RETRY_HEADER] || '0', 10)
}

export function rejectWithRetry(
  context: RmqContext,
  logger: Logger,
  eventType: string,
): 'retry' | 'dead-letter' {
  const channel = context.getChannelRef()
  const originalMsg = context.getMessage()
  const retryCount = getRetryCount(context)

  // KHÔNG requeue — message bị drop khỏi queue hiện tại
  channel.nack(originalMsg, false, false)

  if (retryCount < MAX_RETRIES) {
    logger.warn(
      `Event ${eventType} failed, retry ${retryCount + 1}/${MAX_RETRIES}`,
    )
    return 'retry'
  }

  logger.error(
    `Event ${eventType} exceeded max retries (${MAX_RETRIES}), sending to DLQ`,
  )
  return 'dead-letter'
}
```

### Cập nhật consumer sử dụng retry helper

```ts
// src/queues/order-event.consumer.ts (cập nhật)
import { Controller, Logger } from '@nestjs/common'
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices'
import { OrderEvents } from 'src/shared/constants/rabbitmq.constant'
import { DomainEvent } from 'src/shared/rabbitmq/event-bus.service'
import { EventBusService } from 'src/shared/rabbitmq/event-bus.service'
import { getRetryCount, rejectWithRetry } from 'src/shared/rabbitmq/retry.helper'
import { RmqRecordBuilder } from '@nestjs/microservices'

@Controller()
export class OrderEventConsumer {
  private readonly logger = new Logger(OrderEventConsumer.name)

  constructor(
    private readonly eventBusService: EventBusService,
  ) {}

  @EventPattern(OrderEvents.CREATED)
  async handleOrderCreated(@Payload() event: DomainEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef()
    const originalMsg = context.getMessage()
    const retryCount = getRetryCount(context)

    try {
      this.logger.log(
        `Processing ${event.eventType} [retry: ${retryCount}]: order ${event.aggregateId}`,
      )

      // ... business logic ...

      channel.ack(originalMsg)
    } catch (error) {
      this.logger.error(
        `Failed to process ${event.eventType}: ${error instanceof Error ? error.message : 'Unknown'}`,
      )

      const result = rejectWithRetry(context, this.logger, event.eventType)

      if (result === 'retry') {
        // Publish lại message với retry count + 1
        // Sử dụng RmqRecordBuilder để set custom headers
        const record = new RmqRecordBuilder(event)
          .setOptions({
            headers: { 'x-retry-count': String(retryCount + 1) },
          })
          .build()
        // Re-emit sau delay (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        setTimeout(() => {
          this.eventBusService.publish(event).catch((err) => {
            this.logger.error(`Failed to re-publish for retry: ${err.message}`)
          })
        }, delay)
      }
      // Nếu 'dead-letter' → message đã bị nack(requeue=false) → cần xử lý manual
    }
  }
}
```

### DLQ Consumer — xử lý message thất bại vĩnh viễn

DLQ consumer chạy trên **transport riêng** (đã cấu hình ở Section 10 — `connectMicroservice` thứ 2 trên `ORDER_EVENTS_DLQ` queue).

Vì dead-lettered message **giữ nguyên pattern gốc** (`order.created`, `payment.succeeded`, ...) trong body, consumer cần match pattern đó — **không phải `'dlq'`**.

```ts
// src/queues/dead-letter.consumer.ts
import { Controller, Logger } from '@nestjs/common'
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices'
import { OrderEvents, PaymentEvents } from 'src/shared/constants/rabbitmq.constant'

@Controller()
export class DeadLetterConsumer {
  private readonly logger = new Logger(DeadLetterConsumer.name)

  // Phải khai báo @EventPattern cho MỖI event type có thể bị dead-letter
  // Vì message giữ pattern gốc trong body

  @EventPattern(OrderEvents.CREATED)
  async handleDeadOrderCreated(@Payload() message: any, @Ctx() context: RmqContext) {
    await this.handleDeadLetter(message, context)
  }

  @EventPattern(OrderEvents.CANCELLED)
  async handleDeadOrderCancelled(@Payload() message: any, @Ctx() context: RmqContext) {
    await this.handleDeadLetter(message, context)
  }

  @EventPattern(PaymentEvents.SUCCEEDED)
  async handleDeadPaymentSucceeded(@Payload() message: any, @Ctx() context: RmqContext) {
    await this.handleDeadLetter(message, context)
  }

  @EventPattern(PaymentEvents.FAILED)
  async handleDeadPaymentFailed(@Payload() message: any, @Ctx() context: RmqContext) {
    await this.handleDeadLetter(message, context)
  }

  private async handleDeadLetter(message: any, context: RmqContext) {
    const channel = context.getChannelRef()
    const originalMsg = context.getMessage()

    this.logger.error(`☠️ Dead letter received — manual review needed`, {
      eventType: message.eventType,
      aggregateType: message.aggregateType,
      aggregateId: message.aggregateId,
      correlationId: message.metadata?.correlationId,
      retryCount: originalMsg.properties?.headers?.['x-retry-count'] || 'unknown',
    })

    // TODO: Lưu vào bảng FailedEvent hoặc gửi alert Slack/email
    // await this.prismaService.failedEvent.create({ ... })

    channel.ack(originalMsg)
  }
}
```

### Retry flow hoàn chỉnh

```
Message vào queue chính (order_events_q)
    │
    ▼
Consumer nhận message → xử lý thành công → ACK ✅
    │
    │ (nếu fail)
    ▼
Check header x-retry-count
    │
    ├── count < 3 (MAX_RETRIES):
    │     nack(requeue=false) → message bị drop
    │     setTimeout(delay) → re-publish message mới với count+1
    │     delay = 1s, 2s, 4s (exponential backoff)
    │
    └── count >= 3:
          nack(requeue=false) → message bị drop
          Log error + alert team
          (Manual review: xem logs, fix bug, replay từ Outbox nếu cần)
```

> **Tại sao re-publish thay vì dùng DLX?** Với NestJS RMQ transport, việc setup DLX → retry queue → binding ngược lại queue chính đòi hỏi cấu hình AMQP thủ công ngoài NestJS. Re-publish qua `EventBusService` đơn giản hơn và tận dụng được infrastructure đã có. Khi scale lên, có thể chuyển sang delayed retry queue pattern với AMQP plugin.

---

## 13) Health Check

### Thêm RabbitMQ health check

Codebase đã có `HealthModule` với `@nestjs/terminus`. Thêm RabbitMQ check:

```ts
// Trong health controller hiện có
import { MicroserviceHealthIndicator, MicroserviceHealthIndicatorOptions } from '@nestjs/terminus'
import { Transport } from '@nestjs/microservices'
import envConfig from 'src/shared/config'

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private microservice: MicroserviceHealthIndicator,
    // ... existing indicators
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // ... existing checks ...

      // RabbitMQ health check
      () =>
        this.microservice.pingCheck<MicroserviceHealthIndicatorOptions>('rabbitmq', {
          transport: Transport.RMQ,
          options: {
            urls: [envConfig.RABBITMQ_URL],
          },
        }),
    ])
  }
}
```

---

## 14) Testing

### Unit test cho EventBusService

```ts
// src/shared/rabbitmq/__tests__/event-bus.service.spec.ts
import { Test } from '@nestjs/testing'
import { EventBusService } from '../event-bus.service'
import { RABBITMQ_CLIENT } from 'src/shared/constants/rabbitmq.constant'
import { of } from 'rxjs'

describe('EventBusService', () => {
  let service: EventBusService
  const mockClient = {
    connect: jest.fn(),
    emit: jest.fn().mockReturnValue(of(undefined)),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: RABBITMQ_CLIENT, useValue: mockClient },
      ],
    }).compile()

    service = module.get(EventBusService)
  })

  it('should publish event to RabbitMQ', async () => {
    await service.publish({
      eventType: 'order.created',
      aggregateType: 'Order',
      aggregateId: '123',
      payload: { orderId: 123 },
    })

    expect(mockClient.emit).toHaveBeenCalledWith(
      'order.created',
      expect.objectContaining({
        eventType: 'order.created',
        aggregateType: 'Order',
        aggregateId: '123',
      }),
    )
  })
})
```

### Unit test cho OutboxWorker

```ts
// src/shared/rabbitmq/__tests__/outbox.worker.spec.ts
import { Test } from '@nestjs/testing'
import { OutboxWorker } from '../outbox.worker'
import { PrismaService } from 'src/shared/services/prisma.service'
import { EventBusService } from '../event-bus.service'

describe('OutboxWorker', () => {
  let worker: OutboxWorker
  const mockPrisma = {
    outbox: {
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  }
  const mockEventBus = {
    publish: jest.fn(),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutboxWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile()

    worker = module.get(OutboxWorker)
    jest.clearAllMocks()
  })

  it('should process pending outbox events', async () => {
    const mockEvent = {
      id: 'uuid-1',
      aggregateType: 'Order',
      aggregateId: '123',
      eventType: 'order.created',
      payload: { orderId: 123 },
      publishedAt: null,
      createdAt: new Date(),
    }

    mockPrisma.outbox.findMany.mockResolvedValue([mockEvent])
    mockEventBus.publish.mockResolvedValue(undefined)

    await worker.processOutbox()

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'order.created',
        aggregateType: 'Order',
        aggregateId: '123',
      }),
    )
    expect(mockPrisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { publishedAt: expect.any(Date) },
    })
  })

  it('should skip when no pending events', async () => {
    mockPrisma.outbox.findMany.mockResolvedValue([])
    await worker.processOutbox()
    expect(mockEventBus.publish).not.toHaveBeenCalled()
  })

  it('should continue processing if one event fails', async () => {
    const events = [
      { id: '1', aggregateType: 'Order', aggregateId: '1', eventType: 'order.created', payload: {}, publishedAt: null, createdAt: new Date() },
      { id: '2', aggregateType: 'Order', aggregateId: '2', eventType: 'order.created', payload: {}, publishedAt: null, createdAt: new Date() },
    ]

    mockPrisma.outbox.findMany.mockResolvedValue(events)
    mockEventBus.publish
      .mockRejectedValueOnce(new Error('RabbitMQ down'))
      .mockResolvedValueOnce(undefined)

    await worker.processOutbox()

    expect(mockEventBus.publish).toHaveBeenCalledTimes(2)
    expect(mockPrisma.outbox.update).toHaveBeenCalledTimes(1) // chỉ event thứ 2 được mark
  })
})
```

---

## 15) Phân biệt rõ: BullMQ làm gì, RabbitMQ làm gì

### Bảng phân chia trách nhiệm trong dự án

| Use case | BullMQ (giữ nguyên) | RabbitMQ (mới) |
|---|---|---|
| Cancel payment sau 24h | ✅ `order.producer.ts` | |
| Daily price check | ✅ `wishlist-price-check.cronjob.ts` | |
| Send price alert email | ✅ `wishlist.consumer.ts` | |
| Remove refresh token | ✅ `remove-refresh-token.cronjob.ts` | |
| Order created → reserve stock | | ✅ `OrderEvents.CREATED` |
| Payment succeeded → update order | | ✅ `PaymentEvents.SUCCEEDED` |
| Payment failed → cancel order | | ✅ `PaymentEvents.FAILED` |
| Order cancelled → release stock | | ✅ `OrderEvents.CANCELLED` |
| Cache invalidation | | ✅ `CacheEvents.INVALIDATE` |
| Media uploaded → thumbnail | | ✅ (future) |
| Review created → update rating | | ✅ (future) |

### Nguyên tắc quyết định

```
Dùng BullMQ khi:
  ✓ Job nền nội bộ 1 service
  ✓ Cần delay / schedule
  ✓ Cần cron job
  ✓ Không cần fanout (1 producer → 1 consumer)
  ✓ Job mất được nếu Redis restart (hoặc retry đủ)

Dùng RabbitMQ khi:
  ✓ Event cross-domain (Order → Payment → Inventory → Notification)
  ✓ Cần Outbox pattern (transactional consistency)
  ✓ Cần fanout (1 event → nhiều consumer)
  ✓ Cần routing phức tạp (topic exchange)
  ✓ Cần DLQ + monitoring chuyên nghiệp
  ✓ Event KHÔNG ĐƯỢC mất
```

---

## 16) Checklist triển khai

### Phase 1a — Infrastructure (làm trước)

- [ ] Cài dependencies: `@nestjs/microservices`, `amqplib`, `amqp-connection-manager`
- [ ] Thêm `RABBITMQ_URL` vào `.env`, `.env.example`, `src/shared/config.ts` (Zod schema)
- [ ] Thêm RabbitMQ service vào `docker-compose.yml` và `docker-compose.prod.yml`
- [ ] `docker compose up` → verify RabbitMQ Management UI ở http://localhost:15672
- [ ] Thêm Outbox model vào Prisma schema → `npx prisma migrate dev`

### Phase 1b — Core modules (nền tảng)

- [ ] Tạo `src/shared/constants/rabbitmq.constant.ts` (exchange, queue, event type constants)
- [ ] Tạo `src/shared/rabbitmq/rabbitmq.module.ts` (ClientsModule.register)
- [ ] Tạo `src/shared/rabbitmq/event-bus.service.ts` (producer)
- [ ] Tạo `src/shared/rabbitmq/outbox.worker.ts` (poll Outbox → publish → mark)
- [ ] Đăng ký `RabbitmqModule` trong `app.module.ts`
- [ ] **⚠️ Cập nhật `src/main.ts`**: thêm `app.connectMicroservice(RMQ options)` + `await app.startAllMicroservices()` TRƯỚC `app.listen()` — **bước này bắt buộc để consumer hoạt động**

### Phase 1c — Domain integration (nghiệp vụ)

- [ ] Tích hợp Outbox vào Order creation flow (ghi Outbox trong `$transaction`)
- [ ] Tích hợp Outbox vào Payment webhook flow
- [ ] Tạo `src/queues/order-event.consumer.ts` cho `order.created`, `payment.succeeded`
- [ ] Đăng ký consumer trong `app.module.ts` providers

### Phase 1d — Reliability (ổn định)

- [ ] Thiết lập DLQ + DeadLetterConsumer
- [ ] Thêm RabbitMQ health check vào HealthModule
- [ ] Viết unit tests cho EventBusService, OutboxWorker
- [ ] Cleanup cron cho Outbox (xóa records > 7 ngày đã publish)

### Phase 1e — Verify (kiểm tra)

- [ ] Test end-to-end: tạo order → verify event xuất hiện trong RabbitMQ Management UI
- [ ] Test failure: tắt RabbitMQ → verify Outbox accumulate → bật lại → verify events được publish
- [ ] Test idempotency: gửi cùng event 2 lần → verify consumer xử lý đúng 1 lần
- [ ] Verify BullMQ jobs vẫn hoạt động bình thường (cancel-payment, price-check)

---

## Cấu trúc file sau khi hoàn thành

```
src/
├── app.module.ts              ← thêm RabbitmqModule + event consumers
├── queues/
│   ├── payment.consumer.ts    ← giữ nguyên (BullMQ)
│   ├── wishlist.consumer.ts   ← giữ nguyên (BullMQ)
│   ├── order-event.consumer.ts    ← MỚI (RabbitMQ)
│   ├── dead-letter.consumer.ts    ← MỚI (RabbitMQ)
│   └── __tests__/
│       ├── payment.consumer.spec.ts      ← giữ nguyên
│       ├── wishlist.consumer.spec.ts     ← giữ nguyên
│       ├── order-event.consumer.spec.ts  ← MỚI
│       └── dead-letter.consumer.spec.ts  ← MỚI
├── shared/
│   ├── config.ts              ← thêm RABBITMQ_URL vào Zod schema
│   ├── constants/
│   │   ├── queue.constant.ts          ← giữ nguyên (BullMQ constants)
│   │   └── rabbitmq.constant.ts       ← MỚI (RabbitMQ constants)
│   └── rabbitmq/
│       ├── rabbitmq.module.ts         ← MỚI
│       ├── event-bus.service.ts       ← MỚI
│       ├── outbox.worker.ts           ← MỚI
│       └── __tests__/
│           ├── event-bus.service.spec.ts  ← MỚI
│           └── outbox.worker.spec.ts      ← MỚI
├── routes/
│   ├── order/
│   │   ├── order.module.ts    ← giữ nguyên BullModule, có thể import RabbitmqModule
│   │   ├── order.producer.ts  ← giữ nguyên (BullMQ — cancel payment delay)
│   │   ├── order.repo.ts      ← thêm Outbox.create trong $transaction
│   │   └── order.service.ts
│   └── payment/
│       ├── payment.module.ts
│       └── payment.repo.ts    ← thêm Outbox.create khi payment succeeded/failed
└── cronjobs/
    ├── remove-refresh-token.cronjob.ts  ← giữ nguyên
    └── wishlist-price-check.cronjob.ts  ← giữ nguyên

prisma/
└── schema.prisma              ← thêm model Outbox

docker-compose.yml             ← thêm rabbitmq service
docker-compose.prod.yml        ← thêm rabbitmq service
.env                           ← thêm RABBITMQ_URL
.env.example                   ← thêm RABBITMQ_URL
```
