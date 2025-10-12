# Stripe Webhook Events - Phân Tích Chi Tiết & Khuyến Nghị

## Tổng Quan Hệ Thống

**Mô hình kinh doanh:** Practice Payment System

- **Onboarding Fee:** Phí một lần khi practice đăng ký
- **Subscription:** Phí định kỳ (Monthly hoặc 6 Months)
- **Billing Statuses:** REQUIRED, DONE, PAST_DUE, INACTIVE, CANCELLED

**Provider Entity Fields:**

- `stripeCustomerId` - ID customer trên Stripe
- `stripeSubscriptionId` - ID subscription trên Stripe
- `billingStatus` - Trạng thái thanh toán
- `onboardingPaidAt` - Thời điểm trả onboarding fee

---

## 📋 Danh Sách Webhook Events Từ Stripe

### 🔵 **CUSTOMER EVENTS**

#### 1. `customer.created`

**Khi nào gửi:** Khi tạo customer mới trên Stripe

**Có phù hợp không?** ❌ KHÔNG CẦN

- Hệ thống bạn tự tạo customer qua API (`StripeIntegrationService.createCustomer()`)
- Lưu `stripeCustomerId` vào database ngay sau khi tạo
- Không cần handle webhook này

---

#### 2. `customer.subscription.created`

**Khi nào gửi:** Khi subscription được tạo

**Có phù hợp không?** ⚠️ TÙY CHỌN

- Có thể dùng để log/tracking
- Nhưng subscription được tạo qua checkout session, không cần xử lý riêng
- **Recommendation:** KHÔNG CẦN implement ngay

---

#### 3. `customer.subscription.updated` ⭐

**Khi nào gửi:** Khi subscription thay đổi status hoặc metadata

**Ví dụ:**

- Status thay đổi: `active` → `past_due` → `canceled` → `unpaid`
- User schedule cancellation (`cancel_at_period_end = true`)
- Subscription renewal (current_period_start/end thay đổi)
- Plan upgrade/downgrade

**Có phù hợp không?** ✅ **RẤT KHUYẾN NGHỊ**

**Use Cases:**

1. **Detect cancellation schedule:**

   ```typescript
   if (subscription.cancel_at_period_end === true) {
     // User đã đặt lịch hủy subscription
     // → Gửi email retention, hiển thị warning, v.v.
   }
   ```

2. **Track subscription status:**

   ```typescript
   if (subscription.status === "past_due") {
     billingStatus = BillingStatus.PAST_DUE;
   } else if (
     subscription.status === "canceled" ||
     subscription.status === "unpaid"
   ) {
     billingStatus = BillingStatus.CANCELLED;
   } else if (subscription.status === "active") {
     billingStatus = BillingStatus.DONE;
   }
   ```

3. **Store cycle metadata:**
   ```typescript
   await providerRepository.update(practiceId, {
     subscriptionCurrentPeriodStart: new Date(
       subscription.current_period_start * 1000,
     ),
     subscriptionCurrentPeriodEnd: new Date(
       subscription.current_period_end * 1000,
     ),
     subscriptionStatus: subscription.status,
   });
   ```

**Implementation Priority:** 🔴 HIGH

---

#### 4. `customer.subscription.deleted`

**Khi nào gửi:** Khi subscription bị xóa hoàn toàn

**Có phù hợp không?** ✅ KHUYẾN NGHỊ

**Use Cases:**

- Set `billingStatus = CANCELLED`
- Revoke practice access
- Archive/cleanup data
- Send notification email

**Implementation Priority:** 🟡 MEDIUM

---

#### 5. `customer.subscription.paused`

**Khi nào gửi:** Khi subscription bị pause

**Có phù hợp không?** ⚠️ TÙY CHỌN

- Chỉ cần nếu bạn support pause subscription feature
- Hiện tại: KHÔNG CẦN

---

#### 6. `customer.subscription.resumed`

**Khi nào gửi:** Khi subscription được resume từ paused

**Có phù hợp không?** ⚠️ TÙY CHỌN

- Chỉ cần nếu support pause/resume
- Hiện tại: KHÔNG CẦN

---

#### 7. `customer.updated`

**Khi nào gửi:** Khi customer info thay đổi (email, payment method, v.v.)

**Có phù hợp không?** ⚠️ TÙY CHỌN

- Có thể sync customer data
- Không critical cho billing flow
- **Recommendation:** KHÔNG CẦN ngay

---

### 📄 **INVOICE EVENTS**

#### 8. `invoice.created`

**Khi nào gửi:** Khi Stripe tạo draft invoice cho renewal

**Thời điểm:** ~1 giờ trước khi finalize (nếu có webhook handler)

**Có phù hợp không?** ⚠️ TÙY CHỌN

**Use Cases:**

- Apply discount/credit tự động
- Thêm line items
- Hủy invoice nếu có vấn đề
- Pre-notification (email: "Invoice sắp được charge")

**Hiện tại hệ thống bạn:** Không cần can thiệp trước khi charge

**Recommendation:** KHÔNG CẦN implement ngay (có thể thêm sau)

---

#### 9. `invoice.finalized`

**Khi nào gửi:** Khi invoice chuyển từ draft → open, sẵn sàng charge

**Thời điểm:** Ngay trước khi Stripe attempt payment

**Có phù hợp không?** ⚠️ TÙY CHỌN

**Use Cases:**

- Logging/tracking
- Last chance notification
- Không thể edit invoice nữa

**Recommendation:** KHÔNG CẦN (chỉ để tracking/monitoring)

---

#### 10. `invoice.paid` ✅

**Khi nào gửi:** Khi invoice được thanh toán thành công

**Có phù hợp không?** ✅ **ĐÃ IMPLEMENT**

**Current Handler:** `handleInvoicePaid()` - Line 205-275

**Logic:**

1. Extract practiceId từ subscription metadata
2. Call `checkCompleteBillingStatus()`
3. Set `billingStatus = DONE` nếu có cả onboarding + subscription receipts

**Status:** ✅ Hoạt động tốt, KHÔNG CẦN SỬA

---

#### 11. `invoice.payment_action_required` ⭐

**Khi nào gửi:** Khi payment cần thêm action (3D Secure, SCA)

**Có phù hợp không?** ✅ **KHUYẾN NGHỊ**

**Use Cases:**

- User cần xác thực 3D Secure
- Payment stuck ở trạng thái `requires_action`
- Gửi email yêu cầu user hoàn tất authentication

**Current Gap:** Không handle → user không biết phải làm gì

**Implementation Priority:** 🟡 MEDIUM-HIGH

---

#### 12. `invoice.payment_failed` ✅

**Khi nào gửi:** Khi payment attempt thất bại

**Có phù hợp không?** ✅ **ĐÃ IMPLEMENT**

**Current Handler:** `handleInvoicePaymentFailed()` - Line 277-293

**Logic:**

- Set `billingStatus = PAST_DUE`

**Status:** ✅ Hoạt động tốt, KHÔNG CẦN SỬA

---

#### 13. `invoice.payment_succeeded`

**Khi nào gửi:** Khi automatic payment attempt thành công

**Có phù hợp không?** ✅ **ĐÃ IMPLEMENT**

**Current Handler:** `handleInvoicePaid()` (cùng với `invoice.paid`)

**Status:** ✅ Hoạt động tốt, KHÔNG CẦN SỬA

---

#### 14. `invoice.upcoming`

**Khi nào gửi:** Vài ngày trước khi renewal (theo config)

**Có phù hợp không?** ⚠️ TÙY CHỌN

**Use Cases:**

- Gửi reminder email
- "Subscription của bạn sẽ renew vào ngày X"
- Cho user cơ hội update payment method

**Recommendation:** Có thể implement sau (nice-to-have)

---

#### 15. `invoice.updated`

**Khi nào gửi:** Khi invoice được cập nhật

**Có phù hợp không?** ❌ KHÔNG CẦN

- Thường chỉ dùng khi bạn manually update invoice
- Không cần cho automatic subscription flow

---

#### 16. `invoice.finalization_failed`

**Khi nào gửi:** Khi không thể finalize invoice

**Có phù hợp không?** ⚠️ TÙY CHỌN

**Use Cases:**

- Log error để debug
- Alert admin

**Recommendation:** Có thể log (low priority)

---

### 💳 **PAYMENT INTENT EVENTS**

#### 17. `payment_intent.created`

**Khi nào gửi:** Khi payment intent được tạo

**Có phù hợp không?** ❌ KHÔNG CẦN

- Duplicate với invoice events
- Handle ở invoice level là đủ

---

#### 18. `payment_intent.succeeded`

**Khi nào gửi:** Khi payment intent thành công

**Có phù hợp không?** ❌ KHÔNG CẦN

- Đã có `invoice.payment_succeeded`
- Không cần handle riêng

---

#### 19. `payment_intent.payment_failed`

**Khi nào gửi:** Khi payment intent thất bại

**Có phù hợp không?** ❌ KHÔNG CẦN

- Đã có `invoice.payment_failed`

---

### 📅 **SUBSCRIPTION SCHEDULE EVENTS**

#### 20. `subscription_schedule.aborted`

**Khi nào gửi:** Khi subscription schedule bị hủy

**Có phù hợp không?** ❌ KHÔNG CẦN

- Chỉ cần nếu dùng subscription schedules (advanced feature)

---

#### 21. `subscription_schedule.canceled`

**Khi nào gửi:** Khi subscription schedule bị cancel

**Có phù hợp không?** ❌ KHÔNG CẦN

---

#### 22. `subscription_schedule.completed`

**Khi nào gửi:** Khi subscription schedule hoàn tất

**Có phù hợp không?** ❌ KHÔNG CẦN

---

#### 23. `subscription_schedule.created`

**Khi nào gửi:** Khi tạo subscription schedule

**Có phù hợp không?** ❌ KHÔNG CẦN

---

#### 24. `subscription_schedule.expiring`

**Khi nào gửi:** 7 ngày trước khi schedule expire

**Có phù hợp không?** ❌ KHÔNG CẦN

---

#### 25. `subscription_schedule.released`

**Khi nào gửi:** Khi subscription schedule được release

**Có phù hợp không?** ❌ KHÔNG CẦN

---

#### 26. `subscription_schedule.updated`

**Khi nào gửi:** Khi subscription schedule được update

**Có phù hợp không?** ❌ KHÔNG CẦN

---

## 📊 TÓM TẮT KHUYẾN NGHỊ

### ✅ **ĐÃ IMPLEMENT - HOẠT ĐỘNG TỐT**

| Event                       | Handler                        | Billing Status       | Notes      |
| --------------------------- | ------------------------------ | -------------------- | ---------- |
| `invoice.paid`              | `handleInvoicePaid()`          | `DONE` or `REQUIRED` | ✅ Correct |
| `invoice.payment_succeeded` | `handleInvoicePaid()`          | `DONE` or `REQUIRED` | ✅ Correct |
| `invoice.payment_failed`    | `handleInvoicePaymentFailed()` | `PAST_DUE`           | ✅ Correct |

---

### 🔴 **KHUYẾN NGHỊ THÊM NGAY - HIGH PRIORITY**

#### 1. `customer.subscription.updated` ⭐⭐⭐

**Tại sao quan trọng:**

- Biết khi user đặt lịch cancel (`cancel_at_period_end = true`)
- Track subscription status lifecycle
- Update renewal cycle dates
- Detect plan changes

**Implementation:**

```typescript
case "customer.subscription.updated":
  await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
  break;

private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) {
    this.logger.error('Practice ID not found in subscription metadata');
    return;
  }

  const updateData: any = {
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  // Update billing status based on subscription status
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    updateData.billingStatus = BillingStatus.CANCELLED;
  } else if (subscription.status === 'past_due') {
    updateData.billingStatus = BillingStatus.PAST_DUE;
  } else if (subscription.status === 'active') {
    // Only set DONE if payment history is complete
    const billingCheck = await this.stripeService.checkCompleteBillingStatus(
      subscription.customer as string
    );
    if (billingCheck.isComplete) {
      updateData.billingStatus = BillingStatus.DONE;
    }
  }

  await this.providerRepository.update(practiceId, updateData);

  this.logger.log(
    `Updated subscription status for practice ${practiceId}: ${subscription.status}`
  );
}
```

**Required Database Migration:**

```typescript
// Add new fields to Provider entity
@Column({ type: 'varchar', nullable: true })
subscriptionStatus: string; // active, past_due, canceled, unpaid, etc.

@Column({ type: 'boolean', default: false })
cancelAtPeriodEnd: boolean;
```

---

### 🟡 **KHUYẾN NGHỊ THÊM - MEDIUM PRIORITY**

#### 2. `customer.subscription.deleted`

**Use Case:** Subscription bị xóa hoàn toàn

**Implementation:**

```typescript
case "customer.subscription.deleted":
  await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
  break;

private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) return;

  await this.providerRepository.update(practiceId, {
    billingStatus: BillingStatus.CANCELLED,
    subscriptionStatus: 'canceled',
    stripeSubscriptionId: null,
  });

  this.logger.log(`Subscription deleted for practice ${practiceId}`);
}
```

---

#### 3. `invoice.payment_action_required`

**Use Case:** 3D Secure / SCA authentication needed

**Implementation:**

```typescript
case "invoice.payment_action_required":
  await this.handlePaymentActionRequired(event.data.object as Stripe.Invoice);
  break;

private async handlePaymentActionRequired(invoice: Stripe.Invoice) {
  // Extract practice info
  const { practiceId } = await this.stripeService.handleInvoicePaid(invoice);

  // Could send email to practice admin
  this.logger.warn(
    `Payment action required for practice ${practiceId}. Invoice: ${invoice.id}`
  );

  // TODO: Send email with payment link
  // TODO: Update billing status to pending action
}
```

---

### ⚪ **TÙY CHỌN - LOW PRIORITY (Nice-to-have)**

| Event               | Use Case                                      | Priority |
| ------------------- | --------------------------------------------- | -------- |
| `invoice.created`   | Apply discounts, add credits trước khi charge | Low      |
| `invoice.finalized` | Logging/tracking                              | Low      |
| `invoice.upcoming`  | Send renewal reminder emails                  | Low      |
| `customer.updated`  | Sync customer data changes                    | Low      |

---

## 🎯 ROADMAP TRIỂN KHAI

### Phase 1: Critical (Implement ngay) 🔴

1. ✅ Add `customer.subscription.updated` handler
2. ✅ Add database fields: `subscriptionStatus`, `cancelAtPeriodEnd`
3. ✅ Migration script

### Phase 2: Important (Trong 1-2 tuần) 🟡

4. Add `customer.subscription.deleted` handler
5. Add `invoice.payment_action_required` handler
6. Email notification system

### Phase 3: Enhancement (Khi có thời gian) ⚪

7. `invoice.upcoming` - Renewal reminders
8. `invoice.created` - Pre-charge modifications
9. Better logging/monitoring

---

## 📝 CODE CHANGES SUMMARY

### File: `src/modules/practice-payment/practice-payment.service.ts`

**Cập nhật switch statement:**

```typescript
switch (event.type) {
  case "invoice.paid":
  case "invoice.payment_succeeded":
    await this.handleInvoicePaid(
      event.data.object as unknown as Stripe.Invoice,
    );
    break;

  case "invoice.payment_failed":
    await this.handleInvoicePaymentFailed(
      event.data.object as unknown as Stripe.Invoice,
    );
    break;

  // 🆕 NEW HANDLERS
  case "customer.subscription.updated":
    await this.handleSubscriptionUpdated(
      event.data.object as unknown as Stripe.Subscription,
    );
    break;

  case "customer.subscription.deleted":
    await this.handleSubscriptionDeleted(
      event.data.object as unknown as Stripe.Subscription,
    );
    break;

  case "invoice.payment_action_required":
    await this.handlePaymentActionRequired(
      event.data.object as unknown as Stripe.Invoice,
    );
    break;

  default:
    this.logger.log(`Unhandled event type: ${event.type}`);
}
```

### File: `src/modules/user/entity/provider.entity.ts`

**Thêm fields:**

```typescript
@Column({ type: 'varchar', nullable: true, name: 'subscription_status' })
subscriptionStatus?: string;

@Column({ type: 'boolean', default: false, name: 'cancel_at_period_end' })
cancelAtPeriodEnd: boolean;
```

---

## ✅ CHECKLIST TESTING

Sau khi implement, test các scenarios:

- [ ] Subscription renews successfully → `billingStatus = DONE`
- [ ] Subscription payment fails → `billingStatus = PAST_DUE`
- [ ] User cancels subscription → `cancel_at_period_end = true`
- [ ] Subscription expires after cancellation → `billingStatus = CANCELLED`
- [ ] 3D Secure required → email notification sent
- [ ] Subscription deleted → `billingStatus = CANCELLED`

---

## 📚 NGUỒN THAM KHẢO

- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Event Types](https://docs.stripe.com/api/events/types)
- [Invoice Lifecycle](https://docs.stripe.com/invoicing/integration/workflow-transitions)
- [Subscription Lifecycle](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)

---

**Generated:** October 7, 2025  
**For:** Cellera Backend - Practice Payment System
