### Quyết định áp dụng Message Queue (RabbitMQ/Kafka) cho dự án NestJS Ecommerce

Mục tiêu: chuẩn bị để launch cho người dùng thật, tăng độ tin cậy, hiệu năng và khả năng mở rộng. Tài liệu này đưa ra: khi nào cần MQ, chọn RabbitMQ hay Kafka trong từng bài toán, lộ trình triển khai theo giai đoạn, và cách tích hợp vào codebase hiện tại.

> **Bối cảnh kiến trúc**: Dự án hiện tại là **monolith** (1 NestJS app, 1 Postgres DB, 1 Redis). Chưa phải microservices. MQ trong tài liệu này chủ yếu mang tính **học tập và chuẩn bị kiến trúc** — hiểu rõ lý thuyết để khi cần chuyển sang microservices thì áp dụng đúng. Phần nào áp dụng được ngay cho monolith, phần nào chỉ áp dụng khi đã tách service → được ghi rõ bên dưới.

---

## 0) MQ thường được dùng ở đâu? Monolith vs Microservices

### MQ là thành phần cốt lõi của kiến trúc microservices

Trong thực tế, MQ (RabbitMQ, Kafka, SQS...) **thường được dùng trong hệ thống microservices** — nơi mà các service chạy trên process/container riêng biệt, có database riêng, và **không thể gọi function trực tiếp** của nhau. MQ là cầu nối giao tiếp giữa chúng.

```
Microservices (trường hợp MQ thực sự cần thiết):

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Order Service│     │Payment Service│     │Inventory Svc │
│  (Pod riêng) │     │  (Pod riêng)  │     │  (Pod riêng)  │
│  ┌────────┐  │     │  ┌────────┐  │     │  ┌────────┐  │
│  │Order DB│  │     │  │Pay DB  │  │     │  │Inv DB  │  │
│  └────────┘  │     │  └────────┘  │     │  └────────┘  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       └─────────── MQ (RabbitMQ/Kafka) ──────────┘
       Không thể gọi function trực tiếp → PHẢI qua MQ
```

### Dự án hiện tại là monolith — vậy có cần MQ không?

**Thực tế trong code hiện tại** (đã verify):
- Tất cả modules (`Order`, `Payment`, `SKU`, `Wishlist`...) chạy trong **cùng 1 NestJS process**
- Dùng **1 Postgres database** chung → có thể dùng `$transaction` cho tất cả
- Đã có **BullMQ (Redis-based)** cho 2 use case: cancel payment sau 24h (`order.producer.ts`) và price check wishlist (`wishlist.producer.ts`, `wishlist.consumer.ts`)
- WebSocket gateway (`payment.gateway.ts`, `chat.gateway.ts`) cho realtime

**Trong monolith, MQ giải quyết các bài toán khác so với microservices:**

| Bài toán | Monolith (hiện tại) | Microservices (tương lai) |
|---|---|---|
| Gọi giữa các module | Import trực tiếp — gọi function bình thường | **PHẢI qua MQ** hoặc HTTP/gRPC |
| Transaction giữa modules | `$transaction` (cùng DB) — ACID đầy đủ | **KHÔNG THỂ** — cần Saga pattern qua MQ |
| Xử lý nền (email, resize) | BullMQ đủ tốt (đã dùng) | RabbitMQ/BullMQ đều được |
| Fan-out (1 event → N handlers) | `EventEmitter2` trong process | MQ với fanout exchange |
| Chống traffic spike | BullMQ rate limiter đủ cho scale nhỏ | MQ với backpressure per service |
| Guaranteed delivery | BullMQ retry đủ cho monolith | MQ + Outbox pattern (cross-DB) |
| Cache invalidation cross-service | Gọi Redis trực tiếp từ cùng process | **CẦN MQ** — xem [ZZ_42b](./ZZ_42b_ARCH_MQ_BETWEEN_DB_AND_CACHE_PATTERN.md) |

### Kết luận cho dự án này

```
Monolith hiện tại:
  ✅ BullMQ (đang dùng) → ĐÃ ĐỦ cho job nền, delay, cron
  ✅ EventEmitter2 → đủ cho event nội bộ (in-process pub/sub)
  ❌ RabbitMQ/Kafka → CHƯA CẦN cho nghiệp vụ hiện tại
  📚 Nhưng CẦN HIỂU lý thuyết → để khi tách microservices thì áp dụng đúng

Khi nào thực sự cần MQ (dedicated broker):
  → Khi bắt đầu tách service ra process/container riêng
  → Khi cần cross-service messaging (Order service → Payment service)
  → Khi cần Outbox pattern vì mỗi service có DB riêng
  → Khi BullMQ + Redis trở thành bottleneck (xem Section 10)
```

> **Toàn bộ lý thuyết bên dưới** được viết theo góc nhìn **kiến trúc đúng chuẩn** — tức là hệ thống ĐÃ hoặc SẼ là microservices. Đây là kiến thức nền tảng để khi quy mô dự án tăng lên, có thể áp dụng đúng cách.

---

## 1) Khi nào cần Message Queue? (Lý thuyết chung cho mọi hệ thống)

### 1a) Các tiêu chí CẦN MQ

- **Tách xử lý không đồng bộ, tránh chặn luồng HTTP**: gửi email, ghi log thanh toán, đồng bộ search, tạo thumbnail/video, gửi thông báo. User không cần chờ những việc này hoàn thành.
- **Giảm coupling giữa các module/service**: `Order` → `Payment` → `Inventory` → `Notification` chạy độc lập, retry được, idempotent. Service A chỉ cần publish event, không biết service B tồn tại.
- **Đảm bảo giao hàng message (guaranteed delivery)**: at-least-once delivery — dù consumer tạm down, message không bị mất, sẽ được xử lý khi consumer recover. Quan trọng cho nghiệp vụ tài chính (payment, stock).
- **Fan-out / pub-sub**: 1 event (`payment.succeeded`) → nhiều consumer khác nhau (Order cập nhật status, Notification gửi email, Analytics ghi metrics) mà producer không biết/quan tâm ai đang lắng nghe.
- **Chống bùng nổ lưu lượng (traffic spikes / load leveling)**: flash sale, livestream, chiến dịch khuyến mãi — MQ đóng vai trò buffer, consumer xử lý theo tốc độ riêng mà không bị overwhelm.
- **Retry tự động khi xử lý thất bại**: message fail → requeue → retry với backoff → nếu fail hết → chuyển DLQ (Dead Letter Queue) để manual review. Không mất dữ liệu.
- **Giao tiếp cross-service trong microservices**: khi mỗi service chạy trên container riêng, không thể import function trực tiếp — MQ là cầu nối tự nhiên nhất.
- **Dòng dữ liệu phân tích (event stream)**: clickstream, xem video, live metrics — throughput lớn, lưu trữ dài hạn (Kafka).

### 1b) Khi nào KHÔNG cần MQ

Đây là mặt **thường bị bỏ qua** — không phải lúc nào MQ cũng là giải pháp đúng:

| Tình huống | Tại sao KHÔNG cần MQ | Nên dùng gì thay |
|---|---|---|
| **Monolith nhỏ–trung bình, các module cùng process** | Gọi function trực tiếp nhanh hơn, đơn giản hơn, dễ debug hơn | Import module → gọi service method |
| **Cần response ngay lập tức (synchronous)** | MQ là async — user phải chờ không xác định | HTTP/gRPC trực tiếp |
| **Job nền đơn giản, đã có Redis** | Thêm RabbitMQ là thêm infra + complexity mà BullMQ đã đủ | BullMQ (đang dùng trong dự án) |
| **Event nội bộ trong 1 process** | MQ là overkill cho in-process event | `EventEmitter2` (NestJS built-in) |
| **Volume thấp, team nhỏ** | Overhead vận hành MQ > benefit | Cron job + DB flag đơn giản |
| **Chỉ cần call 1 service khác** | Nếu chỉ gọi 1 target cụ thể, HTTP đơn giản hơn | REST API / gRPC call |

**Nguyên tắc quyết định**:
```
Hỏi: "Nếu tôi gọi function trực tiếp hoặc dùng HTTP, có vấn đề gì không?"
  → Không → ĐỪNG dùng MQ
  → Có (coupling, traffic spike, cross-service, retry) → CẦN MQ
```

### 1c) Áp dụng vào dự án hiện tại

Trong code hiện tại: đã có Postgres + Redis + BullMQ. Kiến trúc monolith. Chưa có MQ dedicated.

Các domain có lợi nhất nếu dùng MQ **khi chuyển sang microservices**: `Order`, `Payment`, `SKU.stock`, `Message/Conversation` (chat).

> **Lưu ý**: `Notification` được nhắc ở nhiều tài liệu MQ nhưng **chưa có model Notification trong Prisma schema hiện tại**. Đây là feature planned/future — khi triển khai, sẽ là một consumer nhận events từ nhiều domain (order, payment, review...) và gửi push/email/SMS.

---

## 2) RabbitMQ vs Kafka: chọn gì cho giai đoạn này?

> **Lưu ý**: Section này là lý thuyết cho khi hệ thống **đã cần MQ** (tách microservices hoặc scale lớn). Trong monolith hiện tại, BullMQ đang đủ dùng — xem Section 10 để so sánh BullMQ vs RabbitMQ.

- **RabbitMQ (AMQP, work queue, at-least-once)**
  - Phù hợp: nghiệp vụ giao dịch, hàng đợi công việc, retry, DLQ, xử lý nền (email, giảm tồn, phát voucher, webhooks thanh toán).
  - Ưu điểm: routing linh hoạt (direct/topic/fanout), xác nhận message, dễ triển khai với NestJS microservices, hỗ trợ multi-protocol (AMQP, MQTT, STOMP).
  - Throughput: ~20–50K msg/s tùy config (non-mirrored cao hơn, mirrored/quorum queues thấp hơn).
  - Latency: sub-millisecond p99 ở moderate load — tốt cho request-reply pattern.
  - Hạn chế: không tối ưu cho analytics stream khối lượng lớn, lưu trữ dài hạn, message bị xóa sau khi ACK.

- **Kafka (log commit, event streaming, scale lớn)**
  - Phù hợp: log/analytics, realtime metrics (livestream, video view), đồng bộ search/recommendation, CDC/outbox, event sourcing.
  - Ưu điểm: throughput cực lớn (~1M msg/s), lưu trữ dài hạn (retention configurable), nhiều consumer groups đọc cùng 1 topic, reprocessing/replay từ quá khứ.
  - Hạn chế: vận hành phức tạp hơn, overkill cho job nền nhỏ, **không có native delay/scheduling** (cần workaround), không có priority queue.
  - **Kafka 4.0 (2026)**: đã **loại bỏ hoàn toàn ZooKeeper**, chuyển sang KRaft consensus protocol — giảm phức tạp vận hành đáng kể so với trước.

👉 Khuyến nghị theo giai đoạn:

- Giai đoạn hiện tại (monolith, chuẩn bị launch): **BullMQ** đã đủ — đang dùng và hoạt động tốt.
- Khi bắt đầu tách microservices: ưu tiên **RabbitMQ** cho nghiệp vụ giao dịch và cross-service messaging.
- Khi cần analytics/stream lớn: giữ **Kafka** cho phase sau.

---

## 3) Lộ trình triển khai theo phase

> **Context**: Roadmap này áp dụng khi dự án **bắt đầu tách microservices**. Trong monolith hiện tại, đang ở Phase 0 và BullMQ đã đủ.

- **Phase 0 (hiện tại — monolith + BullMQ)**
  - Tiếp tục dùng Redis cho cache/presence. BullMQ cho job nền (cancel payment, wishlist price check). Giữ nguyên, không cần thêm infra.

- **Phase 1 (ưu tiên tích hợp để launch)**
  - Thêm RabbitMQ để xử lý các events quan trọng theo kiểu transactional outbox:
    - `order.created` → service `inventory.reserve` và `payment.create`
    - `payment.succeeded/failed` → cập nhật `Order.status`, gửi email/sms/notification
    - `order.cancelled/expired` → `inventory.release`
    - `review.created` → cập nhật điểm, thông báo
    - `media.uploaded` → tạo ảnh thumbnail, transcoding video
  - Triển khai Outbox pattern với Prisma để đảm bảo nhất quán (ghi DB và log sự kiện cùng transaction, worker publish ra MQ).

- **Phase 2 (sau khi có nhu cầu phân tích dòng dữ liệu lớn)**
  - Thêm Kafka cho analytics/stream: `product.viewed`, `video.played`, `live.metrics`, `search.query`, `click.*`.
  - Tùy chọn dùng Debezium CDC hoặc tiếp tục Outbox → Kafka.

---

## 4) Mapping sự kiện vào schema hiện tại

> **Context**: Trong monolith hiện tại, các events này được xử lý bằng function call trực tiếp hoặc BullMQ. Mapping bên dưới là **chuẩn bị cho khi tách microservices** — lúc đó mỗi event sẽ đi qua MQ thay vì function call.

- User/Role/Permission
  - `user.created`, `user.status_changed`, `role.assigned`
- Catalog/Product/SKU
  - `product.published`, `product.updated`, `sku.stock_reserved`, `sku.stock_released`, `sku.stock_low`
- Cart/Order/Payment
  - `cart.expired`
  - `order.created`, `order.status_changed`, `order.cancelled`
  - `payment.created`, `payment.succeeded`, `payment.failed`
- Review/Message/Conversation
  - `review.created`, `review.seller_responded`
  - `message.sent` (để bắn push/offline notification)
  - `conversation.created`, `conversation.message_sent` (chat system — hiện dùng WebSocket, MQ bổ sung cho offline delivery/persistence)
- Voucher
  - `voucher.redeemed`, `voucher.expired`, `voucher.usage_limit_reached`
- Notification (**planned — chưa có model trong schema**)
  - Consumer nhận events từ nhiều domain → gửi push/email/SMS
  - Khi triển khai: `notification.sent`, `notification.failed`, `notification.read`
- AI Assistant
  - `ai.conversation_started`, `ai.knowledge_updated` (nếu cần async processing cho AI responses)

---

## 5) Outbox pattern (đề xuất triển khai)

> **Context**: Outbox pattern chủ yếu cần thiết khi **mỗi service có DB riêng** (microservices) — đảm bảo ghi DB và publish event là atomic. Trong monolith hiện tại (1 DB), có thể dùng `$transaction` + `EventEmitter2` đơn giản hơn. Outbox pattern được trình bày ở đây như **kiến thức chuẩn bị** cho khi tách service.

### 5a) Polling-based Outbox (approach chính)

- Tạo bảng `Outbox` (Postgres) lưu message chờ publish:
  - `id`, `aggregateType`, `aggregateId`, `eventType`, `payload(jsonb)`, `publishedAt`, `createdAt`
- Trong transaction tạo/cập nhật domain (ví dụ `Order`), lưu thêm record Outbox.
- Worker định kỳ đọc Outbox chưa publish → publish vào RabbitMQ → mark `publishedAt`.
- Idempotency: dùng `messageId` + `deduplication` key tại consumer.

Ví dụ pseudo SQL tạo bảng:

```sql
CREATE TABLE "Outbox" (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "Outbox"(published_at);
```

**Ưu điểm**: đơn giản, không cần tool bên ngoài, dùng được với mọi DB.
**Nhược điểm**: có delay (tùy polling interval — thường 1–5 giây), Outbox table sẽ grow → cần cron cleanup.

### 5b) CDC-based Outbox (alternative nâng cao)

Thay vì polling, dùng **Change Data Capture (CDC)** để capture changes trực tiếp từ Postgres WAL (Write-Ahead Log):

```
Application → ghi DB (trong $transaction) → Postgres WAL
                                                │
                                            Debezium CDC
                                                │
                                                ▼
                                         Kafka / RabbitMQ
```

- Tool: **Debezium** (phổ biến nhất) — đọc Postgres WAL, publish thay đổi vào Kafka/RabbitMQ.
- **Ưu điểm**: real-time (không delay polling), không cần Outbox table, không tải DB bằng polling queries.
- **Nhược điểm**: thêm tool vận hành (Debezium + Kafka Connect), phức tạp hơn, cần hiểu WAL/replication slots.
- **Khi nào dùng**: khi throughput cao, cần real-time, hoặc không muốn schema Outbox.

> Đối với dự án này: **polling-based Outbox là đủ** cho Phase 1. CDC (Debezium) chỉ cần khi scale lên Phase 2+ với Kafka.

---

## 6) Cấu hình hạ tầng gợi ý

- docker-compose bổ sung RabbitMQ (ưu tiên):

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: ecom-rabbit
    ports:
      - '5672:5672'
      - '15672:15672' # UI
    networks:
      - ecom-network
```

- docker-compose bổ sung Kafka (tùy phase 2) — **KRaft mode** (Kafka 4.0+, không cần ZooKeeper):

```yaml
services:
  kafka:
    image: apache/kafka:3.9.0
    container_name: ecom-kafka
    ports:
      - '9092:9092'
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      CLUSTER_ID: 'ecom-kafka-cluster-001'
    networks:
      - ecom-network
```

> **Kafka 4.0 (2026) đã loại bỏ hoàn toàn ZooKeeper** thay bằng KRaft consensus protocol. Config cũ dùng `cp-zookeeper` + `KAFKA_ZOOKEEPER_CONNECT` là **lỗi thời** — không dùng cho project mới.

---

## 7) Tích hợp NestJS (microservices)

> **Context**: Code bên dưới là pattern cho khi đã tách microservices. Trong monolith hiện tại, BullMQ integration (`@nestjs/bullmq`) đã hoạt động tốt — xem `order.producer.ts`, `payment.consumer.ts`, `wishlist.consumer.ts`.

- Producer/Consumer với RabbitMQ (NestJS Microservices):

```ts
// main.ts (microservice consumer)
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.RMQ,
  options: {
    urls: ['amqp://guest:guest@localhost:5672'],
    queue: 'order_events_q',
    queueOptions: { durable: true },
  },
})
await app.listen()
```

```ts
// Producer service
@Injectable()
export class EventBusService {
  constructor(@Inject('RABBITMQ_CLIENT') private client: ClientProxy) {}
  publish(eventType: string, payload: any) {
    return this.client.emit(eventType, payload) // at-least-once
  }
}
```

- Định nghĩa queues: `order_events_q`, `payment_events_q`, `inventory_jobs_q`, `media_jobs_q`, `notification_q`.

---

## 8) Chính sách vận hành

### 8a) Idempotency tại Consumer (CRITICAL)

Đây là yếu tố **quan trọng nhất** khi dùng MQ. At-least-once delivery nghĩa là message **CÓ THỂ bị deliver nhiều lần** (network retry, consumer crash sau khi xử lý nhưng trước khi ACK). Consumer PHẢI xử lý đúng dù nhận cùng message 2, 3, hoặc N lần.

**Tại sao message bị deliver nhiều lần?**
```
Trường hợp 1: Consumer xử lý xong → crash trước khi ACK → MQ requeue → deliver lại
Trường hợp 2: Network timeout → MQ nghĩ consumer dead → requeue → deliver lại
Trường hợp 3: Outbox worker publish → crash trước mark publishedAt → polling lại → publish lần 2
```

**Cách implement idempotent consumer:**

| Approach | Cách làm | Phù hợp cho |
|---|---|---|
| **Deduplication table** | Lưu `messageId` vào bảng `ProcessedEvents` trước khi xử lý. Nếu đã tồn tại → skip | Mọi event type |
| **Version check** | So sánh `event.version` với `entity.version` trong DB. Nếu entity đã >= → skip | Entity có version field (SKU, Order) |
| **Idempotent operation** | Operation tự bản chất đã idempotent: `SET status = 'PAID'` (gán cùng giá trị) | Status updates, SET operations |
| **Unique constraint** | DB unique constraint ngăn insert trùng: `@@unique([orderId, eventType])` | Tạo record 1 lần |

```ts
// Ví dụ: deduplication table approach
async handleEvent(event: DomainEvent) {
  const exists = await this.prisma.processedEvent.findUnique({
    where: { messageId: event.messageId }
  })
  if (exists) return // Đã xử lý rồi → skip

  await this.prisma.$transaction([
    this.prisma.processedEvent.create({ data: { messageId: event.messageId } }),
    // ... business logic
  ])
}
```

### 8b) Message Ordering (thứ tự message)

Ordering khác nhau giữa các MQ — điều này **quan trọng** cho domain events:

| MQ | Ordering guarantee | Cách đảm bảo |
|---|---|---|
| **BullMQ** | FIFO trong 1 queue | Mặc định (single queue, sequential processing) |
| **RabbitMQ** | FIFO per queue | 1 queue per entity hoặc consistent hashing |
| **Kafka** | FIFO per partition | Partition key = entity ID (ví dụ: `order-123`) |

**Tại sao ordering quan trọng?**
```
Đúng thứ tự:  order.created → order.paid → order.shipped    ✅
Sai thứ tự:   order.paid → order.created → order.shipped    ❌ (paid nhưng chưa tạo!)
```

**Cách đảm bảo ordering cho domain events:**
- Dùng **entity ID làm routing/partition key** → tất cả events của cùng 1 order luôn vào cùng queue/partition → xử lý tuần tự
- RabbitMQ: `routingKey = 'order.123.created'` + consistent hash exchange
- Kafka: `key = 'order-123'` → cùng partition

> **Trong monolith hiện tại**: ordering không phải vấn đề vì mọi thứ chạy trong 1 process, function call đồng bộ, `$transaction` đảm bảo ACID.

### 8c) Retry + Dead Letter Queue (DLQ)

- Cấu hình TTL và DLX (Dead Letter Exchange) cho mỗi queue quan trọng
- Retry strategy: exponential backoff (2s → 4s → 8s → 16s → DLQ)
- DLQ consumer: log chi tiết, alert team, lưu vào DB cho manual review
- **Không retry vô hạn** — giới hạn 3–5 lần, sau đó chuyển DLQ

```
Message fail → retry 1 (2s) → retry 2 (4s) → retry 3 (8s) → DLQ
                                                                │
                                                    Alert team + log to DB
                                                    Manual review + replay
```

### 8d) Event Schema Versioning

Khi event format thay đổi (thêm/xóa/đổi field), cần chiến lược để không break consumer:

**Backward compatible changes** (an toàn — không cần version bump):
- Thêm field mới **optional** (consumer cũ ignore field mới)
- Thêm enum value mới (consumer cũ fallback default)

**Breaking changes** (CẦN version bump):
- Đổi tên field, đổi type, xóa field required
- Chiến lược: dual-publish v1 + v2 trong transition period

```
Ví dụ migration event schema:

Phase 1: Producer publish cả v1 lẫn v2
  routing key: 'v1.order.created' + 'v2.order.created'
  Consumer cũ: bind 'v1.order.*'
  Consumer mới: bind 'v2.order.*'

Phase 2: Tất cả consumer đã migrate → bỏ publish v1

Payload convention:
{
  "schemaVersion": 2,
  "eventType": "order.created",
  "messageId": "uuid-unique-per-message",
  "timestamp": "2026-04-09T10:00:00Z",
  "data": { ... actual event data ... }
}
```

### 8e) Monitoring & Alerting

| Metric | Ý nghĩa | Alert khi |
|---|---|---|
| **Queue depth** | Số message đang chờ xử lý | > threshold (consumer không theo kịp) |
| **Consumer lag** | Khoảng cách giữa message mới nhất và message đang xử lý | Lag tăng liên tục |
| **Processing time** (p50/p95/p99) | Thời gian xử lý 1 message | p99 > SLA (ví dụ > 5s) |
| **DLQ depth** | Số message fail chuyển DLQ | > 0 (cần manual review) |
| **Error rate** | % message fail / total | > 5% |
| **Outbox pending** | Số Outbox records chưa publish | Tăng liên tục (worker có vấn đề) |

Tools: RabbitMQ Management UI (built-in, port 15672), Prometheus + Grafana, OpenTelemetry + traceId trong header message.

### 8f) Bảo mật

- Dùng user/pass riêng cho RabbitMQ (không dùng `guest:guest` trong production)
- Không public port 15672 (Management UI) ra internet
- TLS cho connection giữa service và MQ trong production
- Giới hạn permissions: mỗi service chỉ có quyền publish/consume queue liên quan

---

## 9) Checklist đưa vào production (Phase 1 - RabbitMQ)

- [ ] Thêm `Outbox` table + worker publish.
- [ ] Thêm docker service `rabbitmq` (dev + staging + prod).
- [ ] Định nghĩa tối thiểu 5 sự kiện: `order.created`, `payment.succeeded`, `payment.failed`, `sku.stock_reserved`, `sku.stock_released`.
- [ ] Viết consumer cho Inventory, Payment, Notification.
- [ ] Thiết lập DLQ + alert khi DLQ tăng.
- [ ] Log/tracing message + dashboard đơn giản (RabbitMQ UI/Prometheus/Grafana).

---

## 10) BullMQ (Redis-based) vs RabbitMQ — Khi nào dùng cái nào?

Dự án đã có Redis. BullMQ là một lựa chọn hợp lý cho job nền nhỏ mà **không cần thêm hạ tầng mới**. Tuy nhiên, khi nghiệp vụ phức tạp hơn, RabbitMQ là bước tiếp theo tự nhiên. Phần này giúp quyết định rõ: dùng BullMQ hay RabbitMQ cho từng loại bài toán, và khi nào nên migrate.

### So sánh trực tiếp

| Tiêu chí | BullMQ (Redis) | RabbitMQ (AMQP) |
|---|---|---|
| **Hạ tầng** | Dùng Redis đã có — không cần thêm service | Cần thêm RabbitMQ service riêng |
| **Độ phức tạp vận hành** | Thấp — Redis đã quen | Trung bình — cần cấu hình exchange/queue/DLX |
| **Throughput** | Tốt cho job nhỏ–trung bình (~10K jobs/s) | ~20–50K msg/s tùy config (mirrored/quorum queues thấp hơn) |
| **Routing** | Không có — queue đơn giản | Linh hoạt: direct, topic, fanout, headers |
| **Retry tự động** | Có (built-in, configurable) | Có (TTL + DLX) |
| **Dead Letter Queue** | Có (failed jobs) | Có (DLX → DLQ) |
| **Persistence** | Redis AOF/RDB — có thể mất nếu Redis crash | Durable queue — persist trên disk |
| **Multi-consumer** | Có (worker concurrency) | Có (competing consumers + fanout) |
| **Fanout / pub-sub** | Không hỗ trợ tốt | Hỗ trợ tốt (fanout exchange) |
| **Cross-service messaging** | Khó — cùng Redis instance | Dễ — nhiều service kết nối độc lập |
| **UI quản lý** | Bull Board (cần cài thêm) | RabbitMQ Management UI (built-in) |
| **NestJS integration** | `@nestjs/bull` / `@nestjs/bullmq` | `@nestjs/microservices` Transport.RMQ |
| **Phù hợp với Outbox pattern** | Không lý tưởng (Redis không transactional với Postgres) | Lý tưởng (Outbox ghi Postgres → worker publish RabbitMQ) |

### Khi nào dùng BullMQ

BullMQ phù hợp khi:

- Job nền **nội bộ trong một service** (không cần cross-service): resize ảnh, gửi email đơn lẻ, export CSV.
- Cần **delay job** hoặc **cron job** đơn giản (BullMQ hỗ trợ tốt hơn RabbitMQ).
- **Chưa muốn thêm hạ tầng** — Redis đã có, chỉ cần `npm install @nestjs/bullmq`.
- Job có thể **mất được** nếu Redis restart (ví dụ: refresh cache, pre-warm data).
- Cần **rate limiting** tích hợp sẵn (BullMQ có limiter built-in).

```ts
// Ví dụ BullMQ — gửi email sau khi user đăng ký
@Processor('email')
export class EmailProcessor {
  @Process('welcome')
  async sendWelcome(job: Job<{ userId: string }>) {
    await this.emailService.sendWelcome(job.data.userId)
  }
}
```

### Khi nào dùng RabbitMQ

RabbitMQ phù hợp khi:

- Event cần **đảm bảo giao hàng tuyệt đối** — `payment.succeeded`, `order.created`, `sku.stock_reserved`.
- Cần **Outbox pattern** với Postgres (transactional consistency).
- **Nhiều service khác nhau** cần nhận cùng một event (fanout).
- Cần **routing phức tạp**: chỉ gửi event `order.cancelled` đến Inventory và Notification, không gửi đến Analytics.
- Hệ thống **multi-service thực sự** — các service chạy trên container/pod riêng biệt.
- Cần **DLQ + alert** khi message xử lý thất bại liên tục.

### Khi nào nên migrate từ BullMQ sang RabbitMQ

Migrate khi gặp **một trong các dấu hiệu** sau:

| Dấu hiệu | Lý do migrate |
|---|---|
| Job nền bắt đầu liên quan đến nhiều service | BullMQ không phù hợp cho cross-service messaging |
| Cần Outbox pattern (Postgres + MQ trong cùng transaction) | Redis không tham gia Postgres transaction |
| Cần fanout — một event → nhiều consumer khác nhau | BullMQ không có fanout exchange |
| Redis bị quá tải vì vừa cache vừa queue | Tách Redis (cache) và RabbitMQ (messaging) |
| Cần audit trail / replay message | RabbitMQ với shovel plugin hoặc chuyển sang Kafka |
| Team cần visibility tốt hơn vào queue state | RabbitMQ Management UI tốt hơn Bull Board |

### Chiến lược cho dự án này

```
Hiện tại (Phase 0):
  BullMQ (nếu đã dùng) → giữ cho job nhỏ nội bộ
  Ví dụ: resize thumbnail, gửi email đơn lẻ, export report

Phase 1 (trước launch):
  Thêm RabbitMQ cho nghiệp vụ giao dịch quan trọng
  BullMQ và RabbitMQ có thể chạy song song:
    - BullMQ: job nền nhỏ, delay job, cron
    - RabbitMQ: order/payment/inventory events với Outbox

Phase 1.5 (khi ổn định):
  Đánh giá lại — nếu BullMQ jobs không còn cần thiết riêng,
  có thể migrate toàn bộ sang RabbitMQ để đơn giản hóa stack.
```

> **Nguyên tắc**: Không cần chọn một. BullMQ và RabbitMQ giải quyết bài toán khác nhau và có thể dùng song song. Chỉ migrate khi BullMQ trở thành điểm nghẽn hoặc không đáp ứng được yêu cầu cross-service.

### Migration path cụ thể: BullMQ → RabbitMQ

Khi quyết định migrate, KHÔNG chuyển toàn bộ cùng lúc. Thực hiện từng bước:

```
Bước 1: Thêm RabbitMQ infra (docker-compose, connection config)
  → Không đụng code BullMQ hiện có

Bước 2: Event mới đi qua RabbitMQ, event cũ giữ BullMQ
  → Ví dụ: order.created (mới) → RabbitMQ
  →        cancel-payment (cũ) → BullMQ (giữ nguyên)

Bước 3: Migrate từng queue, ưu tiên event cross-service trước
  → payment events → RabbitMQ
  → inventory events → RabbitMQ
  → wishlist cron → giữ BullMQ (nội bộ, delay job)

Bước 4: Khi ổn định, đánh giá xem BullMQ còn job nào không
  → Nếu còn (delay/cron) → giữ song song
  → Nếu không → bỏ BullMQ, đơn giản hóa stack

Rollback: Nếu RabbitMQ gặp vấn đề, event bị stuck:
  → Tạm pause consumer RabbitMQ
  → Fallback về function call trực tiếp (monolith) hoặc BullMQ
  → Fix xong → replay message từ queue
```

---

## 11) Kết luận

- **Hiện tại (monolith)**: BullMQ + Redis **đã đủ** cho các job nền hiện có (cancel payment, price check wishlist). Chưa cần thêm RabbitMQ/Kafka vì tất cả modules chạy cùng process, gọi function trực tiếp nhanh và đơn giản hơn.
- **Khi bắt đầu tách microservices**: ưu tiên **RabbitMQ** cho nghiệp vụ giao dịch cross-service (order, payment, inventory), Outbox pattern để đảm bảo consistency.
- **Kafka** chỉ nên thêm khi xuất hiện nhu cầu rõ ràng về analytics/stream dữ liệu lớn (livestream metrics, video views, recommendation, event sourcing).
- Toàn bộ lý thuyết trong tài liệu này là **kiến thức nền tảng** — áp dụng đúng khi quy mô dự án tăng lên, không cần áp dụng tất cả ngay lập tức cho monolith hiện tại.

> **Một câu tóm tắt**: Hiểu MQ từ sớm, nhưng chỉ áp dụng khi kiến trúc thực sự cần — over-engineering sớm tốn nhiều hơn là lợi.
