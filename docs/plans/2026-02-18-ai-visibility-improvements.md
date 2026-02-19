# AI Visibility Tab Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the AI Visibility tab from a raw data dump into an executive-level dashboard with score visualization, actionable recommendations, curated queries (no free text), competitive SoV overlay, hardened scheduled checks, and 7-provider platform readiness.

**Architecture:** Add an AI Visibility Score header card (consuming the existing `/ai-score` endpoint), a recommendations engine that aggregates gaps + platform failures + trends, replace free-text query input with a keyword/persona picker, enhance SoV chart with competitor overlay, restrict schedule frequency to weekly/monthly, and expand platform readiness from 5 to 7 providers.

**Tech Stack:** Hono API (Cloudflare Workers), Recharts, Shadcn UI, Vitest, Drizzle ORM, Next.js dynamic imports

**Design doc:** `docs/plans/2026-02-18-ai-visibility-improvements-design.md`

---

## Task 1: Add AI Visibility Score trend endpoint

**Files:**

- Modify: `apps/api/src/routes/visibility.ts`
- Create: `apps/api/src/__tests__/services/ai-score-trend.test.ts`

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/services/ai-score-trend.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeAIVisibilityScore,
  type AIVisibilityInput,
} from "@llm-boost/scoring";

describe("AI Visibility Score trend comparison", () => {
  it("computes delta between two periods", () => {
    const current: AIVisibilityInput = {
      llmMentionRate: 0.8,
      aiSearchPresenceRate: 0.6,
      shareOfVoice: 0.4,
      backlinkAuthoritySignal: 0.5,
    };
    const previous: AIVisibilityInput = {
      llmMentionRate: 0.6,
      aiSearchPresenceRate: 0.4,
      shareOfVoice: 0.3,
      backlinkAuthoritySignal: 0.5,
    };

    const currentScore = computeAIVisibilityScore(current);
    const previousScore = computeAIVisibilityScore(previous);
    const delta = currentScore.overall - previousScore.overall;

    expect(delta).toBeGreaterThan(0);
    expect(currentScore.overall).toBeGreaterThan(previousScore.overall);
  });

  it("returns zero delta when no previous data", () => {
    const current: AIVisibilityInput = {
      llmMentionRate: 0.5,
      aiSearchPresenceRate: 0.5,
      shareOfVoice: 0.5,
      backlinkAuthoritySignal: 0.5,
    };
    const score = computeAIVisibilityScore(current);
    expect(score.overall).toBe(50);
  });
});
```

**Step 2: Run test to verify it passes (pure function)**

Run: `pnpm --filter api test -- --run src/__tests__/services/ai-score-trend.test.ts`
Expected: PASS

**Step 3: Add the trend endpoint to visibility routes**

In `apps/api/src/routes/visibility.ts`, after the existing `GET /:projectId/ai-score` endpoint (line ~298), add:

```ts
// ---------------------------------------------------------------------------
// GET /:projectId/ai-score/trend — AI Visibility Score with period comparison
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/ai-score/trend", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const checks = await service.listForProject(userId, projectId);
    const project = await createProjectRepository(db).getById(projectId);
    if (!project) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentChecks = checks.filter(
      (ch) => new Date(ch.checkedAt) >= oneWeekAgo,
    );
    const previousChecks = checks.filter(
      (ch) =>
        new Date(ch.checkedAt) >= twoWeeksAgo &&
        new Date(ch.checkedAt) < oneWeekAgo,
    );

    function computeInputs(
      subset: typeof checks,
    ): import("@llm-boost/scoring").AIVisibilityInput {
      const llm = subset.filter((ch) => ch.llmProvider !== "gemini_ai_mode");
      const ai = subset.filter((ch) => ch.llmProvider === "gemini_ai_mode");
      const llmMentionRate =
        llm.length > 0
          ? llm.filter((ch) => ch.brandMentioned).length / llm.length
          : 0;
      const aiSearchPresenceRate =
        ai.length > 0
          ? ai.filter((ch) => ch.brandMentioned).length / ai.length
          : 0;
      const userMentions = llm.filter((ch) => ch.brandMentioned).length;
      let compMentions = 0;
      for (const ch of llm) {
        const mentions = (ch.competitorMentions ?? []) as Array<{
          mentioned: boolean;
        }>;
        compMentions += mentions.filter((m) => m.mentioned).length;
      }
      const total = userMentions + compMentions;
      const shareOfVoice = total > 0 ? userMentions / total : 0;

      return {
        llmMentionRate,
        aiSearchPresenceRate,
        shareOfVoice,
        backlinkAuthoritySignal: 0,
      };
    }

    // Backlink authority is the same for both periods (doesn't change weekly)
    const blSummary = await discoveredLinkQueries(db).getSummary(
      project.domain,
    );
    const backlinkAuth = Math.min(1, blSummary.referringDomains / 50);

    const currentInput = {
      ...computeInputs(currentChecks),
      backlinkAuthoritySignal: backlinkAuth,
    };
    const previousInput = {
      ...computeInputs(previousChecks),
      backlinkAuthoritySignal: backlinkAuth,
    };

    const current = computeAIVisibilityScore(currentInput);
    const previous =
      previousChecks.length > 0
        ? computeAIVisibilityScore(previousInput)
        : null;

    const delta = previous ? current.overall - previous.overall : 0;

    return c.json({
      data: {
        current,
        previous,
        delta,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "stable",
        period: "weekly",
        meta: {
          currentChecks: currentChecks.length,
          previousChecks: previousChecks.length,
          referringDomains: blSummary.referringDomains,
        },
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 4: Verify typecheck**

Run: `pnpm --filter api typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/visibility.ts apps/api/src/__tests__/services/ai-score-trend.test.ts
git commit -m "feat(api): add AI visibility score trend endpoint with weekly comparison"
```

---

## Task 2: Create recommendations endpoint

**Files:**

- Create: `apps/api/src/services/recommendations-service.ts`
- Modify: `apps/api/src/routes/visibility.ts`

**Step 1: Create the recommendations service**

Create `apps/api/src/services/recommendations-service.ts`:

```ts
export interface Recommendation {
  type: "gap" | "platform" | "issue" | "trend" | "coverage";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  provider?: string;
  fixUrl?: string;
}

interface GapData {
  query: string;
  competitorsCited: Array<{ domain: string }>;
}

interface PlatformFailure {
  platform: string;
  label: string;
  issueCode: string;
  importance: "critical" | "important" | "recommended";
}

interface TrendData {
  provider: string;
  currentRate: number;
  previousRate: number;
}

export function generateRecommendations(input: {
  gaps: GapData[];
  platformFailures: PlatformFailure[];
  issueCodesPresent: Set<string>;
  trends: TrendData[];
  providersUsed: Set<string>;
  projectId: string;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Visibility gaps — queries where competitors are cited but user is not
  for (const gap of input.gaps.slice(0, 3)) {
    recs.push({
      type: "gap",
      title: `Invisible for "${gap.query}"`,
      description: `Competitors ${gap.competitorsCited.map((c) => c.domain).join(", ")} are cited for this query but you are not. Create targeted content addressing this topic.`,
      impact: "high",
      fixUrl: `/dashboard/projects/${input.projectId}?tab=strategy`,
    });
  }

  // 2. Platform readiness — critical checks failing
  const criticalFailures = input.platformFailures.filter(
    (f) => f.importance === "critical",
  );
  for (const failure of criticalFailures.slice(0, 3)) {
    const descriptions: Record<string, string> = {
      AI_CRAWLER_BLOCKED: `${failure.platform}'s crawler is blocked by your robots.txt. This prevents the AI from accessing your content entirely.`,
      NO_STRUCTURED_DATA: `Missing JSON-LD schema markup. ${failure.platform} uses structured data to understand and cite your content accurately.`,
      MISSING_LLMS_TXT: `No llms.txt file found. This file tells AI engines how to interpret and cite your content.`,
      THIN_CONTENT: `Content is too thin for ${failure.platform} to consider citation-worthy. Aim for 1500+ words with factual depth.`,
      CITATION_WORTHINESS: `Content lacks citation-worthy elements (statistics, original data, expert quotes) that ${failure.platform} looks for.`,
    };

    recs.push({
      type: "platform",
      title: `${failure.label} failing for ${failure.platform}`,
      description:
        descriptions[failure.issueCode] ??
        `Fix "${failure.label}" to improve ${failure.platform} visibility.`,
      impact: "high",
      provider: failure.platform.toLowerCase(),
      fixUrl: `/dashboard/projects/${input.projectId}?tab=issues`,
    });
  }

  // 3. SoV trend drops — providers where visibility is declining
  for (const trend of input.trends) {
    const drop = trend.previousRate - trend.currentRate;
    if (drop > 0.15) {
      recs.push({
        type: "trend",
        title: `${trend.provider} visibility dropped ${Math.round(drop * 100)}%`,
        description: `Your brand mention rate on ${trend.provider} fell from ${Math.round(trend.previousRate * 100)}% to ${Math.round(trend.currentRate * 100)}% this week. Review recent content changes and competitor activity.`,
        impact: drop > 0.3 ? "high" : "medium",
        provider: trend.provider,
      });
    }
  }

  // 4. Provider coverage gaps — providers not yet checked
  const allProviders = [
    "chatgpt",
    "claude",
    "perplexity",
    "gemini",
    "copilot",
    "gemini_ai_mode",
    "grok",
  ];
  const unchecked = allProviders.filter((p) => !input.providersUsed.has(p));
  if (unchecked.length > 0) {
    recs.push({
      type: "coverage",
      title: `Not tracking ${unchecked.length} AI provider${unchecked.length > 1 ? "s" : ""}`,
      description: `You haven't run visibility checks on ${unchecked.join(", ")}. Add these providers to get a complete picture.`,
      impact: unchecked.length >= 3 ? "medium" : "low",
    });
  }

  // Sort by impact (high first)
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return recs.slice(0, 5);
}
```

**Step 2: Add the endpoint to visibility routes**

In `apps/api/src/routes/visibility.ts`, add after the ai-score/trend endpoint:

```ts
// ---------------------------------------------------------------------------
// GET /:projectId/recommendations — Prioritized action items
// ---------------------------------------------------------------------------

visibilityRoutes.get("/:projectId/recommendations", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  try {
    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const checks =
      await createVisibilityRepository(db).listByProject(projectId);

    // 1. Compute gaps
    const queryMap = new Map<
      string,
      { userMentioned: boolean; competitorsCited: Array<{ domain: string }> }
    >();
    for (const check of checks) {
      const entry = queryMap.get(check.query) ?? {
        userMentioned: false,
        competitorsCited: [],
      };
      if (check.brandMentioned) entry.userMentioned = true;
      const mentions = (check.competitorMentions ?? []) as Array<{
        domain: string;
        mentioned: boolean;
      }>;
      for (const m of mentions) {
        if (
          m.mentioned &&
          !entry.competitorsCited.some((c) => c.domain === m.domain)
        ) {
          entry.competitorsCited.push({ domain: m.domain });
        }
      }
      queryMap.set(check.query, entry);
    }
    const gaps = [...queryMap.entries()]
      .filter(([, v]) => !v.userMentioned && v.competitorsCited.length > 0)
      .map(([query, v]) => ({ query, competitorsCited: v.competitorsCited }));

    // 2. Platform failures (from latest crawl)
    const { crawlQueries: cq, pageQueries: pq } = await import("@llm-boost/db");
    const latestCrawl = await cq(db).getLatestByProject(projectId);
    let platformFailures: Array<{
      platform: string;
      label: string;
      issueCode: string;
      importance: "critical" | "important" | "recommended";
    }> = [];
    if (latestCrawl) {
      const { issueQueries } = await import("@llm-boost/db");
      const issues = await issueQueries(db).listByCrawl(latestCrawl.id);
      const issueCodes = new Set(issues.map((i) => i.code));
      const { PLATFORM_REQUIREMENTS } = await import("@llm-boost/shared");
      for (const [platform, checks] of Object.entries(PLATFORM_REQUIREMENTS)) {
        for (const check of checks) {
          if (issueCodes.has(check.issueCode)) {
            platformFailures.push({ platform, ...check });
          }
        }
      }
    }

    // 3. Trends (current vs previous week per provider)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const providerTrends: Array<{
      provider: string;
      currentRate: number;
      previousRate: number;
    }> = [];
    const providers = new Set(checks.map((ch) => ch.llmProvider));
    for (const provider of providers) {
      const current = checks.filter(
        (ch) =>
          ch.llmProvider === provider && new Date(ch.checkedAt) >= oneWeekAgo,
      );
      const previous = checks.filter(
        (ch) =>
          ch.llmProvider === provider &&
          new Date(ch.checkedAt) >= twoWeeksAgo &&
          new Date(ch.checkedAt) < oneWeekAgo,
      );
      if (current.length > 0 && previous.length > 0) {
        providerTrends.push({
          provider,
          currentRate:
            current.filter((ch) => ch.brandMentioned).length / current.length,
          previousRate:
            previous.filter((ch) => ch.brandMentioned).length / previous.length,
        });
      }
    }

    const { generateRecommendations } =
      await import("../services/recommendations-service");
    const recommendations = generateRecommendations({
      gaps,
      platformFailures,
      issueCodesPresent: new Set(),
      trends: providerTrends,
      providersUsed: providers,
      projectId,
    });

    return c.json({ data: recommendations });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 3: Verify typecheck**

Run: `pnpm --filter api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/services/recommendations-service.ts apps/api/src/routes/visibility.ts
git commit -m "feat(api): add recommendations engine for AI visibility tab"
```

---

## Task 3: Add API client methods for new endpoints

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add types and methods**

Add interfaces near other visibility types:

```ts
interface AIScoreTrend {
  current: {
    overall: number;
    grade: "A" | "B" | "C" | "D" | "F";
    breakdown: {
      llmMentions: number;
      aiSearch: number;
      shareOfVoice: number;
      backlinkAuthority: number;
    };
  };
  previous: {
    overall: number;
    grade: "A" | "B" | "C" | "D" | "F";
    breakdown: {
      llmMentions: number;
      aiSearch: number;
      shareOfVoice: number;
      backlinkAuthority: number;
    };
  } | null;
  delta: number;
  direction: "up" | "down" | "stable";
  period: string;
  meta: {
    currentChecks: number;
    previousChecks: number;
    referringDomains: number;
  };
}

interface VisibilityRecommendation {
  type: "gap" | "platform" | "issue" | "trend" | "coverage";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  provider?: string;
  fixUrl?: string;
}
```

Add methods to the `api.visibility` namespace:

```ts
async getScoreTrend(projectId: string): Promise<AIScoreTrend> {
  const res = await apiClient.get<ApiEnvelope<AIScoreTrend>>(
    `/api/visibility/${projectId}/ai-score/trend`,
  );
  return res.data;
},
async getRecommendations(projectId: string): Promise<VisibilityRecommendation[]> {
  const res = await apiClient.get<ApiEnvelope<VisibilityRecommendation[]>>(
    `/api/visibility/${projectId}/recommendations`,
  );
  return res.data;
},
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add API client methods for score trend and recommendations"
```

---

## Task 4: Create AI Visibility Score header component

**Files:**

- Create: `apps/web/src/components/visibility/ai-visibility-score-header.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type AIScoreTrend } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-600",
  B: "text-blue-600",
  C: "text-amber-600",
  D: "text-orange-600",
  F: "text-red-600",
};

const SCORE_BG: Record<string, string> = {
  A: "bg-green-50 border-green-200",
  B: "bg-blue-50 border-blue-200",
  C: "bg-amber-50 border-amber-200",
  D: "bg-orange-50 border-orange-200",
  F: "bg-red-50 border-red-200",
};

const SIGNAL_LABELS = [
  { key: "llmMentions", label: "LLM Mentions", max: 40 },
  { key: "aiSearch", label: "AI Search Presence", max: 30 },
  { key: "shareOfVoice", label: "Share of Voice", max: 20 },
  { key: "backlinkAuthority", label: "Backlink Authority", max: 10 },
] as const;

export function AIVisibilityScoreHeader({ projectId }: { projectId: string }) {
  const { data, isLoading } = useApiSWR<AIScoreTrend>(
    `ai-score-trend-${projectId}`,
    useCallback(() => api.visibility.getScoreTrend(projectId), [projectId]),
  );

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { current, delta, direction } = data;
  const TrendIcon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    direction === "up"
      ? "text-green-600"
      : direction === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Card 1: Overall Score */}
      <Card className={`border ${SCORE_BG[current.grade]}`}>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              AI Visibility Score
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold">{current.overall}</span>
              <span
                className={`text-2xl font-bold ${GRADE_COLORS[current.grade]}`}
              >
                {current.grade}
              </span>
            </div>
            {delta !== 0 && (
              <div
                className={`mt-2 flex items-center gap-1 text-sm ${trendColor}`}
              >
                <TrendIcon className="h-4 w-4" />
                <span>
                  {delta > 0 ? "+" : ""}
                  {delta} vs last week
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Signal Breakdown */}
      <Card>
        <CardContent className="p-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Score Breakdown
          </p>
          <div className="space-y-2.5">
            {SIGNAL_LABELS.map(({ key, label, max }) => {
              const value =
                current.breakdown[key as keyof typeof current.breakdown];
              const pct = Math.round((value / max) * 100);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-medium">
                      {value}/{max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Check Stats */}
      <Card>
        <CardContent className="p-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Tracking Summary
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Checks this week</span>
              <span className="font-medium">{data.meta.currentChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Previous week</span>
              <span className="font-medium">{data.meta.previousChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Referring domains</span>
              <span className="font-medium">{data.meta.referringDomains}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Period</span>
              <span className="font-medium capitalize">{data.period}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/visibility/ai-visibility-score-header.tsx
git commit -m "feat(web): add AI visibility score header with trend and breakdown"
```

---

## Task 5: Create recommendations card component

**Files:**

- Create: `apps/web/src/components/visibility/recommendations-card.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type VisibilityRecommendation } from "@/lib/api";
import {
  Lightbulb,
  TrendingDown,
  Eye,
  AlertTriangle,
  Radio,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, typeof Lightbulb> = {
  gap: Eye,
  platform: AlertTriangle,
  issue: AlertTriangle,
  trend: TrendingDown,
  coverage: Radio,
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

export function RecommendationsCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = useApiSWR<VisibilityRecommendation[]>(
    `recommendations-${projectId}`,
    useCallback(
      () => api.visibility.getRecommendations(projectId),
      [projectId],
    ),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No actionable recommendations right now. Run more visibility checks
            to get insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Top Actions to Improve Visibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((rec, i) => {
          const Icon = TYPE_ICONS[rec.type] ?? Lightbulb;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-4"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{rec.title}</span>
                  <Badge
                    className={IMPACT_STYLES[rec.impact]}
                    variant="secondary"
                  >
                    {rec.impact}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {rec.description}
                </p>
              </div>
              {rec.fixUrl && (
                <Link href={rec.fixUrl}>
                  <Button size="sm" variant="outline">
                    Fix
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/visibility/recommendations-card.tsx
git commit -m "feat(web): add recommendations card component for AI visibility tab"
```

---

## Task 6: Replace free-text query input with curated query picker

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`
- Modify: `apps/api/src/routes/visibility.ts` (validate query against saved keywords)

**Step 1: Update the visibility tab component**

In `apps/web/src/components/tabs/visibility-tab.tsx`:

a) Add imports and SWR for keywords/personas at top:

```ts
import { useApiSWR } from "@/lib/use-api-swr";
import { Checkbox } from "@/components/ui/checkbox";

// After existing SWR hooks:
const { data: savedKeywords } = useApiSWR<SavedKeyword[]>(
  `keywords-${projectId}`,
  useCallback(() => api.keywords.list(projectId), [projectId]),
);

const { data: personas } = useApiSWR<Persona[]>(
  `personas-${projectId}`,
  useCallback(() => api.personas.list(projectId), [projectId]),
);
```

b) Replace the `query` state with `selectedQueries`:

```ts
const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
```

c) Replace the `handleRunCheck` function to use selected queries:

```ts
async function handleRunCheck() {
  if (selectedQueries.length === 0 || selectedProviders.length === 0) return;
  setLoading(true);
  setError(null);
  try {
    const allResults: VisibilityCheck[] = [];
    for (const query of selectedQueries) {
      await withAuth(async () => {
        const data = await api.visibility.run({
          projectId,
          query,
          providers: selectedProviders,
        });
        allResults.push(...data);
      });
    }
    setResults(allResults);
    const updated = await api.visibility.list(projectId);
    setHistory(updated);
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message);
    } else {
      setError("Failed to run visibility check.");
    }
  } finally {
    setLoading(false);
  }
}
```

d) Replace the Run Check form Card (lines ~257-297) with the curated picker:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Run Visibility Check</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Select Queries</Label>

      {/* From saved keywords */}
      {savedKeywords && savedKeywords.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            From Keywords
          </p>
          {savedKeywords.map((kw) => (
            <label
              key={kw.id}
              className="flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedQueries.includes(kw.keyword)}
                onCheckedChange={(checked) => {
                  setSelectedQueries((prev) =>
                    checked
                      ? [...prev, kw.keyword]
                      : prev.filter((q) => q !== kw.keyword),
                  );
                }}
              />
              <span className="flex-1">{kw.keyword}</span>
              {kw.funnelStage && (
                <Badge variant="secondary" className="text-xs">
                  {kw.funnelStage}
                </Badge>
              )}
            </label>
          ))}
        </div>
      )}

      {/* From persona sample queries */}
      {personas && personas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            From Personas
          </p>
          {personas.flatMap((p) =>
            p.sampleQueries.map((sq) => (
              <label
                key={`${p.id}-${sq}`}
                className="flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedQueries.includes(sq)}
                  onCheckedChange={(checked) => {
                    setSelectedQueries((prev) =>
                      checked ? [...prev, sq] : prev.filter((q) => q !== sq),
                    );
                  }}
                />
                <span className="flex-1">{sq}</span>
                <span className="text-xs text-muted-foreground">{p.name}</span>
              </label>
            )),
          )}
        </div>
      )}

      {/* Empty state */}
      {(!savedKeywords || savedKeywords.length === 0) &&
        (!personas || personas.length === 0) && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No keywords or personas yet.
            </p>
            <Button
              size="sm"
              variant="link"
              className="mt-1"
              onClick={() => {
                // Navigate to keywords tab
                const params = new URLSearchParams(window.location.search);
                params.set("tab", "keywords");
                window.location.search = params.toString();
              }}
            >
              Discover Keywords
            </Button>
          </div>
        )}
    </div>

    {/* Provider toggles — keep existing */}
    <div className="space-y-2">
      <Label>LLM Providers</Label>
      <div className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <Button
            key={p.id}
            variant={selectedProviders.includes(p.id) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleProvider(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>

    {/* Cost indicator */}
    {selectedQueries.length > 0 && (
      <p className="text-xs text-muted-foreground">
        {selectedQueries.length} quer
        {selectedQueries.length === 1 ? "y" : "ies"} ×{" "}
        {selectedProviders.length} provider
        {selectedProviders.length === 1 ? "" : "s"} ={" "}
        {selectedQueries.length * selectedProviders.length} checks
      </p>
    )}

    {error && (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    )}
    <Button
      onClick={handleRunCheck}
      disabled={loading || selectedQueries.length === 0}
    >
      {loading ? "Checking..." : "Run Check"}
    </Button>
  </CardContent>
</Card>
```

**Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): replace free-text query input with curated keyword/persona picker"
```

---

## Task 7: Wire new components into visibility tab

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Add imports for new components**

At the top of the file, add:

```ts
import { AIVisibilityScoreHeader } from "@/components/visibility/ai-visibility-score-header";
import { RecommendationsCard } from "@/components/visibility/recommendations-card";
```

**Step 2: Add components to the render output**

In the return JSX, insert the score header and recommendations card at the TOP, before PlatformReadinessMatrix (line ~240):

```tsx
return (
  <div className="space-y-6">
    {/* AI Visibility Score Header — NEW */}
    <AIVisibilityScoreHeader projectId={projectId} />

    {/* Actionable Recommendations — NEW */}
    <RecommendationsCard projectId={projectId} />

    {/* Platform Readiness Matrix — existing */}
    {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

    {/* ... rest of existing components ... */}
```

**Step 3: Update scheduled checks frequency options**

Replace the `FREQUENCY_OPTIONS` constant (line ~67):

```ts
const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
  { value: "monthly", label: "Monthly", description: "1st of each month" },
] as const;
```

**Step 4: Verify build**

Run: `pnpm --filter web build`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): wire score header, recommendations, and restrict schedule frequency"
```

---

## Task 8: Expand platform readiness to 7 providers

**Files:**

- Modify: `packages/shared/src/constants/platforms.ts`
- Modify: `packages/shared/src/constants/platform-requirements.ts`

**Step 1: Add Copilot and Gemini AI Mode to LLM_PLATFORMS**

In `packages/shared/src/constants/platforms.ts`:

```ts
export const LLM_PLATFORMS = [
  "chatgpt",
  "perplexity",
  "claude",
  "gemini",
  "grok",
  "copilot",
  "gemini_ai_mode",
] as const;
```

Add to `LLM_PLATFORM_NAMES`:

```ts
copilot: "Copilot (Microsoft)",
gemini_ai_mode: "AI Mode (Google)",
```

Add to `PLATFORM_WEIGHTS`:

```ts
copilot: {
  technical: 0.35,
  content: 0.25,
  ai_readiness: 0.15,
  performance: 0.25,
},
gemini_ai_mode: {
  technical: 0.25,
  content: 0.3,
  ai_readiness: 0.35,
  performance: 0.1,
},
```

Add to `PLATFORM_TIPS`:

```ts
copilot: [
  "Ensure Bing can crawl your site (check BingBot in robots.txt)",
  "Implement comprehensive meta tags (title, description, OG)",
  "Submit sitemap to Bing Webmaster Tools",
  "Optimize page speed — Copilot favors fast-loading sources",
],
gemini_ai_mode: [
  "Include source URLs and citations in your content",
  "Use comprehensive JSON-LD schema for entity recognition",
  "Write content that directly answers common questions",
  "Add authoritative references and data-backed claims",
],
```

**Step 2: Add platform requirements for Copilot, Grok, Gemini AI Mode**

In `packages/shared/src/constants/platform-requirements.ts`, add:

```ts
Copilot: [
  { factor: "meta_desc", label: "Meta description", issueCode: "MISSING_META_DESC", importance: "critical" },
  { factor: "structured_data", label: "JSON-LD schema", issueCode: "NO_STRUCTURED_DATA", importance: "critical" },
  { factor: "title", label: "Title tag", issueCode: "MISSING_TITLE", importance: "critical" },
  { factor: "sitemap", label: "Sitemap", issueCode: "MISSING_SITEMAP", importance: "important" },
  { factor: "canonical", label: "Canonical URL", issueCode: "MISSING_CANONICAL", importance: "important" },
  { factor: "robots", label: "Robots.txt", issueCode: "MISSING_ROBOTS_TXT", importance: "important" },
  { factor: "performance", label: "Page speed", issueCode: "SLOW_PAGE_LOAD", importance: "important" },
  { factor: "mobile", label: "Mobile friendly", issueCode: "NOT_MOBILE_FRIENDLY", importance: "recommended" },
],
Grok: [
  { factor: "content_depth", label: "Content depth", issueCode: "THIN_CONTENT", importance: "critical" },
  { factor: "citation", label: "Citation worthy", issueCode: "CITATION_WORTHINESS", importance: "critical" },
  { factor: "direct_answers", label: "Direct answers", issueCode: "NO_DIRECT_ANSWERS", importance: "important" },
  { factor: "structured_data", label: "JSON-LD schema", issueCode: "NO_STRUCTURED_DATA", importance: "important" },
  { factor: "ai_crawlers", label: "AI crawlers allowed", issueCode: "AI_CRAWLER_BLOCKED", importance: "important" },
  { factor: "llms_txt", label: "llms.txt file", issueCode: "MISSING_LLMS_TXT", importance: "recommended" },
  { factor: "faq", label: "FAQ structure", issueCode: "MISSING_FAQ_STRUCTURE", importance: "recommended" },
  { factor: "freshness", label: "Content freshness", issueCode: "STALE_CONTENT", importance: "important" },
],
"Gemini AI Mode": [
  { factor: "structured_data", label: "JSON-LD schema", issueCode: "NO_STRUCTURED_DATA", importance: "critical" },
  { factor: "citation", label: "Citation worthy", issueCode: "CITATION_WORTHINESS", importance: "critical" },
  { factor: "ai_crawlers", label: "Google-Extended allowed", issueCode: "AI_CRAWLER_BLOCKED", importance: "critical" },
  { factor: "direct_answers", label: "Direct answers", issueCode: "NO_DIRECT_ANSWERS", importance: "important" },
  { factor: "llms_txt", label: "llms.txt file", issueCode: "MISSING_LLMS_TXT", importance: "important" },
  { factor: "entity_markup", label: "Entity markup", issueCode: "MISSING_ENTITY_MARKUP", importance: "important" },
  { factor: "summary", label: "Summary section", issueCode: "NO_SUMMARY_SECTION", importance: "recommended" },
  { factor: "internal_links", label: "Internal links", issueCode: "NO_INTERNAL_LINKS", importance: "recommended" },
],
```

**Step 3: Run shared tests**

Run: `pnpm --filter shared test`
Expected: PASS (update tests if they assert specific platform counts)

**Step 4: Run scoring tests**

Run: `pnpm --filter scoring test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/constants/platforms.ts packages/shared/src/constants/platform-requirements.ts
git commit -m "feat(shared): expand platform readiness to 7 providers (add Copilot, Grok reqs, Gemini AI Mode)"
```

---

## Task 9: Final integration and build verification

**Step 1: Run API typecheck**

Run: `pnpm --filter api typecheck`
Expected: PASS

**Step 2: Run all API tests**

Run: `pnpm --filter api test`
Expected: All PASS

**Step 3: Run web build**

Run: `pnpm --filter web build`
Expected: PASS

**Step 4: Run full monorepo typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit any remaining fixes**

```bash
git commit -m "fix: resolve type and test issues from AI visibility improvements"
```
