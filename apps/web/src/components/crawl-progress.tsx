"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CrawlStatus =
  | "pending"
  | "queued"
  | "crawling"
  | "scoring"
  | "complete"
  | "failed"
  | "cancelled";

interface CrawlProgressProps {
  crawlId: string;
  initialStatus?: CrawlStatus;
  initialPagesFound?: number;
  initialPagesCrawled?: number;
  initialPagesScored?: number;
  initialStartedAt?: string;
  onComplete?: () => void;
  className?: string;
}

interface CrawlState {
  status: CrawlStatus;
  pagesFound: number;
  pagesCrawled: number;
  pagesScored: number;
  startedAt: string | null;
  elapsedSeconds: number;
}

const statusConfig: Record<
  CrawlStatus,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "destructive"
      | "success"
      | "warning"
      | "info";
    icon: React.ElementType;
  }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  queued: { label: "Queued", variant: "secondary", icon: Clock },
  crawling: { label: "Crawling", variant: "warning", icon: Loader2 },
  scoring: { label: "Scoring", variant: "info", icon: BarChart3 },
  complete: { label: "Complete", variant: "success", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function CrawlProgress({
  crawlId,
  initialStatus = "pending",
  initialPagesFound = 0,
  initialPagesCrawled = 0,
  initialPagesScored = 0,
  initialStartedAt,
  onComplete,
  className,
}: CrawlProgressProps) {
  const [state, setState] = useState<CrawlState>({
    status: initialStatus,
    pagesFound: initialPagesFound,
    pagesCrawled: initialPagesCrawled,
    pagesScored: initialPagesScored,
    startedAt: initialStartedAt ?? null,
    elapsedSeconds: 0,
  });

  const isActive =
    state.status === "pending" ||
    state.status === "crawling" ||
    state.status === "scoring";

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/crawls/${crawlId}`);
      if (!response.ok) return;
      const json = await response.json();
      const data = json.data ?? json;
      setState((prev) => ({
        ...prev,
        status: data.status ?? prev.status,
        pagesFound: data.pagesFound ?? data.pages_found ?? prev.pagesFound,
        pagesCrawled:
          data.pagesCrawled ?? data.pages_crawled ?? prev.pagesCrawled,
        pagesScored: data.pagesScored ?? data.pages_scored ?? prev.pagesScored,
        startedAt: data.startedAt ?? data.started_at ?? prev.startedAt,
      }));
      if (data.status === "complete" && onComplete) {
        onComplete();
      }
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, [crawlId, onComplete]);

  // Auto-refresh every 3 seconds when active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [isActive, fetchProgress]);

  // Elapsed time counter
  useEffect(() => {
    if (!isActive || !state.startedAt) return;
    const startTime = new Date(state.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setState((prev) => ({
        ...prev,
        elapsedSeconds: Math.floor((now - startTime) / 1000),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, state.startedAt]);

  const config = statusConfig[state.status];
  const StatusIcon = config.icon;
  const progressPercent =
    state.pagesFound > 0
      ? Math.round((state.pagesCrawled / state.pagesFound) * 100)
      : 0;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Crawl Progress</CardTitle>
          <Badge variant={config.variant}>
            <StatusIcon
              className={cn("mr-1 h-3 w-3", isActive && "animate-spin")}
            />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {state.pagesCrawled} / {state.pagesFound || "?"} pages
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs">Found</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{state.pagesFound}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs">Crawled</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{state.pagesCrawled}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs">Scored</span>
            </div>
            <p className="mt-1 text-lg font-semibold">{state.pagesScored}</p>
          </div>
        </div>

        {/* Elapsed time */}
        {state.startedAt && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Elapsed: {formatElapsed(state.elapsedSeconds)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
