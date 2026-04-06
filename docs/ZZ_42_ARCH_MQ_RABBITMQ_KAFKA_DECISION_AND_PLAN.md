### Quyết định áp dụng Message Queue (RabbitMQ/Kafka) cho dự án NestJS Ecommerce

Mục tiêu: chuẩn bị để launch cho người dùng thật, tăng độ tin cậy, hiệu năng và khả năng mở rộng. Tài liệu này đưa ra: khi nào cần MQ, chọn RabbitMQ hay Kafka trong từng bài toán, lộ trình triển khai theo giai đoạn, và cách tích hợp vào codebase hiện tại.

---

## 1) Khi nào cần Message Queue trong hệ thống hiện tại?

- **Tách xử lý không đồng bộ, tránh chặn luồng HTTP**: gửi email, ghi log thanh toán, đồng bộ search, tạo thumbnail/video, gửi thông báo.
- **Giảm coupling giữa các module**: `Order` → `Payment` → `Inventory` → `Notification` chạy độc lập, retry được, idempotent.
- **Chống bùng nổ lưu lượng (traffic spikes)**: flash sale, livestream, chiến dịch khuyến mãi.
- **Dòng dữ liệu phân tích (event stream)**: clickstream, xem video, live metrics.

Trong code hiện tại: đã có Postgres + Redis; chưa có MQ. Các domain có lợi nhất nếu dùng MQ sớm: `Order`, `PaymentTransaction`, `SKU.stock`, `Message` (chat), `Notification`.

---

## 2) RabbitMQ vs Kafka: chọn gì cho giai đoạn này?

- **RabbitMQ (AMQP, work queue, at-least-once)**
  - Phù hợp: nghiệp vụ giao dịch, hàng đợi công việc, retry, DLQ, xử lý nền (email, giảm tồn, phát voucher, webhooks thanh toán).
  - Ưu điểm: routing linh hoạt (direct/topic), xác nhận message, dễ triển khai với NestJS microservices.
  - Hạn chế: không tối ưu cho analytics stream khối lượng lớn, lưu trữ dài hạn.

- **Kafka (log commit, event streaming, scale lớn)**
  - Phù hợp: log/analytics, realtime metrics (livestream, video view), đồng bộ search/recommendation, CDC/outbox.
  - Ưu điểm: throughput lớn, lưu trữ dài hạn, nhiều consumer groups, reprocessing.
  - Hạn chế: vận hành phức tạp hơn, overkill cho job nền nhỏ.

👉 Khuyến nghị theo giai đoạn:

- Giai đoạn hiện tại (chuẩn bị launch): ưu tiên **RabbitMQ** cho nghiệp vụ giao dịch và job nền. Giữ **Kafka** cho phase sau khi cần analytics/stream lớn.

---

## 3) Lộ trình triển khai theo phase

- **Phase 0 (ngay lập tức)**
  - Tiếp tục dùng Redis cho cache/presence. Việc xử lý nền nhỏ có thể dùng BullMQ (nếu đã dùng), nhưng chuẩn bị schema Outbox.

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

- User/Role/Permission
  - `user.created`, `user.status_changed`, `role.assigned`
- Catalog/Product/SKU
  - `product.published`, `product.updated`, `sku.stock_reserved`, `sku.stock_released`, `sku.stock_low`
- Cart/Order/Payment
  - `cart.expired`
  - `order.created`, `order.status_changed`, `order.cancelled`
  - `payment.created`, `payment.succeeded`, `payment.failed`
- Review/Message
  - `review.created`
  - `message.sent` (để bắn push/offline notification)

---

## 5) Outbox pattern (đề xuất triển khai)

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

- docker-compose bổ sung Kafka (tùy phase 2):

```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports:
      - '9092:9092'
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

---

## 7) Tích hợp NestJS (microservices)

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

- Retry + DLQ: cấu hình TTL và DLX cho mỗi queue quan trọng.
- Idempotency: key theo `eventId`/`orderId` + version; kiểm tra trước khi xử lý.
- Tracing/Logs: OpenTelemetry + traceId trong header message.
- Versioning sự kiện: `eventType` có `v1/v2`, payload có `schemaVersion`.
- Bảo mật: dùng user/pass riêng cho RabbitMQ; không public 15672.

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
| **Throughput** | Tốt cho job nhỏ–trung bình (~10k jobs/s) | Tốt cho message routing phức tạp (~50k msg/s) |
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

---

## 11) Kết luận

- Ở giai đoạn hiện tại, **nên áp dụng RabbitMQ** để đảm bảo tính ổn định cho các nghiệp vụ giao dịch, xử lý nền, giảm coupling và hỗ trợ retry/đảm bảo giao hàng.
- **Kafka** chỉ nên thêm khi xuất hiện nhu cầu rõ ràng về analytics/stream dữ liệu lớn (livestream metrics, video views, recommendation).
- Mô hình Outbox + RabbitMQ phù hợp với schema hiện tại và có thể triển khai nhanh để sẵn sàng launch.
