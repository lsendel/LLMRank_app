"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IssueCard } from "@/components/issue-card";
import { cn } from "@/lib/utils";

// Placeholder data
interface CrawledPage {
  url: string;
  statusCode: number;
  title: string;
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
  issueCount: number;
  issues: {
    code: string;
    category: "technical" | "content" | "ai_readiness" | "performance";
    severity: "critical" | "warning" | "info";
    message: string;
    recommendation: string;
  }[];
}

const placeholderPages: CrawledPage[] = [
  {
    url: "/",
    statusCode: 200,
    title: "Home - Acme Corp",
    overallScore: 82,
    technicalScore: 88,
    contentScore: 78,
    aiReadinessScore: 80,
    performanceScore: 82,
    issueCount: 2,
    issues: [
      {
        code: "MISSING_META_DESC",
        category: "technical",
        severity: "warning",
        message: "Meta description is outside 120-160 characters",
        recommendation: "Adjust meta description to 120-160 characters.",
      },
      {
        code: "NO_SUMMARY_SECTION",
        category: "ai_readiness",
        severity: "info",
        message: "Page lacks a summary or key takeaway section",
        recommendation: "Add a TL;DR or key takeaways section.",
      },
    ],
  },
  {
    url: "/about",
    statusCode: 200,
    title: "About Us",
    overallScore: 75,
    technicalScore: 80,
    contentScore: 70,
    aiReadinessScore: 72,
    performanceScore: 78,
    issueCount: 4,
    issues: [
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        message: "Page has insufficient content (320 words)",
        recommendation: "Expand content to at least 500 words.",
      },
    ],
  },
  {
    url: "/products",
    statusCode: 200,
    title: "Products",
    overallScore: 68,
    technicalScore: 72,
    contentScore: 60,
    aiReadinessScore: 65,
    performanceScore: 75,
    issueCount: 5,
    issues: [
      {
        code: "NO_STRUCTURED_DATA",
        category: "ai_readiness",
        severity: "warning",
        message: "Page has no JSON-LD structured data",
        recommendation: "Add JSON-LD structured data.",
      },
    ],
  },
  {
    url: "/blog",
    statusCode: 200,
    title: "Blog",
    overallScore: 85,
    technicalScore: 90,
    contentScore: 82,
    aiReadinessScore: 85,
    performanceScore: 83,
    issueCount: 1,
    issues: [],
  },
  {
    url: "/contact",
    statusCode: 200,
    title: "Contact",
    overallScore: 45,
    technicalScore: 50,
    contentScore: 35,
    aiReadinessScore: 40,
    performanceScore: 55,
    issueCount: 8,
    issues: [
      {
        code: "THIN_CONTENT",
        category: "content",
        severity: "warning",
        message: "Page has insufficient content (88 words)",
        recommendation: "Expand content to at least 500 words.",
      },
      {
        code: "MISSING_H1",
        category: "technical",
        severity: "warning",
        message: "Page is missing an H1 heading",
        recommendation: "Add exactly one H1 heading.",
      },
    ],
  },
  {
    url: "/pricing",
    statusCode: 200,
    title: "Pricing Plans",
    overallScore: 72,
    technicalScore: 78,
    contentScore: 68,
    aiReadinessScore: 70,
    performanceScore: 72,
    issueCount: 3,
    issues: [],
  },
  {
    url: "/docs",
    statusCode: 200,
    title: "Documentation",
    overallScore: 90,
    technicalScore: 92,
    contentScore: 88,
    aiReadinessScore: 90,
    performanceScore: 90,
    issueCount: 1,
    issues: [],
  },
  {
    url: "/faq",
    statusCode: 200,
    title: "FAQ",
    overallScore: 78,
    technicalScore: 82,
    contentScore: 75,
    aiReadinessScore: 76,
    performanceScore: 79,
    issueCount: 3,
    issues: [],
  },
];

type SortField = "url" | "statusCode" | "title" | "overallScore" | "issueCount";
type SortDirection = "asc" | "desc";

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function PagesPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = placeholderPages.filter((page) => {
    const min = scoreMin ? parseInt(scoreMin, 10) : 0;
    const max = scoreMax ? parseInt(scoreMax, 10) : 100;
    return page.overallScore >= min && page.overallScore <= max;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const cmp =
      typeof aVal === "string"
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && <span>{sortDir === "asc" ? "^" : "v"}</span>}
      </span>
    </TableHead>
  );

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
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <p className="mt-1 text-muted-foreground">
          All crawled pages and their scores.
        </p>
      </div>

      {/* Score range filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Filter by score:
        </span>
        <Input
          type="number"
          placeholder="Min"
          className="w-20"
          value={scoreMin}
          onChange={(e) => setScoreMin(e.target.value)}
          min={0}
          max={100}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          className="w-20"
          value={scoreMax}
          onChange={(e) => setScoreMax(e.target.value)}
          min={0}
          max={100}
        />
        {(scoreMin || scoreMax) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScoreMin("");
              setScoreMax("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="url">URL</SortHeader>
              <SortHeader field="statusCode">Status</SortHeader>
              <SortHeader field="title">Title</SortHeader>
              <SortHeader field="overallScore">Score</SortHeader>
              <SortHeader field="issueCount">Issues</SortHeader>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No pages match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((page) => (
                <React.Fragment key={page.url}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedRow(expandedRow === page.url ? null : page.url)
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      {page.url}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          page.statusCode === 200 ? "success" : "destructive"
                        }
                      >
                        {page.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {page.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-semibold",
                          scoreColor(page.overallScore),
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
                    <TableCell>
                      {expandedRow === page.url ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedRow === page.url && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-6">
                        <div className="space-y-4">
                          {/* Score breakdown */}
                          <div className="grid gap-4 sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Technical
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold",
                                  scoreColor(page.technicalScore),
                                )}
                              >
                                {page.technicalScore}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Content
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold",
                                  scoreColor(page.contentScore),
                                )}
                              >
                                {page.contentScore}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                AI Readiness
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold",
                                  scoreColor(page.aiReadinessScore),
                                )}
                              >
                                {page.aiReadinessScore}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Performance
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold",
                                  scoreColor(page.performanceScore),
                                )}
                              >
                                {page.performanceScore}
                              </p>
                            </div>
                          </div>
                          {/* Page issues */}
                          {page.issues.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Issues</h4>
                              {page.issues.map((issue) => (
                                <IssueCard key={issue.code} {...issue} />
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
