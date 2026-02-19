import { createAuth } from "../lib/auth";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { createLogger } from "../lib/logger";
import { userQueries } from "@llm-boost/db";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const log =
    c.get("logger") ?? createLogger({ requestId: c.get("requestId") });

  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication failed",
          },
        },
        401,
      );
    }

    c.set("userId", session.user.id);

    // Check if user is blocked/suspended
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

    await next();
  } catch (error) {
    log.error("Authentication failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication failed",
        },
      },
      401,
    );
  }
});
