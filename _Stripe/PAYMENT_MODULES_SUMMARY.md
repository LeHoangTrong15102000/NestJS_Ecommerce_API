# Payment Modules Summary

This document provides a comprehensive overview of the payment-related modules in the Cellera backend system, specifically the **Practice Payment Module** and **Stripe Integration Service**.

---

## Table of Contents

1. [Overview](#overview)
2. [Practice Payment Module](#practice-payment-module)
3. [Stripe Integration Service](#stripe-integration-service)
4. [Payment Flow](#payment-flow)
5. [Key Components](#key-components)

---

## Overview

The payment system handles practice onboarding payments and recurring subscription billing using Stripe as the payment processor. The architecture separates concerns into two main modules:

- **Practice Payment Module** (`src/modules/practice-payment/`) - Business logic for practice billing
- **Stripe Integration Service** (`src/services/stripe-integration/`) - Low-level Stripe API wrapper

---

## Practice Payment Module

**Location:** `src/modules/practice-payment/`

### Purpose
Manages payment operations for medical practices, including onboarding fees and subscription payments.

### Main Responsibilities

#### 1. **Checkout Session Creation**
- **Endpoint:** `POST /practice-payment/checkout-session`
- **Controller:** `practice-payment.controller.ts:40-67`
- **Service Method:** `createCheckoutSession()` in `practice-payment.service.ts:22-38`
- **Authentication:** Provider-only, requires `READ_OWN_PROFILE` permission
- **Flow:**
  1. Validates practice exists in database
  2. Creates or retrieves Stripe customer ID
  3. Creates Stripe checkout session with both onboarding fee and subscription
  4. Returns checkout URL for payment

#### 2. **Payment Status Retrieval**
- **Endpoint:** `GET /practice-payment/status`
- **Controller:** `practice-payment.controller.ts:69-88`
- **Service Method:** `getPracticePaymentStatus()` in `practice-payment.service.ts:122-171`
- **Returns:**
  - Billing status (REQUIRED, DONE, PAST_DUE)
  - Stripe customer and subscription IDs
  - Onboarding payment date
  - Payment receipts (invoices)
  - Payment methods on file
  - Subscription details

#### 3. **Webhook Processing**
- **Endpoint:** `POST /practice-payment/webhook`
- **Controller:** `payment-webhook.controller.ts:30-68`
- **Service Method:** `handleWebhook()` in `practice-payment.service.ts:173-203`
- **Handles Events:**
  - `invoice.paid` / `invoice.payment_succeeded` → Updates billing status to DONE when both onboarding and subscription are paid
  - `invoice.payment_failed` → Updates billing status to PAST_DUE

### Key Service Methods

**Customer Management:**
- `findOrCreateStripeCustomer()` - Ensures practice has valid Stripe customer
- `validateExistingCustomer()` - Verifies existing customer ID is still valid
- `createNewStripeCustomer()` - Creates new customer and saves ID to database

**Webhook Handlers:**
- `handleInvoicePaid()` - Processes successful payments, checks if billing is complete
- `handleInvoicePaymentFailed()` - Marks billing as past due on payment failure

### DTOs

**CreateCheckoutSessionDto** (`dtos/create-checkout-session.dto.ts`)
```typescript
{
  subscriptionPlan: SubscriptionPlan  // MONTHLY or SIX_MONTHS
}
```

**PracticePaymentStatusResponseDto** (`dtos/practice-payment-status-response.dto.ts`)
```typescript
{
  billingStatus: BillingStatus,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  onboardingPaidAt?: Date,
  receipts?: Stripe.Invoice[],
  paymentMethods?: Stripe.PaymentMethod[],
  subscriptions?: Stripe.Subscription[]
}
```

### Database Integration
- Uses `Provider` entity from `@modules/user/entity/provider.entity`
- Stores: `stripeCustomerId`, `stripeSubscriptionId`, `billingStatus`, `onboardingPaidAt`

---

## Stripe Integration Service

**Location:** `src/services/stripe-integration/`

### Purpose
Provides a clean abstraction layer over the Stripe API, handling all direct Stripe operations.

### Main Responsibilities

#### 1. **Checkout Session Management**
- **Method:** `createCheckoutSession()` in `stripe-integration.service.ts:34-85`
- **Creates:** Combined checkout with both onboarding fee and subscription
- **Mode:** Subscription mode
- **Payment Methods Supported:**
  - Card
  - US Bank Account
  - Link (Stripe)
  - PayPal
  - Amazon Pay
  - Cash App
  - Klarna
- **Features:**
  - Promotion codes enabled
  - Billing address collection required
  - Metadata includes practice ID and subscription plan

#### 2. **Customer Operations**
- **`createCustomer()`** - Creates Stripe customer with practice metadata
- **`findCustomer()`** - Retrieves customer by ID, handles deleted customers
- **`getCustomerReceipts()`** - Gets all paid invoices (up to 100)
- **`getCustomerPaymentMethods()`** - Lists card payment methods
- **`getCustomerSubscriptions()`** - Lists all subscriptions
- **`getCustomerPaymentHistory()`** - Combines receipts, payment methods, and subscriptions

#### 3. **Subscription & Invoice Operations**
- **`retrieveSubscription()`** - Gets subscription details by ID
- **`retrieveInvoice()`** - Gets invoice details by ID

#### 4. **Webhook Handling**
- **`constructWebhookEvent()`** - Validates and constructs webhook event from Stripe signature
- **`handleCheckoutSessionCompleted()`** - Extracts practice and subscription data from completed session
- **`handleInvoicePaid()`** - Processes paid invoice, retrieves practice ID from subscription metadata
- **`handleInvoicePaymentFailed()`** - Handles failed payments, returns PAST_DUE status

#### 5. **Billing Status Verification**
- **Method:** `checkCompleteBillingStatus()` in `stripe-integration.service.ts:365-423`
- **Logic:**
  - Retrieves all paid invoices for customer
  - Checks for onboarding fee receipt (one-time payment)
  - Checks for subscription receipt (recurring payment)
  - Returns complete status only when BOTH exist
- **Returns:**
  ```typescript
  {
    hasOnboardingReceipt: boolean,
    hasSubscriptionReceipt: boolean,
    isComplete: boolean
  }
  ```

### Configuration

**StripeIntegrationConfig** (`stripe-integration.config.ts`)
- Loads configuration from `config` package
- **Keys:**
  - `secretKey` - Stripe secret API key
  - `webhookSecret` - Webhook signing secret
  - `successUrl` - Redirect URL after successful payment
  - `cancelUrl` - Redirect URL if payment cancelled
  - `apiVersion` - `"2025-08-27.basil"`
- **Price IDs:**
  - `prices.onboarding` - One-time onboarding fee
  - `prices.monthly` - Monthly subscription
  - `prices.sixMonths` - 6-month subscription

### Types

**Key Interfaces** (`types.ts`):
- `StripeConfig` - Configuration structure
- `CreateCheckoutSessionDto` - Checkout session parameters
- `CustomerPaymentHistory` - Combined payment data
- `BillingStatusCheck` - Billing completion status
- `InvoicePaidResult` - Result from invoice paid processing
- `InvoicePaymentFailedResult` - Result from failed payment processing

---

## Payment Flow

### Onboarding Payment Flow

```
1. Practice initiates payment
   ↓
2. POST /practice-payment/checkout-session
   → PracticePaymentController.createCheckoutSession()
   ↓
3. PracticePaymentService.createCheckoutSession()
   → Validates practice exists
   → Creates/retrieves Stripe customer
   ↓
4. StripeIntegrationService.createCheckoutSession()
   → Creates checkout with onboarding + subscription
   → Returns checkout URL
   ↓
5. Practice redirected to Stripe checkout page
   ↓
6. Practice completes payment on Stripe
   ↓
7. Stripe sends webhook: invoice.paid
   → POST /practice-payment/webhook
   ↓
8. PaymentWebhookController.handleWebhook()
   → Validates signature
   → PracticePaymentService.handleWebhook()
   ↓
9. PracticePaymentService.handleInvoicePaid()
   → Retrieves practice ID from subscription metadata
   → Checks billing completion status
   → Updates Provider.billingStatus to DONE (if both onboarding and subscription paid)
```

### Status Check Flow

```
1. Practice checks payment status
   ↓
2. GET /practice-payment/status
   → PracticePaymentController.getPracticePaymentStatus()
   ↓
3. PracticePaymentService.getPracticePaymentStatus()
   → Retrieves Provider from database
   → If no Stripe customer ID: return basic info
   → If has Stripe customer ID:
       ↓
4. StripeIntegrationService.getCustomerPaymentHistory()
   → Fetches receipts (paid invoices)
   → Fetches payment methods
   → Fetches subscriptions
   ↓
5. Returns complete payment status with history
```

### Billing Status Logic

**Status Values:**
- `REQUIRED` - Payment needed or incomplete
- `DONE` - Both onboarding and subscription paid
- `PAST_DUE` - Payment failed

**Completion Check:**
- Billing is only marked `DONE` when:
  1. At least one invoice contains onboarding fee line item (one-time)
  2. At least one invoice contains subscription line item (recurring)
- This is checked via `StripeIntegrationService.checkCompleteBillingStatus()`

---

## Key Components

### Controllers

| Controller | File | Endpoints |
|------------|------|-----------|
| PracticePaymentController | `practice-payment.controller.ts` | `POST /checkout-session`<br>`GET /status` |
| PaymentWebhookController | `payment-webhook.controller.ts` | `POST /webhook` |

### Services

| Service | File | Purpose |
|---------|------|---------|
| PracticePaymentService | `practice-payment.service.ts` | Business logic for practice payments |
| StripeIntegrationService | `stripe-integration.service.ts` | Stripe API wrapper |
| StripeIntegrationConfig | `stripe-integration.config.ts` | Configuration loader |

### Dependencies

**External:**
- `stripe` - Official Stripe Node.js SDK
- `@nestjs/typeorm` - Database integration
- `config` - Configuration management

**Internal:**
- `Provider` entity - Stores practice payment data
- `BillingStatus` enum - Payment status values
- `SubscriptionPlan` constants - MONTHLY, SIX_MONTHS

---

## Important Notes

1. **Combined Payment Model**: The checkout session includes BOTH onboarding fee and subscription in a single transaction
2. **Metadata Tracking**: Practice ID is stored in subscription metadata for webhook processing
3. **Fallback Handling**: If practice ID not in invoice metadata, system tries to find by customer ID
4. **Webhook Security**: All webhooks are validated using Stripe signature verification
5. **Error Resilience**: Payment status endpoint returns basic info even if Stripe API calls fail
6. **Customer Validation**: Existing customer IDs are validated before use; new customer created if invalid
7. **Receipt-Based Verification**: Billing completion is verified by checking actual paid invoices, not just events
