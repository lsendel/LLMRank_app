"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IssueCard } from "@/components/issue-card";

// Placeholder data
const allIssues = [
  {
    code: "MISSING_LLMS_TXT",
    category: "ai_readiness" as const,
    severity: "critical" as const,
    message: "No llms.txt file found at /llms.txt",
    recommendation:
      "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site.",
  },
  {
    code: "AI_CRAWLER_BLOCKED",
    category: "ai_readiness" as const,
    severity: "critical" as const,
    message: "robots.txt blocks GPTBot and ClaudeBot",
    recommendation: "Remove Disallow rules for AI user agents in robots.txt.",
    data: { blocked_agents: ["GPTBot", "ClaudeBot"] },
  },
  {
    code: "MISSING_META_DESC",
    category: "technical" as const,
    severity: "warning" as const,
    message: "12 pages are missing a meta description",
    recommendation:
      "Add a meta description of 120-160 characters that summarizes each page's key topic.",
    data: { affected_pages: 12 },
  },
  {
    code: "THIN_CONTENT",
    category: "content" as const,
    severity: "warning" as const,
    message: "5 pages have insufficient content (fewer than 500 words)",
    recommendation:
      "Expand content to at least 500 words of substantive, topic-relevant text.",
    data: { affected_pages: 5 },
  },
  {
    code: "NO_STRUCTURED_DATA",
    category: "ai_readiness" as const,
    severity: "warning" as const,
    message: "8 pages have no JSON-LD structured data",
    recommendation: "Add JSON-LD structured data.",
    data: { affected_pages: 8 },
  },
  {
    code: "LH_PERF_LOW",
    category: "performance" as const,
    severity: "warning" as const,
    message: "3 pages have Lighthouse Performance score below 0.5",
    recommendation:
      "Improve page performance: optimize images, reduce JavaScript, enable caching.",
    data: { affected_pages: 3 },
  },
  {
    code: "MISSING_H1",
    category: "technical" as const,
    severity: "warning" as const,
    message: "3 pages are missing an H1 heading",
    recommendation:
      "Add exactly one H1 heading that clearly describes the page's main topic.",
    data: { affected_pages: 3 },
  },
  {
    code: "MISSING_ALT_TEXT",
    category: "technical" as const,
    severity: "warning" as const,
    message: "15 images are missing alt text attributes",
    recommendation: "Add descriptive alt text to all images.",
    data: { affected_images: 15 },
  },
  {
    code: "MISSING_CANONICAL",
    category: "technical" as const,
    severity: "warning" as const,
    message: "4 pages are missing a canonical URL tag",
    recommendation:
      "Add a canonical tag pointing to the preferred URL for each page.",
    data: { affected_pages: 4 },
  },
  {
    code: "CONTENT_DEPTH",
    category: "content" as const,
    severity: "warning" as const,
    message: "Content lacks depth on 6 pages",
    recommendation:
      "Expand coverage of subtopics, add supporting data, examples, and expert analysis.",
    data: { affected_pages: 6 },
  },
  {
    code: "NO_SUMMARY_SECTION",
    category: "ai_readiness" as const,
    severity: "info" as const,
    message: "10 pages lack a summary or key takeaway section",
    recommendation:
      "Add a TL;DR or key takeaways section that summarizes the page's main points.",
    data: { affected_pages: 10 },
  },
  {
    code: "HEADING_HIERARCHY",
    category: "technical" as const,
    severity: "info" as const,
    message: "4 pages have skipped heading levels",
    recommendation:
      "Ensure headings follow a logical hierarchy: H1 > H2 > H3 without skipping levels.",
    data: { affected_pages: 4 },
  },
  {
    code: "MISSING_OG_TAGS",
    category: "technical" as const,
    severity: "info" as const,
    message: "7 pages are missing Open Graph tags",
    recommendation: "Add og:title, og:description, and og:image meta tags.",
    data: { affected_pages: 7 },
  },
  {
    code: "STALE_CONTENT",
    category: "content" as const,
    severity: "info" as const,
    message: "3 pages appear to have content over 12 months old",
    recommendation:
      "Update content with current information, statistics, and recent developments.",
    data: { affected_pages: 3 },
  },
];

type GroupBy = "none" | "category" | "severity";

const ITEMS_PER_PAGE = 8;

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
};

const severityOrder: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default function IssuesPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [page, setPage] = useState(1);

  const filtered = allIssues.filter((issue) => {
    if (severityFilter !== "all" && issue.severity !== severityFilter)
      return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter)
      return false;
    return true;
  });

  // Counts for badges
  const criticalCount = allIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  // Group issues
  const grouped =
    groupBy !== "none"
      ? filtered.reduce<Record<string, typeof allIssues>>((acc, issue) => {
          const key = groupBy === "category" ? issue.category : issue.severity;
          if (!acc[key]) acc[key] = [];
          acc[key].push(issue);
          return acc;
        }, {})
      : null;

  const groupKeys = grouped
    ? Object.keys(grouped).sort((a, b) => {
        if (groupBy === "severity") {
          return (severityOrder[a] ?? 99) - (severityOrder[b] ?? 99);
        }
        return a.localeCompare(b);
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
        <p className="mt-1 text-muted-foreground">
          All issues found across your pages. {filtered.length} total issues.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Severity filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Severity:
          </span>
          <Button
            variant={severityFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSeverityFilter("all");
              setPage(1);
            }}
          >
            All ({allIssues.length})
          </Button>
          <Button
            variant={severityFilter === "critical" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSeverityFilter("critical");
              setPage(1);
            }}
          >
            Critical ({criticalCount})
          </Button>
          <Button
            variant={severityFilter === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSeverityFilter("warning");
              setPage(1);
            }}
          >
            Warning ({warningCount})
          </Button>
          <Button
            variant={severityFilter === "info" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSeverityFilter("info");
              setPage(1);
            }}
          >
            Info ({infoCount})
          </Button>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Category:
          </span>
          {["all", "technical", "content", "ai_readiness", "performance"].map(
            (cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
              >
                {cat === "all" ? "All" : (categoryLabels[cat] ?? cat)}
              </Button>
            ),
          )}
        </div>

        {/* Group by toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Group by:
          </span>
          {(["none", "category", "severity"] as GroupBy[]).map((g) => (
            <Button
              key={g}
              variant={groupBy === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupBy(g)}
            >
              {g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Issue list */}
      {grouped ? (
        <div className="space-y-6">
          {groupKeys.map((key) => (
            <div key={key}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-base font-semibold">
                  {groupBy === "category"
                    ? (categoryLabels[key] ?? key)
                    : key.charAt(0).toUpperCase() + key.slice(1)}
                </h3>
                <Badge variant="secondary">{grouped[key].length}</Badge>
              </div>
              <div className="space-y-3">
                {grouped[key].map((issue) => (
                  <IssueCard key={issue.code} {...issue} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No issues match the selected filters.
              </Card>
            ) : (
              paginated.map((issue) => (
                <IssueCard key={issue.code} {...issue} />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
