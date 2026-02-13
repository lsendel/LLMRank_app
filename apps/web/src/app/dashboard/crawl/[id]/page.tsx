"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CrawlProgress } from "@/components/crawl-progress";
import { ScoreCircle } from "@/components/score-circle";
import { cn } from "@/lib/utils";

// Placeholder data
const crawl = {
  id: "c1",
  projectId: "1",
  projectName: "acme.com",
  status: "complete" as
    | "pending"
    | "queued"
    | "crawling"
    | "scoring"
    | "complete"
    | "failed"
    | "cancelled",
  startedAt: "2025-01-15T10:30:00Z",
  completedAt: "2025-01-15T10:45:00Z",
  pagesFound: 48,
  pagesCrawled: 45,
  pagesScored: 45,
  pagesErrored: 3,
  overallScore: 72,
  scores: {
    technical: 78,
    content: 65,
    aiReadiness: 70,
    performance: 74,
  },
};

const crawlEvents = [
  { time: "10:30:00", event: "Crawl started", type: "info" as const },
  {
    time: "10:30:01",
    event: "Seed URL loaded: https://acme.com",
    type: "info" as const,
  },
  {
    time: "10:30:05",
    event: "Sitemap discovered: 42 URLs",
    type: "info" as const,
  },
  { time: "10:31:00", event: "10 pages crawled", type: "info" as const },
  { time: "10:33:00", event: "20 pages crawled", type: "info" as const },
  { time: "10:35:00", event: "30 pages crawled", type: "info" as const },
  {
    time: "10:37:00",
    event: "Error: /old-page returned 404",
    type: "warning" as const,
  },
  {
    time: "10:38:00",
    event: "Error: /broken returned 500",
    type: "warning" as const,
  },
  { time: "10:39:00", event: "40 pages crawled", type: "info" as const },
  {
    time: "10:40:00",
    event: "Error: /timeout - request timed out",
    type: "warning" as const,
  },
  {
    time: "10:41:00",
    event: "45 pages crawled (3 errors)",
    type: "info" as const,
  },
  {
    time: "10:42:00",
    event: "Scoring started for 45 pages",
    type: "info" as const,
  },
  { time: "10:44:00", event: "LLM scoring complete", type: "info" as const },
  {
    time: "10:45:00",
    event: "Crawl complete - Overall score: 72",
    type: "success" as const,
  },
];

export default function CrawlDetailPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const isActive =
    crawl.status === "pending" ||
    crawl.status === "crawling" ||
    crawl.status === "scoring";

  const handleCancel = async () => {
    setCancelling(true);
    // TODO: Call API to cancel crawl
    // await api.crawls.cancel(crawl.id);
    setTimeout(() => setCancelling(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/projects/${crawl.projectId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {crawl.projectName}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crawl Details</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {crawl.projectName} - Started{" "}
              {new Date(crawl.startedAt).toLocaleString()}
            </p>
          </div>
          {isActive && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? "Cancelling..." : "Cancel Crawl"}
            </Button>
          )}
        </div>
      </div>

      {/* Crawl Progress */}
      <CrawlProgress
        crawlId={crawl.id}
        initialStatus={crawl.status}
        initialPagesFound={crawl.pagesFound}
        initialPagesCrawled={crawl.pagesCrawled}
        initialPagesScored={crawl.pagesScored}
        initialStartedAt={crawl.startedAt}
      />

      {/* Score summary (when complete) */}
      {crawl.status === "complete" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Score Summary</CardTitle>
              <Link
                href={`/dashboard/projects/${crawl.projectId}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View Project
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
              <ScoreCircle
                score={crawl.overallScore}
                size={120}
                label="Overall"
              />
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Technical</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      crawl.scores.technical >= 80
                        ? "text-success"
                        : crawl.scores.technical >= 60
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {crawl.scores.technical}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Content</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      crawl.scores.content >= 80
                        ? "text-success"
                        : crawl.scores.content >= 60
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {crawl.scores.content}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">AI Readiness</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      crawl.scores.aiReadiness >= 80
                        ? "text-success"
                        : crawl.scores.aiReadiness >= 60
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {crawl.scores.aiReadiness}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Performance</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      crawl.scores.performance >= 80
                        ? "text-success"
                        : crawl.scores.performance >= 60
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {crawl.scores.performance}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crawl timeline/log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crawl Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {crawlEvents.map((event, index) => (
              <div key={index}>
                <div className="flex items-start gap-3 py-2">
                  <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">
                    {event.time}
                  </span>
                  <div
                    className={cn(
                      "h-2 w-2 mt-1.5 flex-shrink-0 rounded-full",
                      event.type === "success" && "bg-success",
                      event.type === "warning" && "bg-warning",
                      event.type === "info" && "bg-primary",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      event.type === "warning" && "text-warning",
                      event.type === "success" && "text-success font-medium",
                    )}
                  >
                    {event.event}
                  </span>
                </div>
                {index < crawlEvents.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
