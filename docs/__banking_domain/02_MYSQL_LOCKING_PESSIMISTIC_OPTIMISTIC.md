# MySQL Locking — Pessimistic & Optimistic Lock (Banking Domain)

> **Mục tiêu:** Hiểu rõ khi nào dùng `SELECT ... FOR UPDATE` (khóa bi quan) và khi nào dùng versioning (khóa lạc quan). Đây là câu hỏi kinh điển trong phỏng vấn hệ thống tài chính.

---

## Mục lục

1. [Vấn đề Race Condition trong Banking](#1-vấn-đề-race-condition-trong-banking)
2. [Pessimistic Lock — SELECT ... FOR UPDATE](#2-pessimistic-lock--select--for-update)
3. [Optimistic Lock — Versioning](#3-optimistic-lock--versioning)
4. [So sánh & Quy tắc chọn lựa](#4-so-sánh--quy-tắc-chọn-lựa)
5. [MySQL InnoDB: Gap Lock & Deadlock](#5-mysql-innodb-gap-lock--deadlock)
6. [Triển khai trong NestJS (TypeORM & Prisma)](#6-triển-khai-trong-nestjs-typeorm--prisma)
7. [Câu hỏi phỏng vấn thường gặp](#7-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Vấn đề Race Condition trong Banking

```
Tài khoản A: balance = 1,000,000 VND

T1 (Web):         T2 (Mobile ATM):
Đọc: 1,000,000    Đọc: 1,000,000
Trừ: -800,000     Trừ: -700,000
Ghi: 200,000      Ghi: 300,000

Kết quả thực tế: balance = 300,000
Kết quả đúng:    balance = -500,000 (cần reject ít nhất 1 giao dịch)

→ Tiền âm! Và không có giao dịch nào bị từ chối → RÚT TIỀN THÀNH CÔNG CẢ 2!
```

---

## 2. Pessimistic Lock — SELECT ... FOR UPDATE

### 2.1 Cơ chế hoạt động

> **Triết lý:** "Tôi giả định xung đột CHẮC CHẮN SẼ XẢY RA, nên tôi khóa trước."

```sql
-- Transaction T1
BEGIN;
  -- Bước 1: Đọc VÀ KHÓA row ngay lập tức
  SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
  -- → Row bị lock. T2 nếu cũng chạy SELECT ... FOR UPDATE → PHẢI CHỜ

  -- Bước 2: Kiểm tra điều kiện (an toàn vì không ai thay đổi được row)
  -- balance = 1,000,000 >= 800,000 → OK

  -- Bước 3: Thực hiện giao dịch
  UPDATE accounts SET balance = balance - 800000 WHERE id = 1;
  INSERT INTO ledger (account_id, amount, type) VALUES (1, -800000, 'DEBIT');
COMMIT;
-- → Lock được giải phóng. T2 bây giờ mới chạy được

-- Transaction T2 (đang đợi)
BEGIN;
  SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
  -- Lúc này balance = 200,000
  -- 200,000 < 700,000 → REJECT
ROLLBACK;
```

### 2.2 Ví dụ trong MySQL thực tế

```sql
-- Session 1 (Banker A)
START TRANSACTION;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- Output: id=1, balance=1000000, owner="Nguyen Van A"
-- Row LOCKED. Session 2 sẽ block nếu cũng muốn FOR UPDATE

-- Session 2 (ATM)  
START TRANSACTION;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- ⏳ WAITING... (blocked by Session 1)

-- Session 1 tiếp tục
UPDATE accounts SET balance = 200000 WHERE id = 1;
COMMIT;
-- → Session 2 ĐƯỢC TIẾP TỤC ngay khi Session 1 commit

-- Session 2 (tiếp tục sau khi được unblocked)
-- Đọc được balance = 200000 (giá trị SAU KHI Session 1 cập nhật)
-- 200000 < 700000 → rollback giao dịch này
ROLLBACK;
```

### 2.3 Các biến thể của FOR UPDATE trong MySQL

```sql
-- 1. FOR UPDATE — Lock độc quyền, transaction khác ĐỢI
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;

-- 2. FOR UPDATE NOWAIT — Lock độc quyền, KHÔNG ĐỢI, báo lỗi ngay
SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;
-- Nếu đang bị lock → ERROR 3572: Statement aborted because lock(s) could not be acquired
-- Dùng khi: muốn fail fast, trả lỗi cho user ngay "Hệ thống bận, thử lại"

-- 3. FOR UPDATE SKIP LOCKED — Bỏ qua row đang bị lock
SELECT * FROM payment_queue WHERE status = 'PENDING' LIMIT 1 FOR UPDATE SKIP LOCKED;
-- Dùng cho: job queue, nhiều worker xử lý song song (mỗi worker lấy 1 task chưa bị lock)

-- 4. FOR SHARE (LOCK IN SHARE MODE) — Lock chia sẻ, chỉ chặn ghi
SELECT * FROM exchange_rates WHERE currency = 'USD' FOR SHARE;
-- Dùng khi: cần đảm bảo row không bị xóa/sửa trong lúc đọc, nhưng cho phép đọc concurrent
```

### 2.4 Ưu & Nhược điểm

**Ưu điểm:**
- Đảm bảo 100% tính chính xác
- Logic đơn giản, dễ debug
- Không cần retry
- Phù hợp cho: chuyển tiền, trừ số dư, đặt vé (conflict rate cao)

**Nhược điểm:**
- Throughput thấp khi traffic cao (transactions xếp hàng)
- Risk Deadlock (xem mục 5)
- Lock giữ lâu nếu transaction phức tạp → các transaction khác đợi lâu

---

## 3. Optimistic Lock — Versioning

### 3.1 Cơ chế hoạt động

> **Triết lý:** "Tôi giả định xung đột HIẾM KHI XẢY RA, chỉ kiểm tra lúc ghi."

```sql
-- Schema cần thêm cột version:
ALTER TABLE accounts ADD COLUMN version INT NOT NULL DEFAULT 0;

-- Transaction T1 (Web)
-- Bước 1: Đọc data + version (KHÔNG LOCK)
SELECT balance, version FROM accounts WHERE id = 1;
-- → balance = 1,000,000, version = 5

-- Bước 2: Thực hiện logic

-- Bước 3: Update CHỈ KHI version vẫn là 5
UPDATE accounts
SET balance = 200000, version = version + 1
WHERE id = 1 AND version = 5 AND balance >= 800000;

-- Kiểm tra rows affected
-- Nếu = 0 → có transaction khác đã thay đổi trước → RETRY hoặc REJECT
-- Nếu = 1 → thành công

-- Transaction T2 (Mobile ATM) — chạy sau T1 đã commit
-- Đọc: balance = 200,000, version = 6 (đã thay đổi!)
-- Update WHERE version = 5 → 0 rows affected → PHÁT HIỆN CONFLICT → RETRY
```

### 3.2 Ví dụ đầy đủ với Retry

```sql
-- Stored procedure với retry logic
DELIMITER //
CREATE PROCEDURE transfer_with_optimistic_lock(
  IN p_account_id INT,
  IN p_amount DECIMAL(15,2),
  IN p_max_retries INT
)
BEGIN
  DECLARE v_balance DECIMAL(15,2);
  DECLARE v_version INT;
  DECLARE v_rows_affected INT DEFAULT 0;
  DECLARE v_retry_count INT DEFAULT 0;

  WHILE v_rows_affected = 0 AND v_retry_count < p_max_retries DO
    -- Đọc current state
    SELECT balance, version INTO v_balance, v_version
    FROM accounts WHERE id = p_account_id;

    IF v_balance < p_amount THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
    END IF;

    -- Cố gắng update với version check
    UPDATE accounts
    SET balance = balance - p_amount,
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_account_id
      AND version = v_version
      AND balance >= p_amount;

    SET v_rows_affected = ROW_COUNT();
    SET v_retry_count = v_retry_count + 1;

    IF v_rows_affected = 0 THEN
      -- Đợi một chút trước khi retry (tránh thundering herd)
      DO SLEEP(0.01 * v_retry_count);  -- Exponential: 10ms, 20ms, 30ms
    END IF;
  END WHILE;

  IF v_rows_affected = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Too many conflicts, please retry';
  END IF;
END //
DELIMITER ;
```

### 3.3 Ưu & Nhược điểm

**Ưu điểm:**
- Throughput cao (không block)
- Không có deadlock
- Scalability tốt
- Phù hợp cho: cập nhật profile, thay đổi settings (conflict rate thấp)

**Nhược điểm:**
- Cần retry logic (code phức tạp hơn)
- Khi conflict cao → retry storm → hiệu suất tệ hơn Pessimistic
- Không phù hợp cho flash sale, chuyển tiền (nhiều người cùng lúc)

---

## 4. So sánh & Quy tắc chọn lựa

```
┌─────────────────────────────────┬──────────────────┬──────────────────┐
│ Tiêu chí                        │ Pessimistic Lock  │ Optimistic Lock   │
│                                 │ (FOR UPDATE)      │ (version field)   │
├─────────────────────────────────┼──────────────────┼──────────────────┤
│ Conflict rate                   │ Cao ✅            │ Thấp ✅           │
│ Throughput (traffic cao)        │ Thấp              │ Cao ✅            │
│ Code complexity                 │ Đơn giản ✅       │ Cần retry logic   │
│ Deadlock risk                   │ Có ⚠️             │ Không có ✅       │
│ Chuyển tiền / trừ số dư         │ ✅ Phù hợp        │ ⚠️ Retry nhiều    │
│ Update profile / settings       │ Overkill          │ ✅ Phù hợp        │
│ Flash sale / giờ cao điểm       │ ✅ Serialize OK    │ ❌ Retry storm    │
│ Distributed (nhiều DB/instance) │ Cần Redis lock    │ ✅ Dễ scale       │
└─────────────────────────────────┴──────────────────┴──────────────────┘
```

### Quy tắc vàng

```
Dùng Pessimistic khi:
  ✅ "Chi phí để xung đột xảy ra" cao (tiền, tồn kho giới hạn)
  ✅ Conflict rate > 20% (nhiều người tranh cùng resource)
  ✅ Logic nghiệp vụ phụ thuộc vào giá trị đọc (đọc balance → check → ghi)

Dùng Optimistic khi:
  ✅ Conflict rate thấp (người dùng edit dữ liệu của mình)
  ✅ Cần throughput cao
  ✅ Retry cost thấp (UI hiện thông báo "thử lại" là chấp nhận được)
```

---

## 5. MySQL InnoDB: Gap Lock & Deadlock

### 5.1 Gap Lock — Đặc trưng của MySQL

MySQL InnoDB (tại REPEATABLE READ) không chỉ lock row mà còn lock **khoảng trống (gap)** giữa các row.

```sql
-- Giả sử bảng có rows với id: 10, 20, 30
-- Transaction T1:
SELECT * FROM transactions WHERE amount BETWEEN 100 AND 500 FOR UPDATE;

-- MySQL lock:
--   Row lock:  rows có amount = 100, 200, 300, 400, 500
--   Gap lock:  khoảng (-∞, 100), (100, 200), ..., (500, +∞)
-- → T2 KHÔNG THỂ INSERT row có amount trong khoảng 100-500
-- → Ngăn Phantom Read

-- Hệ quả: Gap Lock có thể gây DEADLOCK bất ngờ
```

### 5.2 Deadlock — Nguyên nhân và xử lý

```
Deadlock điển hình trong Banking:

T1: Lock account_id=1 → cần lock account_id=2
T2: Lock account_id=2 → cần lock account_id=1

→ Deadlock: ai cũng chờ ai

MySQL phát hiện deadlock → tự rollback transaction có "ít work" hơn (victim)
→ Victim nhận ERROR 1213: Deadlock found when trying to get lock
```

**Cách phòng tránh Deadlock:**

```sql
-- ❌ BAD: Lock theo thứ tự không nhất quán
-- T1: Lock A trước, rồi Lock B
-- T2: Lock B trước, rồi Lock A → DEADLOCK!

-- ✅ GOOD: Luôn lock theo thứ tự NHẤT QUÁN (ví dụ: id tăng dần)
-- T1 và T2 đều: Lock min(A,B) trước, rồi Lock max(A,B)

-- Ví dụ code:
BEGIN;
  -- Sắp xếp để luôn lock id nhỏ hơn trước
  SELECT * FROM accounts WHERE id IN (1, 5) ORDER BY id FOR UPDATE;
  -- → Lock id=1 trước, rồi id=5
  -- → Cả T1 và T2 đều lock theo thứ tự này → không deadlock
COMMIT;
```

**Xử lý Deadlock trong code:**

```typescript
// NestJS: bắt lỗi deadlock và retry
async transferWithDeadlockRetry(fromId: number, toId: number, amount: number) {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await this.doTransfer(fromId, toId, amount);
    } catch (error) {
      // MySQL Deadlock error code: 1213
      const isDeadlock = error?.code === 'ER_LOCK_DEADLOCK' 
        || error?.errno === 1213;
      
      if (isDeadlock && attempt < MAX_RETRIES) {
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 6. Triển khai trong NestJS (TypeORM & Prisma)

### 6.1 TypeORM — QueryRunner (Pessimistic Lock)

```typescript
// banking/account.service.ts — TypeORM
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class AccountService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async transferMoney(fromId: number, toId: number, amount: number) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('REPEATABLE READ');

    try {
      // Pessimistic Lock: lock cả 2 accounts
      // Luôn lock theo thứ tự id tăng dần → tránh deadlock
      const [smallerId, largerId] = fromId < toId 
        ? [fromId, toId] : [toId, fromId];

      // Lock account nhỏ trước
      const accounts = await queryRunner.manager.query(`
        SELECT id, balance, version 
        FROM accounts 
        WHERE id IN (?, ?) 
        ORDER BY id
        FOR UPDATE
      `, [smallerId, largerId]);

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Update balances
      await queryRunner.manager.query(
        'UPDATE accounts SET balance = balance - ?, updated_at = NOW() WHERE id = ?',
        [amount, fromId]
      );
      await queryRunner.manager.query(
        'UPDATE accounts SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
        [amount, toId]
      );

      // Ghi ledger
      await queryRunner.manager.query(
        `INSERT INTO ledger (from_account_id, to_account_id, amount, created_at) 
         VALUES (?, ?, ?, NOW())`,
        [fromId, toId, amount]
      );

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Optimistic Lock với TypeORM
  async updateWithOptimisticLock(accountId: number, amount: number) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const [account] = await queryRunner.manager.query(
          'SELECT balance, version FROM accounts WHERE id = ?',
          [accountId]
        );

        if (!account || account.balance < amount) {
          throw new Error('Insufficient balance');
        }

        const result = await queryRunner.manager.query(
          `UPDATE accounts 
           SET balance = balance - ?, version = version + 1, updated_at = NOW()
           WHERE id = ? AND version = ? AND balance >= ?`,
          [amount, accountId, account.version, amount]
        );

        if (result.affectedRows === 0) {
          await queryRunner.rollbackTransaction();
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
            continue;
          }
          throw new Error('Optimistic lock failed after max retries');
        }

        await queryRunner.commitTransaction();
        return { success: true };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  }
}
```

### 6.2 Prisma — $transaction với $queryRaw (Pessimistic Lock)

```typescript
// banking/account.service.ts — Prisma
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async transferMoney(fromId: number, toId: number, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      // Pessimistic Lock: lock theo thứ tự id tăng dần
      const [smallerId, largerId] = fromId < toId 
        ? [fromId, toId] : [toId, fromId];

      // SELECT ... FOR UPDATE qua $queryRaw
      const accounts = await tx.$queryRaw<Account[]>`
        SELECT id, balance, version 
        FROM accounts 
        WHERE id IN (${smallerId}, ${largerId}) 
        ORDER BY id 
        FOR UPDATE
      `;

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      if (!fromAccount || !toAccount) throw new Error('Account not found');
      if (fromAccount.balance < amount) throw new Error('Insufficient balance');

      // Update dùng Prisma client thông thường
      await tx.account.update({
        where: { id: fromId },
        data: { balance: { decrement: amount } },
      });
      await tx.account.update({
        where: { id: toId },
        data: { balance: { increment: amount } },
      });

      // Ghi ledger
      await tx.ledger.create({
        data: { fromAccountId: fromId, toAccountId: toId, amount },
      });

      return { success: true };
    }, {
      maxWait: 5000,   // Tối đa 5s đợi connection
      timeout: 10000,  // Tối đa 10s cho transaction (sau đó auto rollback)
    });
  }

  // Optimistic Lock với Prisma
  async updateWithOptimisticLock(accountId: number, amount: number) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account || account.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // updateMany + version check (trả về count)
      const result = await this.prisma.account.updateMany({
        where: {
          id: accountId,
          version: account.version,       // Optimistic lock condition
          balance: { gte: amount },        // Business rule
        },
        data: {
          balance: { decrement: amount },
          version: { increment: 1 },
        },
      });

      if (result.count > 0) return { success: true };

      // Conflict! Retry sau backoff
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
      }
    }

    throw new Error('Optimistic lock failed after max retries');
  }
}
```

---

## 7. Câu hỏi phỏng vấn thường gặp

**Q1: "Khi nào dùng `SELECT ... FOR UPDATE` và khi nào dùng Optimistic Lock?"**
> A: `FOR UPDATE` (Pessimistic) khi conflict rate cao và chi phí lỗi cao (chuyển tiền, trừ tồn kho, đặt vé). Optimistic Lock khi conflict rate thấp, retry rẻ và cần throughput cao (update profile, settings).

**Q2: "Deadlock xảy ra như thế nào? Phòng tránh ra sao?"**
> A: Deadlock xảy ra khi T1 giữ lock A và chờ B, đồng thời T2 giữ lock B và chờ A. Phòng tránh: luôn acquire locks theo thứ tự nhất quán (ví dụ: id tăng dần), giảm thời gian giữ lock, tránh user interaction trong transaction. MySQL tự phát hiện deadlock và rollback victim.

**Q3: "FOR UPDATE SKIP LOCKED dùng khi nào?"**
> A: Dùng cho job queue pattern — nhiều worker xử lý song song. Mỗi worker `SELECT ... FOR UPDATE SKIP LOCKED` để lấy task chưa bị lock bởi worker khác, tránh block lẫn nhau.

**Q4: "Tại sao trong banking transaction nên lock theo thứ tự id tăng dần?"**
> A: Để tránh deadlock. Nếu mọi transaction đều lock theo cùng 1 thứ tự (id nhỏ trước), thì không bao giờ có trường hợp T1 lock A chờ B trong khi T2 lock B chờ A. Đây là quy tắc "consistent lock ordering".
