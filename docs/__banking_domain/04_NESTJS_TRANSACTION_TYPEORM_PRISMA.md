# NestJS Transaction Management — TypeORM QueryRunner vs Prisma $transaction

> **Mục tiêu:** Biết cách quản lý Transaction đúng cách trong NestJS với 2 ORM phổ biến nhất — TypeORM (dùng QueryRunner) và Prisma (dùng $transaction). Quan trọng cho banking domain vì mọi giao dịch tài chính đều cần ACID.

---

## Mục lục

1. [Tại sao cần quản lý Transaction trong NestJS?](#1-tại-sao-cần-quản-lý-transaction-trong-nestjs)
2. [TypeORM — QueryRunner (cách đúng)](#2-typeorm--queryrunner-cách-đúng)
3. [TypeORM — EntityManager Transaction](#3-typeorm--entitymanager-transaction)
4. [Prisma — $transaction callback](#4-prisma--transaction-callback)
5. [Prisma — $transaction array (sequential)](#5-prisma--transaction-array-sequential)
6. [So sánh TypeORM vs Prisma cho Banking](#6-so-sánh-typeorm-vs-prisma-cho-banking)
7. [Pattern Banking: Transaction + Row Lock](#7-pattern-banking-transaction--row-lock)
8. [Câu hỏi phỏng vấn thường gặp](#8-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Tại sao cần quản lý Transaction trong NestJS?

```typescript
// ❌ SAI: Không có transaction — không ACID
async transferMoney(fromId: number, toId: number, amount: number) {
  await this.accountRepo.decrement({ id: fromId }, 'balance', amount);
  // → Nếu server crash ở đây → tiền đã bị trừ, nhưng chưa cộng cho bên kia
  await this.accountRepo.increment({ id: toId }, 'balance', amount);
}

// ✅ ĐÚNG: Trong transaction — Atomicity đảm bảo
async transferMoney(fromId: number, toId: number, amount: number) {
  await this.dataSource.transaction(async (manager) => {
    await manager.decrement(Account, { id: fromId }, 'balance', amount);
    await manager.increment(Account, { id: toId }, 'balance', amount);
    // Cả 2 hoặc không ai → ACID
  });
}
```

---

## 2. TypeORM — QueryRunner (cách đúng)

### 2.1 Tại sao dùng QueryRunner thay vì các cách khác?

`QueryRunner` cho phép:
- Kiểm soát hoàn toàn lifecycle (connect, start, commit, rollback, release)
- Set isolation level tùy chỉnh
- Dùng raw SQL kết hợp ORM queries
- Phù hợp cho banking transaction phức tạp

### 2.2 Pattern QueryRunner đầy đủ

```typescript
// banking/transfer.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { Account } from './entities/account.entity';
import { Ledger } from './entities/ledger.entity';

@Injectable()
export class TransferService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async transfer(
    fromAccountId: number,
    toAccountId: number,
    amount: number,
    description: string,
  ) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    
    // Bước 1: Lấy connection từ pool
    await queryRunner.connect();
    
    // Bước 2: Bắt đầu transaction với isolation level cụ thể
    await queryRunner.startTransaction('REPEATABLE READ');

    try {
      // Bước 3: Lock 2 accounts theo thứ tự id (tránh deadlock)
      const [smallerId, largerId] = fromAccountId < toAccountId
        ? [fromAccountId, toAccountId]
        : [toAccountId, fromAccountId];

      const accounts = await queryRunner.manager.query<Account[]>(`
        SELECT id, balance, currency, status
        FROM accounts 
        WHERE id IN (?, ?) 
        ORDER BY id
        FOR UPDATE
      `, [smallerId, largerId]);

      const fromAccount = accounts.find(a => a.id === fromAccountId);
      const toAccount = accounts.find(a => a.id === toAccountId);

      // Bước 4: Validate
      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }
      if (fromAccount.status !== 'ACTIVE') {
        throw new Error('Source account is not active');
      }
      if (fromAccount.balance < amount) {
        throw new Error(`Insufficient balance: have ${fromAccount.balance}, need ${amount}`);
      }
      if (fromAccount.currency !== toAccount.currency) {
        throw new Error('Currency mismatch');
      }

      // Bước 5: Cập nhật số dư
      await queryRunner.manager.query(`
        UPDATE accounts SET balance = balance - ?, updated_at = NOW() WHERE id = ?
      `, [amount, fromAccountId]);

      await queryRunner.manager.query(`
        UPDATE accounts SET balance = balance + ?, updated_at = NOW() WHERE id = ?
      `, [amount, toAccountId]);

      // Bước 6: Ghi ledger
      const ledger = queryRunner.manager.create(Ledger, {
        fromAccountId,
        toAccountId,
        amount,
        currency: fromAccount.currency,
        description,
        status: 'SUCCESS',
        createdAt: new Date(),
      });
      await queryRunner.manager.save(ledger);

      // Bước 7: Commit
      await queryRunner.commitTransaction();
      return { success: true, ledgerId: ledger.id };

    } catch (error) {
      // Bước 8: Rollback nếu có lỗi
      await queryRunner.rollbackTransaction();
      throw error;

    } finally {
      // Bước 9: LUÔN release connection về pool
      // (dù commit hay rollback, nếu không release → connection leak)
      await queryRunner.release();
    }
  }
}
```

### 2.3 Tùy chỉnh Isolation Level

```typescript
// Các mức isolation TypeORM hỗ trợ:
await queryRunner.startTransaction('READ UNCOMMITTED');  // Hiếm khi dùng
await queryRunner.startTransaction('READ COMMITTED');    // Báo cáo, đọc-only
await queryRunner.startTransaction('REPEATABLE READ');  // ✅ Banking thông thường (MySQL default)
await queryRunner.startTransaction('SERIALIZABLE');     // Đối soát, batch phức tạp
```

### 2.4 QueryRunner với Raw SQL + FOR UPDATE

```typescript
// Pattern: đọc-lock-ghi với kiểm tra chi tiết
async debitAccount(accountId: number, amount: number, reference: string) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction('REPEATABLE READ');

  try {
    // Pessimistic lock
    const rows = await queryRunner.manager.query(`
      SELECT id, balance, daily_limit, daily_used
      FROM accounts
      WHERE id = ?
      FOR UPDATE
    `, [accountId]);

    if (!rows.length) throw new Error('Account not found');
    const account = rows[0];

    // Multiple business rule checks
    if (account.balance < amount) {
      throw new Error('Insufficient balance');
    }
    if (account.daily_used + amount > account.daily_limit) {
      throw new Error('Daily limit exceeded');
    }

    // Idempotency check
    const [existing] = await queryRunner.manager.query(`
      SELECT id FROM transactions WHERE reference = ?
    `, [reference]);
    if (existing) {
      throw new Error('Duplicate transaction reference');
    }

    // Update
    await queryRunner.manager.query(`
      UPDATE accounts 
      SET balance = balance - ?,
          daily_used = daily_used + ?,
          updated_at = NOW()
      WHERE id = ?
    `, [amount, amount, accountId]);

    await queryRunner.manager.query(`
      INSERT INTO transactions (account_id, amount, type, reference, created_at)
      VALUES (?, ?, 'DEBIT', ?, NOW())
    `, [accountId, amount, reference]);

    await queryRunner.commitTransaction();
    return { success: true };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

---

## 3. TypeORM — EntityManager Transaction

```typescript
// Cách ngắn gọn hơn, tự động commit/rollback
// Có thể set isolation level bằng cách truyền vào argument đầu tiên
async simpleTransfer(fromId: number, toId: number, amount: number) {
  await this.dataSource.transaction(async (manager) => {
    // manager là EntityManager trong scope transaction này
    await manager.query(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [amount, fromId]
    );
    await manager.query(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [amount, toId]
    );
  });
  
  // Với isolation level:
  await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
    // ...
  });
}
```

---

## 4. Prisma — $transaction callback

### 4.1 Interactive Transaction (dùng cho banking)

```typescript
// banking/transfer.service.ts — Prisma
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransferService {
  constructor(private prisma: PrismaService) {}

  async transfer(fromId: number, toId: number, amount: number) {
    // $transaction nhận async callback
    // Mọi query dùng `tx` đều nằm trong cùng transaction
    return this.prisma.$transaction(async (tx) => {
      // Pessimistic Lock qua $queryRaw
      // (Prisma không có native FOR UPDATE API)
      const [smallerId, largerId] = fromId < toId 
        ? [fromId, toId] : [toId, fromId];

      const accounts = await tx.$queryRaw<Array<{
        id: number; balance: number; status: string
      }>>`
        SELECT id, balance, status
        FROM Account
        WHERE id IN (${smallerId}, ${largerId})
        ORDER BY id
        FOR UPDATE
      `;

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      if (!fromAccount || !toAccount) throw new Error('Account not found');
      if (fromAccount.balance < amount) throw new Error('Insufficient balance');

      // Update dùng Prisma Client (type-safe)
      await tx.account.update({
        where: { id: fromId },
        data: { balance: { decrement: amount } },
      });
      await tx.account.update({
        where: { id: toId },
        data: { balance: { increment: amount } },
      });

      const ledger = await tx.ledger.create({
        data: {
          fromAccountId: fromId,
          toAccountId: toId,
          amount,
          status: 'SUCCESS',
        },
      });

      return { success: true, ledgerId: ledger.id };

    }, {
      // Tùy chỉnh timeout cho banking transaction
      maxWait: 5000,   // 5s: thời gian tối đa chờ lấy connection từ pool
      timeout: 15000,  // 15s: thời gian tối đa cho toàn bộ transaction
      // isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, (Prisma 4.2+)
    });
  }
}
```

### 4.2 Prisma Transaction Isolation Level (Prisma 4.2+)

```typescript
// Prisma hỗ trợ isolation level từ version 4.2
return this.prisma.$transaction(
  async (tx) => {
    // ... banking logic
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 5000,
    timeout: 10000,
  }
);

// Các mức có sẵn:
// Prisma.TransactionIsolationLevel.ReadUncommitted
// Prisma.TransactionIsolationLevel.ReadCommitted
// Prisma.TransactionIsolationLevel.RepeatableRead
// Prisma.TransactionIsolationLevel.Serializable
```

### 4.3 $queryRaw vs $executeRaw trong transaction

```typescript
return this.prisma.$transaction(async (tx) => {
  // $queryRaw: trả về mảng rows — dùng cho SELECT
  const accounts = await tx.$queryRaw<Account[]>`
    SELECT id, balance FROM Account WHERE id = ${accountId} FOR UPDATE
  `;
  // accounts là array, dùng accounts[0] để lấy row đầu tiên

  // $executeRaw: trả về số rows affected — dùng cho UPDATE/DELETE/INSERT
  const affected = await tx.$executeRaw`
    UPDATE Account 
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE id = ${accountId} AND balance >= ${amount}
  `;
  // affected === 0 → không có rows nào thỏa điều kiện → fail
  if (affected === 0) throw new Error('Update failed');
});
```

---

## 5. Prisma — $transaction array (sequential)

```typescript
// Dùng cho nhiều operations độc lập, không cần logic giữa chúng
// KHÔNG phù hợp cho banking (không check balance trước khi update)
const [debit, credit] = await this.prisma.$transaction([
  this.prisma.account.update({
    where: { id: fromId },
    data: { balance: { decrement: amount } },
  }),
  this.prisma.account.update({
    where: { id: toId },
    data: { balance: { increment: amount } },
  }),
]);

// ⚠️ CẢNH BÁO: Array syntax KHÔNG cho phép:
// - Đọc kết quả của query trước để quyết định query sau
// - Row locking (FOR UPDATE)
// - Complex business validation

// ✅ Phù hợp cho: Tạo nhiều records đơn giản cùng lúc
const [user, profile] = await this.prisma.$transaction([
  this.prisma.user.create({ data: userData }),
  this.prisma.userProfile.create({ data: profileData }),
]);
```

---

## 6. So sánh TypeORM vs Prisma cho Banking

```
┌──────────────────────┬─────────────────────────────┬───────────────────────────┐
│ Tiêu chí             │ TypeORM + QueryRunner        │ Prisma + $transaction     │
├──────────────────────┼─────────────────────────────┼───────────────────────────┤
│ Raw SQL control      │ ✅ Hoàn toàn (query methods) │ ✅ $queryRaw/$executeRaw  │
│ FOR UPDATE           │ ✅ Dễ dàng trong query()     │ ✅ $queryRaw`...FOR UPDATE`│
│ Isolation Level      │ ✅ startTransaction(level)   │ ✅ Prisma 4.2+ option     │
│ Type Safety          │ ⚠️ Trung bình (runtime)     │ ✅ Cao (generated types)  │
│ Code verbosity       │ Nhiều boilerplate            │ Gọn hơn                   │
│ Connection management│ Manual (phải release)        │ Tự động                   │
│ Deadlock retry       │ Manual                       │ Manual                    │
│ Phổ biến trong org   │ Nhiều legacy banking apps    │ Phổ biến trong NestJS mới │
└──────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 7. Pattern Banking: Transaction + Row Lock

### Pattern đầy đủ cho Payment Processing

```typescript
// Complete banking transaction pattern
@Injectable()
export class PaymentService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async processPayment(dto: {
    accountId: number;
    amount: number;
    reference: string;
    description: string;
  }) {
    const { accountId, amount, reference, description } = dto;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('REPEATABLE READ');

    try {
      // 1. Idempotency check (trước khi lock để tránh giữ lock lâu)
      const [existing] = await qr.manager.query(
        'SELECT id FROM transactions WHERE reference = ? FOR UPDATE',
        [reference]
      );
      if (existing) {
        // Idempotent: cùng reference → trả về kết quả cũ
        await qr.commitTransaction();
        return { success: true, transactionId: existing.id, idempotent: true };
      }

      // 2. Lock account
      const [account] = await qr.manager.query(
        'SELECT id, balance, status, daily_limit, daily_spent FROM accounts WHERE id = ? FOR UPDATE',
        [accountId]
      );

      if (!account) throw new Error('Account not found');
      if (account.status !== 'ACTIVE') throw new Error('Account is not active');
      if (account.balance < amount) throw new Error('Insufficient balance');
      if (account.daily_spent + amount > account.daily_limit) {
        throw new Error('Daily transaction limit exceeded');
      }

      // 3. Debit account
      await qr.manager.query(
        'UPDATE accounts SET balance = balance - ?, daily_spent = daily_spent + ?, updated_at = NOW() WHERE id = ?',
        [amount, amount, accountId]
      );

      // 4. Record transaction
      const result = await qr.manager.query(
        `INSERT INTO transactions 
          (account_id, amount, type, status, reference, description, created_at)
          VALUES (?, ?, 'DEBIT', 'SUCCESS', ?, ?, NOW())`,
        [accountId, amount, reference, description]
      );
      const transactionId = result.insertId;

      await qr.commitTransaction();
      return { success: true, transactionId };

    } catch (error) {
      await qr.rollbackTransaction();
      
      // Ghi lại failed transaction (ngoài transaction chính để không bị rollback)
      this.recordFailedPayment(dto, error.message).catch(() => {});
      throw error;
    } finally {
      await qr.release();
    }
  }

  private async recordFailedPayment(dto: any, reason: string) {
    await this.dataSource.query(
      `INSERT INTO failed_payments (reference, reason, created_at) VALUES (?, ?, NOW())`,
      [dto.reference, reason]
    );
  }
}
```

---

## 8. Câu hỏi phỏng vấn thường gặp

**Q1: "QueryRunner và EntityManager Transaction khác nhau gì?"**
> A: QueryRunner cho kiểm soát tường minh: `connect()`, `startTransaction(level)`, `commitTransaction()`, `rollbackTransaction()`, `release()`. Phù hợp khi cần custom isolation level hoặc logic phức tạp. EntityManager.transaction() là wrapper ngắn gọn hơn, tự động commit/rollback, nhưng isolation level support hạn chế hơn.

**Q2: "Tại sao phải gọi `queryRunner.release()` trong `finally`?"**
> A: QueryRunner lấy connection từ connection pool. Nếu không release, connection không được trả về pool → pool cạn kiệt → các request tiếp theo bị block → hệ thống timeout. Đặt trong `finally` đảm bảo release dù commit hay rollback thành công.

**Q3: "Prisma `$transaction` callback vs array syntax — khi nào dùng cái nào?"**
> A: Callback (async function) khi cần: đọc data rồi dùng kết quả để quyết định bước tiếp theo, row locking (FOR UPDATE), complex validation. Array syntax khi: các operations độc lập nhau, không cần kết quả của operation trước, đơn giản (tạo nhiều records cùng lúc).

**Q4: "Làm sao set isolation level trong Prisma?"**
> A: Từ Prisma 4.2+, dùng option `isolationLevel` trong `$transaction`: `{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }`. Với TypeORM QueryRunner, dùng `queryRunner.startTransaction('REPEATABLE READ')`.
