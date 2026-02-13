import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";
import { ERROR_CODES, PLAN_LIMITS } from "@llm-boost/shared";

export const billingRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

/** Minimal Stripe API wrapper using fetch (avoids bundling the full Stripe SDK). */
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

// Map plan names to Stripe price IDs (configure via environment or hardcode)
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: "price_starter", // Replace with actual Stripe price IDs
  pro: "price_pro",
  agency: "price_agency",
};

// ---------------------------------------------------------------------------
// POST /checkout — Create Stripe checkout session (requires auth)
// ---------------------------------------------------------------------------

billingRoutes.post("/checkout", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json();
  const { plan, successUrl, cancelUrl } = body as {
    plan: string;
    successUrl: string;
    cancelUrl: string;
  };

  if (!plan || !successUrl || !cancelUrl) {
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

  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: `Invalid plan: ${plan}` } },
      422,
    );
  }

  const user = await userQueries(db).getById(userId);
  if (!user) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      err.status,
    );
  }

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripeRequest<{ id: string }>(
      c.env.STRIPE_SECRET_KEY,
      "POST",
      "/customers",
      { email: user.email, "metadata[user_id]": userId },
    );
    customerId = customer.id;
  }

  // Create checkout session
  const session = await stripeRequest<{ id: string; url: string }>(
    c.env.STRIPE_SECRET_KEY,
    "POST",
    "/checkout/sessions",
    {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[user_id]": userId,
      "metadata[plan]": plan,
    },
  );

  return c.json({ data: { sessionId: session.id, url: session.url } });
});

// ---------------------------------------------------------------------------
// POST /webhook — Handle Stripe webhooks (no auth — uses Stripe signature)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /usage — Return current usage against plan limits (requires auth)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST /portal — Create Stripe Customer Portal session (requires auth)
// ---------------------------------------------------------------------------

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
  const session = await stripeRequest<{ url: string }>(
    c.env.STRIPE_SECRET_KEY,
    "POST",
    "/billing_portal/sessions",
    {
      customer: user.stripeCustomerId,
      return_url: body.returnUrl,
    },
  );

  return c.json({ data: { url: session.url } });
});

// ---------------------------------------------------------------------------
// POST /webhook — Handle Stripe webhooks (no auth — uses Stripe signature)
// ---------------------------------------------------------------------------

billingRoutes.post("/webhook", async (c) => {
  const db = c.get("db");
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing Stripe signature" } },
      401,
    );
  }

  // In production, you should verify the Stripe webhook signature.
  // For now, we parse the event body directly. The webhook endpoint
  // should be configured with a webhook secret in production.
  const event = (await c.req.json()) as {
    type: string;
    data: {
      object: Record<string, unknown>;
    };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = (session.metadata as Record<string, string>)?.user_id;
      const plan = (session.metadata as Record<string, string>)?.plan;
      const subscriptionId = session.subscription as string;

      if (userId && plan && plan in PLAN_LIMITS) {
        await userQueries(db).updatePlan(
          userId,
          plan as "free" | "starter" | "pro" | "agency",
          subscriptionId,
        );
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const userId = (subscription.metadata as Record<string, string>)?.user_id;
      const status = subscription.status as string;

      if (userId && status === "active") {
        // Subscription updated — plan may have changed
        // The plan is determined by the price ID on the subscription items
        const items = subscription.items as
          | { data: Array<{ price: { id: string } }> }
          | undefined;
        const priceId = items?.data?.[0]?.price?.id;
        if (priceId) {
          const plan = Object.entries(PLAN_PRICE_IDS).find(
            ([, id]) => id === priceId,
          )?.[0];
          if (plan) {
            await userQueries(db).updatePlan(
              userId,
              plan as "free" | "starter" | "pro" | "agency",
              subscription.id as string,
            );
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = (subscription.metadata as Record<string, string>)?.user_id;
      if (userId) {
        // Downgrade to free plan when subscription is cancelled
        await userQueries(db).updatePlan(userId, "free", undefined);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return c.json({ received: true });
});
