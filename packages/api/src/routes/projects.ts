import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, userQueries } from "@llm-boost/db";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationSchema,
  ERROR_CODES,
  PLAN_LIMITS,
} from "@llm-boost/shared";

export const projectRoutes = new Hono<AppEnv>();

// All project routes require authentication
projectRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — List user's projects (paginated)
// ---------------------------------------------------------------------------

projectRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const query = PaginationSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  if (!query.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid pagination parameters",
          details: query.error.flatten(),
        },
      },
      422,
    );
  }

  const { page, limit } = query.data;
  const allProjects = await projectQueries(db).listByUser(userId);
  const total = allProjects.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = allProjects.slice(start, start + limit);

  return c.json({
    data,
    pagination: { page, limit, total, totalPages },
  });
});

// ---------------------------------------------------------------------------
// POST / — Create a new project
// ---------------------------------------------------------------------------

projectRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  // Check plan limits for number of projects
  const user = await userQueries(db).getById(userId);
  if (!user) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      err.status,
    );
  }

  const limits = PLAN_LIMITS[user.plan];
  const existingProjects = await projectQueries(db).listByUser(userId);
  if (existingProjects.length >= limits.projects) {
    const err = ERROR_CODES.PLAN_LIMIT_REACHED;
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `Your ${user.plan} plan allows a maximum of ${limits.projects} project(s). Upgrade to add more.`,
        },
      },
      err.status,
    );
  }

  const project = await projectQueries(db).create({
    userId,
    name: parsed.data.name,
    domain: parsed.data.domain,
  });

  return c.json({ data: project }, 201);
});

// ---------------------------------------------------------------------------
// GET /:id — Get project detail with latest crawl
// ---------------------------------------------------------------------------

projectRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);

  return c.json({ data: { ...project, latestCrawl: latestCrawl ?? null } });
});

// ---------------------------------------------------------------------------
// PUT /:id — Update project
// ---------------------------------------------------------------------------

projectRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const existing = await projectQueries(db).getById(projectId);
  if (!existing || existing.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  const body = await c.req.json();
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid update data",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const updated = await projectQueries(db).update(projectId, parsed.data);
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /:id — Soft delete
// ---------------------------------------------------------------------------

projectRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const existing = await projectQueries(db).getById(projectId);
  if (!existing || existing.userId !== userId) {
    const err = ERROR_CODES.NOT_FOUND;
    return c.json(
      { error: { code: "NOT_FOUND", message: err.message } },
      err.status,
    );
  }

  await projectQueries(db).delete(projectId);
  return c.json({ data: { id: projectId, deleted: true } });
});
