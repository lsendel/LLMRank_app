"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/lib/auth-hooks";
import {
  FolderKanban,
  Activity,
  BarChart3,
  Clock,
  Plus,
  Play,
  ArrowRight,
  FileText,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, gradeColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getStatusBadgeVariant(
  status: string,
): "success" | "destructive" | "warning" | "secondary" {
  if (status === "complete") return "success";
  if (status === "failed") return "destructive";
  if (status === "crawling" || status === "scoring") return "warning";
  return "secondary";
}

function formatDashboardDelta(delta: number) {
  if (delta > 0)
    return { label: `+${delta} vs last crawl`, className: "text-emerald-600" };
  if (delta < 0)
    return { label: `${delta} vs last crawl`, className: "text-red-600" };
  return { label: "No change", className: "text-muted-foreground" };
}

const pillarLabels: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
};

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const { data: stats, isLoading: statsLoading } = useApiSWR(
    "dashboard-stats",
    useCallback(() => api.dashboard.getStats(), []),
  );

  const { data: activity, isLoading: activityLoading } = useApiSWR(
    "dashboard-activity",
    useCallback(() => api.dashboard.getRecentActivity(), []),
  );

  const loading = statsLoading || activityLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">
          No data yet. Create your first project to get started.
        </p>
      </div>
    );
  }

  const insights = stats.latestInsights;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here is an overview of your AI-readiness scores and recent activity.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button asChild variant="outline">
            <Link href="/dashboard/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/projects">
              <Play className="h-4 w-4" />
              Start Crawl
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-semibold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Crawls</p>
                <p className="text-2xl font-semibold">{stats.totalCrawls}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p
                  className={cn(
                    "text-2xl font-semibold",
                    gradeColor(stats.avgScore),
                  )}
                >
                  {stats.avgScore}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Credits Remaining
                </p>
                <p className="text-2xl font-semibold">
                  {stats.creditsRemaining}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{stats.creditsTotal}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {insights && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Score Momentum</CardTitle>
              <CardDescription>
                Delta against your previous completed crawl
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Overall", value: insights.scoreDeltas.overall },
                { label: "Technical", value: insights.scoreDeltas.technical },
                { label: "Content", value: insights.scoreDeltas.content },
                {
                  label: "AI Readiness",
                  value: insights.scoreDeltas.aiReadiness,
                },
                {
                  label: "Performance",
                  value: insights.scoreDeltas.performance,
                },
              ].map((row) => {
                const meta = formatDashboardDelta(row.value);
                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between border-b border-border/50 pb-2 last:border-none"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className={cn("text-xs", meta.className)}>
                        {meta.label}
                      </p>
                    </div>
                    <p className={cn("text-lg font-semibold", meta.className)}>
                      {row.value > 0 ? `+${row.value}` : row.value}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Quick Wins</CardTitle>
              <CardDescription>
                High-impact fixes pulled from your latest crawl
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {insights.quickWins.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No outstanding issues detected. Great job!
                </p>
              )}
              {insights.quickWins.map((win) => (
                <div
                  key={win.code}
                  className="rounded-md border border-border/60 p-3"
                >
                  <p className="text-sm font-medium">{win.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {win.recommendation}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Owner: {win.owner}</span>
                    <span>Effort: {win.effort}</span>
                    <span>+{win.scoreImpact} pts</span>
                    <span>{win.affectedPages} pages</span>
                    <span>{pillarLabels[win.pillar] ?? win.pillar}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Readiness Coverage</CardTitle>
              <CardDescription>
                Share of pages meeting critical technical controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {insights.coverage.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Coverage metrics will appear after your next crawl.
                </p>
              )}
              {insights.coverage.map((metric) => (
                <div key={metric.code} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{metric.label}</span>
                    <span>{metric.coveragePercent}%</span>
                  </div>
                  <Progress value={metric.coveragePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {metric.totalPages - metric.affectedPages}/
                    {metric.totalPages} pages compliant
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick actions (mobile) */}
      <div className="flex gap-2 sm:hidden">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/dashboard/projects">
            <Play className="h-4 w-4" />
            Start Crawl
          </Link>
        </Button>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>
                Last 5 crawl jobs across all projects.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/projects">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(activity ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No recent activity. Start a crawl to see results here.
            </p>
          ) : (
            <div className="space-y-0">
              {(activity ?? []).map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <div className="border-t border-border" />}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          item.status === "complete"
                            ? "bg-success/10"
                            : item.status === "failed"
                              ? "bg-destructive/10"
                              : "bg-warning/10",
                        )}
                      >
                        {item.status === "complete" ? (
                          <BarChart3 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/projects/${item.projectId}`}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {item.projectName}
                          </Link>
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {item.pagesScored} pages
                          </span>
                          {item.completedAt && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(item.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.overallScore !== null ? (
                        <span
                          className={cn(
                            "text-lg font-bold",
                            gradeColor(item.overallScore),
                          )}
                        >
                          {item.overallScore}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          --
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
