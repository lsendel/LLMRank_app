import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  pageQueries,
  scoreQueries,
  projectQueries,
  crawlQueries,
} from "@llm-boost/db";
import { ERROR_CODES } from "@llm-boost/shared";

export const pageRoutes = new Hono<AppEnv>();

// All page routes require authentication
pageRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /:id — Page detail with scores and issues
// ---------------------------------------------------------------------------

pageRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const pageId = c.req.param("id");

  const page = await pageQueries(db).getById(pageId);
  if (!page) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Verify ownership: page -> project -> user
  const project = await projectQueries(db).getById(page.projectId);
  if (!project || project.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  // Fetch scores and issues in parallel
  const [score, issues] = await Promise.all([
    scoreQueries(db).getByPage(pageId),
    scoreQueries(db).getIssuesByPage(pageId),
  ]);

  return c.json({
    data: {
      ...page,
      score: score ?? null,
      issues,
    },
  });
});
