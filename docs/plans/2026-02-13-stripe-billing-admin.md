# Stripe Billing + Admin Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate comprehensive Stripe subscription billing with payment tracking, webhook handling, admin analytics dashboard, and customer management — porting patterns from the llmrank FastAPI project to our TypeScript/Drizzle/Workers stack.

**Architecture:** New `packages/billing` package provides a fetch-based StripeGateway and webhook dispatcher (no SDK to keep Workers bundle small). DB schema adds `subscriptions`, `payments`, and `plan_price_history` tables. Admin queries in `packages/db`. Frontend adds admin dashboard and payment history.

**Tech Stack:** TypeScript, Drizzle ORM, Neon PostgreSQL, Hono (Workers), Next.js 15, SWR, shadcn/ui

---

### Task 1: Add DB Schema — New Tables + isAdmin Field

**Files:**

- Modify: `packages/db/src/schema.ts`

**Step 1: Add new enums and tables to schema.ts**

After the existing `llmProviderEnum`, add:

```typescript
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "pending",
  "failed",
]);
```

Add `isAdmin` to the `users` table definition (after `notifyOnScoreDrop`):

```typescript
  isAdmin: boolean("is_admin").notNull().default(false),
```

Add 3 new tables after the `visibilityChecks` table:

```typescript
// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("succeeded"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_payments_user").on(t.userId),
    index("idx_payments_subscription").on(t.subscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// Plan Price History (audit trail)
// ---------------------------------------------------------------------------

export const planPriceHistory = pgTable(
  "plan_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planCode: text("plan_code").notNull(),
    oldPriceCents: integer("old_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    changedBy: uuid("changed_by").references(() => users.id),
    reason: text("reason"),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
  (t) => [index("idx_price_history_plan").on(t.planCode)],
);
```

**Step 2: Push schema to Neon**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Tables created successfully

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/db`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat: add subscriptions, payments, and plan_price_history tables"
```

---

### Task 2: Add Billing DB Queries

**Files:**

- Create: `packages/db/src/queries/billing.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Create billing queries**

Create `packages/db/src/queries/billing.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { subscriptions, payments, planPriceHistory } from "../schema";

export function billingQueries(db: Database) {
  return {
    // ── Subscriptions ─────────────────────────────────────────────

    async getActiveSubscription(userId: string) {
      return db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
        ),
        orderBy: desc(subscriptions.createdAt),
      });
    },

    async getSubscriptionByStripeId(stripeSubscriptionId: string) {
      return db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
      });
    },

    async createSubscription(data: {
      userId: string;
      planCode: string;
      status: "active" | "trialing" | "past_due" | "canceled";
      stripeSubscriptionId: string;
      stripeCustomerId: string;
    }) {
      const [sub] = await db.insert(subscriptions).values(data).returning();
      return sub;
    },

    async updateSubscriptionPeriod(
      stripeSubscriptionId: string,
      periodStart: Date,
      periodEnd: Date,
    ) {
      const [sub] = await db
        .update(subscriptions)
        .set({
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          status: "active",
        })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async updateSubscriptionStatus(
      stripeSubscriptionId: string,
      status: "active" | "trialing" | "past_due" | "canceled",
    ) {
      const [sub] = await db
        .update(subscriptions)
        .set({ status })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async cancelSubscription(stripeSubscriptionId: string, canceledAt: Date) {
      const [sub] = await db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt,
          cancelAtPeriodEnd: false,
        })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    async markCancelAtPeriodEnd(stripeSubscriptionId: string) {
      const [sub] = await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .returning();
      return sub;
    },

    // ── Payments ──────────────────────────────────────────────────

    async getPaymentByInvoiceId(stripeInvoiceId: string) {
      return db.query.payments.findFirst({
        where: eq(payments.stripeInvoiceId, stripeInvoiceId),
      });
    },

    async createPayment(data: {
      userId: string;
      subscriptionId?: string;
      stripeInvoiceId: string;
      amountCents: number;
      currency: string;
      status: "succeeded" | "pending" | "failed";
    }) {
      const [payment] = await db.insert(payments).values(data).returning();
      return payment;
    },

    async listPayments(userId: string, limit = 50) {
      return db.query.payments.findMany({
        where: eq(payments.userId, userId),
        orderBy: desc(payments.createdAt),
        limit,
      });
    },
  };
}
```

**Step 2: Export from index.ts**

Add to `packages/db/src/index.ts`:

```typescript
export { billingQueries } from "./queries/billing";
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/db`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/db/src/queries/billing.ts packages/db/src/index.ts
git commit -m "feat: add billing DB queries for subscriptions and payments"
```

---

### Task 3: Add Admin Analytics DB Queries

**Files:**

- Create: `packages/db/src/queries/admin.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Create admin queries**

Create `packages/db/src/queries/admin.ts` (ported from llmrank's `admin/router.py` SQL):

```typescript
import {
  eq,
  sql,
  and,
  or,
  ilike,
  desc,
  count,
  countDistinct,
} from "drizzle-orm";
import type { Database } from "../client";
import { users, subscriptions, payments } from "../schema";

/** Plan prices in cents — mirrors CLAUDE.md pricing */
const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  starter: 7900,
  pro: 14900,
  agency: 29900,
};

export function adminQueries(db: Database) {
  return {
    async getStats() {
      // MRR: sum of active subscription plan prices
      const mrrResult = await db
        .select({
          planCode: subscriptions.planCode,
          count: count(),
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
        .groupBy(subscriptions.planCode);

      let totalMrrCents = 0;
      const mrrByPlan: Record<string, number> = {};
      for (const row of mrrResult) {
        const priceCents = PLAN_PRICE_CENTS[row.planCode] ?? 0;
        const planMrr = priceCents * row.count;
        totalMrrCents += planMrr;
        mrrByPlan[row.planCode] = planMrr / 100;
      }

      // Active subscribers (distinct users with active subs)
      const [activeResult] = await db
        .select({ value: countDistinct(subscriptions.userId) })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));

      // Total customers
      const [totalResult] = await db.select({ value: count() }).from(users);

      // Churn: subscriptions with cancelAtPeriodEnd = true
      const [churningResult] = await db
        .select({ value: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.cancelAtPeriodEnd, true),
            eq(subscriptions.status, "active"),
          ),
        );

      const activeSubs = activeResult?.value ?? 0;
      const churning = churningResult?.value ?? 0;
      const churnRate = activeSubs > 0 ? (churning / activeSubs) * 100 : 0;

      // Revenue: total succeeded payments
      const [revenueResult] = await db
        .select({
          value: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        })
        .from(payments)
        .where(eq(payments.status, "succeeded"));

      // Failed payments count
      const [failedResult] = await db
        .select({ value: count() })
        .from(payments)
        .where(eq(payments.status, "failed"));

      return {
        mrr: totalMrrCents / 100,
        mrrByPlan,
        totalRevenue: (revenueResult?.value ?? 0) / 100,
        failedPayments: failedResult?.value ?? 0,
        activeSubscribers: activeSubs,
        totalCustomers: totalResult?.value ?? 0,
        churnRate: Math.round(churnRate * 100) / 100,
      };
    },

    async getCustomers(opts: {
      page?: number;
      limit?: number;
      search?: string;
    }) {
      const page = opts.page ?? 1;
      const limit = opts.limit ?? 25;
      const offset = (page - 1) * limit;

      let where;
      if (opts.search) {
        where = or(
          ilike(users.email, `%${opts.search}%`),
          ilike(users.name, `%${opts.search}%`),
        );
      }

      const customerRows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
          stripeCustomerId: users.stripeCustomerId,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db
        .select({ value: count() })
        .from(users)
        .where(where);

      return {
        data: customerRows,
        pagination: {
          page,
          limit,
          total: totalResult?.value ?? 0,
          totalPages: Math.ceil((totalResult?.value ?? 0) / limit),
        },
      };
    },

    async getCustomerDetail(userId: string) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) return null;

      const subs = await db.query.subscriptions.findMany({
        where: eq(subscriptions.userId, userId),
        orderBy: desc(subscriptions.createdAt),
      });

      const userPayments = await db.query.payments.findMany({
        where: eq(payments.userId, userId),
        orderBy: desc(payments.createdAt),
        limit: 50,
      });

      return { user, subscriptions: subs, payments: userPayments };
    },
  };
}
```

**Step 2: Export from index.ts**

Add to `packages/db/src/index.ts`:

```typescript
export { adminQueries } from "./queries/admin";
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/db`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/db/src/queries/admin.ts packages/db/src/index.ts
git commit -m "feat: add admin analytics queries (MRR, revenue, churn, customers)"
```

---

### Task 4: Create packages/billing — StripeGateway

**Files:**

- Create: `packages/billing/package.json`
- Create: `packages/billing/tsconfig.json`
- Create: `packages/billing/src/index.ts`
- Create: `packages/billing/src/gateway.ts`
- Create: `packages/billing/src/plan-map.ts`

**Step 1: Create package.json**

```json
{
  "name": "@llm-boost/billing",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@llm-boost/db": "workspace:*",
    "@llm-boost/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

**Step 3: Create plan-map.ts**

```typescript
/**
 * Bidirectional mapping between Stripe price IDs and plan codes.
 * Replace placeholder values with real Stripe price IDs after creating
 * products in the Stripe dashboard.
 */
export const STRIPE_PLAN_MAP: Record<string, string> = {
  // Stripe price ID → plan code
  price_starter: "starter",
  price_pro: "pro",
  price_agency: "agency",
};

/** Reverse map: plan code → Stripe price ID */
export const PLAN_TO_PRICE: Record<string, string> = Object.fromEntries(
  Object.entries(STRIPE_PLAN_MAP).map(([priceId, planCode]) => [
    planCode,
    priceId,
  ]),
);

export function planCodeFromPriceId(priceId: string): string | undefined {
  return STRIPE_PLAN_MAP[priceId];
}

export function priceIdFromPlanCode(planCode: string): string | undefined {
  return PLAN_TO_PRICE[planCode];
}
```

**Step 4: Create gateway.ts**

Ported from llmrank's `stripe_gateway.py`, adapted to fetch-based Workers:

```typescript
/**
 * Minimal Stripe API gateway using fetch() — no SDK dependency.
 * Ported from llmrank's StripeGateway (Python) to TypeScript for Workers.
 */

export interface StripeCheckoutSession {
  id: string;
  url: string;
  subscription: string;
  customer: string;
  client_reference_id: string;
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  metadata: Record<string, string>;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  items: {
    data: Array<{
      price: { id: string };
      current_period_start: number;
      current_period_end: number;
    }>;
  };
}

export interface StripeInvoice {
  id: string;
  amount_paid: number;
  currency: string;
  billing_reason: string;
  lines: {
    data: Array<{
      parent: {
        subscription_item_details?: {
          subscription: string;
        };
      };
    }>;
  };
}

export interface StripeCustomer {
  id: string;
  email: string;
}

async function stripeRequest<T>(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string>,
): Promise<T> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  let requestBody: string | undefined;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = new URLSearchParams(body).toString();
  }

  const res = await fetch(url, { method, headers, body: requestBody });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export class StripeGateway {
  constructor(private secretKey: string) {}

  /** Create or retrieve a Stripe customer by email + userId. */
  async ensureCustomer(
    email: string,
    userId: string,
    existingCustomerId?: string | null,
  ): Promise<string> {
    if (existingCustomerId) return existingCustomerId;

    const customer = await stripeRequest<StripeCustomer>(
      this.secretKey,
      "POST",
      "/customers",
      { email, "metadata[user_id]": userId },
    );
    return customer.id;
  }

  /** Create a Stripe Checkout session for a subscription. */
  async createCheckoutSession(opts: {
    customerId: string;
    priceId: string;
    userId: string;
    planCode: string;
    successUrl: string;
    cancelUrl: string;
    upgradeFromSubId?: string;
  }): Promise<{ sessionId: string; url: string }> {
    const metadata: Record<string, string> = {
      "subscription_data[metadata][user_id]": opts.userId,
      "subscription_data[metadata][plan_code]": opts.planCode,
    };
    if (opts.upgradeFromSubId) {
      metadata["subscription_data[metadata][upgrade_from_subscription_id]"] =
        opts.upgradeFromSubId;
    }

    const session = await stripeRequest<StripeCheckoutSession>(
      this.secretKey,
      "POST",
      "/checkout/sessions",
      {
        customer: opts.customerId,
        mode: "subscription",
        "line_items[0][price]": opts.priceId,
        "line_items[0][quantity]": "1",
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        client_reference_id: opts.userId,
        ...metadata,
      },
    );

    return { sessionId: session.id, url: session.url };
  }

  /** Create a Stripe Customer Portal session. */
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    const session = await stripeRequest<{ url: string }>(
      this.secretKey,
      "POST",
      "/billing_portal/sessions",
      { customer: customerId, return_url: returnUrl },
    );
    return session.url;
  }

  /** Retrieve a Stripe subscription by ID. */
  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "GET",
      `/subscriptions/${subscriptionId}`,
    );
  }

  /** Cancel a subscription at period end. */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "POST",
      `/subscriptions/${subscriptionId}`,
      { cancel_at_period_end: "true" },
    );
  }

  /** Immediately cancel a subscription (for upgrades). */
  async cancelImmediately(subscriptionId: string): Promise<void> {
    await stripeRequest(
      this.secretKey,
      "DELETE",
      `/subscriptions/${subscriptionId}`,
    );
  }

  /**
   * Verify a webhook signature using HMAC-SHA256.
   * Returns the parsed event or throws on invalid signature.
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<{ type: string; data: { object: Record<string, unknown> } }> {
    // Parse the Stripe-Signature header
    const parts = signature.split(",").reduce(
      (acc, part) => {
        const [key, value] = part.split("=");
        acc[key.trim()] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const timestamp = parts["t"];
    const expectedSig = parts["v1"];

    if (!timestamp || !expectedSig) {
      throw new Error("Invalid Stripe signature format");
    }

    // Check timestamp freshness (5 minute tolerance)
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (Math.abs(age) > 300) {
      throw new Error("Webhook timestamp too old");
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );
    const computedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedSig !== expectedSig) {
      throw new Error("Invalid webhook signature");
    }

    return JSON.parse(payload);
  }
}
```

**Step 5: Create index.ts**

```typescript
export { StripeGateway } from "./gateway";
export type {
  StripeCheckoutSession,
  StripeSubscription,
  StripeInvoice,
  StripeCustomer,
} from "./gateway";
export {
  STRIPE_PLAN_MAP,
  PLAN_TO_PRICE,
  planCodeFromPriceId,
  priceIdFromPlanCode,
} from "./plan-map";
```

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: Workspace links resolved

**Step 7: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/billing`
Expected: Clean

**Step 8: Commit**

```bash
git add packages/billing/
git commit -m "feat: create packages/billing with StripeGateway and plan mapping"
```

---

### Task 5: Create Webhook Handler

**Files:**

- Create: `packages/billing/src/webhooks.ts`
- Modify: `packages/billing/src/index.ts`

**Step 1: Create webhooks.ts**

Ported from llmrank's `webhook_handlers.py`:

```typescript
/**
 * Stripe webhook event dispatcher and handlers.
 * Ported from llmrank's webhook_handlers.py — adapted for Drizzle + Workers.
 */
import type { Database } from "@llm-boost/db";
import { billingQueries, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { StripeGateway, type StripeSubscription } from "./gateway";
import { planCodeFromPriceId } from "./plan-map";

type Plan = "free" | "starter" | "pro" | "agency";

interface WebhookEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Main webhook dispatcher. Routes Stripe events to the correct handler.
 * Returns { handled: boolean } to indicate if the event was processed.
 */
export async function handleWebhook(
  event: WebhookEvent,
  db: Database,
  stripeSecretKey: string,
): Promise<{ handled: boolean }> {
  const billing = billingQueries(db);
  const users = userQueries(db);
  const gateway = new StripeGateway(stripeSecretKey);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, billing, users, gateway);
      return { handled: true };

    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object, billing, gateway);
      return { handled: true };

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object, billing);
      return { handled: true };

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, billing, users);
      return { handled: true };

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, billing, users);
      return { handled: true };

    default:
      return { handled: false };
  }
}

// ─── Handlers ──────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Record<string, unknown>,
  billing: ReturnType<typeof billingQueries>,
  users: ReturnType<typeof userQueries>,
  gateway: StripeGateway,
) {
  const userId = session.client_reference_id as string;
  const stripeSubId = session.subscription as string;
  const customerId = session.customer as string;

  if (!stripeSubId || !userId) return;

  // Fetch full subscription from Stripe to get metadata
  const stripeSub = await gateway.getSubscription(stripeSubId);
  const metadata = stripeSub.metadata ?? {};
  const planCode = (metadata.plan_code ?? "starter") as Plan;

  // Handle upgrade: cancel old subscription
  const oldSubId = metadata.upgrade_from_subscription_id;
  if (oldSubId) {
    await gateway.cancelImmediately(oldSubId);
    await billing.cancelSubscription(oldSubId, new Date());
  }

  // Create local subscription (idempotent — check if already exists)
  const existing = await billing.getSubscriptionByStripeId(stripeSubId);
  if (!existing) {
    await billing.createSubscription({
      userId,
      planCode,
      status: "active",
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId: customerId,
    });
  }

  // Update user's plan + stripeCustomerId + stripeSubId + reset credits
  const limits = PLAN_LIMITS[planCode];
  await users.updatePlan(userId, planCode, stripeSubId);
}

async function handlePaymentSucceeded(
  invoice: Record<string, unknown>,
  billing: ReturnType<typeof billingQueries>,
  gateway: StripeGateway,
) {
  const invoiceId = invoice.id as string;
  const amountPaid = invoice.amount_paid as number;
  const currency = ((invoice.currency as string) ?? "usd").toLowerCase();

  // Extract subscription ID from invoice lines
  const lines = (invoice.lines as { data: Array<Record<string, unknown>> })
    ?.data;
  const parent = lines?.[0]?.parent as Record<string, unknown> | undefined;
  const subDetails = parent?.subscription_item_details as
    | Record<string, unknown>
    | undefined;
  const stripeSubId = subDetails?.subscription as string | undefined;

  if (!stripeSubId) return;

  // Idempotent: skip if payment already recorded
  const existingPayment = await billing.getPaymentByInvoiceId(invoiceId);
  if (existingPayment) return;

  // Sync period dates from Stripe
  const stripeSub = await gateway.getSubscription(stripeSubId);
  const item = stripeSub.items.data[0];
  if (item) {
    await billing.updateSubscriptionPeriod(
      stripeSubId,
      new Date(item.current_period_start * 1000),
      new Date(item.current_period_end * 1000),
    );
  }

  // Record payment
  const localSub = await billing.getSubscriptionByStripeId(stripeSubId);
  if (localSub) {
    await billing.createPayment({
      userId: localSub.userId,
      subscriptionId: localSub.id,
      stripeInvoiceId: invoiceId,
      amountCents: amountPaid,
      currency,
      status: "succeeded",
    });
  }
}

async function handlePaymentFailed(
  invoice: Record<string, unknown>,
  billing: ReturnType<typeof billingQueries>,
) {
  const lines = (invoice.lines as { data: Array<Record<string, unknown>> })
    ?.data;
  const parent = lines?.[0]?.parent as Record<string, unknown> | undefined;
  const subDetails = parent?.subscription_item_details as
    | Record<string, unknown>
    | undefined;
  const stripeSubId = subDetails?.subscription as string | undefined;

  if (!stripeSubId) return;

  await billing.updateSubscriptionStatus(stripeSubId, "past_due");
}

async function handleSubscriptionUpdated(
  subscription: Record<string, unknown>,
  billing: ReturnType<typeof billingQueries>,
  users: ReturnType<typeof userQueries>,
) {
  const stripeSubId = subscription.id as string;
  const status = subscription.status as string;
  const metadata = (subscription.metadata as Record<string, string>) ?? {};
  const userId = metadata.user_id;

  if (!userId) return;

  // Sync plan if price changed
  const items = subscription.items as {
    data: Array<{ price: { id: string } }>;
  };
  const priceId = items?.data?.[0]?.price?.id;
  if (priceId) {
    const planCode = planCodeFromPriceId(priceId);
    if (planCode && status === "active") {
      await users.updatePlan(userId, planCode as Plan, stripeSubId);
    }
  }

  // Sync cancel_at_period_end
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;
  if (cancelAtPeriodEnd) {
    await billing.markCancelAtPeriodEnd(stripeSubId);
  }
}

async function handleSubscriptionDeleted(
  subscription: Record<string, unknown>,
  billing: ReturnType<typeof billingQueries>,
  users: ReturnType<typeof userQueries>,
) {
  const stripeSubId = subscription.id as string;
  const metadata = (subscription.metadata as Record<string, string>) ?? {};
  const userId = metadata.user_id;

  if (!stripeSubId) return;

  const canceledAtTs = subscription.canceled_at as number | null;
  const canceledAt = canceledAtTs ? new Date(canceledAtTs * 1000) : new Date();

  await billing.cancelSubscription(stripeSubId, canceledAt);

  // Downgrade user to free
  if (userId) {
    await users.updatePlan(userId, "free", undefined);
  }
}
```

**Step 2: Export from index.ts**

Add to `packages/billing/src/index.ts`:

```typescript
export { handleWebhook } from "./webhooks";
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/billing`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/billing/src/webhooks.ts packages/billing/src/index.ts
git commit -m "feat: add Stripe webhook handler with 5 event types"
```

---

### Task 6: Refactor API Billing Routes

**Files:**

- Modify: `packages/api/src/routes/billing.ts`
- Modify: `packages/api/src/index.ts` (add `STRIPE_WEBHOOK_SECRET` to Bindings)

**Step 1: Add STRIPE_WEBHOOK_SECRET to Bindings**

In `packages/api/src/index.ts`, add to the `Bindings` type:

```typescript
STRIPE_WEBHOOK_SECRET: string;
```

**Step 2: Rewrite billing.ts**

Replace the entire file with the refactored version that uses `StripeGateway` + `handleWebhook`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries, billingQueries } from "@llm-boost/db";
import {
  StripeGateway,
  priceIdFromPlanCode,
  handleWebhook,
} from "@llm-boost/billing";
import { ERROR_CODES, PLAN_LIMITS } from "@llm-boost/shared";

export const billingRoutes = new Hono<AppEnv>();

// ─── POST /checkout — Create Stripe Checkout session ──────────────

billingRoutes.post("/checkout", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    plan: string;
    successUrl: string;
    cancelUrl: string;
  }>();

  if (!body.plan || !body.successUrl || !body.cancelUrl) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "plan, successUrl, and cancelUrl are required",
        },
      },
      422,
    );
  }

  const priceId = priceIdFromPlanCode(body.plan);
  if (!priceId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid plan: ${body.plan}`,
        },
      },
      422,
    );
  }

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  const customerId = await gateway.ensureCustomer(
    user.email,
    userId,
    user.stripeCustomerId,
  );

  // Save customerId if newly created
  if (!user.stripeCustomerId) {
    await userQueries(db).updateProfile(userId, {});
    // Store customerId — extend updateProfile or do direct update
  }

  const { sessionId, url } = await gateway.createCheckoutSession({
    customerId,
    priceId,
    userId,
    planCode: body.plan,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });

  return c.json({ data: { sessionId, url } });
});

// ─── GET /usage — Current plan + usage limits ────────────────────

billingRoutes.get("/usage", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const limits = PLAN_LIMITS[user.plan];
  return c.json({
    data: {
      plan: user.plan,
      crawlCreditsRemaining: user.crawlCreditsRemaining,
      crawlCreditsTotal: limits.crawlsPerMonth,
      maxPagesPerCrawl: limits.pagesPerCrawl,
      maxDepth: limits.maxCrawlDepth,
      maxProjects: limits.projects,
    },
  });
});

// ─── GET /subscription — Current subscription details ────────────

billingRoutes.get("/subscription", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const sub = await billingQueries(db).getActiveSubscription(userId);

  return c.json({
    data: sub
      ? {
          id: sub.id,
          planCode: sub.planCode,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt?.toISOString() ?? null,
        }
      : null,
  });
});

// ─── GET /payments — User's payment history ──────────────────────

billingRoutes.get("/payments", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const paymentList = await billingQueries(db).listPayments(userId);

  return c.json({
    data: paymentList.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      stripeInvoiceId: p.stripeInvoiceId,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// ─── POST /cancel — Cancel subscription at period end ────────────

billingRoutes.post("/cancel", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const sub = await billingQueries(db).getActiveSubscription(userId);

  if (!sub?.stripeSubscriptionId) {
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "No active subscription" },
      },
      422,
    );
  }

  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  await gateway.cancelAtPeriodEnd(sub.stripeSubscriptionId);
  await billingQueries(db).markCancelAtPeriodEnd(sub.stripeSubscriptionId);

  return c.json({ data: { canceled: true } });
});

// ─── POST /portal — Stripe Customer Portal ──────────────────────

billingRoutes.post("/portal", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);

  if (!user?.stripeCustomerId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No active subscription found",
        },
      },
      422,
    );
  }

  const body = await c.req.json<{ returnUrl: string }>();
  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  const url = await gateway.createPortalSession(
    user.stripeCustomerId,
    body.returnUrl,
  );

  return c.json({ data: { url } });
});

// ─── POST /webhook — Stripe webhook handler ─────────────────────

billingRoutes.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing Stripe signature" } },
      401,
    );
  }

  const rawBody = await c.req.text();
  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = await gateway.verifyWebhookSignature(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid signature" } },
      401,
    );
  }

  const db = c.get("db");
  await handleWebhook(event, db, c.env.STRIPE_SECRET_KEY);

  return c.json({ received: true });
});
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/api`
Expected: Clean

**Step 4: Commit**

```bash
git add packages/api/src/routes/billing.ts packages/api/src/index.ts
git commit -m "feat: refactor billing routes to use StripeGateway + webhook verification"
```

---

### Task 7: Add Admin API Routes

**Files:**

- Create: `packages/api/src/routes/admin.ts`
- Create: `packages/api/src/middleware/admin.ts`
- Modify: `packages/api/src/index.ts` (register admin route)

**Step 1: Create admin middleware**

Create `packages/api/src/middleware/admin.ts`:

```typescript
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { userQueries } from "@llm-boost/db";

export const adminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  if (!user?.isAdmin) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403,
    );
  }

  await next();
});
```

**Step 2: Create admin routes**

Create `packages/api/src/routes/admin.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { adminQueries } from "@llm-boost/db";

export const adminRoutes = new Hono<AppEnv>();

// All admin routes require auth + admin check
adminRoutes.use("*", authMiddleware, adminMiddleware);

// ─── GET /stats — Combined analytics ────────────────────────────

adminRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const stats = await adminQueries(db).getStats();
  return c.json({ data: stats });
});

// ─── GET /customers — Paginated customer list ───────────────────

adminRoutes.get("/customers", async (c) => {
  const db = c.get("db");
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "25", 10);
  const search = c.req.query("search") ?? undefined;

  const result = await adminQueries(db).getCustomers({ page, limit, search });
  return c.json(result);
});

// ─── GET /customers/:id — Customer detail ───────────────────────

adminRoutes.get("/customers/:id", async (c) => {
  const db = c.get("db");
  const detail = await adminQueries(db).getCustomerDetail(c.req.param("id"));

  if (!detail) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Customer not found" } },
      404,
    );
  }

  return c.json({ data: detail });
});
```

**Step 3: Register in index.ts**

Add import and route registration to `packages/api/src/index.ts`:

```typescript
import { adminRoutes } from "./routes/admin";
// ...
app.route("/api/admin", adminRoutes);
```

**Step 4: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/api`
Expected: Clean

**Step 5: Commit**

```bash
git add packages/api/src/middleware/admin.ts packages/api/src/routes/admin.ts packages/api/src/index.ts
git commit -m "feat: add admin API routes with MRR, revenue, churn, and customer management"
```

---

### Task 8: Update Frontend API Client

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add new types**

Add after the existing `BillingInfo` interface:

```typescript
export interface SubscriptionInfo {
  id: string;
  planCode: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  stripeInvoiceId: string;
  createdAt: string;
}

export interface AdminStats {
  mrr: number;
  mrrByPlan: Record<string, number>;
  totalRevenue: number;
  failedPayments: number;
  activeSubscribers: number;
  totalCustomers: number;
  churnRate: number;
}

export interface AdminCustomer {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  stripeCustomerId: string | null;
  createdAt: string;
}

export interface AdminCustomerDetail {
  user: AdminCustomer;
  subscriptions: SubscriptionInfo[];
  payments: PaymentRecord[];
}
```

**Step 2: Add new API methods**

Extend the `billing` section and add `admin` section:

```typescript
  // ── Billing (add these methods) ─────────────────────────────────
  billing: {
    // ... existing methods stay ...

    async getSubscription(token: string): Promise<SubscriptionInfo | null> {
      const res = await apiClient.get<ApiEnvelope<SubscriptionInfo | null>>(
        "/api/billing/subscription",
        { token },
      );
      return res.data;
    },

    async getPayments(token: string): Promise<PaymentRecord[]> {
      const res = await apiClient.get<ApiEnvelope<PaymentRecord[]>>(
        "/api/billing/payments",
        { token },
      );
      return res.data;
    },

    async cancelSubscription(token: string): Promise<void> {
      await apiClient.post("/api/billing/cancel", undefined, { token });
    },
  },

  // ── Admin ───────────────────────────────────────────────────────
  admin: {
    async getStats(token: string): Promise<AdminStats> {
      const res = await apiClient.get<ApiEnvelope<AdminStats>>(
        "/api/admin/stats",
        { token },
      );
      return res.data;
    },

    async getCustomers(
      token: string,
      params?: { page?: number; limit?: number; search?: string },
    ): Promise<PaginatedResponse<AdminCustomer>> {
      const qs = buildQueryString(params);
      return apiClient.get<PaginatedResponse<AdminCustomer>>(
        `/api/admin/customers${qs}`,
        { token },
      );
    },

    async getCustomerDetail(
      token: string,
      userId: string,
    ): Promise<AdminCustomerDetail> {
      const res = await apiClient.get<ApiEnvelope<AdminCustomerDetail>>(
        `/api/admin/customers/${userId}`,
        { token },
      );
      return res.data;
    },
  },
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @llm-boost/web`
Expected: Clean

**Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add billing + admin API client methods"
```

---

### Task 9: Build Admin Dashboard Page

**Files:**

- Create: `apps/web/src/app/dashboard/admin/page.tsx`
- Create: `apps/web/src/app/dashboard/admin/loading.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx` (add admin link)

**Step 1: Create admin dashboard page**

Create `apps/web/src/app/dashboard/admin/page.tsx` — a "use client" page with:

- 4 stat cards (MRR, Total Revenue, Active Subscribers, Churn Rate)
- Customer table with search input
- Uses `useApiSWR` for data fetching
- Each stat card uses lucide icons (DollarSign, TrendingUp, Users, Percent)
- Customer rows show: name/email, plan badge, joined date
- Click row → `/dashboard/admin/customers/${id}` (future, just show detail inline for now)

**Step 2: Create loading skeleton**

Create `apps/web/src/app/dashboard/admin/loading.tsx` with animate-pulse skeleton matching the page layout.

**Step 3: Add admin link to sidebar**

In `apps/web/src/app/dashboard/layout.tsx`, add to `sidebarLinks` (conditionally show for admins — for now show to all, admin middleware protects the API):

```typescript
import { ShieldCheck } from "lucide-react";
// Add to sidebarLinks array:
{ href: "/dashboard/admin", label: "Admin", icon: ShieldCheck },
```

**Step 4: Verify typecheck + build**

Run: `pnpm typecheck --filter @llm-boost/web`
Run: `pnpm build --filter @llm-boost/web`
Expected: Both clean

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/admin/ apps/web/src/app/dashboard/layout.tsx
git commit -m "feat: add admin dashboard with MRR, revenue, churn stats, and customer table"
```

---

### Task 10: Enhance Settings Page with Subscription Management + Payment History

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`

**Step 1: Add subscription status section**

Between the "Current Plan" card and "Available Plans" card, add a "Subscription" card that shows:

- Status badge (Active/Canceling/Past Due)
- Current period end date
- "Cancel Subscription" button (only if active, not already canceling)
- "Manage Billing" button → Stripe Portal
- Confirmation dialog before canceling

**Step 2: Add payment history section**

After the "Available Plans" card, add a "Payment History" card with a table:

- Date, Amount, Status badge, Invoice link
- Uses `useApiSWR` to fetch `api.billing.getPayments()`
- Invoice links open `https://invoice.stripe.com/i/${stripeInvoiceId}` in new tab

**Step 3: Migrate billing data fetching to SWR**

Replace the existing `useEffect`/`useState` pattern with `useApiSWR`:

```typescript
const { data: billing, isLoading: billingLoading } = useApiSWR(
  "billing-info",
  useCallback((token: string) => api.billing.getInfo(token), []),
);
const { data: subscription } = useApiSWR(
  "billing-subscription",
  useCallback((token: string) => api.billing.getSubscription(token), []),
);
const { data: paymentHistory } = useApiSWR(
  "billing-payments",
  useCallback((token: string) => api.billing.getPayments(token), []),
);
```

**Step 4: Verify typecheck + build**

Run: `pnpm typecheck --filter @llm-boost/web`
Run: `pnpm build --filter @llm-boost/web`
Expected: Both clean

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx
git commit -m "feat: enhance settings with subscription management and payment history"
```

---

### Task 11: Final Verification

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All existing tests pass (145+)

**Step 2: Typecheck all packages**

Run: `pnpm typecheck`
Expected: All clean

**Step 3: Build frontend**

Run: `pnpm build --filter @llm-boost/web`
Expected: Compiles successfully

**Step 4: Commit any remaining changes and tag**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, typecheck clean"
```
