"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowLeft } from "lucide-react";
import { cn, gradeColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

interface LeaderboardEntry {
  projectId: string;
  domain: string;
  overallScore: number;
  grade: string;
  aiReadinessScore: number;
}

type GradeFilter = "all" | "A" | "B" | "C" | "D" | "F";

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export default function LeaderboardPage() {
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");

  const { data: entries, isLoading } = useApiSWR<LeaderboardEntry[]>(
    "leaderboard",
    useCallback(() => api.public.leaderboard(), []),
  );

  const filtered =
    gradeFilter === "all"
      ? entries
      : entries?.filter((e) => gradeFromScore(e.overallScore) === gradeFilter);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              AI Readiness Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Top-scoring sites that opted in to public ranking
            </p>
          </div>
        </div>
      </div>

      {/* Grade filter */}
      <div className="flex gap-2">
        {(["all", "A", "B", "C", "D", "F"] as const).map((grade) => (
          <Button
            key={grade}
            variant={gradeFilter === grade ? "default" : "outline"}
            size="sm"
            onClick={() => setGradeFilter(grade)}
          >
            {grade === "all" ? "All" : `Grade ${grade}`}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border bg-muted/30"
            />
          ))}
        </div>
      )}

      {!isLoading && (!filtered || filtered.length === 0) && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {gradeFilter === "all"
              ? "No sites have opted in to the leaderboard yet."
              : `No sites with grade ${gradeFilter} found.`}
          </p>
        </Card>
      )}

      {filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((entry, index) => {
            const grade = gradeFromScore(entry.overallScore);
            return (
              <Card
                key={entry.projectId}
                className="transition-colors hover:bg-accent/5"
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="w-8 text-center text-lg font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.domain}</span>
                      <Badge
                        variant="outline"
                        className={cn(gradeColor(entry.overallScore))}
                      >
                        {grade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AI Readiness: {entry.aiReadinessScore}/100
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      gradeColor(entry.overallScore),
                    )}
                  >
                    {entry.overallScore}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
