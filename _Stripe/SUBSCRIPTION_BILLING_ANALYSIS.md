# Subscription Billing to Next Cycle - Analysis Report

## Overview
This document analyzes how the current system handles subscription billing when it renews to the next cycle and how billing status is managed.

---

## Current Implementation

### 1. Webhook Events Monitored
**Location**: `src/modules/practice-payment/practice-payment.service.ts:182-194`

The system currently listens to these Stripe webhook events:

| Event | Action | Billing Status |
|-------|--------|----------------|
| `invoice.paid` | Updates billing status based on complete billing check | `DONE` or `REQUIRED` |
| `invoice.payment_succeeded` | Same as above | `DONE` or `REQUIRED` |
| `invoice.payment_failed` | Marks subscription as failed | `PAST_DUE` |

### 2. When Invoice is Paid (Next Cycle Payment)
**Location**: `src/modules/practice-payment/practice-payment.service.ts:205-275`

**Flow**:
1. Receives `invoice.paid` webhook from Stripe
2. Extracts `practiceId` and `stripeCustomerId` from invoice metadata
3. Calls `checkCompleteBillingStatus(stripeCustomerId)` to verify payment history
4. Updates billing status:
   - If `isComplete` (both onboarding + subscription receipts exist) → `BillingStatus.DONE`
   - Otherwise → `BillingStatus.REQUIRED`

**Code Reference**:
```typescript
const billingStatus = await this.stripeService.checkCompleteBillingStatus(stripeCustomerId);

let newBillingStatus = BillingStatus.REQUIRED; // Default

if (billingStatus.isComplete) {
  newBillingStatus = BillingStatus.DONE;
}

await this.providerRepository.update(practiceId, {
  billingStatus: newBillingStatus,
});
```

### 3. Complete Billing Status Check
**Location**: `src/services/stripe-integration/stripe-integration.service.ts:365-423`

**Logic**:
- Retrieves all paid invoices for the customer
- Checks for onboarding fee receipt (one-time payment)
- Checks for subscription receipts (recurring payments)
- Returns:
  - `hasOnboardingReceipt: boolean`
  - `hasSubscriptionReceipt: boolean`
  - `isComplete: boolean` (both onboarding AND subscription paid)

### 4. When Invoice Payment Fails
**Location**: `src/modules/practice-payment/practice-payment.service.ts:277-293`

**Flow**:
1. Receives `invoice.payment_failed` webhook
2. Extracts practice information
3. Sets `billingStatus` to `BillingStatus.PAST_DUE`

**Code Reference**:
```typescript
const { practiceId, billingStatus } =
  await this.stripeService.handleInvoicePaymentFailed(invoice);

await this.providerRepository.update(practiceId, {
  billingStatus, // PAST_DUE
});
```

### 5. Billing Status Enum
**Location**: `src/shared/enums/billing-status.enum.ts`

```typescript
export enum BillingStatus {
  REQUIRED = "REQUIRED",    // Payment needed
  DONE = "DONE",           // Payment complete
  PAST_DUE = "PAST_DUE",   // Payment failed
  INACTIVE = "INACTIVE",   // Not currently used
  CANCELLED = "CANCELLED", // Not currently used
}
```

---

## Current Behavior for Next Cycle Renewal

### ✅ What Works:
1. **Automatic Renewal Detection**: Stripe auto-generates invoices for subscription renewals
2. **Payment Success Handling**: `invoice.paid` webhook is triggered → billing status updates to `DONE`
3. **Payment Failure Handling**: `invoice.payment_failed` webhook is triggered → billing status updates to `PAST_DUE`
4. **Customer History**: System can retrieve full payment history (receipts, payment methods, subscriptions)

### ⚠️ Current Gaps:

#### 1. **No Subscription Status Tracking**
The system doesn't listen to `customer.subscription.updated` webhook, which means:
- ❌ Can't detect when subscription status changes (active → past_due → canceled → unpaid)
- ❌ Can't detect cancellation requests (`cancel_at_period_end = true`)
- ❌ Can't track trial periods
- ❌ Can't detect plan changes or upgrades/downgrades

#### 2. **No Subscription Cycle Metadata**
The Provider entity doesn't store:
- ❌ `current_period_start` - When current billing cycle started
- ❌ `current_period_end` - When current billing cycle ends
- ❌ `cancel_at_period_end` - Whether subscription will cancel at cycle end
- ❌ `subscription_status` - Current Stripe subscription status

#### 3. **Limited Status Granularity**
Current statuses (`INACTIVE`, `CANCELLED`) are defined but not used in webhook handlers.

#### 4. **No Proactive Renewal Tracking**
Can't answer questions like:
- "When does this subscription renew?"
- "Is this subscription set to cancel at the end of the period?"
- "What's the subscription status in Stripe?"

---

## Recommendations

### Priority 1: Add Subscription Status Webhook Handler

**Add handler for**: `customer.subscription.updated`

**Location**: Add to `practice-payment.service.ts:182-198`

```typescript
switch (event.type) {
  case "invoice.paid":
  case "invoice.payment_succeeded":
    await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
    break;

  case "invoice.payment_failed":
    await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    break;

  // NEW HANDLER
  case "customer.subscription.updated":
    await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    break;

  default:
    this.logger.log(`Unhandled event type: ${event.type}`);
}
```

### Priority 2: Add Subscription Metadata to Provider Entity

**Add these fields to Provider entity**:

```typescript
@Column({ type: 'timestamp', nullable: true })
subscriptionCurrentPeriodStart: Date;

@Column({ type: 'timestamp', nullable: true })
subscriptionCurrentPeriodEnd: Date;

@Column({ type: 'varchar', nullable: true })
subscriptionStatus: string; // active, past_due, canceled, unpaid, etc.

@Column({ type: 'boolean', default: false })
cancelAtPeriodEnd: boolean;
```

### Priority 3: Implement `handleSubscriptionUpdated` Method

```typescript
private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;

  if (!practiceId) {
    this.logger.error('Practice ID not found in subscription metadata');
    return;
  }

  const updateData = {
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  // Update billing status based on subscription status
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    updateData.billingStatus = BillingStatus.CANCELLED;
  } else if (subscription.status === 'past_due') {
    updateData.billingStatus = BillingStatus.PAST_DUE;
  } else if (subscription.status === 'active') {
    updateData.billingStatus = BillingStatus.DONE;
  }

  await this.providerRepository.update(practiceId, updateData);

  this.logger.log(`Updated subscription metadata for practice ${practiceId}`);
}
```

### Priority 4: Update Existing Webhook Handlers

**In `handleInvoicePaid`**: Also update subscription cycle metadata when payment succeeds
**In `handleInvoicePaymentFailed`**: Sync subscription status from Stripe

---

## Benefits of Implementation

After implementing these recommendations:

✅ **Real-time subscription tracking** - Know exact subscription status at all times
✅ **Proactive cancellation handling** - Detect when users schedule cancellations
✅ **Better customer support** - Answer "when does my subscription renew?" questions
✅ **Accurate billing status** - More granular than just DONE/PAST_DUE
✅ **Trial period support** - Ready if you add trials in the future
✅ **Plan change tracking** - Detect upgrades/downgrades automatically

---

## Summary Answer to Tech Lead

### Question 1: Does it send to webhook when next subscription or not?

**YES** ✅

When a subscription renews to the next billing cycle, Stripe **automatically sends webhooks**:

1. **`invoice.created`** - Stripe creates a new invoice for the next cycle (NOT currently handled)
2. **`invoice.finalized`** - Invoice is finalized and ready for payment (NOT currently handled)
3. **`invoice.paid`** or **`invoice.payment_succeeded`** - Payment succeeds ✅ **HANDLED**
4. **`invoice.payment_failed`** - Payment fails ✅ **HANDLED**

**Your system currently only handles `invoice.paid` and `invoice.payment_failed`.**

---

### Question 2: If yes, what is the billing status it sends?

**Stripe doesn't send a "billing status" - your system DETERMINES the billing status based on the webhook event.**

Here's what happens in your code:

| Webhook Event Received | What Your System Does | Billing Status Set |
|------------------------|----------------------|-------------------|
| `invoice.paid` (successful payment) | Calls `checkCompleteBillingStatus()` to verify both onboarding + subscription are paid | `DONE` (if both paid) or `REQUIRED` (if incomplete) |
| `invoice.payment_failed` | Marks subscription as failed | `PAST_DUE` |

**Location**: `practice-payment.service.ts:248-266`

---

### Question 3: What is the event handler when the webhook sends that status to me?

**The event handler is: `handleInvoicePaid()`**

**Location**: `src/modules/practice-payment/practice-payment.service.ts:205-275`

**Flow for next subscription cycle renewal**:
```
1. Stripe sends webhook → invoice.paid
2. Webhook controller receives it → payment-webhook.controller.ts:37-68
3. Calls practicePaymentService.handleWebhook()
4. Routes to handleInvoicePaid() → Line 205
5. Retrieves practiceId from subscription metadata
6. Calls checkCompleteBillingStatus() to verify payment history
7. Sets billingStatus = DONE (if complete) or REQUIRED (if incomplete)
8. Updates Provider table in database
```

---

## How to Test Next Subscription Cycle on Stripe

### Prerequisites
- You're already in Stripe Test Mode (I can see from your screenshot)
- You have a test subscription created

### Method 1: Use Stripe CLI to Trigger Webhook (Fastest)

1. **Install Stripe CLI** (if not already):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server**:
   ```bash
   stripe listen --forward-to localhost:3000/practice-payment/webhook
   ```

4. **Trigger a test invoice payment**:
   ```bash
   # Find your subscription ID first
   stripe subscriptions list --limit 1

   # Trigger invoice.paid event
   stripe trigger invoice.paid
   ```

### Method 2: Advance Subscription Clock (Recommended for Real Flow)

1. **Go to Stripe Dashboard → Developers → Events**

2. **Click "Create a test clock"** (or use existing one):
   - Create a new test customer with a test clock
   - This lets you fast-forward time

3. **Create subscription with test clock customer**:
   ```bash
   # In Stripe Dashboard, create subscription using the test clock customer
   ```

4. **Advance the clock**:
   - Go to test clock
   - Click "Advance time"
   - Set to 1 month later (or whatever your billing cycle is)
   - Stripe will automatically generate invoice and trigger webhooks

### Method 3: Manual Webhook Testing via Stripe Dashboard

1. **Go to**: `Developers → Webhooks → [Your Webhook Endpoint]`

2. **Click "Send test webhook"**

3. **Select event**: `invoice.paid`

4. **Customize the payload** with your test data:
   ```json
   {
     "data": {
       "object": {
         "id": "in_test_123",
         "customer": "cus_your_test_customer_id",
         "subscription": "sub_your_test_subscription_id",
         "status": "paid",
         "amount_paid": 5000,
         "lines": {
           "data": [
             {
               "pricing": {
                 "price_details": {
                   "price": "price_1S7GdR2aqqvjnb89AiV7aoT"
                 }
               }
             }
           ]
         }
       }
     }
   }
   ```

5. **Click "Send test webhook"**

6. **Check your logs** to see if webhook was received and processed

### Method 4: Create Test Subscription with Short Interval

1. **Create a special test price** (in Stripe Dashboard):
   - Go to Products → Add product
   - Set billing to "Daily" or "Weekly" (for faster testing)
   - Price: $1 (test amount)

2. **Create test subscription** with this price

3. **Wait for next cycle** (1 day or 1 week)

4. **Stripe will automatically charge and send `invoice.paid` webhook**

---

## Testing Checklist

When you test, verify these things:

```
✅ Webhook endpoint receives the event
✅ Signature validation passes
✅ practiceId is extracted correctly from subscription metadata
✅ checkCompleteBillingStatus() runs successfully
✅ billingStatus updates to DONE in database
✅ Logs show "Updated practice {id} billing status to DONE"
```

---

## Recommendation for Your Tech Lead

**Current Answer**:
- ✅ YES, Stripe sends webhooks for next subscription cycle
- ✅ Your system handles `invoice.paid` and sets billing to `DONE`
- ✅ Event handler is `handleInvoicePaid()` in `practice-payment.service.ts:205`

**However**, you should add:
- `customer.subscription.updated` webhook handler to track subscription lifecycle
- Store subscription cycle metadata (current_period_start/end) for better visibility
