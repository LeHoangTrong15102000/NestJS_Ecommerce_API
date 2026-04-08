# Deep Dive: Message Broker và Giao tiếp Bất đồng bộ giữa các Services

> Tài liệu này giải thích chi tiết 7 chủ đề nâng cao liên quan đến Message Broker, giao tiếp bất đồng bộ giữa các services trong kiến trúc microservices — sử dụng code thực tế từ project NestJS Ecommerce API.

---

## Mục lục

1. [Request-Reply Pattern qua Message Broker](#1-request-reply-pattern-qua-message-broker)
2. [Saga Pattern](#2-saga-pattern)
3. [Dead Letter Queue](#3-dead-letter-queue)
4. [Event-driven vs Command-driven](#4-event-driven-vs-command-driven)
5. [Backpressure & Rate Limiting](#5-backpressure--rate-limiting)
6. [So sánh BullMQ (Redis) vs Kafka vs RabbitMQ vs SQS](#6-so-sánh-bullmq-redis-vs-kafka-vs-rabbitmq-vs-sqs)
7. [Topic Exchange trong RabbitMQ — Giải thích toàn diện](#7-topic-exchange-trong-rabbitmq--giải-thích-toàn-diện)

---

## 1. Request-Reply Pattern qua Message Broker

### Fire-and-Forget vs Request-Reply

Trong project của bạn, `order.producer.ts` dùng pattern **fire-and-forget**:

```typescript
// order.producer.ts — Fire-and-Forget
async addCancelPaymentJob(paymentId: number): Promise<void> {
  await this.paymentQueue.add(
    CANCEL_PAYMENT_JOB_NAME,
    { paymentId },
    { delay: 1000 * 60 * 60 * 24 },  // 24h sau mới chạy
  )
  // ← XONG. Không chờ kết quả. Không biết consumer xử lý thế nào.
}
```

Nhưng có những trường hợp bạn **CẦN chờ kết quả** từ service khác qua message broker. Đó là **Request-Reply pattern** (hay còn gọi là RPC over Message Queue).

### Khi nào cần Request-Reply?

```
Fire-and-Forget (code hiện tại của bạn):
  OrderService → "Hủy payment sau 24h" → Queue → PaymentConsumer
  OrderService KHÔNG CẦN biết kết quả

Request-Reply (khi CẦN kết quả):
  OrderService → "Kiểm tra inventory còn hàng không?" → Queue → InventoryService
  OrderService CẦN BIẾT kết quả trước khi tiếp tục
```

### Cách triển khai Request-Reply với BullMQ

```typescript
// ===== PRODUCER (Order Service) =====
async checkInventory(skuId: number, quantity: number): Promise<boolean> {
  const job = await this.inventoryQueue.add('check-stock', {
    skuId,
    quantity,
  })

  // Chờ kết quả từ consumer
  const result = await job.waitUntilFinished(this.queueEvents, 5000) // timeout 5s
  return result.inStock
}

// ===== CONSUMER (Inventory Service) =====
@Processor('inventory-queue')
export class InventoryConsumer extends WorkerHost {
  async process(job: Job) {
    const { skuId, quantity } = job.data
    const sku = await this.prisma.sku.findUnique({ where: { id: skuId } })

    // Kết quả này sẽ được trả về cho producer
    return { inStock: sku.stock >= quantity, currentStock: sku.stock }
  }
}
```

### Flow so sánh

```
Fire-and-Forget:
  Producer ──message──► Queue ──────► Consumer
  Producer đi làm                    Consumer xử lý
  việc khác ngay                     khi nào xong thì xong

Request-Reply:
  Producer ──message──► Queue ──────► Consumer
  Producer CHỜ ◄────── Reply Queue ◄── Consumer trả kết quả
  Producer tiếp tục
  sau khi có kết quả
```

### Khi nào dùng cái nào?

```
┌──────────────────────────┬──────────────────────┬──────────────────────┐
│ Scenario                 │ Pattern              │ Lý do                │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ Hủy payment sau 24h     │ Fire-and-Forget      │ Không cần kết quả    │
│ (code hiện tại)          │                      │ ngay                 │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ Gửi email thông báo     │ Fire-and-Forget      │ User không chờ email │
│ (wishlist.consumer.ts)   │                      │                      │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ Kiểm tra inventory      │ Request-Reply        │ Cần biết còn hàng    │
│ từ service khác          │                      │ trước khi tạo order  │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ Tính phí shipping       │ Request-Reply        │ Cần giá ship để      │
│ từ Shipping Service      │                      │ hiển thị cho user    │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ Xử lý ảnh sản phẩm     │ Fire-and-Forget      │ Upload xong, resize  │
│                          │                      │ sau cũng được        │
└──────────────────────────┴──────────────────────┴──────────────────────┘
```

### Lưu ý quan trọng

Request-Reply qua message broker **chậm hơn** gọi HTTP trực tiếp (thêm overhead của queue). Chỉ dùng khi:
- Cần **retry tự động** nếu service kia down
- Cần **load balancing** giữa nhiều consumer instances
- Muốn **decouple** services (không cần biết IP/port của nhau)

Nếu chỉ cần gọi nhanh và đơn giản → dùng HTTP/gRPC trực tiếp.

---

## 2. Saga Pattern

### Vấn đề: Distributed Transaction

Trong monolith (project hiện tại của bạn), `order.repo.ts` dùng `$transaction` để đảm bảo tất cả operations thành công hoặc rollback:

```typescript
// order.repo.ts:117 — Monolith: 1 database, 1 transaction
await this.prismaService.$transaction(async (tx) => {
  await tx.payment.create(...)     // Cùng DB
  await tx.order.create(...)       // Cùng DB
  await tx.cartItem.deleteMany(...)// Cùng DB
  await tx.$executeRaw`UPDATE SKU` // Cùng DB
})
```

Nhưng trong **microservices**, mỗi service có **database riêng**:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Order Service│  │Payment Service│  │Inventory Svc │  │Shipping Svc  │
│              │  │              │  │              │  │              │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │ Order DB │ │  │ │Payment DB│ │  │ │Inventory │ │  │ │Shipping  │ │
│ │          │ │  │ │          │ │  │ │    DB    │ │  │ │    DB    │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

KHÔNG THỂ dùng $transaction vì khác database!
```

### Saga Pattern giải quyết vấn đề này

Saga chia transaction lớn thành **nhiều local transactions nhỏ**, mỗi cái có **compensating action** (hành động bù) nếu fail.

#### Choreography Saga (Event-based — không có coordinator)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Order     │     │  Payment    │     │  Inventory  │     │  Shipping   │
│   Service   │     │  Service    │     │  Service    │     │  Service    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ OrderCreated      │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ PaymentCompleted   │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ StockReserved     │
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │                   │                   │ ShippingScheduled
       │◄──────────────────│───────────────────│───────────────────│
       │ Update order      │                   │                   │
       │ status: COMPLETED │                   │                   │

NẾU Inventory fail (hết hàng):
       │                   │                   │                   │
       │                   │                   │ StockFailed       │
       │                   │◄──────────────────│                   │
       │                   │ RefundPayment     │                   │
       │◄──────────────────│                   │                   │
       │ CancelOrder       │                   │                   │
```

#### Orchestration Saga (có coordinator điều phối)

```
                    ┌─────────────────────┐
                    │   Saga Orchestrator  │
                    │   (Order Saga)       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    Bước 1:   │    Bước 2:     │    Bước 3:     │
    Create    │    Reserve     │    Process     │
    Payment   │    Stock       │    Shipping    │
              │                │                │
              ▼                ▼                ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ Payment  │    │Inventory │    │ Shipping │
       │ Service  │    │ Service  │    │ Service  │
       └──────────┘    └──────────┘    └──────────┘

Orchestrator biết thứ tự, biết compensating actions:
  Step 1: createPayment()     → compensate: refundPayment()
  Step 2: reserveStock()      → compensate: releaseStock()
  Step 3: scheduleShipping()  → compensate: cancelShipping()
```

### Ví dụ triển khai Saga cho project của bạn (nếu chuyển sang microservices)

```typescript
// order-saga.orchestrator.ts
@Injectable()
export class OrderSagaOrchestrator {
  async execute(orderData: CreateOrderData) {
    const sagaLog: SagaStep[] = []

    try {
      // Step 1: Tạo payment
      const payment = await this.paymentService.createPayment(orderData)
      sagaLog.push({ step: 'payment', data: payment, compensate: 'refund' })

      // Step 2: Reserve stock
      const reservation = await this.inventoryService.reserveStock(orderData.items)
      sagaLog.push({ step: 'inventory', data: reservation, compensate: 'release' })

      // Step 3: Tạo order
      const order = await this.orderService.createOrder(orderData, payment.id)
      sagaLog.push({ step: 'order', data: order, compensate: 'cancel' })

      // Step 4: Schedule shipping
      await this.shippingService.schedule(order.id)
      sagaLog.push({ step: 'shipping', data: order.id, compensate: 'cancelShipping' })

      return { success: true, orderId: order.id }

    } catch (error) {
      // COMPENSATE: Rollback theo thứ tự ngược
      for (const step of sagaLog.reverse()) {
        try {
          await this.compensate(step)
        } catch (compensateError) {
          // Log lỗi compensate → cần manual intervention
          this.logger.error(`Compensate failed for step ${step.step}`, compensateError)
        }
      }
      throw error
    }
  }

  private async compensate(step: SagaStep) {
    switch (step.compensate) {
      case 'refund':
        await this.paymentService.refund(step.data.id)
        break
      case 'release':
        await this.inventoryService.releaseStock(step.data.reservationId)
        break
      case 'cancel':
        await this.orderService.cancelOrder(step.data.id)
        break
      case 'cancelShipping':
        await this.shippingService.cancel(step.data)
        break
    }
  }
}
```

### So sánh: Monolith Transaction vs Saga

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│                      │ $transaction         │ Saga Pattern         │
│                      │ (code hiện tại)      │ (microservices)      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Consistency          │ ACID (strong)        │ Eventually consistent│
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Rollback             │ Tự động (DB)         │ Manual (compensate)  │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Complexity           │ Đơn giản             │ Phức tạp             │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Performance          │ Lock rows            │ Không lock cross-svc │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Khi nào dùng        │ 1 database           │ Nhiều databases      │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 3. Dead Letter Queue

### Vấn đề: Consumer fail liên tục, message đi đâu?

Trong `payment.consumer.ts` của bạn:

```typescript
// payment.consumer.ts:33-39
} catch (error) {
  this.logger.error(`Failed to process job ${job.name}...`)
  // Re-throw to let BullMQ handle retry logic
  throw error  // ← BullMQ sẽ retry
}
```

Khi consumer throw error, BullMQ sẽ **retry** job. Nhưng nếu retry hết số lần cho phép thì sao?

### Flow: Job lifecycle trong BullMQ

```
Job được tạo
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ WAITING  │────►│  ACTIVE  │────►│COMPLETED │  ← Happy path
└──────────┘     └────┬─────┘     └──────────┘
                      │
                      │ Error!
                      ▼
                ┌──────────┐
                │  FAILED  │
                └────┬─────┘
                     │
                     │ Còn retry attempts?
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
         ┌──────────┐  ┌──────────────┐
         │ WAITING  │  │ DEAD LETTER  │  ← Hết retry
         │ (retry)  │  │    QUEUE     │
         └──────────┘  └──────────────┘
```

### Cách cấu hình trong code của bạn

Trong `wishlist.producer.ts:79-93`:

```typescript
await this.wishlistQueue.add(SEND_PRICE_ALERT_JOB_NAME, data, {
  jobId,
  attempts: 3,           // ← Retry tối đa 3 lần
  backoff: {
    type: 'exponential', // ← Chờ lâu hơn mỗi lần retry
    delay: 2000,         // ← Lần 1: 2s, Lần 2: 4s, Lần 3: 8s
  },
  removeOnComplete: {
    age: 3600,           // Xóa job thành công sau 1 giờ
    count: 100,          // Giữ tối đa 100 completed jobs
  },
  removeOnFail: {
    age: 86400,          // Giữ failed jobs 24 giờ để debug
    count: 500,          // Giữ tối đa 500 failed jobs
  },
})
```

**Timeline khi job fail liên tục:**

```
t=0s:    Job chạy lần 1 → FAIL
t=2s:    Retry lần 1 (delay: 2s) → FAIL
t=6s:    Retry lần 2 (delay: 4s, exponential) → FAIL
t=14s:   Retry lần 3 (delay: 8s, exponential) → FAIL
         → Job chuyển sang trạng thái FAILED
         → Nằm trong failed jobs list 24 giờ
         → Sau 24 giờ bị xóa tự động
```

### Triển khai Dead Letter Queue đúng cách

BullMQ không có built-in DLQ, nhưng bạn có thể tự triển khai:

```typescript
// dead-letter.consumer.ts
@Processor('dead-letter-queue')
export class DeadLetterConsumer extends WorkerHost {
  constructor(
    private readonly logger: Logger,
    private readonly notificationService: NotificationService,
  ) { super() }

  async process(job: Job) {
    // Log chi tiết để debug
    this.logger.error(`Dead letter job received`, {
      originalQueue: job.data.originalQueue,
      originalJobName: job.data.originalJobName,
      failedReason: job.data.failedReason,
      attemptsMade: job.data.attemptsMade,
      data: job.data.originalData,
    })

    // Thông báo cho team
    await this.notificationService.alertTeam({
      channel: 'slack',
      message: `Job failed permanently: ${job.data.originalJobName}`,
      severity: 'critical',
    })

    // Lưu vào DB để manual review
    await this.prisma.failedJob.create({
      data: {
        queue: job.data.originalQueue,
        jobName: job.data.originalJobName,
        payload: job.data.originalData,
        error: job.data.failedReason,
        status: 'PENDING_REVIEW',
      },
    })
  }
}

// Trong payment.consumer.ts — thêm logic chuyển sang DLQ
@Processor(PAYMENT_QUEUE_NAME)
export class PaymentConsumer extends WorkerHost {
  constructor(
    @InjectQueue('dead-letter-queue') private dlq: Queue,
  ) { super() }

  async process(job: Job) {
    try {
      // ... xử lý bình thường
    } catch (error) {
      // Nếu đây là lần retry cuối cùng
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.dlq.add('dead-letter', {
          originalQueue: PAYMENT_QUEUE_NAME,
          originalJobName: job.name,
          originalData: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade + 1,
        })
      }
      throw error // Vẫn throw để BullMQ track
    }
  }
}
```

### Tại sao Dead Letter Queue quan trọng?

Trong project của bạn, `order.producer.ts` schedule cancel payment sau 24h:

```
Scenario xấu:
  1. User tạo order → cancel payment job scheduled (24h)
  2. 24h sau, PaymentConsumer chạy → nhưng DB connection fail
  3. Retry 3 lần → vẫn fail
  4. Job bị xóa sau 24h (removeOnFail.age: 86400)
  5. Payment KHÔNG BAO GIỜ bị cancel → user bị charge tiền mãi mãi!

Với DLQ:
  1-3. Giống trên
  4. Job chuyển sang DLQ → team nhận alert
  5. Team fix DB connection → replay job từ DLQ
  6. Payment được cancel đúng cách
```

---

## 4. Event-driven vs Command-driven

### Hai cách giao tiếp qua Message Broker

Trong project của bạn có **cả hai** pattern, nhưng có thể bạn chưa nhận ra:

#### Command (Lệnh): "Hãy làm việc này"

```typescript
// order.producer.ts — ĐÂY LÀ COMMAND
await this.paymentQueue.add(
  CANCEL_PAYMENT_JOB_NAME,  // ← "Hãy hủy payment này"
  { paymentId },
)

// wishlist.producer.ts — ĐÂY CŨNG LÀ COMMAND
await this.wishlistQueue.add(
  SEND_PRICE_ALERT_JOB_NAME,  // ← "Hãy gửi email alert này"
  { userId, productName, ... },
)
```

#### Event (Sự kiện): "Chuyện này đã xảy ra"

```typescript
// payment.service.ts:19 — ĐÂY LÀ EVENT
this.paymentGateway.emitPaymentSuccess(userId)
// ← "Payment đã thành công" — ai muốn biết thì nghe
```

### Sự khác biệt cốt lõi

```
COMMAND:                              EVENT:
"CancelPayment"                       "PaymentCompleted"
  │                                     │
  │ Producer BIẾT consumer              │ Producer KHÔNG BIẾT
  │ sẽ làm gì                          │ ai sẽ nghe
  │                                     │
  │ 1 producer → 1 consumer             │ 1 producer → N consumers
  │ (point-to-point)                    │ (pub/sub)
  │                                     │
  ▼                                     ▼
┌──────────────┐                  ┌──────────────┐
│ Payment      │                  │ Order Service│ → cập nhật status
│ Consumer     │                  │ Email Service│ → gửi email
│ (chỉ 1 thằng│                  │ Analytics    │ → track metrics
│  xử lý)     │                  │ Notification │ → push notification
└──────────────┘                  └──────────────┘
```

### Ví dụ cụ thể: Nếu refactor project của bạn sang Event-driven

**Hiện tại (Command-driven):**

```typescript
// payment.repo.ts:117-138 — Tất cả logic nằm trong 1 chỗ
await Promise.all([
  tx.payment.update({ data: { status: PaymentStatus.SUCCESS } }),
  tx.order.updateMany({ data: { status: OrderStatus.PENDING_PICKUP } }),
  this.paymentProducer.removeJob(paymentId),  // Command: "Xóa cancel job"
])
// Rồi:
this.paymentGateway.emitPaymentSuccess(userId)  // Event: "Payment thành công"
```

**Nếu chuyển sang Event-driven:**

```typescript
// payment.service.ts — Chỉ cập nhật payment, rồi emit event
async processPayment(body: WebhookPaymentBodyType) {
  await this.paymentRepo.updateStatus(paymentId, PaymentStatus.SUCCESS)

  // Emit event — KHÔNG BIẾT ai sẽ xử lý
  await this.eventBus.emit('payment.completed', {
    paymentId,
    userId,
    amount: totalPrice,
    timestamp: new Date(),
  })
}

// order.service.ts — Lắng nghe event
@OnEvent('payment.completed')
async handlePaymentCompleted(event: PaymentCompletedEvent) {
  await this.orderRepo.updateStatus(event.paymentId, OrderStatus.PENDING_PICKUP)
}

// notification.service.ts — Cũng lắng nghe event
@OnEvent('payment.completed')
async sendPaymentNotification(event: PaymentCompletedEvent) {
  await this.pushNotification(event.userId, 'Thanh toán thành công!')
}

// analytics.service.ts — Cũng lắng nghe event
@OnEvent('payment.completed')
async trackPaymentMetrics(event: PaymentCompletedEvent) {
  await this.metrics.increment('payments.success', { amount: event.amount })
}

// scheduler.service.ts — Cũng lắng nghe event
@OnEvent('payment.completed')
async removeCancelJob(event: PaymentCompletedEvent) {
  await this.paymentProducer.removeJob(event.paymentId)
}
```

### So sánh

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│                      │ Command              │ Event                │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Ý nghĩa             │ "Hãy làm X"         │ "X đã xảy ra"       │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Coupling             │ Chặt (biết consumer) │ Lỏng (không biết)   │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Số consumers         │ Thường 1             │ Nhiều (N)            │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Thêm consumer mới   │ Phải sửa producer    │ Không sửa gì cả     │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Error handling       │ Producer biết lỗi    │ Producer không biết  │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Ví dụ trong project  │ CancelPayment        │ PaymentSuccess       │
│                      │ SendPriceAlert       │ (emitPaymentSuccess) │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Naming convention    │ Động từ mệnh lệnh   │ Quá khứ phân từ     │
│                      │ (CancelPayment)      │ (PaymentCompleted)   │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

### Khi nào dùng cái nào?

- **Command**: Khi bạn biết chính xác AI sẽ xử lý và CẦN nó xử lý (cancel payment, send email)
- **Event**: Khi bạn muốn thông báo "chuyện đã xảy ra" và để các service tự quyết định phản ứng

Trong thực tế, hầu hết hệ thống dùng **cả hai**. Project của bạn đang dùng chủ yếu Command (BullMQ jobs) + một ít Event (WebSocket emit).

---

## 5. Backpressure & Rate Limiting

### Vấn đề: Producer bắn message nhanh hơn Consumer xử lý

Giả sử trong project của bạn, `wishlist-price-check.cronjob.ts` chạy daily và tìm thấy 100,000 wishlist items cần gửi price alert:

```
CronJob: "Tìm thấy 100,000 items cần alert!"
    │
    ├─ addSendPriceAlertJob(item1)   ← 1ms
    ├─ addSendPriceAlertJob(item2)   ← 1ms
    ├─ addSendPriceAlertJob(item3)   ← 1ms
    ├─ ... (100,000 jobs trong ~100 giây)
    │
    ▼
┌──────────────────────────────────────┐
│         Redis Queue                   │
│  [job1][job2][job3]...[job100000]    │  ← 100,000 jobs chờ xử lý
│                                      │
│  Memory usage: ~500MB                │  ← Redis có thể hết RAM!
└──────────────────────────────────────┘
    │
    ▼
WishlistConsumer: Xử lý 1 job mất ~2 giây (gửi email)
  → 100,000 × 2s = 200,000 giây = ~55 GIỜ để xử lý hết!
```

### Các cơ chế Backpressure

#### 5.1. Concurrency Control (BullMQ Worker)

```typescript
// Mặc định BullMQ xử lý 1 job tại 1 thời điểm
// Tăng concurrency để xử lý nhiều jobs song song:

@Processor(WISHLIST_QUEUE_NAME, {
  concurrency: 10,  // Xử lý 10 jobs đồng thời
})
export class WishlistConsumer extends WorkerHost {
  // 100,000 jobs ÷ 10 concurrent × 2s = ~5.5 giờ (thay vì 55 giờ)
}
```

#### 5.2. Rate Limiting (giới hạn tốc độ xử lý)

```typescript
// Giới hạn: tối đa 100 jobs / 10 giây
@Processor(WISHLIST_QUEUE_NAME, {
  limiter: {
    max: 100,       // Tối đa 100 jobs
    duration: 10000, // trong 10 giây
  },
})
export class WishlistConsumer extends WorkerHost {
  // Tránh overwhelm email server (SMTP rate limit)
}
```

#### 5.3. Batch Processing (xử lý theo lô)

Thay vì tạo 100,000 jobs riêng lẻ, gom thành batches:

```typescript
// Thay vì:
for (const item of items) {
  await this.wishlistProducer.addSendPriceAlertJob(item)  // 100,000 jobs
}

// Gom batch:
const BATCH_SIZE = 100
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE)
  await this.wishlistQueue.add('send-price-alerts-batch', {
    items: batch,  // 100 items / job
  })
}
// Chỉ tạo 1,000 jobs thay vì 100,000
```

#### 5.4. Producer-side Backpressure (kiểm tra queue trước khi bắn)

```typescript
async addPriceAlertJobWithBackpressure(data: any) {
  // Kiểm tra queue có quá tải không
  const jobCounts = await this.wishlistQueue.getJobCounts()
  const pendingJobs = jobCounts.waiting + jobCounts.delayed

  if (pendingJobs > 10000) {
    this.logger.warn(`Queue overloaded (${pendingJobs} pending). Delaying...`)
    // Chờ queue giảm tải
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  await this.wishlistQueue.add(SEND_PRICE_ALERT_JOB_NAME, data)
}
```

### Flow Backpressure hoàn chỉnh

```
Producer (CronJob)
    │
    ├─ Kiểm tra queue size < threshold?
    │   ├─ YES → Bắn message
    │   └─ NO  → Chờ hoặc giảm tốc độ
    │
    ▼
┌──────────────────────────────────────┐
│         Redis Queue                   │
│                                      │
│  Max queue size: 10,000 jobs         │
│  Memory limit: 256MB                 │
│                                      │
│  Nếu vượt limit:                     │
│  → Reject new jobs                   │
│  → Alert team                        │
└──────────────────────────────────────┘
    │
    ▼
Consumer (Worker)
    │
    ├─ Concurrency: 10 (10 jobs đồng thời)
    ├─ Rate limit: 100 jobs / 10s
    └─ Nếu fail → retry với exponential backoff
```

---

## 6. So sánh BullMQ (Redis) vs Kafka vs RabbitMQ vs SQS

### Tổng quan nhanh

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│              │ BullMQ       │ RabbitMQ     │ Kafka        │ Amazon SQS   │
│              │ (Redis)      │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Project bạn  │ ✅ Đang dùng │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Kiểu         │ Job Queue    │ Message      │ Event        │ Message      │
│              │              │ Broker       │ Streaming    │ Queue (SaaS) │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Protocol     │ Redis        │ AMQP         │ Custom TCP   │ HTTP/HTTPS   │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Throughput   │ ~10K msg/s   │ ~50K msg/s   │ ~1M msg/s    │ ~3K msg/s    │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Latency      │ ~1ms         │ ~1ms         │ ~5ms         │ ~20-50ms     │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Persistence  │ Redis AOF/   │ Disk         │ Disk         │ AWS managed  │
│              │ RDB          │ (durable)    │ (retention)  │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Message      │ Xóa sau khi  │ Xóa sau khi  │ GIỮ LẠI     │ Xóa sau khi  │
│ retention    │ xử lý        │ ACK          │ (configurable│ xử lý        │
│              │              │              │  days/weeks) │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Consumer     │ 1 consumer   │ 1 consumer   │ N consumers  │ 1 consumer   │
│ model        │ per job      │ per message  │ per message  │ per message  │
│              │              │              │ (consumer    │              │
│              │              │              │  groups)     │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Ordering     │ FIFO         │ FIFO per     │ FIFO per     │ Best-effort  │
│              │              │ queue        │ partition    │ (hoặc FIFO)  │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Delay/       │ ✅ Built-in  │ ✅ Plugin    │ ❌ Không     │ ✅ Built-in  │
│ Schedule     │ (code bạn    │              │ native       │ (max 15 min) │
│              │ dùng 24h     │              │              │              │
│              │ delay)       │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Priority     │ ✅ Built-in  │ ✅ Priority  │ ❌ Không     │ ❌ Không     │
│              │              │ queues       │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Ops          │ Đơn giản     │ Trung bình   │ Phức tạp     │ Zero ops     │
│ complexity   │ (Redis)      │ (Erlang)     │ (ZooKeeper/  │ (AWS quản lý)│
│              │              │              │  KRaft)      │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Cost         │ Redis RAM    │ Server       │ Server +     │ Pay per msg  │
│              │ (có thể đắt) │              │ storage      │ (~$0.40/1M)  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### Khi nào dùng cái nào?

#### BullMQ (Redis) — Đang dùng trong project của bạn

```
✅ Phù hợp khi:
  - Job queue với delay/scheduling (cancel payment sau 24h)
  - Background tasks (gửi email, resize ảnh)
  - Cron jobs (daily price check)
  - Ứng dụng nhỏ-trung bình
  - Đã có Redis trong stack (bạn dùng Redis cho WebSocket adapter)

❌ Không phù hợp khi:
  - Cần throughput > 50K msg/s
  - Cần message retention (replay events)
  - Cần nhiều consumer groups cho cùng 1 message
  - Redis hết RAM → mất data (nếu không config persistence)
```

#### RabbitMQ — Message Broker truyền thống

```
✅ Phù hợp khi:
  - Cần routing phức tạp (topic exchange, header exchange)
  - Microservices communication (request-reply, pub/sub)
  - Cần message acknowledgment đáng tin cậy
  - Team quen với AMQP protocol

❌ Không phù hợp khi:
  - Cần event streaming (replay events từ quá khứ)
  - Throughput cực cao (> 100K msg/s)
  - Cần message retention dài hạn
```

**Ví dụ: Nếu project bạn dùng RabbitMQ thay BullMQ:**

```typescript
// NestJS có built-in support cho RabbitMQ
// order.producer.ts — RabbitMQ version
@Injectable()
export class OrderProducer {
  constructor(@Inject('PAYMENT_SERVICE') private client: ClientProxy) {}

  async cancelPayment(paymentId: number) {
    // Fire-and-forget
    this.client.emit('cancel_payment', { paymentId })
  }

  async checkInventory(skuId: number): Promise<boolean> {
    // Request-Reply
    return firstValueFrom(
      this.client.send('check_inventory', { skuId })
    )
  }
}
```

#### Kafka — Event Streaming Platform

```
✅ Phù hợp khi:
  - Event sourcing (lưu lại MỌI event đã xảy ra)
  - Cần replay events (rebuild state từ event history)
  - Throughput cực cao (hàng triệu msg/s)
  - Nhiều consumer groups cần đọc cùng 1 stream
  - Real-time analytics, data pipeline

❌ Không phù hợp khi:
  - Cần delay/scheduling (Kafka không có native delay)
  - Ứng dụng nhỏ (overkill, ops phức tạp)
  - Cần priority queue
  - Team nhỏ (Kafka cần DevOps experience)
```

**Ví dụ: Nếu project bạn dùng Kafka:**

```typescript
// Kafka giữ lại TẤT CẢ events
// Bạn có thể replay từ đầu để rebuild state

// Producer
await this.kafka.emit('order-events', {
  key: `order-${orderId}`,  // Partition key
  value: {
    type: 'OrderCreated',
    orderId,
    userId,
    items,
    timestamp: new Date(),
  },
})

// Consumer Group 1: Order Service
@EventPattern('order-events')
handleOrderEvent(event: OrderEvent) {
  // Xử lý order logic
}

// Consumer Group 2: Analytics Service (đọc CÙNG events)
@EventPattern('order-events')
trackOrderMetrics(event: OrderEvent) {
  // Track metrics — KHÔNG ảnh hưởng Order Service
}

// Consumer Group 3: Search Service (đọc CÙNG events)
@EventPattern('order-events')
indexOrder(event: OrderEvent) {
  // Update Elasticsearch index
}
```

#### Amazon SQS — Managed Queue Service

```
✅ Phù hợp khi:
  - Đã dùng AWS ecosystem
  - Không muốn quản lý infrastructure
  - Cần auto-scaling (SQS scale vô hạn)
  - Cần Dead Letter Queue built-in
  - Budget cho managed service

❌ Không phù hợp khi:
  - Cần latency < 10ms
  - Cần message ordering chặt chẽ (FIFO SQS có limit 300 msg/s)
  - Cần delay > 15 phút (SQS max delay = 15 min)
    → Code bạn delay 24h → SQS KHÔNG phù hợp cho use case này!
  - Muốn self-hosted / on-premise
```

### Khuyến nghị cho project Ecommerce của bạn

```
Giai đoạn hiện tại (Monolith):
  → BullMQ (Redis) ✅ ĐÚNG RỒI
  → Đơn giản, đủ mạnh, đã có Redis

Nếu scale lên Microservices nhỏ (5-10 services):
  → RabbitMQ
  → Routing linh hoạt, request-reply dễ dàng
  → Hoặc giữ BullMQ nếu chỉ cần job queue

Nếu scale lên Microservices lớn (20+ services, event sourcing):
  → Kafka
  → Event streaming, replay, nhiều consumer groups
  → Kết hợp với BullMQ cho delayed jobs (Kafka không có delay)

Nếu deploy trên AWS:
  → SQS + SNS (pub/sub)
  → Zero ops, auto-scale
  → Kết hợp với EventBridge cho event routing
```

---

## 7. Topic Exchange trong RabbitMQ — Giải thích toàn diện

> **Tại sao cần hiểu sâu về Topic Exchange?**
> Lead của bạn đúng khi nói "chỉ cần hiểu Topic là đủ" — vì Topic Exchange là loại Exchange mạnh nhất, có thể **giả lập hoàn toàn** cả Direct lẫn Fanout Exchange. Hiểu Topic = hiểu hết toàn bộ routing trong RabbitMQ.

### 7.1. Bức tranh toàn cảnh: 4 loại Exchange

RabbitMQ có 4 loại Exchange. Mỗi loại quyết định **cách message được route vào queue**:

```
Producer → Exchange → [routing logic] → Queue(s) → Consumer(s)

4 loại Exchange:
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Direct       │ Exact match: routing key phải = binding key (không wildcard) │
│ Fanout       │ Broadcast: gửi cho TẤT CẢ queues đang bind (ignore key)     │
│ Topic        │ Pattern match: dùng wildcard (* và #) — LINH HOẠT NHẤT      │
│ Headers      │ Match theo message headers thay vì routing key (ít dùng)    │
└──────────────┴──────────────────────────────────────────────────────────────┘

Topic Exchange là SUPERSET của Direct và Fanout:
  Direct Exchange  =  Topic với binding key không có wildcard (exact match)
  Fanout Exchange  =  Topic với binding key = '#' (match tất cả)
  → Trong production, senior dev thường mặc định dùng Topic cho mọi trường hợp
```

### 7.2. Hai khái niệm cốt lõi: Routing Key vs Binding Key

Đây là điểm nhiều người hay nhầm lẫn nhất:

```
┌─────────────────┬────────────────────────────────────────────────────────────┐
│ Routing Key     │ Producer gán vào message khi publish                        │
│                 │ Ví dụ: 'order.created', 'payment.failed'                    │
│                 │ Là "địa chỉ gửi" của message                               │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ Binding Key     │ Queue "đăng ký" với Exchange — dùng wildcard pattern        │
│                 │ Ví dụ: 'order.*', 'payment.#', '#'                         │
│                 │ Là "điều kiện nhận" của queue                               │
└─────────────────┴────────────────────────────────────────────────────────────┘

Flow:
  Producer publish('order.created')
       │
       ▼
  Exchange 'ecom.events' (topic)
       │
       ├─ Queue order_events_q   (binding: 'order.*')   → MATCH ✅
       ├─ Queue payment_events_q (binding: 'payment.*') → NO MATCH ❌
       └─ Queue audit_q          (binding: '#')          → MATCH ✅
```

### 7.3. Routing Key — Format chuẩn

Topic Exchange yêu cầu routing key theo format **dot-separated** (phân cách bằng dấu chấm):

```
Format: word.word.word   (tối đa 255 bytes)

Trong project này (rabbitmq.constant.ts):
  'order.created'          ← 2 levels
  'order.status_changed'
  'order.cancelled'
  'order.expired'

  'payment.created'
  'payment.succeeded'
  'payment.failed'

  'sku.stock_reserved'     ← domain.action
  'sku.stock_released'
  'sku.stock_low'

  'notification.send_email'
  'cache.invalidate'

Mở rộng khi cần (3 levels):
  'order.payment.failed'   ← chi tiết hơn: domain.sub-entity.action
  'user.profile.updated'
  'sku.inventory.threshold_breached'
```

### 7.4. Binding Key — Wildcard Pattern (cốt lõi nhất)

Chỉ có 2 wildcard ký tự, nhưng kết hợp tạo ra vô số khả năng:

```
*  (star) = khớp ĐÚNG 1 word (1 segment giữa hai dấu chấm)
#  (hash) = khớp 0 hoặc NHIỀU words liên tiếp
```

**Bảng so sánh chi tiết — phải nắm vững:**

```
┌─────────────────┬────────────────────────────────────────────────────────────┐
│ Binding Pattern │ Routing keys nào khớp?                                     │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ order.*         │ ✅ order.created, order.cancelled, order.expired           │
│                 │ ❌ order.payment.failed    (3 words — * chỉ match 1)       │
│                 │ ❌ order                   (thiếu word sau dấu chấm)       │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ order.#         │ ✅ order.created, order.cancelled                          │
│                 │ ✅ order.payment.failed    (# match nhiều words)            │
│                 │ ✅ order.a.b.c.d           (# match bao nhiêu cũng được)   │
│                 │ ✅ order                   (# match 0 words)               │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ *.created       │ ✅ order.created, payment.created, user.created            │
│                 │ ❌ order.user.created      (* chỉ match 1 word)            │
│                 │ ❌ created                 (thiếu word trước dấu chấm)     │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ #.failed        │ ✅ payment.failed                                          │
│                 │ ✅ order.payment.failed    (# match 'order.payment')       │
│                 │ ✅ a.b.c.d.failed          (# match nhiều words)           │
│                 │ ❌ failed                  (# match 0 words, nhưng cần     │
│                 │                             dấu chấm phân cách)            │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ #               │ ✅ TẤT CẢ routing keys (giống Fanout Exchange)             │
│                 │    order.created, payment.failed, a.b.c — match hết       │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ order.created   │ ✅ Chỉ đúng 'order.created' (giống Direct Exchange)        │
│ (không wildcard)│ ❌ order.cancelled, order.created.v2 — không match        │
├─────────────────┼────────────────────────────────────────────────────────────┤
│ *.*.failed      │ ✅ order.payment.failed, user.auth.failed                  │
│                 │ ❌ payment.failed      (chỉ 2 words, pattern cần 3)        │
│                 │ ❌ a.b.c.d.failed      (quá nhiều words)                   │
└─────────────────┴────────────────────────────────────────────────────────────┘
```

### 7.5. Tại sao Topic > Direct > Fanout (trong microservices)

**Direct Exchange — quá cứng nhắc:**

```
Vấn đề: Binding key phải match CHÍNH XÁC routing key

Queue 'order_q' bind với key 'order.created'
  → Chỉ nhận 'order.created'
  → 'order.cancelled' → KHÔNG nhận được ❌
  → Phải tạo thêm binding key 'order.cancelled', 'order.expired'... cho từng event

→ Với 10 event types → 10 binding keys → quản lý phức tạp
→ Topic giải quyết bằng 'order.*' → 1 binding cho tất cả order events
```

**Fanout Exchange — quá rộng:**

```
Vấn đề: Broadcast cho TẤT CẢ queues, không filter được

Nếu dùng Fanout:
  order.created → gửi vào payment_q, inventory_q, notification_q, audit_q, ...
  payment.failed → CŨNG gửi vào tất cả các queue trên

→ Consumer inventory phải nhận cả payment.failed rồi tự filter
→ Lãng phí, coupling tăng, consumer phức tạp hơn

→ Topic giải quyết: inventory_q chỉ bind 'sku.*', payment_q chỉ bind 'payment.*'
```

**Topic Exchange — điểm mạnh (excellent points):**

```
✅ 1. SELECTIVE ROUTING: Mỗi queue chỉ nhận đúng events nó cần
      inventory_q  → bind 'sku.*'           → chỉ SKU events
      payment_q    → bind 'payment.*'       → chỉ payment events
      audit_q      → bind '#'               → nhận hết (cho compliance)

✅ 2. ZERO PRODUCER COUPLING: Producer chỉ cần biết routing key, không biết
      queue nào đang lắng nghe, bao nhiêu consumers

✅ 3. OPEN/CLOSED PRINCIPLE: Thêm consumer mới (queue mới, binding mới)
      mà KHÔNG cần sửa bất kỳ dòng code producer nào

✅ 4. HIERARCHICAL NAMESPACE: Routing key 2-3 levels tạo ra namespace rõ ràng
      Rất dễ đọc, trace log, monitoring

✅ 5. FLEXIBLE FANOUT khi cần: Nhiều queues cùng bind 'order.created'
      → tất cả đều nhận cùng 1 event (pub/sub pattern)

✅ 6. GIẢ LẬP DIRECT: Binding key không có wildcard → hoạt động y hệt Direct
      → 1 Exchange type dùng cho mọi trường hợp
```

### 7.6. Cơ chế trong project NestJS này

Trong `rabbitmq.module.ts` và `main.ts` của codebase:

```typescript
// Cấu hình Exchange
exchange: 'ecom.events',     // Tên exchange dùng chung toàn dự án
exchangeType: 'topic',       // Loại Topic
wildcards: true,             // ← BẮT BUỘC với NestJS — không có dòng này,
                             //   NestJS không tạo exchange, routing im lặng thất bại

// Routing keys được dùng (rabbitmq.constant.ts):
'order.created'              // Producer publish với key này
'order.status_changed'
'order.cancelled'
'payment.succeeded'
'payment.failed'
'sku.stock_reserved'
'cache.invalidate'
```

**Luồng routing từ đầu đến cuối:**

```
1. Order service tạo order thành công
   └─ Ghi Outbox { eventType: 'order.created', ... } vào DB (trong $transaction)

2. OutboxWorker (mỗi 1 giây)
   └─ eventBusService.publish({ eventType: 'order.created', ... })
   └─ client.emit('order.created', data)   ← routing key = 'order.created'

3. Exchange 'ecom.events' (topic) nhận message
   └─ So sánh routing key 'order.created' với binding keys của các queues

4. Kết quả routing:
   ├─ order_events_q        (binding: 'order.*')   → MATCH → message vào queue này
   ├─ payment_events_q      (binding: 'payment.*') → NO MATCH
   ├─ inventory_events_q    (binding: 'sku.*')     → NO MATCH
   └─ audit_q               (binding: '#')         → MATCH → message vào queue này

5. Consumers nhận message:
   @EventPattern('order.created')        ← exact pattern
   async handleOrderCreated(event) { ... }

   // Hoặc dùng wildcard khi wildcards: true:
   @EventPattern('order.*')              ← match tất cả order events
   async handleAllOrderEvents(event) { ... }
```

### 7.7. Patterns các lập trình viên senior áp dụng

**Pattern 1: Domain Namespace Hierarchy (phổ biến nhất)**

```
Cấu trúc: {domain}.{entity}.{action}
          hoặc {domain}.{action} (khi domain = entity)

Ví dụ trong ecommerce:
  order.created, order.cancelled, order.expired
  payment.succeeded, payment.failed
  inventory.stock_reserved, inventory.stock_low
  user.registered, user.profile_updated

Ví dụ trong fintech:
  account.deposit.completed
  account.withdrawal.failed
  card.transaction.declined
  loan.application.approved

→ Nhìn vào routing key biết ngay: domain gì, xảy ra gì
→ Queue binding theo domain: 'order.*', 'payment.*', 'account.*'
```

**Pattern 2: Multi-consumer cho cùng 1 event (Pub/Sub)**

```
Event: 'payment.succeeded'
  │
  ├── order_events_q    (binding: 'payment.*') → Cập nhật order status
  ├── notification_q    (binding: 'payment.*') → Gửi email receipt cho user
  ├── loyalty_q         (binding: 'payment.*') → Cộng điểm thưởng
  └── audit_q           (binding: '#')         → Log cho compliance

→ 1 producer emit 1 event → 4 consumers xử lý song song
→ Thêm consumer mới (ví dụ analytics_q) → KHÔNG đụng vào 1 dòng code cũ
```

**Pattern 3: Audit Queue nhận tất cả**

```typescript
// 1 queue bind '#' → nhận 100% events từ exchange
// Không cần sửa bất kỳ producer hay consumer nào khác

app.connectMicroservice({
  options: {
    queue: 'audit_all_events_q',
    exchange: 'ecom.events',
    exchangeType: 'topic',
    wildcards: true,
    // binding key '#' → được cấu hình phía RabbitMQ khi declare binding
  }
})

// Consumer:
@EventPattern('#')   // hoặc từng pattern cụ thể
async auditAllEvents(event: DomainEvent) {
  await this.auditLog.record(event)
}
```

**Pattern 4: Event Versioning khi migration**

```
Bài toán: Cần thay đổi format của event 'order.created' (breaking change)

Giải pháp:
  v1: publish routing key 'v1.order.created'
  v2: publish routing key 'v2.order.created'

  Consumer cũ: bind 'v1.order.*'  → nhận v1 events
  Consumer mới: bind 'v2.order.*' → nhận v2 events

  Migration period: publish cả v1 lẫn v2 song song
  Sau khi tất cả consumer migrate xong → bỏ publish v1

→ Zero downtime migration, không cần flag hay if/else trong code
```

**Pattern 5: Environment/Tenant routing**

```
Multi-tenant SaaS:
  tenant_A.order.created   → bind 'tenant_a.*.*' → Queue của tenant A
  tenant_B.order.created   → bind 'tenant_b.*.*' → Queue của tenant B

Environment separation (1 RabbitMQ cho nhiều môi trường):
  prod.order.created    → prod consumers: bind 'prod.#'
  staging.order.created → staging consumers: bind 'staging.#'
  dev.order.created     → dev consumers: bind 'dev.#'
```

### 7.8. Điểm "excellent" của Topic Exchange — tổng hợp

```
┌──────────────────────────────┬────────────────────────────────────────────────┐
│ Điểm mạnh (Excellent Points) │ Giải thích                                     │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Superset của tất cả          │ Giả lập được Direct (no wildcard) và           │
│                              │ Fanout (binding '#') — 1 loại dùng cho tất cả  │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Selective routing            │ Queue chỉ nhận đúng events nó quan tâm,        │
│                              │ không phải xử lý rồi bỏ qua                   │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Zero coupling                │ Producer không biết ai đang lắng nghe,         │
│                              │ chỉ publish vào exchange + routing key         │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Open/Closed Principle        │ Thêm consumer mới = thêm queue + binding key   │
│                              │ KHÔNG sửa producer, KHÔNG sửa consumer cũ     │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Hierarchical namespace       │ Routing key 'order.payment.failed' tự mô tả   │
│                              │ domain → entity → action, rất readable         │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Flexible fan-out             │ Nhiều queues cùng bind 1 pattern → pub/sub     │
│                              │ 'payment.succeeded' → N consumers song song   │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Backward-compatible          │ Versioning events (v1.*, v2.*) không cần       │
│ versioning                   │ downtime hay code flag                         │
├──────────────────────────────┼────────────────────────────────────────────────┤
│ Operations-friendly          │ Nhìn vào routing key trên RabbitMQ Management  │
│                              │ UI biết ngay event này thuộc domain nào        │
└──────────────────────────────┴────────────────────────────────────────────────┘
```

### 7.9. Lưu ý quan trọng khi dùng với NestJS

```typescript
// ⚠️ wildcards: true là BẮT BUỘC — nếu bỏ:
//   - NestJS KHÔNG tạo exchange
//   - Message đi vào default exchange (direct)
//   - Routing theo pattern KHÔNG hoạt động
//   - Không có lỗi, không có warning — im lặng hoàn toàn

// ✅ ĐÚNG:
ClientsModule.register([{
  transport: Transport.RMQ,
  options: {
    wildcards: true,           // ← không được thiếu
    exchange: 'ecom.events',
    exchangeType: 'topic',
    // ...
  }
}])

// ❌ SAI — exchange và exchangeType bị IGNORE hoàn toàn:
ClientsModule.register([{
  transport: Transport.RMQ,
  options: {
    // wildcards: true  ← thiếu dòng này
    exchange: 'ecom.events',   // ← bị ignore
    exchangeType: 'topic',     // ← bị ignore
  }
}])
```

---

## Tổng kết

```
1. Request-Reply    → Khi CẦN kết quả từ service khác qua queue
2. Saga Pattern     → Distributed transaction khi mỗi service có DB riêng
3. Dead Letter Queue→ Nơi chứa messages fail vĩnh viễn, cần manual review
4. Event vs Command → Event: "đã xảy ra" (pub/sub) | Command: "hãy làm" (point-to-point)
5. Backpressure     → Kiểm soát tốc độ producer/consumer để tránh overwhelm
6. Broker comparison→ BullMQ (đơn giản) → RabbitMQ (linh hoạt) → Kafka (scale lớn) → SQS (managed)
7. Topic Exchange   → Superset của Direct + Fanout: routing key (producer) + binding key wildcard
                      (* = 1 word, # = 0..N words) → selective, decoupled, extensible
```
