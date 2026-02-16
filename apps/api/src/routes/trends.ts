import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries } from "@llm-boost/db";

export const trendRoutes = new Hono<AppEnv>();
trendRoutes.use("*", authMiddleware);

// GET /api/trends/:projectId?period=30d
trendRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const period = c.req.query("period") ?? "90d";

  // Validate ownership
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Parse period
  const days = parseInt(period) || 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get completed crawls in the period
  const crawls = await crawlQueries(db).listByProject(projectId);
  const completedCrawls = crawls
    .filter((cr: any) => cr.status === "complete" && cr.completedAt)
    .filter((cr: any) => new Date(cr.completedAt) >= since)
    .sort(
      (a: any, b: any) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );

  // For each crawl, get aggregated scores from summaryData
  const trendPoints = [];
  for (const crawl of completedCrawls) {
    if (crawl.summaryData) {
      const sd = crawl.summaryData as any;
      trendPoints.push({
        crawlId: crawl.id,
        date: crawl.completedAt,
        overall: sd.overallScore ?? sd.overall ?? 0,
        technical: sd.technicalScore ?? sd.technical ?? 0,
        content: sd.contentScore ?? sd.content ?? 0,
        aiReadiness: sd.aiReadinessScore ?? sd.aiReadiness ?? 0,
        performance: sd.performanceScore ?? sd.performance ?? 0,
        letterGrade: sd.letterGrade ?? "F",
        pageCount: crawl.pagesScored ?? 0,
      });
    }
  }

  // Compute deltas between consecutive points
  const withDeltas = trendPoints.map((point, i) => {
    if (i === 0) return { ...point, deltas: null };
    const prev = trendPoints[i - 1];
    return {
      ...point,
      deltas: {
        overall: point.overall - prev.overall,
        technical: point.technical - prev.technical,
        content: point.content - prev.content,
        aiReadiness: point.aiReadiness - prev.aiReadiness,
        performance: point.performance - prev.performance,
      },
    };
  });

  return c.json({
    data: {
      projectId,
      period,
      points: withDeltas,
    },
  });
});
