# Payments, Subscriptions & Admin Panel — Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Four features to complete the billing and admin system:

1. Subscription downgrades (at period end)
2. User blocking/suspension by admin
3. Full coupon/promo code system (Stripe-native)
4. Admin subscription management

## 1. Subscription Downgrades

### Current State

Users can upgrade (Stripe checkout) and cancel (at period end). No downgrade path exists.

### Design

- `POST /api/billing/downgrade` accepts `{ plan: "starter" | "free" }`
- Uses Stripe `Update Subscription` API with `proration_behavior: "none"` so the change takes effect at next renewal
- Downgrade to Free = cancel subscription at period end (existing `/cancel` logic)
- Webhook `customer.subscription.updated` already syncs plan changes — no webhook changes needed
- Frontend: billing UI's downgrade buttons call this endpoint

### Files to Modify

- `packages/billing/src/gateway.ts` — add `updateSubscription()` method
- `apps/api/src/services/billing-service.ts` — add `downgrade()` method
- `apps/api/src/routes/billing.ts` — add `POST /downgrade` route
- `apps/web/src/components/settings/billing-section.tsx` — wire downgrade buttons

## 2. User Blocking (Admin)

### Current State

No `status` field on users. Admin can view customers but cannot block them.

### Design

**Schema changes:**

- Add `userStatusEnum`: `"active" | "suspended" | "banned"`
- Add to `users` table: `status` (default `"active"`), `suspendedAt` (nullable timestamp), `suspendedReason` (nullable text)

**Auth middleware:**

- After resolving userId, check `user.status`. If not `"active"`, return 403 with message indicating account is suspended/banned.

**Admin endpoints:**

- `POST /api/admin/customers/:id/block` — sets status to `"banned"`, cancels Stripe subscription immediately, audit logs
- `POST /api/admin/customers/:id/suspend` — sets status to `"suspended"`, cancels Stripe subscription immediately, audit logs
- `POST /api/admin/customers/:id/unblock` — sets status back to `"active"`, audit logs (user must re-subscribe)

**Admin UI:**

- Block/suspend/unblock buttons on customer detail view
- Confirmation dialog with reason input
- Status badge on customer list

### Files to Modify

- `packages/db/src/schema.ts` — add enum + columns
- `packages/db/src/queries/users.ts` — add `updateStatus()` query
- `apps/api/src/middleware/auth.ts` — add status check
- `apps/api/src/routes/admin.ts` — add block/suspend/unblock endpoints
- `apps/api/src/services/admin-service.ts` — add block/unblock logic
- `apps/web/src/app/dashboard/admin/page.tsx` — add blocking UI

## 3. Coupon / Promo Code System

### Current State

No promo code support anywhere.

### Design — Stripe-Native

All coupons live in Stripe. Local `promos` table mirrors them for admin UI and validation.

**Database — `promos` table:**

```
id: uuid PK
code: text UNIQUE NOT NULL
stripeCouponId: text NOT NULL
stripePromotionCodeId: text
discountType: enum("percent_off", "amount_off", "free_months")
discountValue: integer NOT NULL (percentage 1-100, or cents, or months)
duration: enum("once", "repeating", "forever")
durationMonths: integer (nullable, for repeating)
maxRedemptions: integer (nullable, null = unlimited)
timesRedeemed: integer DEFAULT 0
expiresAt: timestamp (nullable)
active: boolean DEFAULT true
createdBy: text FK users
createdAt: timestamp DEFAULT now()
```

**Gateway additions (`packages/billing/src/gateway.ts`):**

- `createCoupon(opts)` — POST /coupons (percent_off or amount_off + duration)
- `createPromotionCode(couponId, code)` — POST /promotion_codes
- `applyDiscountToSubscription(subscriptionId, couponId)` — POST /subscriptions/:id with coupon
- `listPromotionCodes()` / `deactivatePromotionCode(id)`

**API endpoints:**

- `POST /api/admin/promos` — create promo (Stripe coupon + promotion code + local record)
- `GET /api/admin/promos` — list all promos with redemption counts
- `DELETE /api/admin/promos/:id` — deactivate promo (Stripe + local)
- `POST /api/admin/customers/:id/apply-promo` — admin applies coupon to customer's active subscription
- `POST /api/billing/validate-promo` — user validates promo code (checks active, not expired, under max redemptions)

**Checkout integration:**

- Add optional `promoCode` to `POST /api/billing/checkout`
- If provided, look up local promo → pass `discounts[0][promotion_code]: stripePromotionCodeId` to Stripe checkout session
- Frontend: promo code input field in checkout/upgrade flow

**Admin UI:**

- "Promos" tab in admin panel: create form, list table, deactivate button
- Customer detail: "Apply Promo" button with promo selector

### Files to Create

- `packages/db/src/queries/promos.ts` — CRUD queries

### Files to Modify

- `packages/db/src/schema.ts` — add `promos` table + enums
- `packages/billing/src/gateway.ts` — add coupon/promo methods
- `apps/api/src/routes/billing.ts` — add validate-promo, update checkout with promo
- `apps/api/src/routes/admin.ts` — add promo CRUD endpoints
- `apps/api/src/services/admin-service.ts` — add promo logic
- `apps/web/src/components/settings/billing-section.tsx` — add promo input to checkout
- `apps/web/src/app/dashboard/admin/page.tsx` — add promos section

## 4. Admin Subscription Management

### Current State

Admin can view customer subscriptions but cannot modify them.

### Design

- `POST /api/admin/customers/:id/change-plan` — force-change user's plan
  - If user has Stripe subscription: update it via Stripe API (immediate, prorated)
  - If user is on free plan: just update local `plan` field
  - Audit log entry
- `POST /api/admin/customers/:id/cancel-subscription` — cancel subscription immediately
  - Calls `cancelImmediately()` on Stripe
  - Downgrades user to free locally
  - Audit log entry

**Admin UI:**

- Plan selector dropdown on customer detail page
- "Cancel Subscription" button with confirmation
- All actions logged in audit trail

### Files to Modify

- `apps/api/src/routes/admin.ts` — add change-plan, cancel-subscription endpoints
- `apps/api/src/services/admin-service.ts` — add plan management logic
- `apps/web/src/app/dashboard/admin/page.tsx` — add plan management UI
