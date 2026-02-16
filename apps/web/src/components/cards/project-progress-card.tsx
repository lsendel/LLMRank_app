"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ProjectProgress } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export function ProjectProgressCard({ projectId }: { projectId: string }) {
  const { data: progress } = useApiSWR<ProjectProgress | null>(
    `progress-${projectId}`,
    useCallback(() => api.projects.progress(projectId), [projectId]),
  );

  if (!progress) return null;

  const deltaColor =
    progress.scoreDelta > 0
      ? "text-green-600"
      : progress.scoreDelta < 0
        ? "text-red-600"
        : "text-muted-foreground";

  const DeltaIcon =
    progress.scoreDelta > 0
      ? TrendingUp
      : progress.scoreDelta < 0
        ? TrendingDown
        : Minus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DeltaIcon className={`h-5 w-5 ${deltaColor}`} />
          Progress Since Last Crawl
        </CardTitle>
        <CardDescription>
          Comparing your two most recent completed crawls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score delta hero */}
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${deltaColor}`}>
            {progress.scoreDelta > 0 ? "+" : ""}
            {progress.scoreDelta.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">
            points ({progress.previousScore.toFixed(0)} →{" "}
            {progress.currentScore.toFixed(0)})
          </span>
        </div>

        {/* Category deltas */}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "technical", label: "Technical" },
              { key: "content", label: "Content" },
              { key: "aiReadiness", label: "AI Readiness" },
              { key: "performance", label: "Performance" },
            ] as const
          ).map(({ key, label }) => {
            const cat = progress.categoryDeltas[key];
            return (
              <div key={key} className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`text-sm font-semibold ${
                    cat.delta > 0
                      ? "text-green-600"
                      : cat.delta < 0
                        ? "text-red-600"
                        : ""
                  }`}
                >
                  {cat.delta > 0 ? "+" : ""}
                  {cat.delta.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Issues summary */}
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <ArrowDown className="h-3 w-3" />
            {progress.issuesFixed} fixed
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <ArrowUp className="h-3 w-3" />
            {progress.issuesNew} new
          </span>
          <span className="text-muted-foreground">
            {progress.issuesPersisting} persisting
          </span>
        </div>

        {/* Grade changes */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{progress.gradeChanges.improved} pages improved</span>
          <span>{progress.gradeChanges.regressed} regressed</span>
          <span>{progress.gradeChanges.unchanged} unchanged</span>
        </div>
      </CardContent>
    </Card>
  );
}
