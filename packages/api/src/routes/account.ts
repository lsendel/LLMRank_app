import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — Get current user info
// ---------------------------------------------------------------------------

accountRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({ data: user });
});
