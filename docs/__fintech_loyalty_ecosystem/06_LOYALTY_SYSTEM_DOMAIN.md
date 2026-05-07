# Loyalty System - Domain Knowledge

## Loyalty System là gì?

Hệ thống tích điểm/thưởng để giữ chân khách hàng. User thực hiện hành động (mua hàng, thanh toán) → nhận điểm → đổi voucher/ưu đãi.

## Core Concepts

### Point Lifecycle
```
Earn (tích điểm) → Hold (pending) → Available → Redeem (đổi) → Expired (hết hạn)
```

### Tier System (Hạng thành viên)
```
Bronze (0-999 pts) → Silver (1000-4999) → Gold (5000-19999) → Platinum (20000+)
```
- Tier quyết định: multiplier tích điểm, ưu đãi riêng, priority support
- Tier evaluation: monthly/quarterly recalculation

### Point Types
| Loại | Mô tả |
|------|--------|
| **Earn points** | Tích từ giao dịch (VD: 1000đ = 1 điểm) |
| **Bonus points** | Thưởng thêm (sinh nhật, promotion) |
| **Referral points** | Giới thiệu bạn bè |
| **Adjustment points** | Admin điều chỉnh (hoàn điểm, fix lỗi) |

## Architecture cho Loyalty trong Fintech Ecosystem

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Payment Svc │────→│  Message Q   │────→│  Loyalty Svc    │
│ (VNPay,MoMo)│     │  (RabbitMQ)  │     │  (Point Engine) │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                   │
                    ┌──────────────┐               │
                    │  Redis Cache │←──────────────┘
                    │  (Balance,   │
                    │   Tier)      │     ┌─────────────────┐
                    └──────────────┘     │  Notification   │
                                         │  (Push, Email)  │
                                         └─────────────────┘
```

### Event Flow: User thanh toán → Cộng điểm
```
1. Payment Service: thanh toán thành công
2. Emit event: { type: 'payment.completed', userId, amount: 500000, txId }
3. Loyalty Consumer nhận event
4. Idempotency check (txId đã xử lý chưa?)
5. Calculate points: 500000 / 1000 = 500 pts × tier_multiplier
6. BEGIN TRANSACTION
   - INSERT point_transaction (earn, 500 pts, pending)
   - UPDATE user SET total_points += 500
   - Check tier upgrade
7. COMMIT
8. Invalidate Redis cache (user balance, tier)
9. Emit event: { type: 'points.earned', userId, points: 500 }
10. Notification Service: push "Bạn vừa nhận 500 điểm!"
```

## Database Design

### Core Tables
```sql
-- User points summary (denormalized for fast read)
CREATE TABLE user_loyalty (
  user_id UUID PRIMARY KEY,
  total_points INT DEFAULT 0,
  available_points INT DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'BRONZE',
  tier_evaluated_at TIMESTAMP,
  lifetime_points INT DEFAULT 0  -- tổng điểm từ trước đến giờ (dùng tính tier)
);

-- Point transactions (ledger - append-only)
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,  -- EARN, REDEEM, EXPIRE, ADJUST
  points INT NOT NULL,         -- positive = earn, negative = redeem
  balance_after INT NOT NULL,  -- snapshot balance sau transaction
  reference_id VARCHAR(255),   -- payment_id, voucher_id, etc.
  idempotency_key VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,        -- điểm hết hạn khi nào
  created_at TIMESTAMP DEFAULT NOW()
);

-- Voucher redemption
CREATE TABLE voucher_redemptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  voucher_id UUID NOT NULL,
  points_spent INT NOT NULL,
  redeemed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(voucher_id, user_id)  -- 1 user chỉ redeem 1 voucher 1 lần
);
```

### Indexes
```sql
CREATE INDEX idx_pt_user_date ON point_transactions(user_id, created_at DESC);
CREATE INDEX idx_pt_expires ON point_transactions(expires_at) WHERE type = 'EARN' AND expires_at IS NOT NULL;
CREATE INDEX idx_user_tier ON user_loyalty(tier, lifetime_points DESC);
```

## Các bài toán thường gặp

### 1. Double-spend prevention (Trừ điểm 2 lần)
```sql
-- Pessimistic lock: SELECT FOR UPDATE
BEGIN;
SELECT available_points FROM user_loyalty WHERE user_id = $1 FOR UPDATE;
-- Check đủ điểm không
-- Trừ điểm
COMMIT;
```

### 2. Point Expiration (Điểm hết hạn)
```typescript
// Cron job chạy hàng ngày
@Cron('0 2 * * *') // 2AM daily
async expirePoints() {
  const expired = await this.db.query(`
    UPDATE point_transactions SET type = 'EXPIRE'
    WHERE expires_at < NOW() AND type = 'EARN' AND status = 'available'
    RETURNING user_id, points
  `);
  // Recalculate user balance
  // Notify users
}
```

### 3. Concurrent Redemption (2 user redeem cùng voucher limited)
```sql
-- Dùng DB constraint + atomic update
UPDATE vouchers SET remaining = remaining - 1
WHERE id = $1 AND remaining > 0;
-- affected rows = 0 → hết voucher
```

### 4. Tier Recalculation
```typescript
async recalculateTier(userId: string) {
  const { lifetime_points } = await this.getUserLoyalty(userId);
  const newTier = this.calculateTier(lifetime_points);
  // Chỉ update nếu tier thay đổi
  if (newTier !== currentTier) {
    await this.updateTier(userId, newTier);
    this.eventEmitter.emit('tier.changed', { userId, from: currentTier, to: newTier });
  }
}
```

## Câu hỏi phỏng vấn Loyalty-specific

1. **Làm sao tránh cộng điểm 2 lần?** → Idempotency key (transaction_id) + UNIQUE constraint + Redis NX check
2. **Điểm hết hạn xử lý thế nào?** → Cron job expire + recalculate balance. Notify user trước N ngày
3. **Tier tính thế nào?** → Dựa trên lifetime_points (tổng tích lũy), recalculate monthly
4. **Flash sale 10K user redeem cùng lúc?** → Redis distributed lock + DB atomic update + queue processing
5. **Audit trail quan trọng không?** → Cực kỳ quan trọng. point_transactions là append-only ledger, không bao giờ UPDATE/DELETE
