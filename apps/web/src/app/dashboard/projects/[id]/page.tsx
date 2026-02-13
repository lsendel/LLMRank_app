"use client";

import React, { useState } from "react";
import Link from "next/link";
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

// Placeholder data -- will be replaced with API calls
const project = {
  id: "1",
  name: "acme.com",
  domain: "https://acme.com",
  createdAt: "2025-01-01T00:00:00Z",
  settings: {
    maxPages: 100,
    maxDepth: 3,
    schedule: "weekly" as const,
  },
};

const crawlHistory = [
  {
    id: "c1",
    startedAt: "2025-01-15T10:30:00Z",
    completedAt: "2025-01-15T10:45:00Z",
    pagesScanned: 45,
    overallScore: 72,
    letterGrade: "C" as const,
    issuesFound: 8,
  },
  {
    id: "c2",
    startedAt: "2025-01-08T10:00:00Z",
    completedAt: "2025-01-08T10:12:00Z",
    pagesScanned: 42,
    overallScore: 65,
    letterGrade: "D" as const,
    issuesFound: 12,
  },
  {
    id: "c3",
    startedAt: "2025-01-01T10:00:00Z",
    completedAt: "2025-01-01T10:10:00Z",
    pagesScanned: 38,
    overallScore: 60,
    letterGrade: "D" as const,
    issuesFound: 15,
  },
];

const latestScores = {
  overall: 72,
  technical: 78,
  content: 65,
  aiReadiness: 70,
  performance: 74,
};

const categoryBreakdown = [
  { key: "technical", label: "Technical SEO", score: 78, maxScore: 100 },
  { key: "content", label: "Content Quality", score: 65, maxScore: 100 },
  { key: "aiReadiness", label: "AI Readiness", score: 70, maxScore: 100 },
  { key: "performance", label: "Performance", score: 74, maxScore: 100 },
];

const topIssues = [
  {
    code: "MISSING_LLMS_TXT",
    category: "ai_readiness" as const,
    severity: "critical" as const,
    message: "No llms.txt file found at /llms.txt",
    recommendation:
      "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site.",
  },
  {
    code: "MISSING_META_DESC",
    category: "technical" as const,
    severity: "warning" as const,
    message:
      "12 pages are missing a meta description or it is outside 120-160 characters",
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
    recommendation:
      "Add JSON-LD structured data (at minimum: Organization, WebPage, and Article/FAQPage as appropriate).",
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
];

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

export default function ProjectPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [startingCrawl, setStartingCrawl] = useState(false);

  const handleStartCrawl = async () => {
    setStartingCrawl(true);
    // TODO: Call API to start crawl
    // const response = await api.crawls.start(project.id);
    // router.push(`/dashboard/crawl/${response.id}`);
    setTimeout(() => setStartingCrawl(false), 2000);
  };

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
          {/* Hero section with ScoreCircle */}
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <Card className="flex items-center justify-center p-8">
              <ScoreCircle
                score={latestScores.overall}
                size={160}
                label="Overall Score"
              />
            </Card>

            {/* Category breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.label}</span>
                      <span
                        className={cn("font-semibold", gradeColor(cat.score))}
                      >
                        {cat.score} / {cat.maxScore}
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
              {topIssues.map((issue) => (
                <IssueCard key={issue.code} {...issue} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages" className="pt-4">
          <PagesTabContent projectId={project.id} />
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="pt-4">
          <IssuesTabContent />
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

interface PageData {
  url: string;
  statusCode: number;
  title: string;
  overallScore: number;
  issueCount: number;
}

const placeholderPages: PageData[] = [
  {
    url: "/",
    statusCode: 200,
    title: "Home - Acme Corp",
    overallScore: 82,
    issueCount: 2,
  },
  {
    url: "/about",
    statusCode: 200,
    title: "About Us",
    overallScore: 75,
    issueCount: 4,
  },
  {
    url: "/products",
    statusCode: 200,
    title: "Products",
    overallScore: 68,
    issueCount: 5,
  },
  {
    url: "/blog",
    statusCode: 200,
    title: "Blog",
    overallScore: 85,
    issueCount: 1,
  },
  {
    url: "/contact",
    statusCode: 200,
    title: "Contact",
    overallScore: 45,
    issueCount: 8,
  },
  {
    url: "/pricing",
    statusCode: 200,
    title: "Pricing Plans",
    overallScore: 72,
    issueCount: 3,
  },
  {
    url: "/docs",
    statusCode: 200,
    title: "Documentation",
    overallScore: 90,
    issueCount: 1,
  },
  {
    url: "/faq",
    statusCode: 200,
    title: "FAQ",
    overallScore: 78,
    issueCount: 3,
  },
];

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

function PagesTabContent({ projectId: _projectId }: { projectId: string }) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = [...placeholderPages].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const cmp =
      typeof aVal === "string"
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "^" : "v"}</span>;
  };

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
            <React.Fragment key={page.url}>
              <TableRow
                className="cursor-pointer"
                onClick={() =>
                  setExpandedRow(expandedRow === page.url ? null : page.url)
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
                <TableCell>{page.title}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-semibold",
                      page.overallScore >= 80
                        ? "text-success"
                        : page.overallScore >= 60
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {page.overallScore}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    {page.issueCount}
                  </span>
                </TableCell>
              </TableRow>
              {expandedRow === page.url && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Technical
                        </p>
                        <p className="text-lg font-semibold">78</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Content</p>
                        <p className="text-lg font-semibold">65</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          AI Readiness
                        </p>
                        <p className="text-lg font-semibold">70</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Performance
                        </p>
                        <p className="text-lg font-semibold">74</p>
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

const allIssues = [
  ...topIssues,
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
    code: "NO_SUMMARY_SECTION",
    category: "ai_readiness" as const,
    severity: "info" as const,
    message: "10 pages lack a summary or key takeaway section",
    recommendation:
      "Add a TL;DR or key takeaways section that summarizes the page's main points.",
    data: { affected_pages: 10 },
  },
];

function IssuesTabContent() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = allIssues.filter((issue) => {
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
            No issues match the selected filters.
          </Card>
        ) : (
          filtered.map((issue) => <IssueCard key={issue.code} {...issue} />)
        )}
      </div>
    </div>
  );
}

// ─── History Tab ────────────────────────────────────────────────────

interface CrawlHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  pagesScanned: number;
  overallScore: number;
  letterGrade: string;
  issuesFound: number;
}

function HistoryTabContent({
  crawlHistory,
}: {
  crawlHistory: CrawlHistoryEntry[];
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Pages</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crawlHistory.map((crawl) => (
            <TableRow key={crawl.id}>
              <TableCell>
                {new Date(crawl.startedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {crawl.pagesScanned}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "font-semibold",
                    crawl.overallScore >= 80
                      ? "text-success"
                      : crawl.overallScore >= 60
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {crawl.overallScore}
                </span>
              </TableCell>
              <TableCell className="font-semibold">
                {crawl.letterGrade}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                  {crawl.issuesFound}
                </span>
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
