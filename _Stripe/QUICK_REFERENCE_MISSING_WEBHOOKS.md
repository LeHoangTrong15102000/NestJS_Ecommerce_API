# Quick Reference: Missing Stripe Webhooks

**Last Updated:** 2025-10-07  
**Status:** Ready for Implementation

---

## 📋 Summary

Your system currently handles **3 webhook events** but is **missing 3 critical webhooks** that are essential for proper subscription management.

### Current Status

| Status | Count | Webhooks |
|--------|-------|----------|
| ✅ Implemented | 3 | `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed` |
| ⚠️ Missing | 3 | `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_action_required` |

---

## 🔴 Missing Webhook #1: `customer.subscription.updated` (HIGH PRIORITY)

### What It Does
Tracks subscription lifecycle changes: active → past_due → canceled, renewal dates, cancellation schedules.

### Why Critical
- ❌ Can't detect when user schedules cancellation
- ❌ No visibility into next billing cycle
- ❌ Billing status may be out of sync

### Database Changes Required
```sql
ALTER TABLE "Provider" 
ADD COLUMN "subscription_status" VARCHAR(50),
ADD COLUMN "cancel_at_period_end" BOOLEAN DEFAULT false,
ADD COLUMN "subscription_current_period_start" TIMESTAMP,
ADD COLUMN "subscription_current_period_end" TIMESTAMP;
```

### Implementation Code
```typescript
case "customer.subscription.updated":
  await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
  break;

private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const practiceId = subscription.metadata?.practiceId;
  if (!practiceId) return;

  const updateData: any = {
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

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
}
```

---

## 🟡 Missing Webhook #2: `customer.subscription.deleted` (MEDIUM PRIORITY)

### What It Does
Handles permanent subscription deletion (not just cancellation).

### Why Important
- ❌ User may retain access after deletion
- ❌ No cleanup of subscription data

### Implementation Code
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
    cancelAtPeriodEnd: false,
  });
}
```

---

## 🟡 Missing Webhook #3: `invoice.payment_action_required` (MEDIUM-HIGH PRIORITY)

### What It Does
Notifies when payment requires 3D Secure authentication or additional action.

### Why Important
- ❌ User doesn't know payment needs authentication
- ❌ Lost revenue from incomplete payments

### Implementation Code
```typescript
case "invoice.payment_action_required":
  await this.handlePaymentActionRequired(event.data.object as Stripe.Invoice);
  break;

private async handlePaymentActionRequired(invoice: Stripe.Invoice) {
  const subscription = await this.stripeService.getSubscription(
    invoice.subscription as string
  );
  const practiceId = subscription.metadata?.practiceId;
  if (!practiceId) return;

  this.logger.warn(
    `Payment action required for practice ${practiceId}. Invoice: ${invoice.id}`
  );

  // TODO: Send email with invoice.hosted_invoice_url
  // await this.emailService.sendPaymentActionRequired({
  //   practiceId,
  //   invoiceUrl: invoice.hosted_invoice_url,
  //   amount: invoice.amount_due / 100,
  //   currency: invoice.currency,
  // });
}
```

---

## 🚀 Implementation Checklist

### Phase 1: Critical (1-2 days) 🔴

- [ ] Create database migration for 4 new columns
- [ ] Update Provider entity with new fields
- [ ] Add `customer.subscription.updated` case to switch statement
- [ ] Implement `handleSubscriptionUpdated()` method
- [ ] Test with Stripe CLI: `stripe trigger customer.subscription.updated`
- [ ] Deploy to staging

### Phase 2: Important (3-5 days) 🟡

- [ ] Add `customer.subscription.deleted` case to switch statement
- [ ] Implement `handleSubscriptionDeleted()` method
- [ ] Add `invoice.payment_action_required` case to switch statement
- [ ] Implement `handlePaymentActionRequired()` method
- [ ] Set up email notification service
- [ ] Test all 3 new webhooks end-to-end
- [ ] Deploy to production

---

## 🧪 Testing Commands

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

---

## 📁 Files to Modify

1. **`src/modules/practice-payment/practice-payment.service.ts`**
   - Add 3 new cases to `handleWebhook()` switch statement
   - Add 3 new handler methods

2. **`src/modules/user/entity/provider.entity.ts`**
   - Add 4 new columns

3. **`src/migrations/YYYYMMDDHHMMSS-add-subscription-fields.ts`**
   - Create new migration file

---

## 📊 Expected Database Schema After Implementation

```typescript
@Entity('Provider')
export class Provider {
  // Existing fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: BillingStatus;
  onboardingPaidAt?: Date;

  // 🆕 NEW FIELDS
  subscriptionStatus?: string;              // active, past_due, canceled, unpaid
  cancelAtPeriodEnd: boolean;               // User scheduled cancellation?
  subscriptionCurrentPeriodStart?: Date;    // Current billing cycle start
  subscriptionCurrentPeriodEnd?: Date;      // Current billing cycle end (next renewal)
}
```

---

## ❓ Key Questions for Tech Lead

1. **Priority:** Implement all 3 webhooks at once, or start with `customer.subscription.updated` only?
2. **Database:** Add columns to Provider entity, or create separate SubscriptionMetadata table?
3. **Email:** Which email service for `invoice.payment_action_required` notifications?
4. **Testing:** How thorough should testing be before production?
5. **Backfill:** Should we backfill existing Provider records with data from Stripe API?

---

## 📚 Full Documentation

For complete analysis with detailed flow diagrams, see:
- **`MISSING_WEBHOOKS_COMPLETE_FLOW_ANALYSIS.md`** - Comprehensive 1100+ line document

---

## 🎯 Success Criteria

After implementation, the system should:

✅ Track subscription status changes in real-time  
✅ Know when user schedules cancellation (`cancel_at_period_end = true`)  
✅ Display next billing date to users  
✅ Handle subscription deletions properly  
✅ Notify users when payment requires authentication  
✅ Maintain billing status in sync with Stripe  

---

**Ready to implement?** Start with Phase 1 (database migration + `customer.subscription.updated` handler).

