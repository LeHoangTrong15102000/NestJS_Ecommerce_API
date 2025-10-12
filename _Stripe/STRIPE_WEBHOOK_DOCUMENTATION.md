# Missing Stripe Webhooks - Implementation Proposal

## 1. Context

The current Stripe integration relies on webhook events to synchronize subscription and payment data between Stripe and our platform. Based on analysis of the existing implementation and Stripe documentation, **5 critical webhook handlers are missing** that are essential for proper subscription lifecycle management.

Without these webhooks, the system cannot track important subscription state changes, leading to data inconsistency and potential revenue loss.

### Missing / Required Webhooks

- **`customer.subscription.updated`** (critical for tracking subscription status changes, renewal dates, and cancellation schedules)
- **`customer.subscription.deleted`** (to handle permanent subscription deletion)
- **`invoice.payment_action_required`** (to notify users when payment requires 3D Secure authentication)
- **`invoice.created`** (to apply discounts or credits before invoice finalization)
- **`invoice.finalized`** (for audit trail and logging before payment attempt)

---

## 2. Current Implementation Status

Our system currently handles **3 webhook events** for payment processing:

**Implemented Webhooks:**

- `invoice.paid` / `invoice.payment_succeeded` → Updates billing status to DONE
- `invoice.payment_failed` → Updates billing status to PAST_DUE

**Missing Webhooks:**

- `customer.subscription.updated` → No handler (HIGH PRIORITY)
- `customer.subscription.deleted` → No handler (MEDIUM PRIORITY)
- `invoice.payment_action_required` → No handler (MEDIUM-HIGH PRIORITY)
- `invoice.created` → No handler (LOW PRIORITY)
- `invoice.finalized` → No handler (LOW PRIORITY)

## 3. Problem Analysis

### Problem 1: Cannot Track Subscription Status Changes

**Current Gap:**
The system doesn't receive notifications when subscription status changes (active → past_due → canceled) or when users schedule cancellations.

**Business Impact:**

- Customer support cannot answer "When does my subscription renew?"
- No visibility when user schedules subscription cancellation
- Billing status may be out of sync with Stripe
- Risk of charging customers after they've cancelled

**Example Scenario:**
User clicks "Cancel Subscription" in Stripe Customer Portal → Stripe sets `cancel_at_period_end = true` → Our system doesn't know about it → User expects cancellation but we keep charging → Chargeback dispute and customer churn.

### Problem 2: No Cleanup When Subscription is Deleted

**Current Gap:**
The system doesn't know when a subscription is permanently deleted from Stripe.

**Business Impact:**

- Users may retain access after subscription deletion
- Database contains stale subscription IDs
- No proper cleanup of subscription-related data

### Problem 3: Users Not Notified for Payment Authentication

**Current Gap:**
When payment requires 3D Secure authentication (common for European customers), the system doesn't notify users to complete the authentication.

**Business Impact:**

- Lost revenue from incomplete payments (estimated 5-10% of European transactions)
- Poor user experience - payment stuck without guidance
- Subscription may be cancelled due to failed authentication after 24 hours

---

## 4. Integration Plan - Backend

Assuming all required webhook events are available from Stripe, there are two main options to handle the missing webhooks:

### Option 1 - Real-time Webhook Processing (Recommended)

- Process webhook events immediately when received from Stripe
- Update database in real-time to maintain synchronization
- Emit events to frontend via WebSocket for live updates

### Option 2 - Scheduled Processing + Event Queue

- Queue webhook events for batch processing
- Process events periodically via cron job
- Suitable for high-volume scenarios with rate limiting concerns

### Recommendation

We should prefer **Option 1 (Real-time Webhook Processing)** because:

- It maintains real-time data synchronization with Stripe
- It allows us to provide immediate feedback to users
- It provides flexibility to implement our own **notification and alerting system**

### Webhook Processing Flow (Option 1)

```
┌─────────────┐
│   Stripe    │
│   Platform  │
└──────┬──────┘
       │ Webhook Event
       │ (customer.subscription.updated)
       ▼
┌──────────────────────────────────────────────────────────┐
│ NestJS Backend - Webhook Controller                     │
│ POST /practice-payment/webhook                           │
└──────┬───────────────────────────────────────────────────┘
       │ 1. Verify Stripe signature
       │ 2. Parse event payload
       ▼
┌──────────────────────────────────────────────────────────┐
│ Practice Payment Service - handleWebhook()              │
└──────┬───────────────────────────────────────────────────┘
       │ Route to specific handler
       ▼
┌──────────────────────────────────────────────────────────┐
│ Handler Method (e.g., handleSubscriptionUpdated)        │
│ - Extract subscription data                             │
│ - Map to database fields                                │
│ - Update billing status based on subscription status    │
└──────┬───────────────────────────────────────────────────┘
       │ Update database
       ▼
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL - Provider Table                             │
│ - subscription_status                                    │
│ - cancel_at_period_end                                   │
│ - subscription_current_period_start                      │
│ - subscription_current_period_end                        │
│ - billing_status                                         │
└──────┬───────────────────────────────────────────────────┘
       │ Emit event (optional)
       ▼
┌──────────────────────────────────────────────────────────┐
│ WebSocket Gateway - Notify Frontend                     │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Missing Webhook Handlers - Detailed Analysis

Based on the current implementation analysis and Stripe documentation, the system is missing **5 critical webhook handlers**:

### 5.1. `customer.subscription.updated` (HIGH PRIORITY 🔴)

**When Triggered:**

- Subscription status changes (active → past_due → canceled)
- User schedules cancellation (`cancel_at_period_end` changes)
- Subscription renewal (billing cycle dates update)
- Subscription metadata changes

**Why Critical:**

- Cannot track when user schedules subscription cancellation
- No visibility into next billing cycle dates
- Billing status may be out of sync with Stripe
- Risk of charging customers after they've cancelled

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Stripe
    participant Webhook as Webhook Controller
    participant Service as Payment Service
    participant DB as PostgreSQL

    User->>Stripe: Cancel subscription
    Stripe->>Stripe: Set cancel_at_period_end = true
    Stripe->>Webhook: POST /webhook<br/>customer.subscription.updated
    Webhook->>Webhook: Verify signature
    Webhook->>Service: handleWebhook(event)
    Service->>Service: handleSubscriptionUpdated()
    Service->>Service: Extract subscription data
    Service->>DB: UPDATE Provider SET<br/>subscription_status = 'active'<br/>cancel_at_period_end = true<br/>period_start, period_end
    DB-->>Service: Success
    Service-->>Webhook: 200 OK
    Webhook-->>Stripe: Webhook received
```

**Database Impact:**

- Updates `subscription_status`, `cancel_at_period_end`, `subscription_current_period_start`, `subscription_current_period_end`
- Updates `billing_status` based on subscription status

---

### 5.2. `customer.subscription.deleted` (MEDIUM PRIORITY 🟡)

**When Triggered:**

- Subscription is permanently deleted from Stripe
- After subscription ends and retention period expires

**Why Important:**

- Users may retain access after subscription deletion
- Database contains stale subscription IDs
- No proper cleanup of subscription-related data

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook as Webhook Controller
    participant Service as Payment Service
    participant DB as PostgreSQL

    Stripe->>Stripe: Delete subscription permanently
    Stripe->>Webhook: POST /webhook<br/>customer.subscription.deleted
    Webhook->>Webhook: Verify signature
    Webhook->>Service: handleWebhook(event)
    Service->>Service: handleSubscriptionDeleted()
    Service->>DB: UPDATE Provider SET<br/>billing_status = 'CANCELLED'<br/>subscription_status = 'canceled'<br/>stripe_subscription_id = NULL
    DB-->>Service: Success
    Service-->>Webhook: 200 OK
    Webhook-->>Stripe: Webhook received
```

**Database Impact:**

- Sets `billing_status` to `CANCELLED`
- Clears `stripe_subscription_id`
- Sets `subscription_status` to `canceled`

---

### 5.3. `invoice.payment_action_required` (MEDIUM-HIGH PRIORITY 🟡)

**When Triggered:**

- Payment requires 3D Secure authentication (SCA)
- Common for European customers
- Payment is stuck pending user action

**Why Important:**

- Lost revenue from incomplete payments (5-10% of European transactions)
- Poor user experience - payment stuck without guidance
- Subscription may be cancelled after 24 hours if not completed

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Customer
    participant Stripe
    participant Webhook as Webhook Controller
    participant Service as Payment Service
    participant Email as Email Service

    Stripe->>Stripe: Payment requires 3D Secure
    Stripe->>Webhook: POST /webhook<br/>invoice.payment_action_required
    Webhook->>Webhook: Verify signature
    Webhook->>Service: handleWebhook(event)
    Service->>Service: handlePaymentActionRequired()
    Service->>Service: Extract invoice & payment intent
    Service->>Email: Send authentication email<br/>with hosted_invoice_url
    Email->>Customer: Email: "Complete Payment Authentication"
    Service-->>Webhook: 200 OK
    Webhook-->>Stripe: Webhook received

    Note over Customer,Stripe: User completes 3D Secure
    Customer->>Stripe: Complete authentication
    Stripe->>Webhook: POST /webhook<br/>invoice.paid
```

**Database Impact:**

- No direct database changes
- Triggers email notification to user

---

### 5.4. `invoice.created` (LOW PRIORITY ⚪)

**When Triggered:**

- Draft invoice is created (~1 hour before finalization)
- Happens before invoice is finalized and charged

**Why Useful:**

- Apply discounts or credits before charge
- Modify invoice line items if needed
- Add metadata or custom fields

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook as Webhook Controller
    participant Service as Payment Service
    participant DB as PostgreSQL

    Stripe->>Stripe: Create draft invoice<br/>(~1hr before charge)
    Stripe->>Webhook: POST /webhook<br/>invoice.created
    Webhook->>Webhook: Verify signature
    Webhook->>Service: handleWebhook(event)
    Service->>Service: handleInvoiceCreated()
    Service->>Service: Check for applicable discounts
    Service->>DB: Log invoice creation (optional)
    DB-->>Service: Success
    Service-->>Webhook: 200 OK
    Webhook-->>Stripe: Webhook received

    Note over Stripe: Invoice finalized after 1 hour
```

**Database Impact:**

- Optional logging only
- No billing status changes

---

### 5.5. `invoice.finalized` (LOW PRIORITY ⚪)

**When Triggered:**

- Invoice is finalized and ready to be charged
- Happens after `invoice.created` and before payment attempt

**Why Useful:**

- Logging and tracking purposes
- Last chance to review invoice before charge
- Audit trail for billing operations

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook as Webhook Controller
    participant Service as Payment Service
    participant DB as PostgreSQL

    Stripe->>Stripe: Finalize invoice<br/>(ready to charge)
    Stripe->>Webhook: POST /webhook<br/>invoice.finalized
    Webhook->>Webhook: Verify signature
    Webhook->>Service: handleWebhook(event)
    Service->>Service: handleInvoiceFinalized()
    Service->>DB: Log finalized invoice (optional)
    DB-->>Service: Success
    Service-->>Webhook: 200 OK
    Webhook-->>Stripe: Webhook received

    Note over Stripe: Payment attempt follows
    Stripe->>Webhook: invoice.payment_succeeded<br/>or invoice.payment_failed
```

**Database Impact:**

- Optional logging only
- No billing status changes

---

## 6. Integration Plan - Frontend

To support the new webhook integration, several updates are required on the frontend to display subscription information and handle user notifications.

### 6.1. Subscription Status Display

**Requirements:**

- Display current subscription status to users (Active, Past Due, Cancelled, Unpaid)
- Show next billing date from `subscription_current_period_end`
- Show cancellation schedule if `cancel_at_period_end = true`
- Display warning when subscription is scheduled for cancellation

**UI Components Needed:**

- Subscription status badge (color-coded by status)
- Billing cycle information panel
- Cancellation notice banner (when applicable)

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB as PostgreSQL

    User->>Frontend: Navigate to Subscription page
    Frontend->>Backend: GET /api/subscription/status
    Backend->>DB: SELECT subscription_status,<br/>cancel_at_period_end,<br/>period_end FROM Provider
    DB-->>Backend: Return subscription data
    Backend-->>Frontend: {status: 'active',<br/>cancel_at_period_end: true,<br/>next_billing_date: '2025-11-07'}
    Frontend->>Frontend: Render status badge
    Frontend->>Frontend: Show cancellation notice
    Frontend-->>User: Display subscription info
```

---

### 6.2. Payment Action Required Notification

**Requirements:**

- Display notification when payment requires 3D Secure authentication
- Provide "Complete Payment" button linking to Stripe hosted invoice
- Show countdown timer (payment expires in 24 hours)
- Clear notification after successful payment

**UI Components Needed:**

- Notification banner/modal for payment action required
- "Complete Payment Authentication" button
- Timer component showing time remaining

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Stripe
    participant Backend
    participant WebSocket
    participant Frontend
    participant User

    Stripe->>Backend: invoice.payment_action_required
    Backend->>Backend: Process webhook
    Backend->>WebSocket: Emit payment_action_required event
    WebSocket->>Frontend: Push notification
    Frontend->>Frontend: Show notification banner
    Frontend-->>User: "Payment Authentication Required"

    User->>Frontend: Click "Complete Payment"
    Frontend->>User: Open Stripe hosted invoice URL
    User->>Stripe: Complete 3D Secure
    Stripe->>Backend: invoice.paid
    Backend->>WebSocket: Emit payment_completed event
    WebSocket->>Frontend: Push notification
    Frontend->>Frontend: Clear notification
    Frontend-->>User: "Payment Successful"
```

---

### 6.3. Real-time Updates via WebSocket

**Requirements:**

- Establish WebSocket connection for real-time subscription updates
- Listen for subscription status changes
- Update UI immediately when webhook events are processed
- Handle reconnection and error states

**Events to Listen For:**

- `subscription.updated` - Update subscription status and billing dates
- `subscription.deleted` - Show subscription cancelled message
- `payment.action_required` - Show payment authentication notification
- `payment.succeeded` - Clear notifications and update status

**Sequence Diagram:**

```mermaid
sequenceDiagram
    participant Frontend
    participant WebSocket
    participant Backend
    participant Stripe

    Frontend->>WebSocket: Connect (on page load)
    WebSocket-->>Frontend: Connection established

    Note over Stripe,Frontend: User cancels subscription in Stripe

    Stripe->>Backend: customer.subscription.updated
    Backend->>Backend: Update database
    Backend->>WebSocket: Emit subscription.updated
    WebSocket->>Frontend: Push event {cancel_at_period_end: true}
    Frontend->>Frontend: Update UI in real-time
    Frontend-->>Frontend: Show "Subscription will cancel on [date]"
```

---

_This proposal is based on analysis of current implementation and Stripe documentation. Detailed implementation code is available in supporting documentation._
