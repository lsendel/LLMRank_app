import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { logQueries } from "@llm-boost/db";
import { parseLogLine, summarizeLogs, type LogEntry } from "@llm-boost/shared";

export const logRoutes = new Hono<AppEnv>();

// ─── POST /:projectId/upload — Upload + analyze server log file ────

logRoutes.post("/:projectId/upload", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const body = await c.req.json<{ filename: string; content: string }>();
  if (!body.content || !body.filename) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "filename and content required",
        },
      },
      422,
    );
  }

  // Parse log lines
  const lines = body.content.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    const entry = parseLogLine(line);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid log entries found",
        },
      },
      422,
    );
  }

  // Compute summary
  const summary = summarizeLogs(entries);

  // Persist
  const upload = await logQueries(db).create({
    projectId,
    userId,
    filename: body.filename,
    totalRequests: summary.totalRequests,
    crawlerRequests: summary.crawlerRequests,
    uniqueIPs: summary.uniqueIPs,
    summary,
  });

  return c.json({ data: { id: upload.id, summary } });
});

// ─── GET /:projectId — List log uploads for project ────────────────

logRoutes.get("/:projectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("projectId");
  const uploads = await logQueries(db).listByProject(projectId);
  return c.json({ data: uploads });
});

// ─── GET /detail/:id — Get a specific log upload with summary ──────

logRoutes.get("/detail/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const upload = await logQueries(db).getById(c.req.param("id"));
  if (!upload) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Log upload not found" } },
      404,
    );
  }
  return c.json({ data: upload });
});
