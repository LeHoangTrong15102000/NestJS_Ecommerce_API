# Idempotency (Tính lũy đẳng) — Banking Payment

> **Mục tiêu:** Thiết kế API và hệ thống sao cho dù nhận 1 event/request **N lần** (at-least-once delivery), user **vẫn chỉ bị trừ tiền 1 lần**. Đây là yêu cầu cốt lõi trong mọi hệ thống thanh toán.

---

## Mục lục

1. [Tại sao cần Idempotency trong Banking?](#1-tại-sao-cần-idempotency-trong-banking)
2. [3 Tình huống gây duplicate trong thực tế](#2-3-tình-huống-gây-duplicate-trong-thực-tế)
3. [Idempotency Key — Thiết kế API](#3-idempotency-key--thiết-kế-api)
4. [Deduplication Table — Cơ chế chính](#4-deduplication-table--cơ-chế-chính)
5. [Idempotent Consumer — Xử lý duplicate events](#5-idempotent-consumer--xử-lý-duplicate-events)
6. [Triển khai NestJS đầy đủ](#6-triển-khai-nestjs-đầy-đủ)
7. [Idempotency với Database Constraints](#7-idempotency-với-database-constraints)
8. [Câu hỏi phỏng vấn thường gặp](#8-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Tại sao cần Idempotency trong Banking?

```
Định nghĩa: f(f(x)) = f(x)
→ Thực hiện operation cùng input nhiều lần = kết quả giống thực hiện 1 lần

Trong banking payment:
  POST /payments {amount: 100000, accountId: 1, reference: "PAY-001"}
  
  Gửi lần 1: Trừ 100,000 VND → balance = 900,000 ✅
  Gửi lần 2: Trừ thêm 100,000 VND → balance = 800,000 ❌ (WRONG!)
  
  Với idempotency:
  Gửi lần 1: Trừ 100,000 VND → balance = 900,000 ✅
  Gửi lần 2: Detect duplicate → trả kết quả cũ → balance vẫn = 900,000 ✅
```

---

## 2. 3 Tình huống gây duplicate trong thực tế

### Tình huống 1: Client retry khi timeout

```
Client ──POST /payment──► Server
Client ◄──timeout!────────Server (đang xử lý)
Client ──POST /payment──► Server (RETRY!) ← duplicate request
Server    ◄──200 OK────────────────────────
Server    ◄──200 OK────────────────────────
→ 2 lần trừ tiền!
```

### Tình huống 2: Message Broker at-least-once delivery

```
At-least-once delivery: Broker đảm bảo message ĐƯỢC deliver,
nhưng CÓ THỂ deliver nhiều lần (khi consumer crash sau xử lý nhưng trước ACK)

Consumer xử lý payment.processed event:
  1. Nhận event, trừ tiền ✅
  2. Consumer crash TRƯỚC KHI ACK message
  3. Broker retry → gửi lại cùng event
  4. Consumer khởi động lại, nhận event lần 2
  5. Trừ tiền lần 2 ❌

GCP Pub/Sub, RabbitMQ, Artemis đều có behavior này!
```

### Tình huống 3: Outbox Worker publish nhiều lần

```
Outbox Worker:
  1. Publish event lên broker ✅
  2. Worker crash TRƯỚC KHI update outbox status = 'PUBLISHED'
  3. Worker restart, thấy event status vẫn = 'NEW'
  4. Publish lại lần 2 → Downstream nhận 2 events
```

---

## 3. Idempotency Key — Thiết kế API

### 3.1 Idempotency-Key Header (HTTP API)

```http
POST /v1/payments HTTP/1.1
Content-Type: application/json
Idempotency-Key: a4e8f7b2-1234-4abc-def0-123456789abc

{
  "accountId": 12345,
  "amount": 500000,
  "description": "Thanh toán hóa đơn điện"
}
```

**Quy tắc:**
- Client tạo UUID random khi gửi request lần đầu
- Khi retry, dùng CÙNG Idempotency-Key
- Server detect key đã tồn tại → trả lại response cũ (không xử lý lại)

### 3.2 Internal Reference / Transaction Reference

```
Ngoài HTTP API, cần reference trong business logic:
  - Payment reference: "PAY-2025-001234"
  - Transfer reference: "TRF-20250115-00001"
  - Format: {type}-{date}-{sequence}

Đảm bảo: UNIQUE constraint trên cột reference
→ INSERT thứ 2 với cùng reference → DUPLICATE KEY error → detect duplicate
```

---

## 4. Deduplication Table — Cơ chế chính

### 4.1 Schema

```sql
-- Bảng lưu idempotency keys đã xử lý
CREATE TABLE idempotency_keys (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  idempotency_key VARCHAR(100) NOT NULL,
  service         VARCHAR(50) NOT NULL,             -- 'payment', 'transfer'
  status          ENUM('PROCESSING', 'COMPLETED', 'FAILED') NOT NULL,
  request_hash    VARCHAR(64),                      -- Hash của request body (optional)
  response_body   JSON,                             -- Cache lại response để trả về
  response_status SMALLINT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME NOT NULL,                -- Tự hết hạn sau 24h-7 ngày
  
  UNIQUE INDEX uk_key_service (idempotency_key, service)
);

-- Bảng processed_events cho message consumer
CREATE TABLE processed_events (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id        VARCHAR(200) NOT NULL,            -- Message ID từ broker
  event_type      VARCHAR(100) NOT NULL,
  processor       VARCHAR(100) NOT NULL,            -- Service xử lý
  processed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE INDEX uk_event_processor (event_id, processor)
);
```

### 4.2 Flow xử lý với Deduplication

```
Nhận request với Idempotency-Key: "key-abc-123"

┌─ Kiểm tra key tồn tại? ─┐
│                           │
│  KHÔNG: Ghi key (status=PROCESSING) → Xử lý business → Cập nhật COMPLETED + lưu response
│  CÓ + COMPLETED:          Trả lại response cũ từ DB (không xử lý lại)
│  CÓ + PROCESSING:         Trả 409 Conflict (đang xử lý, thử lại sau 1-2 giây)
│  CÓ + FAILED:             Tùy policy: cho retry hay trả lại lỗi cũ
└──────────────────────────┘
```

---

## 5. Idempotent Consumer — Xử lý duplicate events

### 5.1 Pattern: Check-then-Act

```typescript
// payment.consumer.ts
async handlePaymentProcessed(event: PaymentProcessedEvent) {
  // Bước 1: Kiểm tra đã xử lý event này chưa
  const [processed] = await this.db.query(`
    SELECT id FROM processed_events 
    WHERE event_id = ? AND processor = 'ledger_service'
  `, [event.messageId]);
  
  if (processed) {
    this.logger.log(`Event ${event.messageId} already processed, skipping`);
    return; // Idempotent: bỏ qua
  }

  // Bước 2: Xử lý trong transaction (ghi cả 2 hoặc không ai)
  await this.db.transaction(async (tx) => {
    // Business logic
    await tx.query('INSERT INTO ledger_entries (...) VALUES (...)', [...]);
    
    // Đánh dấu đã xử lý (cùng transaction)
    await tx.query(`
      INSERT INTO processed_events (event_id, event_type, processor, processed_at)
      VALUES (?, ?, 'ledger_service', NOW())
    `, [event.messageId, 'payment.processed']);
  });
}
```

### 5.2 Pattern: Upsert / INSERT IGNORE

```sql
-- Thay vì INSERT → có thể bị duplicate
-- Dùng INSERT IGNORE (MySQL) hoặc ON DUPLICATE KEY UPDATE
INSERT IGNORE INTO ledger_entries (transaction_id, amount, account_id, created_at)
VALUES (?, ?, ?, NOW());

-- Nếu transaction_id đã tồn tại (unique constraint) → bỏ qua, không error
-- → Idempotent!

-- Hoặc dùng ON DUPLICATE KEY UPDATE (để cập nhật thêm thông tin)
INSERT INTO payment_records (reference, amount, status)
VALUES ('PAY-001', 100000, 'SUCCESS')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  updated_at = NOW();
-- → Lần 2 cùng reference → UPDATE thay vì INSERT → kết quả giống nhau
```

---

## 6. Triển khai NestJS đầy đủ

### 6.1 Idempotency Guard (HTTP API)

```typescript
// idempotency/idempotency.guard.ts
import { Injectable, CanActivate, ExecutionContext, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Request, Response } from 'express';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const key = request.headers['idempotency-key'] as string;
    if (!key) return true; // Không có key → không check (GET requests)

    const service = this.getServiceName(request.path);

    // Check existing
    const [existing] = await this.dataSource.query(`
      SELECT id, status, response_body, response_status
      FROM idempotency_keys
      WHERE idempotency_key = ? AND service = ? AND expires_at > NOW()
    `, [key, service]);

    if (existing) {
      if (existing.status === 'PROCESSING') {
        throw new ConflictException('Request is still being processed');
      }
      // Return cached response
      response.status(existing.response_status)
               .json(existing.response_body);
      return false; // Ngăn controller chạy
    }

    // Insert key as PROCESSING
    try {
      await this.dataSource.query(`
        INSERT INTO idempotency_keys (idempotency_key, service, status, expires_at)
        VALUES (?, ?, 'PROCESSING', DATE_ADD(NOW(), INTERVAL 24 HOUR))
      `, [key, service]);
    } catch (error) {
      // Race condition: 2 requests cùng key đồng thời → 1 cái fail UNIQUE constraint
      throw new ConflictException('Concurrent request with same idempotency key');
    }

    // Lưu key và service vào request để controller dùng sau
    request['idempotencyKey'] = key;
    request['idempotencyService'] = service;
    return true;
  }

  private getServiceName(path: string): string {
    if (path.includes('/payments')) return 'payment';
    if (path.includes('/transfers')) return 'transfer';
    return 'default';
  }
}

// Sau khi controller xử lý xong → update idempotency record
// Dùng Interceptor:
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request['idempotencyKey'];

    return next.handle().pipe(
      tap(async (responseBody) => {
        if (!key) return;
        const response = context.switchToHttp().getResponse<Response>();
        await this.dataSource.query(`
          UPDATE idempotency_keys 
          SET status = 'COMPLETED', response_body = ?, response_status = ?
          WHERE idempotency_key = ? AND service = ?
        `, [JSON.stringify(responseBody), response.statusCode, key, request['idempotencyService']]);
      }),
      catchError(async (error) => {
        if (key) {
          await this.dataSource.query(`
            UPDATE idempotency_keys SET status = 'FAILED'
            WHERE idempotency_key = ? AND service = ?
          `, [key, request['idempotencyService']]);
        }
        throw error;
      })
    );
  }
}
```

### 6.2 Idempotent Event Consumer (Message Broker)

```typescript
// payment/payment.consumer.ts
@Injectable()
export class PaymentConsumer {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  // Xử lý event từ GCP Pub/Sub hoặc Artemis
  async handlePaymentEvent(message: IncomingMessage) {
    const eventId = message.id;         // Message ID từ broker
    const event = JSON.parse(message.data.toString()) as PaymentEvent;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Bước 1: Kiểm tra + ghi processed_events trong cùng transaction
      // (Dùng INSERT IGNORE để atomic check-and-insert)
      const result = await qr.manager.query(`
        INSERT IGNORE INTO processed_events 
          (event_id, event_type, processor, processed_at)
        VALUES (?, ?, 'payment_consumer', NOW())
      `, [eventId, event.eventType]);

      if (result.affectedRows === 0) {
        // Đã xử lý rồi (INSERT IGNORE → không insert → affectedRows = 0)
        this.logger.log(`Duplicate event ${eventId}, skipping`);
        await qr.rollbackTransaction();
        message.ack(); // ACK để broker không gửi lại
        return;
      }

      // Bước 2: Xử lý business logic
      await qr.manager.query(`
        INSERT INTO ledger_entries (transaction_id, account_id, amount, type, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [event.transactionId, event.accountId, event.amount, event.type]);

      await qr.commitTransaction();
      message.ack();   // ACK message sau khi commit thành công

    } catch (error) {
      await qr.rollbackTransaction();
      message.nack();  // NACK → broker sẽ redeliver → retry
      throw error;

    } finally {
      await qr.release();
    }
  }
}
```

---

## 7. Idempotency với Database Constraints

### Cách đơn giản nhất: UNIQUE constraint

```sql
-- Đặt UNIQUE trên reference/idempotency key
ALTER TABLE transactions ADD UNIQUE INDEX uk_reference (reference);

-- Trong code:
INSERT INTO transactions (reference, amount, account_id, created_at)
VALUES ('PAY-001', 100000, 1, NOW());
-- Lần 2: ERROR 1062 (Duplicate entry 'PAY-001' for key 'uk_reference')
-- → Bắt error code 1062 → biết là duplicate → trả response cũ
```

```typescript
// NestJS: bắt unique constraint error
async processPayment(dto: ProcessPaymentDto) {
  try {
    const result = await this.dataSource.query(`
      INSERT INTO transactions (reference, amount, account_id)
      VALUES (?, ?, ?)
    `, [dto.reference, dto.amount, dto.accountId]);
    return { transactionId: result.insertId };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // Duplicate reference → trả lại kết quả cũ
      const [existing] = await this.dataSource.query(
        'SELECT id, amount, status FROM transactions WHERE reference = ?',
        [dto.reference]
      );
      return { transactionId: existing.id, idempotent: true };
    }
    throw error;
  }
}
```

---

## 8. Câu hỏi phỏng vấn thường gặp

**Q1: "Idempotency là gì? Tại sao cần thiết trong banking?"**
> A: Idempotency nghĩa là thực hiện cùng operation nhiều lần cho kết quả giống 1 lần. Cần thiết trong banking vì: (1) client retry khi network timeout, (2) message broker at-least-once delivery có thể gửi duplicate events, (3) Outbox Worker có thể publish lại message. Không có idempotency → user bị trừ tiền nhiều lần cho cùng 1 giao dịch.

**Q2: "Thiết kế idempotent payment API thế nào?"**
> A: (1) Client gửi `Idempotency-Key` header (UUID) khi tạo request, dùng cùng key khi retry. (2) Server check `idempotency_keys` table, nếu key tồn tại → trả cached response. Nếu chưa → insert key với status=PROCESSING → xử lý → update COMPLETED + cache response. (3) UNIQUE constraint trên reference column là safety net.

**Q3: "INSERT IGNORE vs ON DUPLICATE KEY UPDATE — dùng khi nào?"**
> A: INSERT IGNORE khi không cần update gì thêm, chỉ muốn bỏ qua duplicate — ví dụ ghi processed_events. ON DUPLICATE KEY UPDATE khi muốn cập nhật thêm thông tin nếu duplicate — ví dụ upsert payment status. Cả 2 đều idempotent.

**Q4: "Message consumer xử lý at-least-once delivery thế nào cho idempotent?"**
> A: Trước khi xử lý, INSERT event_id vào `processed_events` table (cùng transaction với business logic). Dùng INSERT IGNORE: nếu affectedRows = 0 → đã xử lý rồi → skip. ACK message sau khi commit thành công. NACK (không ACK) nếu xử lý fail → broker retry. Key: check + business + mark-processed phải trong cùng 1 transaction.
