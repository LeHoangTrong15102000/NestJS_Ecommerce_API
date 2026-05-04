# Saga Pattern — Banking Domain (EDA)

> **Mục tiêu:** Hiểu Saga Pattern để xử lý distributed transaction khi nhiều service có DB riêng (microservices banking). Tập trung vào **Choreography** (dùng Message Broker) vì phổ biến hơn trong banking hiện đại.

---

## Mục lục

1. [Vấn đề: Không thể dùng ACID transaction cross-service](#1-vấn-đề-không-thể-dùng-acid-transaction-cross-service)
2. [Saga Pattern là gì?](#2-saga-pattern-là-gì)
3. [Choreography Saga (Event-based)](#3-choreography-saga-event-based)
4. [Orchestration Saga (Coordinator-based)](#4-orchestration-saga-coordinator-based)
5. [So sánh Choreography vs Orchestration](#5-so-sánh-choreography-vs-orchestration)
6. [Compensating Transaction (Rollback phân tán)](#6-compensating-transaction-rollback-phân-tán)
7. [Triển khai trong NestJS Banking](#7-triển-khai-trong-nestjs-banking)
8. [Câu hỏi phỏng vấn thường gặp](#8-câu-hỏi-phỏng-vấn-thường-gặp)

---

## 1. Vấn đề: Không thể dùng ACID transaction cross-service

### Monolith Banking (1 DB):

```sql
-- Chuyển tiền: toàn bộ trong 1 transaction → ACID đảm bảo
BEGIN;
  UPDATE accounts SET balance = balance - 500000 WHERE id = 1;  -- Trừ A
  UPDATE accounts SET balance = balance + 500000 WHERE id = 2;  -- Cộng B
  INSERT INTO ledger (...) VALUES (...);                          -- Ghi lịch sử
COMMIT; -- All or nothing
```

### Microservices Banking (mỗi service có DB riêng):

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Account Service │  │  Ledger Service  │  │  Notify Service  │
│                  │  │                  │  │                  │
│  MySQL DB A      │  │  MySQL DB B      │  │  MySQL DB C      │
└──────────────────┘  └──────────────────┘  └──────────────────┘

KHÔNG THỂ: BEGIN; ... Account DB ... Ledger DB ... COMMIT;
→ Các DB khác nhau, không share transaction

Vấn đề: 
  - Account Service trừ tiền thành công
  - Ledger Service ghi lịch sử FAIL
  → Tiền bị trừ nhưng không có lịch sử → Inconsistent!
```

**Saga Pattern** giải quyết bằng cách chia transaction lớn thành chuỗi **local transactions nhỏ**, mỗi cái có **compensating action** nếu fail.

---

## 2. Saga Pattern là gì?

```
Saga = Chuỗi local transactions + Compensating transactions

Mỗi bước trong Saga:
  - Thực hiện local transaction trên DB riêng của service
  - Phát ra event/command báo bước tiếp theo
  - Nếu thất bại: phát event để rollback các bước trước (compensating)

Ví dụ chuyển tiền banking:
  Bước 1: Account Service — Trừ tiền tài khoản nguồn
  Bước 2: Ledger Service  — Ghi lịch sử giao dịch
  Bước 3: Notify Service  — Gửi SMS/Email thông báo

  Nếu bước 2 fail:
  Compensate bước 1: Account Service — Cộng lại tiền (refund)
```

---

## 3. Choreography Saga (Event-based)

### Khái niệm

Không có coordinator trung tâm. Mỗi service **tự lắng nghe events** và quyết định hành động tiếp theo. Giống như vũ điệu — mỗi người biết vai trò của mình.

### Flow chuyển tiền — Choreography:

```
User → Transfer API → Account Service
                           │
                     Trừ tiền thành công
                           │
                     Phát event: TransferDebited
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Ledger Svc    Risk Engine     Notify Svc
       Lắng nghe     Lắng nghe       Lắng nghe
       TransferDebited TransferDebited TransferDebited
            │
       Ghi lịch sử OK
            │
       Phát event: LedgerRecorded
            │
            ▼
       Account Service (lắng nghe)
       Cộng tiền cho tài khoản đích
            │
       Phát event: TransferCompleted
            │
            ▼
       Notify Service: gửi SMS thành công

NẾU Ledger Service FAIL:
       Phát event: LedgerFailed
            │
            ▼
       Account Service (lắng nghe LedgerFailed)
       → Compensate: cộng lại tiền đã trừ
       → Phát event: TransferRolledBack
            │
            ▼
       Notify Service: gửi SMS "Giao dịch thất bại"
```

### Diagram chi tiết:

```
┌────────────┐              ┌────────────┐              ┌────────────┐
│  Account   │              │   Ledger   │              │   Notify   │
│  Service   │              │  Service   │              │  Service   │
└─────┬──────┘              └─────┬──────┘              └─────┬──────┘
      │                           │                           │
      │──TransferDebited──────────►                           │
      │   {fromId, toId, amount}  │──LedgerRecorded──────────►│
      │                           │   {ledgerId}              │
      │◄──────────────────────────┤                           │
      │   Account svc nghe        │                           │
      │   LedgerRecorded          │                           │
      │   → cộng tiền toId        │                           │
      │                           │                           │
      │──TransferCompleted────────────────────────────────────►
      │                                                       │
      │                                                       │ Gửi SMS: "Thành công"
      
NẾU Ledger FAIL:
      │◄──LedgerFailed────────────┤
      │   {reason}                │
      │                           │
      │ Compensate: Cộng lại      │
      │ tiền cho fromId           │
      │──TransferFailed───────────────────────────────────────►
      │                                                       │ Gửi SMS: "Thất bại"
```

---

## 4. Orchestration Saga (Coordinator-based)

### Khái niệm

Có 1 **Saga Orchestrator** trung tâm điều phối toàn bộ luồng. Orchestrator biết thứ tự các bước và compensating actions.

```
                    ┌─────────────────────┐
                    │   Transfer Saga      │
                    │   Orchestrator       │
                    │                     │
                    │ Step 1: DebitAccount │
                    │ Step 2: RecordLedger │
                    │ Step 3: CreditAccount│
                    │ Step 4: NotifyUser   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   Account Service       Ledger Service       Notify Service
   (nhận command:        (nhận command:        (nhận command:
    DebitAccount)         RecordLedger)         NotifyUser)
```

### NestJS Orchestration implementation:

```typescript
// transfer-saga.orchestrator.ts
@Injectable()
export class TransferSagaOrchestrator {
  constructor(
    private accountClient: AccountServiceClient,
    private ledgerClient: LedgerServiceClient,
    private notifyClient: NotifyServiceClient,
    private sagaRepo: SagaRepository,
  ) {}

  async execute(dto: TransferDto): Promise<TransferResult> {
    const sagaId = uuid();
    const saga = await this.sagaRepo.create({
      id: sagaId,
      type: 'TRANSFER',
      status: 'STARTED',
      data: dto,
    });

    const compensations: CompensationStep[] = [];

    try {
      // Step 1: Debit source account
      const debitResult = await this.accountClient.debit({
        accountId: dto.fromAccountId,
        amount: dto.amount,
        sagaId,
      });
      compensations.push({
        step: 'DEBIT',
        compensate: () => this.accountClient.refund({
          accountId: dto.fromAccountId,
          amount: dto.amount,
          sagaId,
          reason: 'SAGA_ROLLBACK',
        }),
      });
      await this.sagaRepo.updateStep(sagaId, 'DEBIT_COMPLETED');

      // Step 2: Record in ledger
      const ledgerResult = await this.ledgerClient.record({
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount: dto.amount,
        debitTransactionId: debitResult.transactionId,
        sagaId,
      });
      compensations.push({
        step: 'LEDGER',
        compensate: () => this.ledgerClient.reverse({
          ledgerId: ledgerResult.ledgerId,
          sagaId,
        }),
      });
      await this.sagaRepo.updateStep(sagaId, 'LEDGER_COMPLETED');

      // Step 3: Credit destination account
      await this.accountClient.credit({
        accountId: dto.toAccountId,
        amount: dto.amount,
        ledgerId: ledgerResult.ledgerId,
        sagaId,
      });
      await this.sagaRepo.updateStep(sagaId, 'CREDIT_COMPLETED');

      // Step 4: Notify (không cần compensate — notification là best-effort)
      this.notifyClient.sendTransferSuccess(dto).catch(err => {
        // Log nhưng không fail saga
        this.logger.warn('Notification failed', err);
      });

      await this.sagaRepo.updateStep(sagaId, 'COMPLETED');
      return { success: true, sagaId };

    } catch (error) {
      // Rollback: thực hiện compensation theo thứ tự NGƯỢC
      await this.sagaRepo.updateStep(sagaId, 'COMPENSATING');
      
      for (const comp of compensations.reverse()) {
        try {
          await comp.compensate();
          await this.sagaRepo.updateStep(sagaId, `${comp.step}_COMPENSATED`);
        } catch (compensateError) {
          // Compensation fail → cần manual intervention
          await this.sagaRepo.markManualRequired(sagaId, comp.step, compensateError);
          this.alertOps(`Saga ${sagaId} compensation failed at step ${comp.step}`);
        }
      }
      
      await this.sagaRepo.updateStep(sagaId, 'FAILED');
      throw error;
    }
  }
}
```

---

## 5. So sánh Choreography vs Orchestration

```
┌────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Tiêu chí               │ Choreography            │ Orchestration           │
├────────────────────────┼─────────────────────────┼─────────────────────────┤
│ Coordinator            │ Không có                │ Có (Saga Orchestrator)  │
│ Coupling               │ Loose — service chỉ     │ Chặt hơn — Orchestrator │
│                        │ biết event, không biết  │ biết tất cả services    │
│                        │ service khác            │                         │
│ Debugging              │ Khó — flow phân tán     │ Dễ hơn — flow tập trung │
│ Complexity             │ Thấp (nhỏ hơn 4 steps)  │ Cao (code orchestrator) │
│ Circular dependency    │ Có thể xảy ra           │ Ít hơn                  │
│ Banking phù hợp        │ Simple flows (3-4 step) │ Complex flows (5+ step) │
│ Phổ biến               │ ✅ Hơn (với GCP Pub/Sub)│ ✅ Khi cần traceability  │
└────────────────────────┴─────────────────────────┴─────────────────────────┘
```

**Khi nào dùng Choreography (Banking):**
- Luồng đơn giản: Debit → Record → Credit → Notify
- Team nhỏ, cần độc lập triển khai từng service
- Dùng GCP Pub/Sub, RabbitMQ Topic Exchange

**Khi nào dùng Orchestration (Banking):**
- Luồng phức tạp: Loan Approval, KYC verification (nhiều bước có điều kiện)
- Cần traceability cao (audit trail)
- Cần retry/resume logic phức tạp

---

## 6. Compensating Transaction (Rollback phân tán)

### Nguyên tắc thiết kế Compensating Transaction:

```
1. Idempotent: Chạy compensation 2 lần không gây thêm hậu quả
   ✅ "Refund 500,000 cho tài khoản 1 với sagaId X" → chạy lần 2 → detect duplicate → skip
   ❌ "Cộng thêm 500,000 cho tài khoản 1" → chạy lần 2 → cộng thêm 500,000 nữa → SAI

2. Không phải UNDO: Compensation tạo hành động ĐỐI LẬP, không phải xóa record
   ✅ Giao dịch DEBIT 500,000 → Compensate = CREDIT 500,000 (tạo record mới)
   ❌ Xóa record DEBIT → mất audit trail

3. Có thể fail: Compensation cũng có thể fail → cần retry + manual fallback
   → Lưu saga state vào DB → nếu crash, tiếp tục từ bước đang dang dở
```

### Saga State Machine:

```
STARTED
  │
  ▼ (step 1 OK)
DEBIT_COMPLETED
  │
  ▼ (step 2 OK)
LEDGER_COMPLETED
  │
  ▼ (step 3 OK)
CREDIT_COMPLETED
  │
  ▼ (step 4 OK)
COMPLETED

Nếu fail ở LEDGER_COMPLETED:
LEDGER_COMPLETED
  │
  ▼ (fail)
COMPENSATING
  │
  ▼ (compensate step 1)
DEBIT_COMPENSATED
  │
  ▼
FAILED (hoặc MANUAL_REQUIRED nếu compensation cũng fail)
```

---

## 7. Triển khai trong NestJS Banking

### Choreography với GCP Pub/Sub (banking context)

```typescript
// account.service.ts — Account Service
@Injectable()
export class AccountService {
  constructor(
    private prisma: PrismaService,
    private pubsub: PubSubService,
  ) {}

  // Lắng nghe event: transfer.initiated
  @Subscribe('transfer.initiated')
  async handleTransferInitiated(event: TransferInitiatedEvent) {
    await this.prisma.$transaction(async (tx) => {
      // Lock account
      const [account] = await tx.$queryRaw`
        SELECT id, balance FROM Account WHERE id = ${event.fromAccountId} FOR UPDATE
      `;

      if (account.balance < event.amount) {
        // Emit failure event
        await this.pubsub.publish('transfer.debit.failed', {
          sagaId: event.sagaId,
          reason: 'INSUFFICIENT_BALANCE',
        });
        return;
      }

      // Trừ tiền
      await tx.account.update({
        where: { id: event.fromAccountId },
        data: { balance: { decrement: event.amount } },
      });

      // Ghi Outbox (đảm bảo event được publish sau khi DB commit)
      await tx.outboxEvent.create({
        data: {
          topic: 'transfer.debited',
          payload: JSON.stringify({
            sagaId: event.sagaId,
            fromAccountId: event.fromAccountId,
            toAccountId: event.toAccountId,
            amount: event.amount,
            debitedAt: new Date(),
          }),
        },
      });
    });
  }

  // Lắng nghe event: transfer.ledger.recorded → Credit bên kia
  @Subscribe('transfer.ledger.recorded')
  async handleLedgerRecorded(event: LedgerRecordedEvent) {
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: event.toAccountId },
        data: { balance: { increment: event.amount } },
      });

      await tx.outboxEvent.create({
        data: {
          topic: 'transfer.credited',
          payload: JSON.stringify({ sagaId: event.sagaId }),
        },
      });
    });
  }

  // Compensation: hoàn tiền khi saga fail
  @Subscribe('transfer.saga.failed')
  async handleSagaFailed(event: SagaFailedEvent) {
    if (event.failedStep !== 'DEBIT_COMPLETED') return; // Chưa debit → không cần refund

    await this.prisma.$transaction(async (tx) => {
      // Idempotency: kiểm tra đã refund chưa
      const [existing] = await tx.$queryRaw`
        SELECT id FROM Account WHERE id = ${event.fromAccountId} 
        AND JSON_CONTAINS(metadata, ${JSON.stringify({ refundedSaga: event.sagaId })})
      `;
      if (existing) return; // Đã refund rồi

      await tx.account.update({
        where: { id: event.fromAccountId },
        data: { balance: { increment: event.amount } },
      });

      await tx.outboxEvent.create({
        data: {
          topic: 'transfer.refunded',
          payload: JSON.stringify({ sagaId: event.sagaId }),
        },
      });
    });
  }
}
```

---

## 8. Câu hỏi phỏng vấn thường gặp

**Q1: "Saga Pattern giải quyết vấn đề gì? Tại sao không dùng 2-phase commit (2PC)?"**
> A: Saga giải quyết distributed transaction khi mỗi service có DB riêng. 2PC (Two-Phase Commit) yêu cầu tất cả participants đồng ý trong 1 global transaction, nhưng nó blocking (nếu coordinator fail, tất cả participants bị lock mãi), không scale, và không phù hợp microservices. Saga thay thế bằng eventually consistent approach với compensating transactions.

**Q2: "Choreography vs Orchestration — khi nào dùng cái nào trong banking?"**
> A: Choreography khi flow đơn giản, ít bước (3-4), và muốn coupling thấp — ví dụ: chuyển tiền nhanh. Orchestration khi flow phức tạp, nhiều điều kiện, cần traceability cao — ví dụ: xét duyệt vay vốn (loan), KYC verification. Banking thường dùng Orchestration cho critical flows vì dễ debug và monitor hơn.

**Q3: "Compensating Transaction có phải là UNDO không?"**
> A: Không. Compensating Transaction là hành động ĐỐI LẬP, không phải xóa. Ví dụ: DEBIT 500k → compensation là CREDIT 500k (tạo record mới). Không được xóa record gốc vì mất audit trail — trong banking, mọi giao dịch phải được lưu lại. Compensation phải idempotent — chạy nhiều lần không gây side effect thêm.

**Q4: "Nếu Compensating Transaction cũng fail thì sao?"**
> A: Đây là tình huống cần manual intervention. Hệ thống phải: (1) lưu saga state vào DB với status MANUAL_REQUIRED, (2) alert team ops ngay lập tức, (3) có process thủ công để reconcile. Đây là lý do banking cần saga log đầy đủ và reconciliation process hàng ngày.
