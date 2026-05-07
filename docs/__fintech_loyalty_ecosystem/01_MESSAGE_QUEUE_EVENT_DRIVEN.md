# Message Queue & Event-Driven Architecture

## Tại sao cần MQ trong Fintech/Loyalty?

Hệ thống phục vụ hàng triệu user → gọi API đồng bộ gây nghẽn.
VD: User thanh toán xong → hệ thống ném message vào Queue để cộng điểm tích lũy. Việc cộng điểm làm sau, không bắt user chờ.

## Khái niệm cốt lõi

| Thành phần | Vai trò |
|------------|---------|
| **Producer** | Gửi message (VD: Payment Service gửi event `payment.completed`) |
| **Consumer** | Nhận và xử lý message (VD: Loyalty Service nhận event, cộng điểm) |
| **Broker** | Nơi trung chuyển message (RabbitMQ, Kafka, AWS SQS) |

## So sánh nhanh các Broker

| | RabbitMQ | Kafka | AWS SQS |
|--|---------|-------|---------|
| Mô hình | Push-based, Exchange→Queue | Pull-based, Partition log | Managed queue |
| Ordering | Per-queue FIFO | Per-partition ordering | Standard: best-effort, FIFO: strict |
| Replay | Không (consumed = gone) | Có (offset-based replay) | Không |
| Khi nào dùng | Task queue, RPC, routing phức tạp | Event streaming, high throughput, audit log | Serverless, AWS ecosystem |
| Throughput | ~50K msg/s | ~1M msg/s | ~3K msg/s (standard) |

## Dead Letter Queue (DLQ)

Message bị lỗi không tiêu thụ được → chuyển vào DLQ thay vì mất.

```
Main Queue → Consumer xử lý
    ↓ (fail sau N lần retry)
Dead Letter Queue → Alert team / Manual review / Auto replay
```

**Flow xử lý:**
1. Consumer nhận message, xử lý fail
2. Retry với exponential backoff: 1s → 2s → 4s → 8s (+ jitter tránh thundering herd)
3. Sau max retries → message chuyển vào DLQ
4. Alert + review + replay khi fix xong

**Config RabbitMQ DLQ:**
```typescript
// Khai báo queue với DLQ policy
channel.assertQueue('loyalty.points', {
  arguments: {
    'x-dead-letter-exchange': 'dlx.exchange',
    'x-dead-letter-routing-key': 'loyalty.points.dlq',
    'x-message-ttl': 30000, // retry sau 30s
    'x-max-retries': 3
  }
});
```

## Idempotency (Tính lũy đẳng)

**Vấn đề:** 1 message gửi 2 lần → cộng điểm 2 lần cho user.

**3 cách giải quyết:**

### 1. Deduplication Table (DB)
```sql
CREATE TABLE processed_events (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  result JSONB,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Trước khi xử lý: INSERT, nếu CONFLICT → skip
INSERT INTO processed_events (idempotency_key, result)
VALUES ('evt_abc123', '{"points": 100}')
ON CONFLICT (idempotency_key) DO NOTHING;
-- affected rows = 0 → đã xử lý rồi, skip
```

### 2. Redis SET NX (nhanh, TTL tự dọn)
```typescript
const key = `idempotent:${eventId}`;
const acquired = await redis.set(key, '1', 'NX', 'EX', 86400); // 24h TTL
if (!acquired) return; // đã xử lý rồi
// Xử lý logic...
```

### 3. Version check (Optimistic locking)
```sql
UPDATE user_points
SET points = points + 100, version = version + 1
WHERE user_id = 'u1' AND version = 5;
-- affected rows = 0 → version đã thay đổi, có conflict
```

## Event-Driven Patterns quan trọng

### Outbox Pattern
Giải quyết dual-write problem: ghi DB thành công nhưng publish event thất bại.

```
1. BEGIN TRANSACTION
2. INSERT INTO orders (...)
3. INSERT INTO outbox (event_type, payload, published = false)
4. COMMIT

Outbox Worker (cron/CDC):
5. SELECT * FROM outbox WHERE published = false
6. Publish to RabbitMQ
7. UPDATE outbox SET published = true
```

### Saga Pattern
Distributed transaction qua nhiều service:
- **Choreography:** Mỗi service listen event, tự publish event tiếp theo
- **Orchestration:** Saga Orchestrator điều phối các bước, gọi compensating action khi fail

## Câu hỏi phỏng vấn thường gặp

1. **Tại sao dùng MQ thay vì gọi API trực tiếp?** → Decouple services, async processing, retry mechanism, không mất message khi service down
2. **Message ordering có quan trọng không?** → Tùy case. Cộng điểm thì order không quan trọng (idempotent). Chuyển tiền thì cần strict ordering per account
3. **Làm sao đảm bảo exactly-once delivery?** → Không thể. Dùng at-least-once + idempotency consumer
4. **Consumer chết giữa chừng thì sao?** → Message unacked → broker re-deliver → consumer khác xử lý (cần idempotent)
