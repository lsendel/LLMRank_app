import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import { createCompetitorBenchmarkService } from "../services/competitor-benchmark-service";
import {
  competitorBenchmarkQueries,
  competitorQueries,
  userQueries,
  projectQueries,
  crawlQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const competitorRoutes = new Hono<AppEnv>();
competitorRoutes.use("*", authMiddleware);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/competitors/benchmark — Trigger benchmark of a competitor domain
competitorRoutes.post("/benchmark", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId?: string;
    competitorDomain?: string;
  }>();

  if (
    !body.projectId ||
    !UUID_RE.test(body.projectId) ||
    !body.competitorDomain
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId (uuid) and competitorDomain are required",
        },
      },
      422,
    );
  }

  // Normalize domain (strip protocol and trailing slash)
  let domain = body.competitorDomain.trim().toLowerCase();
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    domain = new URL(url).hostname;
  } catch {
    return c.json(
      {
        error: { code: "INVALID_DOMAIN", message: "Invalid competitor domain" },
      },
      422,
    );
  }

  try {
    const user = await userQueries(db).getById(userId);
    const project = await projectQueries(db).getById(body.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    if (limits.competitorsPerProject === 0) {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Competitor benchmarking requires a paid plan.",
          },
        },
        403,
      );
    }

    const service = createCompetitorBenchmarkService({
      competitorBenchmarks: competitorBenchmarkQueries(db),
      competitors: competitorQueries(db),
    });

    const benchmark = await service.benchmarkCompetitor({
      projectId: body.projectId,
      competitorDomain: domain,
      competitorLimit: limits.competitorsPerProject,
    });

    return c.json({ data: benchmark }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/competitors?projectId=xxx — Get competitor comparisons for a project
competitorRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter required",
        },
      },
      422,
    );
  }

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Get the project's latest crawl scores for comparison
  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  let projectScores = {
    overall: 0,
    technical: 0,
    content: 0,
    aiReadiness: 0,
    performance: 0,
    letterGrade: "F",
  };

  if (latestCrawl?.summaryData) {
    // summaryData is a jsonb field containing aggregated scores
    const summary = latestCrawl.summaryData as any;
    projectScores = {
      overall: summary.overallScore ?? 0,
      technical: summary.technicalScore ?? 0,
      content: summary.contentScore ?? 0,
      aiReadiness: summary.aiReadinessScore ?? 0,
      performance: summary.performanceScore ?? 0,
      letterGrade: summary.letterGrade ?? "F",
    };
  }

  const service = createCompetitorBenchmarkService({
    competitorBenchmarks: competitorBenchmarkQueries(db),
    competitors: competitorQueries(db),
  });

  const comparison = await service.getComparison({
    projectId,
    projectScores,
  });

  return c.json({ data: { projectScores, competitors: comparison } });
});
