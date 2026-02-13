"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
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
import { cn } from "@/lib/utils";

// Placeholder data -- will be replaced with API calls
const stats = {
  totalProjects: 3,
  totalCrawls: 12,
  avgScore: 72,
  creditsRemaining: 6,
  creditsTotal: 10,
};

const recentActivity = [
  {
    id: "c1",
    projectName: "acme.com",
    projectId: "1",
    status: "complete" as const,
    overallScore: 72,
    pagesScanned: 45,
    completedAt: "2025-01-15T10:45:00Z",
  },
  {
    id: "c2",
    projectName: "widgets.io",
    projectId: "2",
    status: "complete" as const,
    overallScore: 58,
    pagesScanned: 22,
    completedAt: "2025-01-14T08:30:00Z",
  },
  {
    id: "c3",
    projectName: "blog.example.com",
    projectId: "3",
    status: "complete" as const,
    overallScore: 85,
    pagesScanned: 12,
    completedAt: "2025-01-14T12:15:00Z",
  },
  {
    id: "c4",
    projectName: "acme.com",
    projectId: "1",
    status: "complete" as const,
    overallScore: 65,
    pagesScanned: 42,
    completedAt: "2025-01-08T10:12:00Z",
  },
  {
    id: "c5",
    projectName: "widgets.io",
    projectId: "2",
    status: "failed" as const,
    overallScore: null,
    pagesScanned: 5,
    completedAt: "2025-01-07T09:00:00Z",
  },
];

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

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

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

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
          <div className="space-y-0">
            {recentActivity.map((activity, index) => (
              <div key={activity.id}>
                {index > 0 && <div className="border-t border-border" />}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        activity.status === "complete"
                          ? "bg-success/10"
                          : "bg-destructive/10",
                      )}
                    >
                      {activity.status === "complete" ? (
                        <BarChart3 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/projects/${activity.projectId}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {activity.projectName}
                        </Link>
                        <Badge
                          variant={
                            activity.status === "complete"
                              ? "success"
                              : "destructive"
                          }
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {activity.pagesScanned} pages
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(activity.completedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.overallScore !== null ? (
                      <span
                        className={cn(
                          "text-lg font-bold",
                          gradeColor(activity.overallScore),
                        )}
                      >
                        {activity.overallScore}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
