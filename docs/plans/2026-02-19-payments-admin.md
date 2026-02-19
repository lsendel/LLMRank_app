# Payments, Subscriptions & Admin Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the billing system with subscription downgrades, user blocking, a full Stripe-native coupon/promo code system, and admin subscription management.

**Architecture:** Stripe-native approach — all coupons and subscription changes go through Stripe's API first, then sync locally via webhooks. The `packages/billing` gateway handles raw Stripe calls, `apps/api` services handle business logic, and `packages/db` stores the local mirror.

**Tech Stack:** Stripe API (raw fetch, no SDK), Drizzle ORM (pgTable/pgEnum), Hono routes, React (SWR + shadcn/ui)

---

### Task 1: Add user status enum and columns to DB schema

**Files:**

- Modify: `packages/db/src/schema.ts:20` (add enum after planEnum)
- Modify: `packages/db/src/schema.ts:164-193` (add columns to users table)

**Step 1: Add the `userStatusEnum` after line 20**

In `packages/db/src/schema.ts`, after the `planEnum` line, add:

```ts
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);
```

**Step 2: Add status columns to the users table**

In the `users` table definition (line 164), add these columns after `isAdmin` (line 184):

```ts
  status: userStatusEnum("status").notNull().default("active"),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
```

**Step 3: Push schema and verify**

Run: `cd packages/db && export $(grep -v '^#' ../../.env | grep DATABASE_URL | xargs) && npx drizzle-kit push`
Expected: New enum and columns created successfully.

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add user_status enum and status columns to users table"
```

---

### Task 2: Add promos table to DB schema

**Files:**

- Modify: `packages/db/src/schema.ts` (add enums + table after payments table ~line 576)

**Step 1: Add promo-related enums after `keywordSourceEnum` (~line 158)**

```ts
export const discountTypeEnum = pgEnum("discount_type", [
  "percent_off",
  "amount_off",
  "free_months",
]);

export const promoDurationEnum = pgEnum("promo_duration", [
  "once",
  "repeating",
  "forever",
]);
```

**Step 2: Add the promos table after the payments table (~line 576)**

```ts
// ---------------------------------------------------------------------------
// Promos / Coupons
// ---------------------------------------------------------------------------

export const promos = pgTable(
  "promos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    stripeCouponId: text("stripe_coupon_id").notNull(),
    stripePromotionCodeId: text("stripe_promotion_code_id"),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    duration: promoDurationEnum("duration").notNull(),
    durationMonths: integer("duration_months"),
    maxRedemptions: integer("max_redemptions"),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_promos_code").on(t.code),
    index("idx_promos_active").on(t.active),
  ],
);
```

**Step 3: Push schema**

Run: `cd packages/db && export $(grep -v '^#' ../../.env | grep DATABASE_URL | xargs) && npx drizzle-kit push`

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add promos table with discount_type and promo_duration enums"
```

---

### Task 3: Add user status query + promo queries to DB package

**Files:**

- Modify: `packages/db/src/queries/users.ts` (add updateStatus)
- Create: `packages/db/src/queries/promos.ts`
- Modify: `packages/db/src/index.ts` (export promoQueries)

**Step 1: Add `updateStatus` to userQueries**

In `packages/db/src/queries/users.ts`, add this method inside the returned object (after `resetCrawlCreditsForPlan`, ~line 108):

```ts
    async updateStatus(
      id: string,
      status: "active" | "suspended" | "banned",
      reason?: string,
    ) {
      const [updated] = await db
        .update(users)
        .set({
          status,
          suspendedAt: status !== "active" ? new Date() : null,
          suspendedReason: reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return updated;
    },
```

Also add `userStatusEnum` to the imports from `../schema` at line 3:

```ts
import { users, planEnum, personaEnum, userStatusEnum } from "../schema";
```

**Step 2: Create `packages/db/src/queries/promos.ts`**

```ts
import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { promos } from "../schema";

export function promoQueries(db: Database) {
  return {
    async getByCode(code: string) {
      return db.query.promos.findFirst({
        where: and(
          eq(promos.code, code.toUpperCase()),
          eq(promos.active, true),
        ),
      });
    },

    async getById(id: string) {
      return db.query.promos.findFirst({
        where: eq(promos.id, id),
      });
    },

    async list() {
      return db.query.promos.findMany({
        orderBy: desc(promos.createdAt),
      });
    },

    async create(data: {
      code: string;
      stripeCouponId: string;
      stripePromotionCodeId?: string;
      discountType: "percent_off" | "amount_off" | "free_months";
      discountValue: number;
      duration: "once" | "repeating" | "forever";
      durationMonths?: number;
      maxRedemptions?: number;
      expiresAt?: Date;
      createdBy?: string;
    }) {
      const [promo] = await db
        .insert(promos)
        .values({ ...data, code: data.code.toUpperCase() })
        .returning();
      return promo;
    },

    async incrementRedeemed(id: string) {
      const [updated] = await db
        .update(promos)
        .set({ timesRedeemed: sql`${promos.timesRedeemed} + 1` })
        .where(eq(promos.id, id))
        .returning();
      return updated;
    },

    async deactivate(id: string) {
      const [updated] = await db
        .update(promos)
        .set({ active: false })
        .where(eq(promos.id, id))
        .returning();
      return updated;
    },
  };
}
```

**Step 3: Export from `packages/db/src/index.ts`**

Add after the `savedKeywordQueries` export line:

```ts
export { promoQueries } from "./queries/promos";
```

**Step 4: Verify build**

Run: `cd packages/db && pnpm build`
Expected: Clean build

**Step 5: Commit**

```bash
git add packages/db/src/queries/users.ts packages/db/src/queries/promos.ts packages/db/src/index.ts
git commit -m "feat(db): add user updateStatus query and promo CRUD queries"
```

---

### Task 4: Add Stripe gateway methods for downgrades, coupons, and discounts

**Files:**

- Modify: `packages/billing/src/gateway.ts` (add methods to StripeGateway class)

**Step 1: Add subscription update method (for downgrades)**

Add to the `StripeGateway` class, after `cancelImmediately` (~line 277):

```ts
  /**
   * Update a subscription's price (for downgrades).
   * proration_behavior "none" means the change takes effect at next renewal.
   */
  async updateSubscriptionPrice(
    subscriptionId: string,
    itemId: string,
    newPriceId: string,
  ): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "POST",
      `/subscriptions/${subscriptionId}`,
      {
        "items[0][id]": itemId,
        "items[0][price]": newPriceId,
        proration_behavior: "none",
      },
    );
  }

  /**
   * Create a Stripe coupon.
   */
  async createCoupon(opts: {
    percentOff?: number;
    amountOff?: number;
    currency?: string;
    duration: "once" | "repeating" | "forever";
    durationInMonths?: number;
    name?: string;
  }): Promise<{ id: string }> {
    const params: Record<string, string> = {
      duration: opts.duration,
    };
    if (opts.percentOff != null) params.percent_off = String(opts.percentOff);
    if (opts.amountOff != null) {
      params.amount_off = String(opts.amountOff);
      params.currency = opts.currency ?? "usd";
    }
    if (opts.durationInMonths != null)
      params.duration_in_months = String(opts.durationInMonths);
    if (opts.name) params.name = opts.name;

    return stripeRequest<{ id: string }>(
      this.secretKey,
      "POST",
      "/coupons",
      params,
    );
  }

  /**
   * Create a Stripe promotion code (the user-facing code linked to a coupon).
   */
  async createPromotionCode(
    couponId: string,
    code: string,
    opts?: { maxRedemptions?: number; expiresAt?: number },
  ): Promise<{ id: string; code: string }> {
    const params: Record<string, string> = {
      coupon: couponId,
      code: code.toUpperCase(),
    };
    if (opts?.maxRedemptions != null)
      params.max_redemptions = String(opts.maxRedemptions);
    if (opts?.expiresAt != null)
      params.expires_at = String(opts.expiresAt);

    return stripeRequest<{ id: string; code: string }>(
      this.secretKey,
      "POST",
      "/promotion_codes",
      params,
    );
  }

  /**
   * Apply a coupon to an existing subscription.
   */
  async applyDiscountToSubscription(
    subscriptionId: string,
    couponId: string,
  ): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "POST",
      `/subscriptions/${subscriptionId}`,
      { coupon: couponId },
    );
  }

  /**
   * Deactivate a Stripe promotion code.
   */
  async deactivatePromotionCode(
    promotionCodeId: string,
  ): Promise<{ id: string; active: boolean }> {
    return stripeRequest<{ id: string; active: boolean }>(
      this.secretKey,
      "POST",
      `/promotion_codes/${promotionCodeId}`,
      { active: "false" },
    );
  }

  /**
   * Delete a Stripe coupon (also deactivates linked promotion codes).
   */
  async deleteCoupon(couponId: string): Promise<void> {
    await stripeRequest<{ id: string; deleted: boolean }>(
      this.secretKey,
      "DELETE",
      `/coupons/${couponId}`,
    );
  }
```

**Step 2: Verify build**

Run: `cd packages/billing && pnpm build`

**Step 3: Commit**

```bash
git add packages/billing/src/gateway.ts
git commit -m "feat(billing): add gateway methods for downgrades, coupons, and discounts"
```

---

### Task 5: Add downgrade endpoint to billing routes

**Files:**

- Modify: `apps/api/src/services/billing-service.ts` (add `downgrade` method)
- Modify: `apps/api/src/routes/billing.ts` (add `POST /downgrade` route)

**Step 1: Add `downgrade` to billing service**

In `apps/api/src/services/billing-service.ts`, add after `cancelAtPeriodEnd` (~line 88):

```ts
    async downgrade(args: {
      userId: string;
      targetPlan: string;
      stripeSecretKey: string;
    }) {
      const user = await deps.users.getById(args.userId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", 404, "User not found");
      }

      // Downgrade to free = cancel subscription
      if (args.targetPlan === "free") {
        return this.cancelAtPeriodEnd(args.userId, args.stripeSecretKey);
      }

      const targetPriceId = priceIdFromPlanCode(args.targetPlan);
      if (!targetPriceId) {
        throw new ServiceError("VALIDATION_ERROR", 422, `Invalid plan: ${args.targetPlan}`);
      }

      const subscription = await deps.billing.getActiveSubscription(args.userId);
      if (!subscription?.stripeSubscriptionId) {
        throw new ServiceError("VALIDATION_ERROR", 422, "No active subscription to downgrade");
      }

      const gateway = new StripeGateway(args.stripeSecretKey);
      const stripeSub = await gateway.getSubscription(subscription.stripeSubscriptionId);
      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        throw new ServiceError("VALIDATION_ERROR", 422, "Subscription has no items");
      }

      await gateway.updateSubscriptionPrice(
        subscription.stripeSubscriptionId,
        itemId,
        targetPriceId,
      );

      return { downgraded: true, targetPlan: args.targetPlan };
    },
```

**Step 2: Add route in `apps/api/src/routes/billing.ts`**

After the `/cancel` route (~line 142), add:

```ts
// ─── POST /downgrade — Downgrade subscription at period end ─────
billingRoutes.post("/downgrade", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{ plan: string }>();

  if (!body.plan) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "plan is required" } },
      422,
    );
  }

  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.downgrade({
      userId,
      targetPlan: body.plan,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 3: Verify typecheck**

Run: `pnpm --filter api typecheck`

**Step 4: Commit**

```bash
git add apps/api/src/services/billing-service.ts apps/api/src/routes/billing.ts
git commit -m "feat(api): add subscription downgrade endpoint"
```

---

### Task 6: Add validate-promo and update checkout with promo code support

**Files:**

- Modify: `apps/api/src/routes/billing.ts` (add validate-promo, update checkout)
- Modify: `apps/api/src/services/billing-service.ts` (add validatePromo, update checkout)

**Step 1: Add validatePromo and update checkout in billing service**

In `apps/api/src/services/billing-service.ts`, add at the top:

```ts
import { promoQueries } from "@llm-boost/db";
```

Add method after `downgrade`:

```ts
    async validatePromo(code: string, db: Parameters<typeof promoQueries>[0]) {
      const promo = await promoQueries(db).getByCode(code);
      if (!promo) {
        throw new ServiceError("NOT_FOUND", 404, "Promo code not found");
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new ServiceError("VALIDATION_ERROR", 422, "Promo code has expired");
      }
      if (promo.maxRedemptions && promo.timesRedeemed >= promo.maxRedemptions) {
        throw new ServiceError("VALIDATION_ERROR", 422, "Promo code has reached maximum redemptions");
      }
      return {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        duration: promo.duration,
        durationMonths: promo.durationMonths,
      };
    },
```

**Step 2: Update the `checkout` method to accept optional promo code**

In the `checkout` method, add `promoCode?: string` to the args type. Before `return gateway.createCheckoutSession(...)`, add promo lookup:

```ts
let stripePromotionCodeId: string | undefined;
if (args.promoCode) {
  const promo = await promoQueries(args.db).getByCode(args.promoCode);
  if (promo?.stripePromotionCodeId) {
    stripePromotionCodeId = promo.stripePromotionCodeId;
  }
}
```

Pass it through to the gateway by updating `createCheckoutSession` — add `promotionCodeId?: string` to the opts in `gateway.ts` and add to params:

```ts
if (opts.promotionCodeId) {
  params["discounts[0][promotion_code]"] = opts.promotionCodeId;
}
```

**Step 3: Add routes**

In `apps/api/src/routes/billing.ts`, add:

```ts
// ─── POST /validate-promo — Validate a promo code ──────────────
billingRoutes.post("/validate-promo", async (c) => {
  const body = await c.req.json<{ code: string }>();
  if (!body.code?.trim()) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "code is required" } },
      422,
    );
  }

  const db = c.get("db");
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.validatePromo(body.code.trim(), db);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

Update the checkout route to pass `promoCode` from the request body and `db` to the service.

**Step 4: Verify typecheck**

Run: `pnpm --filter api typecheck`

**Step 5: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/services/billing-service.ts packages/billing/src/gateway.ts
git commit -m "feat(api): add promo code validation and checkout integration"
```

---

### Task 7: Add user blocking to auth middleware

**Files:**

- Modify: `apps/api/src/middleware/auth.ts`

**Step 1: Add status check after session validation**

After `c.set("userId", session.user.id)` (line 28), add a user status check:

```ts
// Check if user is blocked/suspended
const { userQueries } = await import("@llm-boost/db");
const db = c.get("db");
const user = await userQueries(db).getById(session.user.id);
if (user && user.status !== "active") {
  return c.json(
    {
      error: {
        code: "ACCOUNT_SUSPENDED",
        message:
          user.status === "banned"
            ? "Your account has been permanently banned."
            : "Your account has been suspended. Contact support for assistance.",
      },
    },
    403,
  );
}
```

**Step 2: Verify typecheck**

Run: `pnpm --filter api typecheck`

**Step 3: Commit**

```bash
git add apps/api/src/middleware/auth.ts
git commit -m "feat(api): block suspended/banned users in auth middleware"
```

---

### Task 8: Add admin endpoints for user blocking and subscription management

**Files:**

- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/services/admin-service.ts`

**Step 1: Add blocking/unblocking endpoints to admin routes**

In `apps/api/src/routes/admin.ts`, add after the outbox replay route (~line 124):

```ts
// ─── POST /customers/:id/block — Ban a user ────────────────────
adminRoutes.post("/customers/:id/block", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };

  const service = buildAdminService(c);
  try {
    const result = await service.blockUser({
      targetId,
      adminId,
      reason: body.reason,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/suspend — Suspend a user ──────────────
adminRoutes.post("/customers/:id/suspend", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };

  const service = buildAdminService(c);
  try {
    const result = await service.suspendUser({
      targetId,
      adminId,
      reason: body.reason,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/unblock — Restore a user ──────────────
adminRoutes.post("/customers/:id/unblock", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");

  const service = buildAdminService(c);
  try {
    const result = await service.unblockUser({ targetId, adminId, db });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/change-plan — Admin force plan change ──
adminRoutes.post("/customers/:id/change-plan", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = await c.req.json<{ plan: string }>();

  if (!body.plan) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "plan is required" } },
      422,
    );
  }

  const service = buildAdminService(c);
  try {
    const result = await service.changeUserPlan({
      targetId,
      adminId,
      plan: body.plan,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/cancel-subscription — Admin cancel sub ─
adminRoutes.post("/customers/:id/cancel-subscription", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");

  const service = buildAdminService(c);
  try {
    const result = await service.cancelUserSubscription({
      targetId,
      adminId,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Add service methods to `apps/api/src/services/admin-service.ts`**

Add imports at top:

```ts
import { userQueries, billingQueries, type Database } from "@llm-boost/db";
import { StripeGateway } from "@llm-boost/billing";
import type { PlanTier } from "@llm-boost/shared";
```

Add methods to the returned object:

```ts
    async blockUser(args: {
      targetId: string;
      adminId: string;
      reason?: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      // Cancel Stripe subscription if exists
      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);
      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
        await usersQ.updatePlan(args.targetId, "free", undefined);
      }

      await usersQ.updateStatus(args.targetId, "banned", args.reason);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "block_user",
        targetType: "user",
        targetId: args.targetId,
        reason: args.reason,
      });
      return { blocked: true };
    },

    async suspendUser(args: {
      targetId: string;
      adminId: string;
      reason?: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);
      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
        await usersQ.updatePlan(args.targetId, "free", undefined);
      }

      await usersQ.updateStatus(args.targetId, "suspended", args.reason);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "suspend_user",
        targetType: "user",
        targetId: args.targetId,
        reason: args.reason,
      });
      return { suspended: true };
    },

    async unblockUser(args: {
      targetId: string;
      adminId: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      await usersQ.updateStatus(args.targetId, "active");
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "unblock_user",
        targetType: "user",
        targetId: args.targetId,
      });
      return { unblocked: true };
    },

    async changeUserPlan(args: {
      targetId: string;
      adminId: string;
      plan: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const user = await usersQ.getById(args.targetId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      await usersQ.updatePlan(args.targetId, args.plan as PlanTier, user.stripeSubId ?? undefined);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "change_plan",
        targetType: "user",
        targetId: args.targetId,
        reason: `Changed plan to ${args.plan}`,
      });
      return { plan: args.plan };
    },

    async cancelUserSubscription(args: {
      targetId: string;
      adminId: string;
      stripeSecretKey: string;
      db: Database;
    }) {
      const usersQ = userQueries(args.db);
      const billing = billingQueries(args.db);
      const sub = await billing.getActiveSubscription(args.targetId);

      if (sub?.stripeSubscriptionId) {
        const gateway = new StripeGateway(args.stripeSecretKey);
        await gateway.cancelImmediately(sub.stripeSubscriptionId);
        await billing.cancelSubscription(sub.stripeSubscriptionId, new Date());
      }

      await usersQ.updatePlan(args.targetId, "free", undefined);
      await deps.admin.recordAction({
        actorId: args.adminId,
        action: "cancel_subscription",
        targetType: "user",
        targetId: args.targetId,
      });
      return { canceled: true };
    },
```

**Step 3: Verify typecheck**

Run: `pnpm --filter api typecheck`

**Step 4: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/services/admin-service.ts
git commit -m "feat(api): add admin endpoints for user blocking and subscription management"
```

---

### Task 9: Add admin promo CRUD endpoints

**Files:**

- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/services/admin-service.ts`

**Step 1: Add promo routes to admin**

Add to `apps/api/src/routes/admin.ts`:

```ts
// ─── GET /promos — List all promo codes ─────────────────────────
adminRoutes.get("/promos", async (c) => {
  const db = c.get("db");
  const { promoQueries } = await import("@llm-boost/db");
  const promoList = await promoQueries(db).list();
  return c.json({ data: promoList });
});

// ─── POST /promos — Create a promo code ─────────────────────────
adminRoutes.post("/promos", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const body = await c.req.json<{
    code: string;
    discountType: "percent_off" | "amount_off" | "free_months";
    discountValue: number;
    duration: "once" | "repeating" | "forever";
    durationMonths?: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }>();

  if (
    !body.code?.trim() ||
    !body.discountType ||
    !body.discountValue ||
    !body.duration
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "code, discountType, discountValue, and duration are required",
        },
      },
      422,
    );
  }

  try {
    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);

    // Build Stripe coupon params
    const couponOpts: Parameters<typeof gateway.createCoupon>[0] = {
      duration: body.duration,
      name: `Promo: ${body.code.toUpperCase()}`,
    };

    if (body.discountType === "percent_off") {
      couponOpts.percentOff = body.discountValue;
    } else if (body.discountType === "amount_off") {
      couponOpts.amountOff = body.discountValue;
    } else if (body.discountType === "free_months") {
      couponOpts.percentOff = 100;
      couponOpts.duration = "repeating";
      couponOpts.durationInMonths = body.discountValue;
    }

    if (body.duration === "repeating" && body.durationMonths) {
      couponOpts.durationInMonths = body.durationMonths;
    }

    const stripeCoupon = await gateway.createCoupon(couponOpts);

    const stripePromoCode = await gateway.createPromotionCode(
      stripeCoupon.id,
      body.code,
      {
        maxRedemptions: body.maxRedemptions ?? undefined,
        expiresAt: body.expiresAt
          ? Math.floor(new Date(body.expiresAt).getTime() / 1000)
          : undefined,
      },
    );

    const { promoQueries } = await import("@llm-boost/db");
    const promo = await promoQueries(db).create({
      code: body.code,
      stripeCouponId: stripeCoupon.id,
      stripePromotionCodeId: stripePromoCode.id,
      discountType: body.discountType,
      discountValue: body.discountValue,
      duration:
        body.discountType === "free_months" ? "repeating" : body.duration,
      durationMonths:
        body.discountType === "free_months"
          ? body.discountValue
          : body.durationMonths,
      maxRedemptions: body.maxRedemptions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      createdBy: adminId,
    });

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "create_promo",
      targetType: "promo",
      targetId: promo.id,
    });

    return c.json({ data: promo }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── DELETE /promos/:id — Deactivate a promo code ───────────────
adminRoutes.delete("/promos/:id", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const promoId = c.req.param("id");

  try {
    const { promoQueries } = await import("@llm-boost/db");
    const promo = await promoQueries(db).getById(promoId);
    if (!promo) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Promo not found" } },
        404,
      );
    }

    // Deactivate in Stripe
    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
    if (promo.stripePromotionCodeId) {
      await gateway.deactivatePromotionCode(promo.stripePromotionCodeId);
    }

    await promoQueries(db).deactivate(promoId);

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "deactivate_promo",
      targetType: "promo",
      targetId: promoId,
    });

    return c.json({ data: { deactivated: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/apply-promo — Apply promo to customer ──
adminRoutes.post("/customers/:id/apply-promo", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = await c.req.json<{ promoId: string }>();

  if (!body.promoId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "promoId is required" } },
      422,
    );
  }

  try {
    const { promoQueries, billingQueries: billingQ } =
      await import("@llm-boost/db");
    const promo = await promoQueries(db).getById(body.promoId);
    if (!promo || !promo.active) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Promo not found or inactive" },
        },
        404,
      );
    }

    const sub = await billingQ(db).getActiveSubscription(targetId);
    if (!sub?.stripeSubscriptionId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Customer has no active subscription",
          },
        },
        422,
      );
    }

    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
    await gateway.applyDiscountToSubscription(
      sub.stripeSubscriptionId,
      promo.stripeCouponId,
    );
    await promoQueries(db).incrementRedeemed(promo.id);

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "apply_promo",
      targetType: "user",
      targetId,
      reason: `Applied promo ${promo.code}`,
    });

    return c.json({ data: { applied: true, promoCode: promo.code } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Add `recordAction` as a public method on admin service**

In `apps/api/src/services/admin-service.ts`, expose it:

```ts
    recordAction(args: {
      actorId: string;
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
    }) {
      return deps.admin.recordAction(args);
    },
```

**Step 3: Add `StripeGateway` import to admin routes**

```ts
import { StripeGateway } from "@llm-boost/billing";
```

**Step 4: Verify typecheck**

Run: `pnpm --filter api typecheck`

**Step 5: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/services/admin-service.ts
git commit -m "feat(api): add admin promo CRUD and apply-promo endpoints"
```

---

### Task 10: Update frontend API client with new endpoints

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add new types**

After `PaymentRecord` (~line 436):

```ts
export interface PromoInfo {
  code: string;
  discountType: "percent_off" | "amount_off" | "free_months";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
}

export interface Promo {
  id: string;
  code: string;
  stripeCouponId: string;
  discountType: "percent_off" | "amount_off" | "free_months";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}
```

**Step 2: Add new billing methods**

In the `billing` namespace, add:

```ts
    async downgrade(plan: string): Promise<{ downgraded: boolean }> {
      const res = await apiClient.post<ApiEnvelope<{ downgraded: boolean }>>(
        "/api/billing/downgrade",
        { plan },
      );
      return res.data;
    },

    async validatePromo(code: string): Promise<PromoInfo> {
      const res = await apiClient.post<ApiEnvelope<PromoInfo>>(
        "/api/billing/validate-promo",
        { code },
      );
      return res.data;
    },
```

**Step 3: Add admin methods**

In the `admin` namespace, add:

```ts
    async blockUser(id: string, reason?: string) {
      return apiClient.post(`/api/admin/customers/${id}/block`, { reason });
    },
    async suspendUser(id: string, reason?: string) {
      return apiClient.post(`/api/admin/customers/${id}/suspend`, { reason });
    },
    async unblockUser(id: string) {
      return apiClient.post(`/api/admin/customers/${id}/unblock`, {});
    },
    async changeUserPlan(id: string, plan: string) {
      return apiClient.post(`/api/admin/customers/${id}/change-plan`, { plan });
    },
    async cancelUserSubscription(id: string) {
      return apiClient.post(`/api/admin/customers/${id}/cancel-subscription`, {});
    },
    async listPromos(): Promise<Promo[]> {
      const res = await apiClient.get<ApiEnvelope<Promo[]>>("/api/admin/promos");
      return res.data;
    },
    async createPromo(data: {
      code: string;
      discountType: string;
      discountValue: number;
      duration: string;
      durationMonths?: number;
      maxRedemptions?: number;
      expiresAt?: string;
    }): Promise<Promo> {
      const res = await apiClient.post<ApiEnvelope<Promo>>("/api/admin/promos", data);
      return res.data;
    },
    async deactivatePromo(id: string) {
      return apiClient.delete(`/api/admin/promos/${id}`);
    },
    async applyPromo(userId: string, promoId: string) {
      return apiClient.post(`/api/admin/customers/${userId}/apply-promo`, { promoId });
    },
```

**Step 4: Verify web build**

Run: `pnpm --filter web typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add API client methods for downgrades, promos, and admin actions"
```

---

### Task 11: Update billing-section.tsx with downgrade and promo code support

**Files:**

- Modify: `apps/web/src/components/settings/billing-section.tsx`

**Step 1: Add promo code input to the plan cards**

Add state for promo code:

```ts
const [promoCode, setPromoCode] = useState("");
const [promoValid, setPromoValid] = useState<PromoInfo | null>(null);
const [promoError, setPromoError] = useState<string | null>(null);
const [validatingPromo, setValidatingPromo] = useState(false);
```

Add promo validation handler:

```ts
async function handleValidatePromo() {
  if (!promoCode.trim()) return;
  setValidatingPromo(true);
  setPromoError(null);
  try {
    const info = await api.billing.validatePromo(promoCode.trim());
    setPromoValid(info);
  } catch (err) {
    setPromoValid(null);
    setPromoError(err instanceof Error ? err.message : "Invalid promo code");
  } finally {
    setValidatingPromo(false);
  }
}
```

**Step 2: Wire downgrade buttons to call `api.billing.downgrade(plan)`**

Replace the existing downgrade dialog confirmation to call `api.billing.downgrade(targetPlan)` instead of just canceling. For downgrades to free, keep existing cancel flow.

**Step 3: Add promo code input field to the upgrade card area**

Below the plan cards, add a promo code input:

```tsx
<div className="flex items-center gap-2">
  <Input
    placeholder="Promo code"
    value={promoCode}
    onChange={(e) => setPromoCode(e.target.value)}
    className="max-w-[200px]"
  />
  <Button
    variant="outline"
    size="sm"
    onClick={handleValidatePromo}
    disabled={validatingPromo}
  >
    {validatingPromo ? "Checking..." : "Apply"}
  </Button>
  {promoValid && (
    <Badge variant="default">
      {promoValid.discountType === "percent_off"
        ? `${promoValid.discountValue}% off`
        : promoValid.discountType === "free_months"
          ? `${promoValid.discountValue} free months`
          : `$${promoValid.discountValue / 100} off`}
    </Badge>
  )}
  {promoError && <span className="text-sm text-destructive">{promoError}</span>}
</div>
```

**Step 4: Verify web build**

Run: `pnpm --filter web typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/components/settings/billing-section.tsx
git commit -m "feat(web): add downgrade flow and promo code input to billing section"
```

---

### Task 12: Add admin panel UI for user blocking, plan management, and promos

**Files:**

- Modify: `apps/web/src/app/dashboard/admin/page.tsx`

**Step 1: Add user blocking UI to customer detail section**

When viewing a customer, add:

- Status badge (active/suspended/banned)
- "Block User" button with reason dialog
- "Suspend User" button with reason dialog
- "Unblock User" button (shown when status is not active)

**Step 2: Add plan management UI to customer detail**

- Plan selector dropdown (free/starter/pro/agency)
- "Apply Plan Change" button
- "Cancel Subscription" button

**Step 3: Add Promos section as a new tab/section in admin**

- "Create Promo" form: code, discount type select, value input, duration select, duration months, max redemptions, expiry date
- Promo list table: code, type, value, duration, redemptions, status, deactivate button
- On customer detail: "Apply Promo" button that shows a dialog with promo code picker

**Step 4: Verify web build**

Run: `pnpm --filter web typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/admin/page.tsx
git commit -m "feat(web): add admin UI for user blocking, plan management, and promo codes"
```

---

### Task 13: Full verification and deployment

**Step 1: Run all typechecks**

Run: `pnpm typecheck`

**Step 2: Push DB schema**

Run: `cd packages/db && export $(grep -v '^#' ../../.env | grep DATABASE_URL | xargs) && npx drizzle-kit push`

**Step 3: Deploy API**

Run: `cd apps/api && npx wrangler deploy`

**Step 4: Build and deploy web**

Run: `cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc`

**Step 5: Verify endpoints in production**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.llmrank.app/api/billing/downgrade
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.llmrank.app/api/billing/validate-promo
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.llmrank.app/api/admin/customers/test/block
curl -s -o /dev/null -w "%{http_code}" -X GET https://api.llmrank.app/api/admin/promos
```

Expected: 401 for all (auth required, not 404).

**Step 6: Commit any final fixes**

```bash
git add -A && git commit -m "chore: final verification fixes" && git push origin main
```
