import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";

export const exportRoutes = new Hono<AppEnv>();

exportRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// GET /:projectId/export?format=csv|json
// ---------------------------------------------------------------------------

exportRoutes.get("/:projectId/export", withOwnership("project"), async (c) => {
  const project = c.get("project");
  const format = c.req.query("format") ?? "csv";

  if (format !== "csv" && format !== "json") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: 'Invalid format. Must be "csv" or "json".',
        },
      },
      422,
    );
  }

  const { crawls, scores } = c.get("container");

  // 1. Get latest crawl
  const crawl = await crawls.getLatestByProject(project.id);
  if (!crawl) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "No crawl data found for this project",
        },
      },
      404,
    );
  }

  // 2. Get pages with scores
  const pageScores = await scores.listByJobWithPages(crawl.id);

  // 3. Map to export rows
  const rows = pageScores.map((entry) => ({
    url: entry.page?.url ?? "",
    overallScore: entry.overallScore ?? 0,
    technicalScore: entry.technicalScore ?? 0,
    contentScore: entry.contentScore ?? 0,
    aiReadinessScore: entry.aiReadinessScore ?? 0,
    performanceScore: entry.lighthousePerf ?? 0,
    letterGrade: letterGrade(entry.overallScore ?? 0),
    issueCount: entry.issueCount ?? 0,
  }));

  const domain = project.domain ?? "export";

  if (format === "json") {
    return c.json({ data: rows }, 200, {
      "Content-Disposition": `attachment; filename="${domain}-export.json"`,
    });
  }

  // CSV format
  const headers = [
    "url",
    "overallScore",
    "technicalScore",
    "contentScore",
    "aiReadinessScore",
    "performanceScore",
    "letterGrade",
    "issueCount",
  ];

  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        escapeCsv(row.url),
        String(row.overallScore),
        String(row.technicalScore),
        String(row.contentScore),
        String(row.aiReadinessScore),
        String(row.performanceScore),
        row.letterGrade,
        String(row.issueCount),
      ].join(","),
    );
  }

  const csvContent = csvLines.join("\n");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${domain}-export.csv"`,
    },
  });
});
