import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /stats — aggregate dashboard statistics
// ---------------------------------------------------------------------------

dashboardRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  const projects = await projectQueries(db).listByUser(userId);

  const limits = PLAN_LIMITS[user?.plan ?? "free"];
  const creditsTotal =
    limits.crawlsPerMonth === Infinity ? 999 : limits.crawlsPerMonth;

  return c.json({
    data: {
      total_projects: projects.length,
      total_crawls: 0,
      avg_score: 0,
      credits_remaining: user?.crawlCreditsRemaining ?? 0,
      credits_total: creditsTotal,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /activity — recent crawl jobs across all user projects
// ---------------------------------------------------------------------------

dashboardRoutes.get("/activity", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const projects = await projectQueries(db).listByUser(userId);

  const allCrawls: Array<Record<string, unknown>> = [];
  for (const project of projects.slice(0, 10)) {
    const crawls = await crawlQueries(db).listByProject(project.id);
    for (const crawl of crawls.slice(0, 5)) {
      allCrawls.push({
        ...crawl,
        projectName: project.name,
        projectId: project.id,
      });
    }
  }

  allCrawls.sort((a, b) => {
    const aTime = new Date(a.createdAt as string).getTime();
    const bTime = new Date(b.createdAt as string).getTime();
    return bTime - aTime;
  });

  return c.json({ data: allCrawls.slice(0, 5) });
});
