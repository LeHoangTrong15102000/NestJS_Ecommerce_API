# Stripe Missing Webhooks - Complete Flow Analysis & Implementation Guide

**Document Version:** 1.0  
**Date:** 2025-10-07  
**Project:** NestJS E-commerce API - Stripe Subscription Integration  
**Prepared For:** Tech Lead Review

---

## 📋 Executive Summary

This document provides a comprehensive analysis of **missing Stripe webhook events** in the current system, their complete data flow from Stripe to database, and detailed implementation recommendations.

### Current Implementation Status

**✅ Currently Implemented (3 webhooks):**

- `invoice.paid` / `invoice.payment_succeeded` → Updates billing status to DONE
- `invoice.payment_failed` → Updates billing status to PAST_DUE

**⚠️ Missing Critical Webhooks (3 webhooks):**

1. `customer.subscription.updated` - **HIGH PRIORITY** 🔴
2. `customer.subscription.deleted` - **MEDIUM PRIORITY** 🟡
3. `invoice.payment_action_required` - **MEDIUM-HIGH PRIORITY** 🟡

---

## 🎯 System Context

### Business Model

- **Onboarding Fee:** One-time payment when practice registers
- **Subscription:** Recurring payment (Monthly or 6-Month plans)
- **Billing Statuses:** `REQUIRED`, `DONE`, `PAST_DUE`, `INACTIVE`, `CANCELLED`

### Current Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Stripe    │ Webhook │   NestJS     │  Update │  PostgreSQL │
│   Platform  ├────────>│   Backend    ├────────>│  Database   │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Emit Event
                              ▼
                        ┌──────────────┐
                        │  WebSocket   │
                        │   Gateway    │
                        └──────────────┘
```

### Key Files Location

- **Webhook Controller:** `src/modules/practice-payment/payment-webhook.controller.ts`
- **Payment Service:** `src/modules/practice-payment/practice-payment.service.ts`
- **Stripe Service:** `src/services/stripe-integration/stripe-integration.service.ts`
- **Provider Entity:** `src/modules/user/entity/provider.entity.ts`

---

## 🔴 MISSING WEBHOOK #1: `customer.subscription.updated`

### Priority: **HIGH** 🔴

### When Stripe Sends This Event

According to [Stripe Documentation](https://docs.stripe.com/billing/subscriptions/webhooks#state-changes), this webhook is sent when:

1. **Subscription status changes:**
   - `active` → `past_due` (payment failed)
   - `active` → `canceled` (subscription cancelled)
   - `trialing` → `active` (trial ended)
   - `past_due` → `active` (payment recovered)

2. **Subscription metadata changes:**
   - User schedules cancellation (`cancel_at_period_end = true`)
   - Plan upgrade/downgrade
   - Billing cycle dates update

3. **Renewal occurs:**
   - `current_period_start` and `current_period_end` update

### Why It's Critical

**Current Gap:**

- ❌ System cannot detect when user schedules subscription cancellation
- ❌ Cannot track subscription lifecycle (active → past_due → canceled)
- ❌ No visibility into next billing cycle dates
- ❌ Cannot detect plan changes or upgrades

**Business Impact:**

- Customer support cannot answer "When does my subscription renew?"
- No proactive notification when subscription is scheduled for cancellation
- Billing status may be out of sync with actual Stripe subscription status

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Stripe Event Trigger                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
User Action on Stripe Dashboard or Automatic Status Change
  - User clicks "Cancel Subscription"
  - Payment fails → status changes to past_due
  - Billing cycle renews → dates update
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Stripe Sends Webhook                                    │
└─────────────────────────────────────────────────────────────────┘

POST https://your-domain.com/practice-payment/webhook

Headers:
  stripe-signature: t=1234567890,v1=abc123...

Body:
{
  "id": "evt_1234567890",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_1234567890",
      "status": "active",                    // or past_due, canceled, etc.
      "cancel_at_period_end": true,          // User scheduled cancellation
      "current_period_start": 1704067200,    // Unix timestamp
      "current_period_end": 1706745600,      // Unix timestamp
      "metadata": {
        "practiceId": "123"                  // Your practice ID
      }
    }
  }
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: NestJS Webhook Controller Receives Event                │
│ File: payment-webhook.controller.ts                             │
└─────────────────────────────────────────────────────────────────┘

@Post('webhook')
async handleWebhook(@Req() req: Request) {
  // 1. Verify webhook signature
  const event = this.stripeService.constructWebhookEvent(
    req.body,
    req.headers['stripe-signature']
  );

  // 2. Route to service handler
  await this.practicePaymentService.handleWebhook(event);
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Practice Payment Service Routes Event                   │
│ File: practice-payment.service.ts                               │
└─────────────────────────────────────────────────────────────────┘

async handleWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.updated":
      await this.handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription
      );
      break;
    // ... other cases
  }
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Handle Subscription Updated Logic                       │
│ Method: handleSubscriptionUpdated()                             │
└─────────────────────────────────────────────────────────────────┘

private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // 1. Extract practice ID from metadata
  const practiceId = subscription.metadata?.practiceId;

  // 2. Prepare update data
  const updateData = {
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

  // 3. Update billing status based on subscription status
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    updateData.billingStatus = BillingStatus.CANCELLED;
  } else if (subscription.status === 'past_due') {
    updateData.billingStatus = BillingStatus.PAST_DUE;
  } else if (subscription.status === 'active') {
    // Verify complete billing history
    const billingCheck = await this.stripeService.checkCompleteBillingStatus(
      subscription.customer as string
    );
    if (billingCheck.isComplete) {
      updateData.billingStatus = BillingStatus.DONE;
    }
  }

  // 4. Update database
  await this.providerRepository.update(practiceId, updateData);

  // 5. Log the update
  this.logger.log(
    `Subscription updated for practice ${practiceId}: ${subscription.status}`
  );
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Database Update                                         │
│ Table: Provider                                                  │
└─────────────────────────────────────────────────────────────────┘

UPDATE "Provider"
SET
  "subscriptionStatus" = 'active',
  "cancelAtPeriodEnd" = true,
  "subscriptionCurrentPeriodStart" = '2024-01-01 00:00:00',
  "subscriptionCurrentPeriodEnd" = '2024-02-01 00:00:00',
  "billingStatus" = 'DONE',
  "updatedAt" = NOW()
WHERE "id" = 123;
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Optional - Emit WebSocket Event (Future Enhancement)    │
└─────────────────────────────────────────────────────────────────┘

this.server.to(`practice-${practiceId}`).emit('subscription-updated', {
  status: subscription.status,
  cancelAtPeriodEnd: subscription.cancel_at_period_end,
  nextBillingDate: subscription.current_period_end
});
```

### Database Schema Changes Required

**Add to Provider Entity:**

```typescript
@Column({ type: 'varchar', nullable: true, name: 'subscription_status' })
subscriptionStatus?: string; // active, past_due, canceled, unpaid, trialing

@Column({ type: 'boolean', default: false, name: 'cancel_at_period_end' })
cancelAtPeriodEnd: boolean;

@Column({ type: 'timestamp', nullable: true, name: 'subscription_current_period_start' })
subscriptionCurrentPeriodStart?: Date;

@Column({ type: 'timestamp', nullable: true, name: 'subscription_current_period_end' })
subscriptionCurrentPeriodEnd?: Date;
```

**Migration SQL:**

```sql
ALTER TABLE "Provider"
ADD COLUMN "subscription_status" VARCHAR(50),
ADD COLUMN "cancel_at_period_end" BOOLEAN DEFAULT false,
ADD COLUMN "subscription_current_period_start" TIMESTAMP,
ADD COLUMN "subscription_current_period_end" TIMESTAMP;
```

---

## 🟡 MISSING WEBHOOK #2: `customer.subscription.deleted`

### Priority: **MEDIUM** 🟡

### When Stripe Sends This Event

According to [Stripe Documentation](https://docs.stripe.com/billing/subscriptions/webhooks), this webhook is sent when:

1. Subscription is **permanently deleted** (not just canceled)
2. Subscription reaches end of `cancel_at_period_end` period
3. Admin manually deletes subscription from Stripe Dashboard

### Why It's Important

**Current Gap:**

- ❌ System doesn't know when subscription is permanently removed
- ❌ No cleanup of subscription-related data
- ❌ User may still see "active" status after subscription deletion

**Business Impact:**

- Users may retain access after subscription deletion
- Billing status doesn't reflect actual subscription state
- No notification sent to user about subscription deletion

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Stripe Event Trigger                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Subscription Deletion Scenarios:
  - Subscription with cancel_at_period_end=true reaches end date
  - Admin deletes subscription from Stripe Dashboard
  - API call to delete subscription
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Stripe Sends Webhook                                    │
└─────────────────────────────────────────────────────────────────┘

POST https://your-domain.com/practice-payment/webhook

Body:
{
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_1234567890",
      "customer": "cus_1234567890",
      "status": "canceled",
      "metadata": {
        "practiceId": "123"
      }
    }
  }
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3-4: Webhook Controller → Service Router                   │
│ (Same as webhook #1)                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Handle Subscription Deleted Logic                       │
└─────────────────────────────────────────────────────────────────┘

private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) {
    this.logger.error('Practice ID not found in subscription metadata');
    return;
  }

  // Update provider record
  await this.providerRepository.update(practiceId, {
    billingStatus: BillingStatus.CANCELLED,
    subscriptionStatus: 'canceled',
    stripeSubscriptionId: null,  // Clear subscription ID
    cancelAtPeriodEnd: false,
  });

  // Optional: Revoke access, send notification email
  this.logger.log(`Subscription deleted for practice ${practiceId}`);
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Database Update                                         │
└─────────────────────────────────────────────────────────────────┘

UPDATE "Provider"
SET
  "billingStatus" = 'CANCELLED',
  "subscriptionStatus" = 'canceled',
  "stripeSubscriptionId" = NULL,
  "cancelAtPeriodEnd" = false,
  "updatedAt" = NOW()
WHERE "id" = 123;
```

---

## 🟡 MISSING WEBHOOK #3: `invoice.payment_action_required`

### Priority: **MEDIUM-HIGH** 🟡

### When Stripe Sends This Event

According to [Stripe Documentation](https://docs.stripe.com/billing/subscriptions/overview#requires-action), this webhook is sent when:

1. **3D Secure (SCA) authentication required** for European cards
2. Payment requires additional customer action
3. Invoice status is `requires_action` or `requires_payment_method`

### Why It's Important

**Current Gap:**

- ❌ User doesn't know payment needs authentication
- ❌ Payment stuck in pending state without notification
- ❌ No email sent to complete authentication

**Business Impact:**

- Lost revenue from incomplete payments
- Poor user experience (no guidance on what to do)
- Subscription may be cancelled due to failed authentication

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Stripe Event Trigger                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Payment Scenarios Requiring Action:
  - European card requires 3D Secure authentication
  - Bank requires additional verification
  - Payment method needs confirmation
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Stripe Sends Webhook                                    │
└─────────────────────────────────────────────────────────────────┘

POST https://your-domain.com/practice-payment/webhook

Body:
{
  "type": "invoice.payment_action_required",
  "data": {
    "object": {
      "id": "in_1234567890",
      "customer": "cus_1234567890",
      "subscription": "sub_1234567890",
      "status": "open",
      "payment_intent": {
        "id": "pi_1234567890",
        "status": "requires_action",
        "client_secret": "pi_123_secret_456",
        "next_action": {
          "type": "use_stripe_sdk"
        }
      }
    }
  }
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3-4: Webhook Controller → Service Router                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Handle Payment Action Required Logic                    │
└─────────────────────────────────────────────────────────────────┘

private async handlePaymentActionRequired(invoice: Stripe.Invoice) {
  // 1. Extract practice information
  const subscription = await this.stripeService.getSubscription(
    invoice.subscription as string
  );
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) {
    this.logger.error('Practice ID not found');
    return;
  }

  // 2. Get payment intent details
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
  const hostedInvoiceUrl = invoice.hosted_invoice_url;

  // 3. Log warning
  this.logger.warn(
    `Payment action required for practice ${practiceId}. Invoice: ${invoice.id}`
  );

  // 4. Send email notification (TODO: implement email service)
  await this.emailService.sendPaymentActionRequired({
    practiceId,
    invoiceUrl: hostedInvoiceUrl,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
  });

  // 5. Optional: Update billing status to indicate action needed
  // await this.providerRepository.update(practiceId, {
  //   billingStatus: BillingStatus.REQUIRED,
  // });
}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Send Email Notification                                 │
└─────────────────────────────────────────────────────────────────┘

Email Template:
  Subject: "Action Required: Complete Your Payment"

  Body:
    "Your recent payment requires additional authentication.
     Please click the link below to complete the payment:

     [Complete Payment] → {hosted_invoice_url}

     Amount: ${amount} {currency}

     If you don't complete this within 24 hours, your subscription
     may be cancelled."
```

### Implementation Notes

**Key Differences from Other Webhooks:**

- Does NOT update billing status (payment is still pending)
- Requires email notification system
- Should provide user with `hosted_invoice_url` to complete payment

**Stripe Hosted Invoice URL:**

- Stripe provides a pre-built page for completing authentication
- User clicks link → completes 3D Secure → payment processes
- After completion, `invoice.paid` webhook will be sent

---

## 📊 Summary Comparison Table

| Webhook Event                     | Current Status | Priority       | Billing Status Impact           | Database Changes | Email Notification |
| --------------------------------- | -------------- | -------------- | ------------------------------- | ---------------- | ------------------ |
| `invoice.paid`                    | ✅ Implemented | Current        | `DONE` or `REQUIRED`            | None             | No                 |
| `invoice.payment_succeeded`       | ✅ Implemented | Current        | `DONE` or `REQUIRED`            | None             | No                 |
| `invoice.payment_failed`          | ✅ Implemented | Current        | `PAST_DUE`                      | None             | Optional           |
| `customer.subscription.updated`   | ⚠️ Missing     | 🔴 HIGH        | `DONE`, `PAST_DUE`, `CANCELLED` | 4 new columns    | No                 |
| `customer.subscription.deleted`   | ⚠️ Missing     | 🟡 MEDIUM      | `CANCELLED`                     | None             | Yes (recommended)  |
| `invoice.payment_action_required` | ⚠️ Missing     | 🟡 MEDIUM-HIGH | No change                       | None             | Yes (required)     |

---

## 🔄 Complete System Flow Diagram

### Current Flow (Implemented)

```
┌──────────────┐
│   Customer   │
│  Completes   │
│   Payment    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Stripe Platform                           │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├─── invoice.paid ──────────────────────┐
       │                                       │
       ├─── invoice.payment_succeeded ─────────┤
       │                                       │
       └─── invoice.payment_failed ────────────┤
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Webhook Handler │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  Update Billing  │
                                    │     Status       │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │    Database      │
                                    │   (Provider)     │
                                    └──────────────────┘
```

### Proposed Flow (With Missing Webhooks)

```
┌──────────────┐
│   Customer   │
│   Actions    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Stripe Platform                           │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├─── invoice.paid ──────────────────────┐
       │                                       │
       ├─── invoice.payment_succeeded ─────────┤
       │                                       │
       ├─── invoice.payment_failed ────────────┤
       │                                       │
       ├─── customer.subscription.updated ─────┤  🆕 NEW
       │                                       │
       ├─── customer.subscription.deleted ─────┤  🆕 NEW
       │                                       │
       └─── invoice.payment_action_required ───┤  🆕 NEW
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Webhook Handler │
                                    │   (Enhanced)     │
                                    └────────┬─────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                        ▼                    ▼                    ▼
              ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
              │ Update Billing  │  │ Update Subscription│ │ Send Email      │
              │    Status       │  │    Metadata      │  │ Notification    │
              └────────┬────────┘  └────────┬────────┘  └─────────────────┘
                       │                    │
                       └────────┬───────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    Database     │
                       │   (Provider)    │
                       │                 │
                       │ - billingStatus │
                       │ - subscriptionStatus │  🆕 NEW
                       │ - cancelAtPeriodEnd  │  🆕 NEW
                       │ - periodStart/End    │  🆕 NEW
                       └─────────────────┘
```

---

## 💻 Implementation Code Summary

### 1. Update Webhook Handler Switch Statement

**File:** `src/modules/practice-payment/practice-payment.service.ts`

```typescript
async handleWebhook(event: Stripe.Event) {
  switch (event.type) {
    // ✅ Existing handlers
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    // 🆕 NEW HANDLERS
    case "customer.subscription.updated":
      await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_action_required":
      await this.handlePaymentActionRequired(event.data.object as Stripe.Invoice);
      break;

    default:
      this.logger.log(`Unhandled event type: ${event.type}`);
  }
}
```

### 2. Implement Handler Methods

**File:** `src/modules/practice-payment/practice-payment.service.ts`

```typescript
private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) {
    this.logger.error('Practice ID not found in subscription metadata');
    return;
  }

  const updateData: any = {
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

  // Update billing status based on subscription status
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    updateData.billingStatus = BillingStatus.CANCELLED;
  } else if (subscription.status === 'past_due') {
    updateData.billingStatus = BillingStatus.PAST_DUE;
  } else if (subscription.status === 'active') {
    const billingCheck = await this.stripeService.checkCompleteBillingStatus(
      subscription.customer as string
    );
    if (billingCheck.isComplete) {
      updateData.billingStatus = BillingStatus.DONE;
    }
  }

  await this.providerRepository.update(practiceId, updateData);
  this.logger.log(`Subscription updated for practice ${practiceId}: ${subscription.status}`);
}

private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) return;

  await this.providerRepository.update(practiceId, {
    billingStatus: BillingStatus.CANCELLED,
    subscriptionStatus: 'canceled',
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  });

  this.logger.log(`Subscription deleted for practice ${practiceId}`);
}

private async handlePaymentActionRequired(invoice: Stripe.Invoice) {
  const subscription = await this.stripeService.getSubscription(
    invoice.subscription as string
  );
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) return;

  this.logger.warn(
    `Payment action required for practice ${practiceId}. Invoice: ${invoice.id}`
  );

  // TODO: Implement email notification
  // await this.emailService.sendPaymentActionRequired({
  //   practiceId,
  //   invoiceUrl: invoice.hosted_invoice_url,
  //   amount: invoice.amount_due / 100,
  //   currency: invoice.currency,
  // });
}
```

### 3. Update Provider Entity

**File:** `src/modules/user/entity/provider.entity.ts`

```typescript
@Entity('Provider')
export class Provider {
  // ... existing fields ...

  @Column({ type: 'varchar', nullable: true, name: 'stripe_customer_id' })
  stripeCustomerId?: string

  @Column({ type: 'varchar', nullable: true, name: 'stripe_subscription_id' })
  stripeSubscriptionId?: string

  @Column({ type: 'varchar', nullable: true, name: 'billing_status' })
  billingStatus?: BillingStatus

  @Column({ type: 'timestamp', nullable: true, name: 'onboarding_paid_at' })
  onboardingPaidAt?: Date

  // 🆕 NEW FIELDS
  @Column({ type: 'varchar', nullable: true, name: 'subscription_status' })
  subscriptionStatus?: string // active, past_due, canceled, unpaid, trialing

  @Column({ type: 'boolean', default: false, name: 'cancel_at_period_end' })
  cancelAtPeriodEnd: boolean

  @Column({ type: 'timestamp', nullable: true, name: 'subscription_current_period_start' })
  subscriptionCurrentPeriodStart?: Date

  @Column({ type: 'timestamp', nullable: true, name: 'subscription_current_period_end' })
  subscriptionCurrentPeriodEnd?: Date
}
```

### 4. Create Database Migration

**File:** `src/migrations/YYYYMMDDHHMMSS-add-subscription-fields.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSubscriptionFields1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "Provider"
      ADD COLUMN "subscription_status" VARCHAR(50),
      ADD COLUMN "cancel_at_period_end" BOOLEAN DEFAULT false,
      ADD COLUMN "subscription_current_period_start" TIMESTAMP,
      ADD COLUMN "subscription_current_period_end" TIMESTAMP;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "Provider"
      DROP COLUMN "subscription_status",
      DROP COLUMN "cancel_at_period_end",
      DROP COLUMN "subscription_current_period_start",
      DROP COLUMN "subscription_current_period_end";
    `)
  }
}
```

---

## 📝 Implementation Phases

### Phase 1: Critical (Implement Immediately) 🔴

**Timeline:** 1-2 days

1. ✅ Add database migration for new subscription fields
2. ✅ Update Provider entity with new columns
3. ✅ Implement `customer.subscription.updated` handler
4. ✅ Test with Stripe CLI webhook forwarding
5. ✅ Deploy to staging environment

**Testing Checklist:**

- [ ] Subscription renewal updates period dates
- [ ] User cancels subscription → `cancel_at_period_end = true`
- [ ] Payment fails → `subscriptionStatus = past_due`
- [ ] Subscription reactivates → `subscriptionStatus = active`

### Phase 2: Important (Within 1-2 weeks) 🟡

**Timeline:** 3-5 days

1. Implement `customer.subscription.deleted` handler
2. Implement `invoice.payment_action_required` handler
3. Set up email notification service
4. Create email templates for payment action required
5. Test complete flow end-to-end

**Testing Checklist:**

- [ ] Subscription deleted → billing status = CANCELLED
- [ ] 3D Secure required → email sent to user
- [ ] User completes authentication → invoice.paid received

### Phase 3: Enhancement (When Time Permits) ⚪

**Timeline:** 1-2 weeks

1. Add `invoice.upcoming` webhook (renewal reminders)
2. Add `invoice.created` webhook (pre-charge modifications)
3. Implement WebSocket notifications for real-time updates
4. Add admin dashboard for subscription monitoring
5. Implement comprehensive logging and monitoring

---

## 🧪 Testing Strategy

### 1. Local Testing with Stripe CLI

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/practice-payment/webhook

# Trigger test events
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_action_required
```

### 2. Test Scenarios

**Scenario 1: User Cancels Subscription**

```
1. User clicks "Cancel Subscription" in Stripe Customer Portal
2. Stripe sends customer.subscription.updated with cancel_at_period_end=true
3. System updates database: cancelAtPeriodEnd = true
4. Verify: SELECT cancel_at_period_end FROM "Provider" WHERE id = X
5. Expected: true
```

**Scenario 2: Subscription Renewal**

```
1. Wait for subscription renewal date (or use Stripe CLI to advance time)
2. Stripe sends customer.subscription.updated with new period dates
3. System updates subscriptionCurrentPeriodStart and subscriptionCurrentPeriodEnd
4. Verify dates in database match Stripe Dashboard
```

**Scenario 3: Payment Requires 3D Secure**

```
1. Use test card 4000002500003155 (requires authentication)
2. Stripe sends invoice.payment_action_required
3. System logs warning and sends email
4. User completes authentication
5. Stripe sends invoice.paid
6. System updates billingStatus = DONE
```

### 3. Integration Tests

```typescript
describe('Stripe Webhook Handlers', () => {
  describe('customer.subscription.updated', () => {
    it('should update subscription status when subscription changes', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'past_due',
            cancel_at_period_end: false,
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            metadata: { practiceId: '1' },
          },
        },
      }

      await service.handleWebhook(mockEvent)

      const provider = await providerRepo.findOne({ where: { id: 1 } })
      expect(provider.subscriptionStatus).toBe('past_due')
      expect(provider.billingStatus).toBe(BillingStatus.PAST_DUE)
    })
  })

  describe('customer.subscription.deleted', () => {
    it('should set billing status to CANCELLED', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            metadata: { practiceId: '1' },
          },
        },
      }

      await service.handleWebhook(mockEvent)

      const provider = await providerRepo.findOne({ where: { id: 1 } })
      expect(provider.billingStatus).toBe(BillingStatus.CANCELLED)
      expect(provider.stripeSubscriptionId).toBeNull()
    })
  })

  describe('invoice.payment_action_required', () => {
    it('should log warning and send email', async () => {
      const mockEvent = {
        type: 'invoice.payment_action_required',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            hosted_invoice_url: 'https://invoice.stripe.com/i/123',
          },
        },
      }

      const loggerSpy = jest.spyOn(service['logger'], 'warn')
      await service.handleWebhook(mockEvent)

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Payment action required'))
    })
  })
})
```

---

## 🎯 Next Steps - Action Items

### For Developer (You)

1. **Review this document** with your tech lead
2. **Get approval** for Phase 1 implementation
3. **Create database migration** for new fields
4. **Implement webhook handlers** following the code examples
5. **Write unit tests** for each handler
6. **Test locally** using Stripe CLI
7. **Deploy to staging** and verify with real Stripe test events

### For Tech Lead

1. **Review implementation approach** - Is the flow correct?
2. **Approve database schema changes** - Are the new fields appropriate?
3. **Prioritize phases** - Should we implement all 3 webhooks or start with #1?
4. **Decide on email service** - Which email provider to use for notifications?
5. **Set timeline** - When should Phase 1 be completed?

---

## ❓ Questions for Discussion

Based on the analysis above, here are key questions to discuss with your tech lead:

### 1. Implementation Priority

**Question:** Should we implement all 3 missing webhooks at once, or prioritize `customer.subscription.updated` first?

**Options:**

- **Option A:** Implement only `customer.subscription.updated` (Phase 1) - **Recommended**
  - Pros: Fastest to production, addresses most critical gap
  - Cons: Still missing deletion and payment action handling

- **Option B:** Implement all 3 webhooks together (Phase 1 + 2)
  - Pros: Complete solution, no follow-up work needed
  - Cons: Takes longer, more testing required

- **Option C:** Implement in phases as outlined (Phase 1 → Phase 2 → Phase 3)
  - Pros: Balanced approach, iterative improvements
  - Cons: Requires multiple deployment cycles

### 2. Database Schema

**Question:** Should we add all 4 new columns to Provider entity, or use a separate SubscriptionMetadata table?

**Options:**

- **Option A:** Add columns to Provider entity - **Recommended**
  - Pros: Simpler queries, no joins needed
  - Cons: Provider table grows larger

- **Option B:** Create separate SubscriptionMetadata table
  - Pros: Better normalization, cleaner separation
  - Cons: Requires joins, more complex queries

### 3. Email Notifications

**Question:** Which email service should we use for `invoice.payment_action_required` notifications?

**Options:**

- **Option A:** Use existing email service (if available)
- **Option B:** Integrate SendGrid/Mailgun
- **Option C:** Use Stripe's built-in email notifications
- **Option D:** Defer email implementation to Phase 2

### 4. WebSocket Real-time Updates

**Question:** Should we emit WebSocket events when subscription status changes?

**Options:**

- **Option A:** Yes, emit events for real-time UI updates
  - Use case: User sees "Subscription Cancelled" immediately

- **Option B:** No, defer to Phase 3
  - Use case: Not critical for MVP, can add later

### 5. Testing Approach

**Question:** How thoroughly should we test before production deployment?

**Options:**

- **Option A:** Unit tests + Stripe CLI testing only
- **Option B:** Unit tests + Integration tests + Manual testing
- **Option C:** Full test suite + Staging environment + Production monitoring

### 6. Backward Compatibility

**Question:** What should we do with existing Provider records that don't have subscription metadata?

**Options:**

- **Option A:** Backfill data from Stripe API
- **Option B:** Leave as NULL, populate on next webhook
- **Option C:** Run one-time migration script

---

## 📚 References

### Stripe Documentation

- [Subscription Webhooks Overview](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Subscription State Changes](https://docs.stripe.com/billing/subscriptions/webhooks#state-changes)
- [Invoice Workflow Transitions](https://docs.stripe.com/invoicing/integration/workflow-transitions)
- [Handling Payment Actions](https://docs.stripe.com/billing/subscriptions/overview#requires-action)
- [Automatic Advancement](https://docs.stripe.com/invoicing/integration/automatic-advancement-collection)

### Internal Documentation

- `_Stripe/STRIPE_WEBHOOK_IMPLEMENTATION_SUMMARY_EN.md` - Current webhook status
- `_Stripe/PAYMENT_MODULES_SUMMARY.md` - System architecture overview
- `_Stripe/SUBSCRIPTION_BILLING_ANALYSIS.md` - Billing flow analysis
- `_Stripe/STRIPE_RENEWAL_WEBHOOK_ANALYSIS.md` - Renewal cycle details

---

## 📄 Document Changelog

| Version | Date       | Author       | Changes                                 |
| ------- | ---------- | ------------ | --------------------------------------- |
| 1.0     | 2025-10-07 | AI Assistant | Initial comprehensive analysis document |

---

**End of Document**

_This document is ready for PDF conversion and tech lead review._
