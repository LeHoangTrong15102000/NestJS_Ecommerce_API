# Transactional Outbox Pattern — Banking Domain

> **Mục tiêu:** Đảm bảo dữ liệu vừa được lưu vào Database (MySQL) **vừa** chắc chắn Event được bắn lên Message Broker (Artemis/GCP Pub/Sub/RabbitMQ) mà **không bị thất thoát** dù rớt mạng hay crash giữa chừng.

---

## Mục lục

1. [Vấn đề: DB write và Event publish không atomic](#1-vấn-đề-db-write-và-event-publish-không-atomic)
2. [Transactional Outbox Pattern](#2-transactional-outbox-pattern)
3. [Outbox Table Design (MySQL)](#3-outbox-table-design-mysql)
4. [Outbox Worker — Polling-based](#4-outbox-worker--polling-based)
5. [Triển khai NestJS + MySQL + Artemis/GCP Pub/Sub](#5-triển-khai-nestjs--mysql--artemisgcp-pubsub)
6. [CDC-based Outbox (Alternative nâng cao)](#6-cdc-based-outbox-alternative-nâng-cao)
7. [Cleanup & Monitoring](#7-cleanup--monitoring)
8. [Câu hỏi phỏng vấn thường gặp](#8-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Vấn đề: DB write và Event publish không atomic

### Hai kịch bản lỗi:

```
Kịch bản 1: Ghi DB thành công → Publish event → CRASH
──────────────────────────────────────────────────────
Transaction Service:
  BEGIN;
    INSERT INTO transactions (account_id, amount, ...) VALUES (...);
  COMMIT; ✅ DB đã lưu

  await messageBroker.publish('payment.processed', data);
  // ← SERVER CRASH ở đây

Hậu quả:
  - DB: giao dịch đã lưu (success)
  - Message Broker: event CHƯA được publish
  - Downstream services (Ledger, Notify) KHÔNG biết giao dịch này tồn tại
  - → Inconsistency! Tiền đã trừ nhưng không ghi sổ cái

Kịch bản 2: Publish event → Ghi DB → CRASH
──────────────────────────────────────────────────────
  await messageBroker.publish('payment.processed', data);
  // ← Downstream đã xử lý event

  BEGIN;
    INSERT INTO transactions (...) VALUES (...);
  COMMIT; 
  // ← SERVER CRASH

Hậu quả:
  - Event đã publish (downstream đã xử lý)
  - DB: giao dịch CHƯA được lưu
  - → Downstream đã ghi sổ cái cho giao dịch KHÔNG TỒN TẠI trong DB chính
```

**Kết luận:** Không thể đảm bảo DB write và Message Broker publish là atomic.

---

## 2. Transactional Outbox Pattern

### Giải pháp:

```
Thay vì publish TRỰC TIẾP lên Message Broker:
  1. Ghi event vào bảng OUTBOX (cùng DB, cùng transaction với business data)
  2. Worker RIÊNG đọc Outbox và publish lên Message Broker
  3. Sau khi publish thành công → đánh dấu Outbox record là PUBLISHED

Đảm bảo:
  - DB write và Outbox write: CÙNG transaction → ACID bảo đảm
  - Nếu DB commit OK → Outbox record chắc chắn tồn tại
  - Worker có thể retry cho đến khi publish thành công
  - At-least-once delivery (consumer phải xử lý idempotent)
```

### Diagram:

```
┌─────────────────────────────────────────────────────────────────┐
│  Transaction Service                                            │
│                                                                 │
│  BEGIN TX ──────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  ├─ INSERT INTO transactions (amount, account_id, ...)      │  │
│  │                                                          │  │
│  └─ INSERT INTO outbox_events (topic, payload, status='NEW')│  │
│                                                          COMMIT  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   │ (cùng DB, cùng transaction)
                                   │ → ACID bảo đảm cả 2 hoặc không ai
                                   
┌─────────────────────────────────────────────────────────────────┐
│  Outbox Worker (background job — chạy riêng)                    │
│                                                                 │
│  Loop mỗi 1-2 giây:                                            │
│    SELECT * FROM outbox_events WHERE status = 'NEW' LIMIT 100   │
│    FOR EACH event:                                              │
│      publish(event.topic, event.payload)  → Artemis/Pub Sub    │
│      UPDATE outbox_events SET status='PUBLISHED' WHERE id=...  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             Artemis Broker  GCP Pub/Sub    RabbitMQ
             (Banking)       (Modern)       (Traditional)
                    │
                    ▼
             Downstream Services (Ledger, Notify, Risk...)
```

---

## 3. Outbox Table Design (MySQL)

```sql
CREATE TABLE outbox_events (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  aggregate_type  VARCHAR(100) NOT NULL,        -- 'TRANSACTION', 'ACCOUNT', 'PAYMENT'
  aggregate_id    VARCHAR(100) NOT NULL,         -- ID của entity liên quan
  event_type      VARCHAR(100) NOT NULL,         -- 'payment.processed', 'transfer.debited'
  topic           VARCHAR(200) NOT NULL,         -- Topic/Queue trên broker
  payload         JSON NOT NULL,                -- Event data
  status          ENUM('NEW', 'PROCESSING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'NEW',
  retry_count     TINYINT NOT NULL DEFAULT 0,
  max_retries     TINYINT NOT NULL DEFAULT 5,
  error_message   TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at    DATETIME,
  next_retry_at   DATETIME,
  
  -- Index để worker query hiệu quả
  INDEX idx_status_retry (status, next_retry_at),
  INDEX idx_aggregate (aggregate_type, aggregate_id),
  INDEX idx_created (created_at)    -- Để cleanup cron
) ENGINE=InnoDB;
```

---

## 4. Outbox Worker — Polling-based

### Logic của Worker:

```
Mỗi 1-2 giây:
  1. SELECT với FOR UPDATE SKIP LOCKED (nhiều worker chạy song song)
  2. Đánh dấu PROCESSING (tránh worker khác nhặt trùng)
  3. Publish lên broker
  4. Đánh dấu PUBLISHED hoặc FAILED + tăng retry_count
  5. Nếu retry_count >= max_retries → chuyển vào DLQ hoặc alert
```

```sql
-- Worker query pattern (SKIP LOCKED cho multi-worker)
SELECT id, topic, payload, retry_count
FROM outbox_events
WHERE status = 'NEW'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY created_at ASC
LIMIT 100
FOR UPDATE SKIP LOCKED;
```

---

## 5. Triển khai NestJS + MySQL + Artemis/GCP Pub/Sub

### 5.1 Outbox Service (Ghi vào Outbox)

```typescript
// outbox/outbox.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

export interface OutboxEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  topic: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  // Ghi event vào Outbox TRONG cùng QueryRunner (transaction)
  async writeEvent(
    qr: QueryRunner,  // ← cùng QueryRunner với business logic
    event: OutboxEvent,
  ): Promise<void> {
    await qr.manager.query(`
      INSERT INTO outbox_events 
        (aggregate_type, aggregate_id, event_type, topic, payload, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'NEW', NOW())
    `, [
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      event.topic,
      JSON.stringify(event.payload),
    ]);
  }
}
```

### 5.2 Dùng Outbox trong Payment Service

```typescript
// payment/payment.service.ts
@Injectable()
export class PaymentService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private outboxService: OutboxService,
  ) {}

  async processPayment(dto: ProcessPaymentDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('REPEATABLE READ');

    try {
      // 1. Lock account
      const [account] = await qr.manager.query(
        'SELECT id, balance FROM accounts WHERE id = ? FOR UPDATE',
        [dto.accountId]
      );

      if (account.balance < dto.amount) {
        throw new Error('Insufficient balance');
      }

      // 2. Tạo transaction record
      const result = await qr.manager.query(
        `INSERT INTO transactions (account_id, amount, reference, status, created_at)
         VALUES (?, ?, ?, 'SUCCESS', NOW())`,
        [dto.accountId, dto.amount, dto.reference]
      );
      const transactionId = result.insertId;

      // 3. Cập nhật số dư
      await qr.manager.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [dto.amount, dto.accountId]
      );

      // 4. Ghi Outbox (TRONG CÙNG TRANSACTION với business data)
      await this.outboxService.writeEvent(qr, {
        aggregateType: 'PAYMENT',
        aggregateId: String(transactionId),
        eventType: 'payment.processed',
        topic: 'payment.processed',            // Topic trên Artemis/GCP Pub/Sub
        payload: {
          transactionId,
          accountId: dto.accountId,
          amount: dto.amount,
          reference: dto.reference,
          processedAt: new Date().toISOString(),
        },
      });

      // 5. COMMIT — Cả 2 (transaction record + outbox event) hoặc không ai
      await qr.commitTransaction();
      return { success: true, transactionId };

    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
```

### 5.3 Outbox Worker — Publish lên GCP Pub/Sub

```typescript
// outbox/outbox.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly pubsub = new PubSub();

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_SECOND)  // Chạy mỗi giây
  async processPendingEvents() {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Lấy events chưa publish, SKIP LOCKED cho multi-instance
      const events = await qr.manager.query(`
        SELECT id, topic, payload, retry_count
        FROM outbox_events
        WHERE status = 'NEW'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `);

      if (!events.length) {
        await qr.rollbackTransaction();
        return;
      }

      // Đánh dấu PROCESSING để tránh worker khác lấy trùng
      const ids = events.map(e => e.id);
      await qr.manager.query(
        `UPDATE outbox_events SET status = 'PROCESSING' WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      await qr.commitTransaction();

      // Publish từng event (ngoài transaction để không giữ lock lâu)
      await Promise.allSettled(
        events.map(event => this.publishEvent(event))
      );
    } catch (error) {
      this.logger.error('Outbox worker error', error);
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }
  }

  private async publishEvent(event: OutboxEventRow) {
    try {
      // Publish lên GCP Pub/Sub
      const topic = this.pubsub.topic(event.topic);
      const messageId = await topic.publishMessage({
        data: Buffer.from(event.payload),
        attributes: {
          outboxEventId: String(event.id),
          eventType: event.event_type,
        },
      });

      // Đánh dấu PUBLISHED
      await this.dataSource.query(
        `UPDATE outbox_events 
         SET status = 'PUBLISHED', published_at = NOW()
         WHERE id = ?`,
        [event.id]
      );

      this.logger.log(`Published event ${event.id} → ${event.topic} (messageId: ${messageId})`);

    } catch (error) {
      this.logger.error(`Failed to publish event ${event.id}`, error);

      // Tăng retry count + exponential backoff
      const nextRetrySeconds = Math.pow(2, event.retry_count + 1) * 30; // 60s, 120s, 240s...
      
      await this.dataSource.query(
        `UPDATE outbox_events 
         SET status = CASE WHEN retry_count >= max_retries THEN 'FAILED' ELSE 'NEW' END,
             retry_count = retry_count + 1,
             next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
             error_message = ?
         WHERE id = ?`,
        [nextRetrySeconds, error.message, event.id]
      );
    }
  }
}
```

### 5.4 Outbox Worker — Publish lên Apache Artemis

```typescript
// outbox/artemis-outbox.worker.ts
import { Container, Connection, Sender } from 'rhea-promise';  // AMQP 1.0 library cho Artemis

@Injectable()
export class ArtemisOutboxWorker {
  private connection: Connection;
  private sender: Sender;

  async onModuleInit() {
    // Kết nối tới Apache Artemis qua AMQP 1.0
    const container = new Container();
    this.connection = await container.connect({
      hostname: process.env.ARTEMIS_HOST,
      port: parseInt(process.env.ARTEMIS_PORT),
      username: process.env.ARTEMIS_USER,
      password: process.env.ARTEMIS_PASSWORD,
      transport: 'ssl',  // TLS cho production banking
    });
    this.sender = await this.connection.createSender('payment.events');
  }

  private async publishToArtemis(event: OutboxEventRow) {
    // Gửi message lên Artemis queue/topic
    await this.sender.send({
      body: event.payload,
      properties: {
        messageId: `outbox-${event.id}`,       // Để broker dedup
        correlationId: event.aggregate_id,
      },
      applicationProperties: {
        eventType: event.event_type,
        outboxId: event.id,
      },
    });
  }
}
```

---

## 6. CDC-based Outbox (Alternative nâng cao)

```
CDC (Change Data Capture) = Đọc MySQL Binary Log thay vì polling

Tools: Debezium → đọc MySQL binlog → publish event tự động
       (không cần Outbox table, không cần Worker)

┌──────────────┐     Binlog     ┌───────────┐    Events    ┌──────────────┐
│ MySQL DB     │ ──────────────►│ Debezium  │ ────────────►│ Kafka/Broker │
│ (transactions│                │ Connector │              └──────────────┘
│  table)      │                └───────────┘
└──────────────┘

Ưu điểm:
  - Real-time (không delay polling)
  - Không cần Outbox table schema
  - Không tạo thêm DB load

Nhược điểm:
  - Phức tạp hơn (cần Debezium setup)
  - Cần MySQL binlog_format = ROW
  - Coupling với DB schema

Khi nào dùng:
  → Polling-based Outbox đủ cho phần lớn banking use cases
  → CDC khi cần real-time strict (< 500ms latency) hoặc throughput rất cao
```

---

## 7. Cleanup & Monitoring

### Cron cleanup Outbox records cũ

```typescript
@Cron('0 2 * * *')  // 2am hàng ngày
async cleanupOldEvents() {
  // Xóa events đã publish quá 7 ngày
  await this.dataSource.query(`
    DELETE FROM outbox_events 
    WHERE status = 'PUBLISHED' 
      AND published_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    LIMIT 10000
  `);
}
```

### Monitoring metrics cần theo dõi

```
1. outbox_events_new_count: Số events chưa publish
   → Alert nếu > 100 sau 5 phút (worker có vấn đề)

2. outbox_events_failed_count: Số events fail hết retry
   → Alert ngay nếu > 0 (cần manual review)

3. outbox_publish_latency: Thời gian từ create đến publish
   → Alert nếu P95 > 30 giây

4. Worker heartbeat: Worker có đang chạy không?
   → Alert nếu worker không chạy trong 2 phút
```

---

## 8. Câu hỏi phỏng vấn thường gặp

**Q1: "Tại sao cần Outbox Pattern? Tại sao không publish event trực tiếp sau khi COMMIT?"**
> A: Vì giữa COMMIT và publish có khoảng thời gian — server có thể crash, mạng có thể fail. Nếu publish thất bại → DB đã commit nhưng downstream không biết. Outbox Pattern ghi event vào DB cùng transaction → ACID đảm bảo cả 2 hoặc không ai. Worker sau đó có thể retry mãi cho đến khi publish thành công.

**Q2: "Outbox Pattern đảm bảo at-least-once hay exactly-once?"**
> A: At-least-once. Worker có thể publish rồi crash trước khi đánh dấu PUBLISHED → publish lần 2 khi restart. Vì vậy consumer PHẢI xử lý idempotent — kiểm tra đã xử lý event này chưa trước khi thực hiện business logic.

**Q3: "Làm sao tránh nhiều worker publish cùng 1 event?"**
> A: Dùng `FOR UPDATE SKIP LOCKED` — mỗi worker chỉ lấy events chưa bị lock. Ngoài ra có thể dùng `status = 'PROCESSING'` sau khi lấy, để worker khác biết event đang được xử lý.

**Q4: "Polling có delay không? Làm sao giảm delay?"**
> A: Có — tùy polling interval (thường 1-2 giây). Để giảm: (1) giảm interval xuống 200-500ms, (2) sau khi COMMIT, trigger worker ngay qua in-process event (EventEmitter2) thay vì chờ cron, (3) dùng CDC (Debezium) nếu cần real-time. Cho banking, 1-2 giây thường chấp nhận được.
