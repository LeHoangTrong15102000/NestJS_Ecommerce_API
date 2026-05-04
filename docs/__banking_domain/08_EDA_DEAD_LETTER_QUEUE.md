# Dead Letter Queue (DLQ) — Banking Domain

> **Mục tiêu:** Hiểu cách xử lý các message **bị lỗi liên tục** (consumer không xử lý được sau nhiều lần retry), đặc biệt trong ngữ cảnh banking nơi mọi giao dịch thất bại đều cần được track và resolve thủ công.

---

## Mục lục

1. [DLQ là gì? Tại sao banking cần?](#1-dlq-là-gì-tại-sao-banking-cần)
2. [Flow Message Lifecycle với DLQ](#2-flow-message-lifecycle-với-dlq)
3. [Retry Strategy — Exponential Backoff](#3-retry-strategy--exponential-backoff)
4. [DLQ trong các Message Brokers](#4-dlq-trong-các-message-brokers)
5. [Xử lý DLQ — Alert, Review, Replay](#5-xử-lý-dlq--alert-review-replay)
6. [Triển khai NestJS Banking](#6-triển-khai-nestjs-banking)
7. [Câu hỏi phỏng vấn thường gặp](#7-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. DLQ là gì? Tại sao banking cần?

### Khái niệm

**Dead Letter Queue (DLQ)** = Hàng đợi "nghĩa địa" — nơi chứa các message không thể xử lý thành công sau N lần retry.

```
Normal Queue:  [msg1] [msg2] [msg3] [msg4]
                   ↓        ↓
              Consumer    Consumer
              xử lý OK    FAIL × 3 lần

Dead Letter Queue: [msg3]  ← Sau 3 lần fail → chuyển vào đây
                      ↓
              Ops team review + fix + replay thủ công
```

### Tại sao banking KHÔNG THỂ thiếu DLQ?

```
Kịch bản KHÔNG CÓ DLQ:

  payment.processed event → Consumer trừ tiền sổ cái
  Consumer FAIL (DB connection issue)
  Broker retry 3 lần → tất cả fail
  Message BỊ XÓA khỏi queue

Hậu quả:
  → Tiền đã trừ khỏi tài khoản khách hàng
  → Nhưng KHÔNG ghi vào sổ cái (ledger)
  → Đối soát cuối ngày: số tiền KHÔNG KHỚP
  → Vi phạm quy định kiểm toán → phạt nặng

Với DLQ:
  → Message chuyển vào DLQ
  → Ops team nhận alert ngay
  → Team fix DB connection
  → Replay message từ DLQ → ghi sổ cái thành công
  → Dữ liệu nhất quán
```

---

## 2. Flow Message Lifecycle với DLQ

```
Producer → Queue → Consumer
              │
              │ Consumer xử lý
              │
          ┌───┴───┐
          │       │
        OK       FAIL
          │       │
      COMPLETED  Retry 1 (2s)
                  │
               FAIL
                  │
              Retry 2 (4s)
                  │
               FAIL
                  │
              Retry 3 (8s)
                  │
               FAIL
                  │
              ────────────►  DEAD LETTER QUEUE
                               │
                          ┌────┴────────────────────────────────┐
                          │  1. Alert ops team                   │
                          │  2. Log chi tiết lỗi                 │
                          │  3. Lưu vào failed_jobs DB table     │
                          │  4. Manual review và fix             │
                          │  5. Replay nếu đã fix                │
                          └──────────────────────────────────────┘
```

---

## 3. Retry Strategy — Exponential Backoff

### Tại sao cần Exponential Backoff?

```
Không có backoff:
  Retry mỗi 1 giây → 100 failed messages × retry 5 lần/giây = 500 requests/giây lên DB
  → DB đang quá tải (đó là lý do fail) → bị bắn thêm 500 req/s → càng tệ hơn

Exponential Backoff:
  Retry 1: chờ 2 giây
  Retry 2: chờ 4 giây  
  Retry 3: chờ 8 giây
  Retry 4: chờ 16 giây
  Retry 5: chờ 32 giây → nếu vẫn fail → DLQ
  → Tổng thời gian: ~62 giây → cho hệ thống recovery time
```

### Jitter — Tránh Thundering Herd

```
Không có jitter:
  1000 messages fail cùng lúc → sau 2s, tất cả retry cùng lúc → spike
  
Với random jitter:
  Retry 1: chờ 2s ± random(0, 2s) → mỗi message retry lúc khác nhau → smooth
```

---

## 4. DLQ trong các Message Brokers

### 4.1 RabbitMQ — Dead Letter Exchange (DLX)

```
Cơ chế native:
  - Mỗi queue có thể có Dead Letter Exchange (DLX) config
  - Khi message rejected/expired → tự động route vào DLQ

Setup:
  1. Tạo DLQ: payment.events.dlq
  2. Tạo DLX: payment.events.dlx
  3. Configure main queue để dùng DLX
  4. Message fail → tự động vào payment.events.dlq
```

### 4.2 GCP Pub/Sub — Dead Letter Topic

```
GCP Pub/Sub hỗ trợ Dead Letter Topic native:
  - Configure dead_letter_policy khi tạo subscription
  - Sau max_delivery_attempts lần → chuyển vào dead letter topic

gcloud pubsub subscriptions create payment-subscription \
  --topic=payment-events \
  --dead-letter-topic=payment-events-dlq \
  --max-delivery-attempts=5
```

### 4.3 Apache Artemis — Dead Letter Address

```
Artemis hỗ trợ Dead Letter Address:
  - Configure trong broker.xml
  - Message hết redeliveryDelay → chuyển vào dead letter address

<address-setting match="payment.events">
  <dead-letter-address>DLQ.payment.events</dead-letter-address>
  <max-delivery-attempts>5</max-delivery-attempts>
  <redelivery-delay>2000</redelivery-delay>
  <redelivery-multiplier>2.0</redelivery-multiplier>
  <max-redelivery-delay>60000</max-redelivery-delay>
</address-setting>
```

### 4.4 BullMQ (Redis) — Failed Jobs

```typescript
// BullMQ không có built-in DLQ
// Nhưng có failed jobs — jobs hết attempt → failed state
// Worker tự implement DLQ pattern:

worker.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts - 1) {
    // Đây là lần fail CUỐI CÙNG → chuyển vào "DLQ"
    await dlqQueue.add('dead-letter', {
      originalQueue: job.queueName,
      originalJobId: job.id,
      data: job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade + 1,
    });
  }
});
```

---

## 5. Xử lý DLQ — Alert, Review, Replay

### 5.1 Alert khi có message vào DLQ

```
Banking rule: DLQ > 0 là INCIDENT cần xử lý ngay

Alert channels (theo mức độ):
  DLQ count = 1-5:   → Slack #payment-alerts
  DLQ count = 6-20:  → PagerDuty (on-call engineer)
  DLQ count > 20:    → PagerDuty + Email manager + war room
  
Timeline:
  DLQ alert nhận được: T+0
  Acknowledge:          T+5 phút
  Root cause identified: T+30 phút
  Fix deployed:          T+2 giờ
  Replay completed:      T+2.5 giờ
```

### 5.2 Lưu DLQ messages vào DB

```sql
-- failed_messages table: để review + replay
CREATE TABLE failed_messages (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id      VARCHAR(200) NOT NULL,
  queue           VARCHAR(100) NOT NULL,
  topic           VARCHAR(100) NOT NULL,
  payload         JSON NOT NULL,
  error_message   TEXT NOT NULL,
  error_stack     TEXT,
  attempts        INT NOT NULL,
  first_failed_at DATETIME NOT NULL,
  last_failed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('PENDING_REVIEW', 'IN_PROGRESS', 'REPLAYED', 'DISCARDED') DEFAULT 'PENDING_REVIEW',
  reviewed_by     VARCHAR(100),
  review_note     TEXT,
  reviewed_at     DATETIME,
  
  INDEX idx_status (status, last_failed_at),
  INDEX idx_queue (queue, first_failed_at)
);
```

### 5.3 Replay từ DLQ

```
Trước khi replay:
  1. Hiểu rõ nguyên nhân fail (đọc error log)
  2. Đảm bảo root cause đã được fix
  3. Kiểm tra consumer có idempotent không (safe to replay)
  4. Replay 1 message test trước khi replay batch

Khi replay:
  - Re-publish message vào queue gốc
  - Consumer xử lý như message mới
  - Vì consumer idempotent → an toàn kể cả đã xử lý 1 phần trước đó

Sau replay:
  - Kiểm tra processed successfully
  - Update failed_messages.status = 'REPLAYED'
  - Đóng incident ticket
```

---

## 6. Triển khai NestJS Banking

### 6.1 DLQ Consumer

```typescript
// dlq/dlq.consumer.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DlqConsumer {
  private readonly logger = new Logger(DlqConsumer.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private alertService: AlertService,
  ) {}

  // Xử lý message từ DLQ
  async handleDeadLetter(message: DlqMessage) {
    this.logger.error('Dead letter received', {
      messageId: message.id,
      queue: message.originalQueue,
      topic: message.originalTopic,
      payload: message.payload,
      failedReason: message.failedReason,
      attempts: message.attemptsMade,
    });

    // Lưu vào DB để review thủ công
    await this.dataSource.query(`
      INSERT INTO failed_messages 
        (message_id, queue, topic, payload, error_message, attempts, first_failed_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        attempts = VALUES(attempts),
        error_message = VALUES(error_message),
        last_failed_at = NOW()
    `, [
      message.id,
      message.originalQueue,
      message.originalTopic,
      JSON.stringify(message.payload),
      message.failedReason,
      message.attemptsMade,
    ]);

    // Alert ops team
    await this.alertService.sendAlert({
      severity: this.getSeverity(message.originalTopic),
      title: `Dead Letter: ${message.originalTopic}`,
      message: `Message ${message.id} failed after ${message.attemptsMade} attempts`,
      details: {
        messageId: message.id,
        topic: message.originalTopic,
        error: message.failedReason,
        payload: message.payload,
      },
    });
  }

  private getSeverity(topic: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
    if (topic.includes('payment') || topic.includes('transfer')) return 'CRITICAL';
    if (topic.includes('ledger') || topic.includes('account')) return 'HIGH';
    return 'MEDIUM';
  }
}
```

### 6.2 Consumer với Retry + DLQ Integration

```typescript
// payment/payment.consumer.ts — với full retry logic
@Injectable()
export class PaymentConsumer {
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private dlqProducer: DlqProducer,
  ) {}

  async handlePaymentProcessed(message: IncomingMessage) {
    const event = JSON.parse(message.data) as PaymentProcessedEvent;
    const attemptNumber = message.deliveryAttempt ?? 1;

    try {
      // Idempotency check (xem file 07)
      const alreadyProcessed = await this.checkAlreadyProcessed(
        message.id,
        event.transactionId
      );
      if (alreadyProcessed) {
        message.ack();
        return;
      }

      // Business logic
      await this.processLedgerEntry(event);
      message.ack();  // Thành công → ACK

    } catch (error) {
      this.logger.error(`Payment processing failed (attempt ${attemptNumber})`, {
        messageId: message.id,
        transactionId: event.transactionId,
        error: error.message,
      });

      // Quyết định retry hay DLQ
      const MAX_ATTEMPTS = 5;
      
      if (attemptNumber >= MAX_ATTEMPTS) {
        // Hết lần retry → chuyển DLQ thủ công (nếu broker không tự làm)
        await this.dlqProducer.send({
          id: message.id,
          originalQueue: 'payment.processed',
          originalTopic: 'payment.processed',
          payload: event,
          failedReason: error.message,
          errorStack: error.stack,
          attemptsMade: attemptNumber,
        });
        message.ack(); // ACK để xóa khỏi main queue (đã chuyển DLQ)
      } else {
        // Còn retry → NACK (broker sẽ retry với backoff)
        message.nack();
      }
    }
  }

  private async processLedgerEntry(event: PaymentProcessedEvent) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Insert IGNORE cho idempotency
      const result = await qr.manager.query(`
        INSERT IGNORE INTO processed_events (event_id, event_type, processor, processed_at)
        VALUES (?, 'payment.processed', 'ledger_consumer', NOW())
      `, [event.messageId || event.transactionId]);

      if (result.affectedRows === 0) {
        // Đã xử lý → skip
        await qr.commitTransaction();
        return;
      }

      // Ghi ledger entry
      await qr.manager.query(`
        INSERT INTO ledger_entries (transaction_id, account_id, amount, type, reference, created_at)
        VALUES (?, ?, ?, 'DEBIT', ?, NOW())
      `, [event.transactionId, event.accountId, event.amount, event.reference]);

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  private async checkAlreadyProcessed(messageId: string, transactionId: string): Promise<boolean> {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM processed_events WHERE event_id IN (?, ?) LIMIT 1`,
      [messageId, String(transactionId)]
    );
    return !!existing;
  }
}
```

### 6.3 Replay Service

```typescript
// dlq/replay.service.ts
@Injectable()
export class ReplayService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private messageBroker: MessageBrokerService,
  ) {}

  // Replay 1 message từ DLQ
  async replayOne(failedMessageId: number, reviewNote: string, reviewedBy: string) {
    const [message] = await this.dataSource.query(
      'SELECT * FROM failed_messages WHERE id = ? AND status = "PENDING_REVIEW"',
      [failedMessageId]
    );

    if (!message) throw new Error('Message not found or already processed');

    // Re-publish vào queue gốc
    await this.messageBroker.publish(message.topic, message.payload);

    // Update status
    await this.dataSource.query(`
      UPDATE failed_messages 
      SET status = 'REPLAYED', reviewed_by = ?, review_note = ?, reviewed_at = NOW()
      WHERE id = ?
    `, [reviewedBy, reviewNote, failedMessageId]);

    return { success: true, replayedTo: message.topic };
  }

  // Replay batch (sau khi đã fix root cause)
  async replayBatch(topic: string, reviewedBy: string, dryRun = true) {
    const messages = await this.dataSource.query(
      `SELECT id, topic, payload FROM failed_messages 
       WHERE topic = ? AND status = 'PENDING_REVIEW'
       ORDER BY first_failed_at ASC
       LIMIT 100`,
      [topic]
    );

    if (dryRun) {
      return { wouldReplay: messages.length, messages };
    }

    let replayed = 0;
    for (const msg of messages) {
      try {
        await this.messageBroker.publish(msg.topic, msg.payload);
        await this.dataSource.query(
          `UPDATE failed_messages SET status = 'REPLAYED', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
          [reviewedBy, msg.id]
        );
        replayed++;
        // Throttle: không replay quá nhanh tránh overwhelm consumer
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        this.logger.error(`Failed to replay message ${msg.id}`, err);
      }
    }

    return { replayed, total: messages.length };
  }
}
```

---

## 7. Câu hỏi phỏng vấn thường gặp

**Q1: "DLQ là gì? Tại sao không retry vô hạn?"**
> A: DLQ là hàng đợi chứa messages không thể xử lý sau N lần retry. Không retry vô hạn vì: (1) Message có thể fail vĩnh viễn (data corruption, business logic error) → retry vô hạn lãng phí resources. (2) Retry liên tục một message lỗi có thể gây "head-of-line blocking" — chặn message phía sau. (3) Cần human review để quyết định fix hoặc discard.

**Q2: "Exponential backoff là gì? Tại sao dùng trong retry?"**
> A: Exponential backoff = mỗi lần retry chờ gấp đôi: 2s → 4s → 8s → 16s → 32s. Dùng vì: nếu service fail do overload, constant retry càng gây thêm load → worse. Backoff cho service recovery time. Thêm jitter (random) để tránh thundering herd — N consumers cùng retry lúc nhau tạo spike.

**Q3: "Khi nào nên replay message từ DLQ?"**
> A: (1) Xác định được root cause (DB connection fail, code bug). (2) Root cause đã được fix và deployed. (3) Consumer xử lý idempotent — replay an toàn kể cả đã xử lý 1 phần. (4) Trong banking, replay sau khi reconcile để đảm bảo không double-process. Test replay 1 message trước khi batch replay.

**Q4: "Làm thế nào monitor DLQ trong production banking?"**
> A: (1) Alert PagerDuty ngay khi DLQ count > 0 cho payment/transfer topics. (2) Dashboard theo dõi: DLQ depth trend, message age (bao lâu trong DLQ), failure rate by topic. (3) SLA: acknowledge trong 5 phút, resolve trong 2 giờ với financial messages. (4) Post-mortem sau mỗi incident để tránh lặp lại.
