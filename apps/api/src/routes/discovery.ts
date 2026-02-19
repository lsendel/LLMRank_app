import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  projectQueries,
  personaQueries,
  savedKeywordQueries,
  competitorQueries,
  crawlQueries,
  pageQueries,
} from "@llm-boost/db";
import { handleServiceError } from "../services/errors";

export const discoveryRoutes = new Hono<AppEnv>();
discoveryRoutes.use("*", authMiddleware);

// Trigger full auto-discovery pipeline
discoveryRoutes.post(
  "/:projectId/run",
  rateLimit({ limit: 2, windowSeconds: 300, keyPrefix: "rl:discovery" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    try {
      const project = await projectQueries(db).getById(projectId);
      if (!project || project.userId !== userId) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Project not found" } },
          404,
        );
      }

      const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
      if (!latestCrawl) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "No crawl data available. Run a crawl first.",
            },
          },
          404,
        );
      }

      const allPages = await pageQueries(db).listByJob(latestCrawl.id);
      const indexPage = allPages[0];
      if (!indexPage) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "No pages found in latest crawl.",
            },
          },
          404,
        );
      }

      const { createDiscoveryService } =
        await import("../services/discovery-service");
      const service = createDiscoveryService({
        perplexityApiKey: c.env.PERPLEXITY_API_KEY,
        anthropicApiKey: c.env.ANTHROPIC_API_KEY,
        personaRepo: personaQueries(db),
        keywordRepo: savedKeywordQueries(db),
        competitorRepo: competitorQueries(db),
      });

      const result = await service.runFullDiscovery(
        {
          url: indexPage.url,
          title: indexPage.title,
          metaDescription: indexPage.metaDesc,
        },
        projectId,
      );

      return c.json({ data: result }, 201);
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);
