"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  BarChart3,
  FileText,
  AlertTriangle,
  Bug,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreCircle } from "@/components/score-circle";
import { IssueCard } from "@/components/issue-card";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import {
  api,
  ApiError,
  type Project,
  type CrawlJob,
  type CrawledPage,
  type PageIssue,
} from "@/lib/api";

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  if (score >= 40) return "bg-orange-500";
  return "bg-destructive";
}

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { withToken } = useApi();

  const [project, setProject] = useState<Project | null>(null);
  const [crawlHistory, setCrawlHistory] = useState<CrawlJob[]>([]);
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [issues, setIssues] = useState<PageIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingCrawl, setStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  useEffect(() => {
    withToken(async (token) => {
      const proj = await api.projects.get(token, params.id);
      setProject(proj);

      // Fetch crawl history
      const crawls = await api.crawls.list(token, params.id);
      setCrawlHistory(crawls.data);

      // If there's a latest crawl, fetch pages and issues
      if (proj.latestCrawl?.id) {
        const [pagesRes, issuesRes] = await Promise.all([
          api.pages.list(token, proj.latestCrawl.id),
          api.issues.listForCrawl(token, proj.latestCrawl.id),
        ]);
        setPages(pagesRes.data);
        setIssues(issuesRes.data);
      }
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [withToken, params.id]);

  async function handleStartCrawl() {
    setStartingCrawl(true);
    setCrawlError(null);
    try {
      await withToken(async (token) => {
        const crawlJob = await api.crawls.start(token, params.id);
        router.push(`/dashboard/crawl/${crawlJob.id}`);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setCrawlError(err.message);
      } else {
        setCrawlError("Failed to start crawl. Please try again.");
      }
      setStartingCrawl(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const latestCrawl = project.latestCrawl;
  const hasScores = latestCrawl?.scores != null;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.domain}
            </p>
          </div>
          <Button onClick={handleStartCrawl} disabled={startingCrawl}>
            <Play className="h-4 w-4" />
            {startingCrawl ? "Starting..." : "Run Crawl"}
          </Button>
        </div>
        {crawlError && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {crawlError}
          </div>
        )}
      </div>

      {/* Tabs for navigation */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="pages">
            <FileText className="mr-1.5 h-4 w-4" />
            Pages
          </TabsTrigger>
          <TabsTrigger value="issues">
            <Bug className="mr-1.5 h-4 w-4" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1.5 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {hasScores ? (
            <>
              {/* Hero section with ScoreCircle */}
              <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
                <Card className="flex items-center justify-center p-8">
                  <ScoreCircle
                    score={latestCrawl!.overallScore ?? 0}
                    size={160}
                    label="Overall Score"
                  />
                </Card>

                {/* Category breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Category Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {[
                      {
                        key: "technical",
                        label: "Technical SEO",
                        score: latestCrawl!.scores!.technical,
                      },
                      {
                        key: "content",
                        label: "Content Quality",
                        score: latestCrawl!.scores!.content,
                      },
                      {
                        key: "aiReadiness",
                        label: "AI Readiness",
                        score: latestCrawl!.scores!.aiReadiness,
                      },
                      {
                        key: "performance",
                        label: "Performance",
                        score: latestCrawl!.scores!.performance,
                      },
                    ].map((cat) => (
                      <div key={cat.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.label}</span>
                          <span
                            className={cn(
                              "font-semibold",
                              gradeColor(cat.score),
                            )}
                          >
                            {cat.score} / 100
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              scoreBarColor(cat.score),
                            )}
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Top Issues */}
              {issues.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Top Issues</h2>
                    <Link
                      href={`/dashboard/projects/${project.id}/issues`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View all issues
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {issues.slice(0, 5).map((issue) => (
                      <IssueCard key={issue.code} {...issue} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No crawl data yet. Click &quot;Run Crawl&quot; to analyze this
                site.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages" className="pt-4">
          <PagesTabContent pages={pages} projectId={project.id} />
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="pt-4">
          <IssuesTabContent issues={issues} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="pt-4">
          <HistoryTabContent crawlHistory={crawlHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Pages Tab ──────────────────────────────────────────────────────

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

function PagesTabContent({
  pages,
  projectId: _projectId,
}: {
  pages: CrawledPage[];
  projectId: string;
}) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (pages.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No pages crawled yet. Run a crawl to see page-level results.
        </p>
      </Card>
    );
  }

  const sorted = [...pages].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal == null || bVal == null) return 0;
    const cmp =
      typeof aVal === "string"
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "^" : "v"}</span>;
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("url")}
            >
              URL <SortIndicator field="url" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("statusCode")}
            >
              Status <SortIndicator field="statusCode" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("title")}
            >
              Title <SortIndicator field="title" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("overallScore")}
            >
              Score <SortIndicator field="overallScore" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("issueCount")}
            >
              Issues <SortIndicator field="issueCount" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((page) => (
            <React.Fragment key={page.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() =>
                  setExpandedRow(expandedRow === page.id ? null : page.id)
                }
              >
                <TableCell className="font-mono text-xs">{page.url}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      page.statusCode === 200 ? "success" : "destructive"
                    }
                  >
                    {page.statusCode}
                  </Badge>
                </TableCell>
                <TableCell>{page.title ?? "--"}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-semibold",
                      page.overallScore != null
                        ? gradeColor(page.overallScore)
                        : "",
                    )}
                  >
                    {page.overallScore ?? "--"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    {page.issueCount}
                  </span>
                </TableCell>
              </TableRow>
              {expandedRow === page.id && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Technical
                        </p>
                        <p className="text-lg font-semibold">
                          {page.technicalScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Content</p>
                        <p className="text-lg font-semibold">
                          {page.contentScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          AI Readiness
                        </p>
                        <p className="text-lg font-semibold">
                          {page.aiReadinessScore ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Performance
                        </p>
                        <p className="text-lg font-semibold">
                          {page.performanceScore ?? "--"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Issues Tab ─────────────────────────────────────────────────────

function IssuesTabContent({ issues }: { issues: PageIssue[] }) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = issues.filter((issue) => {
    if (severityFilter !== "all" && issue.severity !== severityFilter)
      return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter)
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Severity:
          </span>
          {["all", "critical", "warning", "info"].map((sev) => (
            <Button
              key={sev}
              variant={severityFilter === sev ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter(sev)}
            >
              {sev === "all"
                ? "All"
                : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Category:
          </span>
          {["all", "technical", "content", "ai_readiness", "performance"].map(
            (cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "all"
                  ? "All"
                  : cat === "ai_readiness"
                    ? "AI Readiness"
                    : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ),
          )}
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {issues.length === 0
              ? "No issues found. Run a crawl to check for issues."
              : "No issues match the selected filters."}
          </Card>
        ) : (
          filtered.map((issue, i) => (
            <IssueCard key={`${issue.code}-${i}`} {...issue} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── History Tab ────────────────────────────────────────────────────

function HistoryTabContent({ crawlHistory }: { crawlHistory: CrawlJob[] }) {
  if (crawlHistory.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No crawl history yet. Run your first crawl to see results.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pages</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crawlHistory.map((crawl) => (
            <TableRow key={crawl.id}>
              <TableCell>
                {crawl.startedAt
                  ? new Date(crawl.startedAt).toLocaleDateString()
                  : "--"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    crawl.status === "complete"
                      ? "success"
                      : crawl.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {crawl.status}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {crawl.pagesScored}
                </span>
              </TableCell>
              <TableCell>
                {crawl.overallScore != null ? (
                  <span
                    className={cn(
                      "font-semibold",
                      gradeColor(crawl.overallScore),
                    )}
                  >
                    {crawl.overallScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="font-semibold">
                {crawl.letterGrade ?? "--"}
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/crawl/${crawl.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Details
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
