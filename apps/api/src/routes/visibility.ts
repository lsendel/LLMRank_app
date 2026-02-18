import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  createCompetitorRepository,
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
} from "../repositories";
import { createVisibilityService } from "../services/visibility-service";
import { handleServiceError } from "../services/errors";
import { rateLimit } from "../middleware/rate-limit";
import { suggestKeywords } from "@llm-boost/llm";
import {
  enrichmentQueries,
  crawlQueries,
  scheduledVisibilityQueryQueries,
} from "@llm-boost/db";

export const visibilityRoutes = new Hono<AppEnv>();

visibilityRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST /check — Run visibility check
// ---------------------------------------------------------------------------

visibilityRoutes.post(
  "/check",
  rateLimit({ limit: 5, windowSeconds: 60, keyPrefix: "rl:vis" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");

    const body = await c.req.json<{
      projectId: string;
      query: string;
      providers: string[];
    }>();

    if (!body.projectId || !body.query || !body.providers?.length) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectId, query, and providers are required",
          },
        },
        422,
      );
    }

    const service = createVisibilityService({
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      visibility: createVisibilityRepository(db),
      competitors: createCompetitorRepository(db),
    });

    try {
      const stored = await service.runCheck({
        userId,
        projectId: body.projectId,
        query: body.query,
        providers: body.providers,
        apiKeys: {
          chatgpt: c.env.OPENAI_API_KEY,
          claude: c.env.ANTHROPIC_API_KEY,
          perplexity: c.env.PERPLEXITY_API_KEY,
          gemini: c.env.GOOGLE_API_KEY,
          copilot: c.env.BING_API_KEY,
        },
      });
      return c.json({ data: stored }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:projectId — List visibility results
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.listForProject(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/gaps — Content gaps where competitors are cited but user isn't
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/gaps", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const checks = await service.listForProject(userId, projectId);

    // Group by query and find gaps: queries where user is NOT mentioned
    // but at least one competitor IS mentioned
    const queryMap = new Map<
      string,
      {
        query: string;
        providers: string[];
        userMentioned: boolean;
        userCited: boolean;
        competitorsCited: Array<{
          domain: string;
          position: number | null;
        }>;
      }
    >();

    for (const check of checks) {
      const existing = queryMap.get(check.query) ?? {
        query: check.query,
        providers: [],
        userMentioned: false,
        userCited: false,
        competitorsCited: [],
      };

      existing.providers.push(check.llmProvider);
      if (check.brandMentioned) existing.userMentioned = true;
      if (check.urlCited) existing.userCited = true;

      const mentions = (check.competitorMentions ?? []) as Array<{
        domain: string;
        mentioned: boolean;
        position: number | null;
      }>;
      for (const m of mentions) {
        if (
          m.mentioned &&
          !existing.competitorsCited.find((c2) => c2.domain === m.domain)
        ) {
          existing.competitorsCited.push({
            domain: m.domain,
            position: m.position,
          });
        }
      }

      queryMap.set(check.query, existing);
    }

    // Filter to gaps: user not mentioned, competitors are
    const gaps = Array.from(queryMap.values()).filter(
      (q) => !q.userMentioned && q.competitorsCited.length > 0,
    );

    return c.json({ data: gaps });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// GET /:projectId/trends — Weekly share-of-voice trends
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/trends", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const data = await service.getTrends(userId, projectId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ---------------------------------------------------------------------------
// POST /:projectId/discover-keywords — Suggest keywords to track
// ---------------------------------------------------------------------------

visibilityRoutes.post(
  "/:projectId/discover-keywords",
  rateLimit({ limit: 3, windowSeconds: 60, keyPrefix: "rl:vis-discover" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const { createKeywordDiscoveryService } =
      await import("../services/keyword-discovery-service");

    const service = createKeywordDiscoveryService({
      projects: createProjectRepository(db),
      enrichments: {
        async listByJobAndProvider(jobId: string, provider: string) {
          return enrichmentQueries(db).listByJobAndProvider(
            jobId,
            provider as any,
          );
        },
      },
      schedules: {
        async listByProject(pid: string) {
          return scheduledVisibilityQueryQueries(db).listByProject(pid);
        },
      },
      crawls: {
        async getLatestByProject(pid: string) {
          return crawlQueries(db).getLatestByProject(pid);
        },
      },
      llm: {
        async generateKeywords(domain: string, context: string) {
          return suggestKeywords(c.env.ANTHROPIC_API_KEY, domain, context);
        },
      },
    });

    try {
      const result = await service.discover(userId, projectId);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);
