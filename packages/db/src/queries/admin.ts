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

const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  starter: 7900,
  pro: 14900,
  agency: 29900,
};

export function adminQueries(db: Database) {
  return {
    async getStats() {
      // MRR: count active subscriptions by plan, multiply by price
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

      const [activeResult] = await db
        .select({ value: countDistinct(subscriptions.userId) })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"));

      const [totalResult] = await db.select({ value: count() }).from(users);

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

      const [revenueResult] = await db
        .select({
          value: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        })
        .from(payments)
        .where(eq(payments.status, "succeeded"));

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

      const where = opts.search
        ? or(
            ilike(users.email, `%${opts.search}%`),
            ilike(users.name, `%${opts.search}%`),
          )
        : undefined;

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

      const [subs, userPayments] = await Promise.all([
        db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .orderBy(desc(subscriptions.createdAt)),
        db
          .select()
          .from(payments)
          .where(eq(payments.userId, userId))
          .orderBy(desc(payments.createdAt))
          .limit(50),
      ]);

      return { user, subscriptions: subs, payments: userPayments };
    },
  };
}
