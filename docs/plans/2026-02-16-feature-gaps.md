# Feature Gaps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 5 feature gaps: Copilot visibility provider, Apply Fix UI, Project Progress widget, Branding Settings fix, and pageFacts cleanup.

**Architecture:** Each task is independent — no ordering dependencies. Tasks 2-5 are frontend-only or cleanup (backend already exists). Task 1 adds a new LLM provider following the established pattern.

**Tech Stack:** TypeScript, Hono, Next.js, Recharts, Bing Web Search API, Vitest

---

### Task 1: Copilot Visibility Provider

**Files:**

- Create: `packages/llm/src/providers/copilot.ts`
- Modify: `packages/llm/src/visibility.ts:1,35-40`
- Modify: `apps/api/src/index.ts` (Bindings type + apiKeys objects)
- Modify: `apps/api/src/routes/visibility.ts:60-65`
- Test: `packages/llm/src/__tests__/providers/copilot.test.ts`

**Context:** All providers follow the same pattern — accept `(query, targetDomain, competitors, apiKey)`, call the LLM, return `VisibilityCheckResult`. Copilot has no official chat API, so we use Bing Web Search API as a proxy (Copilot grounds responses on Bing results). The `"copilot"` enum value already exists in the DB schema.

**Step 1: Write the provider test**

Create `packages/llm/src/__tests__/providers/copilot.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkCopilot } from "../../providers/copilot";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("checkCopilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns visibility result from Bing search snippets", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webPages: {
            value: [
              {
                name: "Example - Best AI SEO Tool",
                url: "https://example.com/features",
                snippet: "Example.com is the leading AI SEO platform...",
              },
              {
                name: "Other result",
                url: "https://other.com",
                snippet: "Some other content about SEO tools.",
              },
            ],
          },
        }),
    });

    const result = await checkCopilot(
      "best AI SEO tools",
      "example.com",
      ["rival.com"],
      "test-bing-key",
    );

    expect(result.provider).toBe("copilot");
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
    expect(result.query).toBe("best AI SEO tools");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.bing.microsoft.com"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Ocp-Apim-Subscription-Key": "test-bing-key",
        }),
      }),
    );
  });

  it("returns no mention when domain not in results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webPages: {
            value: [
              {
                name: "Unrelated",
                url: "https://unrelated.com",
                snippet: "Nothing about the target domain.",
              },
            ],
          },
        }),
    });

    const result = await checkCopilot(
      "test query",
      "example.com",
      [],
      "test-key",
    );

    expect(result.brandMentioned).toBe(false);
    expect(result.urlCited).toBe(false);
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(
      checkCopilot("test", "example.com", [], "bad-key"),
    ).rejects.toThrow("Bing API error: 403");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/llm && npx vitest run src/__tests__/providers/copilot.test.ts`
Expected: FAIL — cannot resolve `../../providers/copilot`

**Step 3: Implement the Copilot provider**

Create `packages/llm/src/providers/copilot.ts`:

```typescript
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";

const REQUEST_TIMEOUT_MS = 15_000;
const BING_SEARCH_URL = "https://api.bing.microsoft.com/v7.0/search";

/**
 * Check Copilot visibility using Bing Web Search API.
 * Microsoft Copilot grounds its responses on Bing search results,
 * so Bing ranking is a strong proxy for Copilot visibility.
 */
export async function checkCopilot(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const url = `${BING_SEARCH_URL}?q=${encodeURIComponent(query)}&count=10`;

  const response = await withRetry(() =>
    withTimeout(
      fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  if (!response.ok) {
    throw new Error(`Bing API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    webPages?: { value: Array<{ name: string; url: string; snippet: string }> };
  };

  // Concatenate snippets into a pseudo-response for analysis
  const pages = data.webPages?.value ?? [];
  const responseText = pages
    .map((p) => `${p.name}\n${p.url}\n${p.snippet}`)
    .join("\n\n");

  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "copilot",
    query,
    responseText,
    ...analysis,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/llm && npx vitest run src/__tests__/providers/copilot.test.ts`
Expected: PASS (3 tests)

**Step 5: Register the provider**

In `packages/llm/src/visibility.ts`, add import and registration:

```typescript
import { checkCopilot } from "./providers/copilot";

// Add to PROVIDER_MAP:
const PROVIDER_MAP: Record<string, ProviderCheckFn> = {
  chatgpt: checkChatGPT,
  claude: checkClaude,
  perplexity: checkPerplexity,
  gemini: checkGemini,
  copilot: checkCopilot,
};
```

**Step 6: Add BING_API_KEY to API bindings**

In `apps/api/src/index.ts`, add to the `Bindings` type:

```typescript
BING_API_KEY: string;
```

In `apps/api/src/routes/visibility.ts` (line 60-65), add:

```typescript
apiKeys: {
  chatgpt: c.env.OPENAI_API_KEY,
  claude: c.env.ANTHROPIC_API_KEY,
  perplexity: c.env.PERPLEXITY_API_KEY,
  gemini: c.env.GOOGLE_API_KEY,
  copilot: c.env.BING_API_KEY,
},
```

Same change in `apps/api/src/index.ts` scheduled visibility handler (around line 440-445).

**Step 7: Run full test suite and commit**

Run: `pnpm test && pnpm typecheck`

```bash
git add packages/llm/src/providers/copilot.ts \
  packages/llm/src/__tests__/providers/copilot.test.ts \
  packages/llm/src/visibility.ts \
  apps/api/src/index.ts \
  apps/api/src/routes/visibility.ts
git commit -m "feat(llm): add Copilot visibility provider via Bing Web Search API"
```

---

### Task 2: Apply Fix Button in Semantic Gap Matrix

**Files:**

- Modify: `apps/web/src/components/visibility/semantic-gap-matrix.tsx:123-176`

**Context:** The `POST /api/strategy/apply-fix` endpoint and `api.strategy.applyFix()` client method already exist. The `FactList` component in `semantic-gap-matrix.tsx` renders competitor facts with `missing` highlighting but has no action button. We add an "Apply Fix" button that calls the API and shows the generated snippet.

**Step 1: Add Apply Fix button and state to FactList**

In `apps/web/src/components/visibility/semantic-gap-matrix.tsx`, modify the `FactList` component:

1. Add new props: `pageId?: string` and `onApplyFix?: boolean` to `FactList`
2. Add state for loading and result inside `FactList`
3. After the `sourceSentence` paragraph (line 169), add:

```tsx
{
  missing && pageId && <ApplyFixButton pageId={pageId} fact={fact} />;
}
```

4. Create `ApplyFixButton` as a small inline component:

```tsx
function ApplyFixButton({
  pageId,
  fact,
}: {
  pageId: string;
  fact: ExtractedFact;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    suggestedSnippet: string;
    placementAdvice: string;
    citabilityBoost: number;
  } | null>(null);

  async function handleApply() {
    setLoading(true);
    try {
      const data = await api.strategy.applyFix({
        pageId,
        missingFact: fact.content,
        factType: fact.type,
      });
      setResult(data);
    } catch (err) {
      console.error("Apply fix failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-2 rounded-md bg-green-50 border border-green-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-green-800">
          Suggested Content (+{result.citabilityBoost}pts)
        </p>
        <p className="text-sm text-green-900">{result.suggestedSnippet}</p>
        <p className="text-xs text-green-700 italic">
          {result.placementAdvice}
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleApply}
      disabled={loading}
      className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {loading ? "Generating fix..." : "Generate AI fix →"}
    </button>
  );
}
```

5. Add required imports at top: `import { useState } from "react"` and `import { api } from "@/lib/api"`

**Step 2: Pass pageId through the component chain**

The `SemanticGapMatrix` component needs a `pageId` prop. Check where it's used and pass the active page ID from the parent (strategy tab or visibility tab). If no specific page is selected, pass the first page from the crawl.

**Step 3: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/web/src/components/visibility/semantic-gap-matrix.tsx
git commit -m "feat(web): add Apply Fix button to semantic gap matrix"
```

---

### Task 3: Project Progress Widget in Overview Tab

**Files:**

- Create: `apps/web/src/components/cards/project-progress-card.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx:147-150`

**Context:** `GET /api/projects/:id/progress` and `api.projects.progress()` already exist and return `ProjectProgress` with score deltas, category deltas, issues fixed/new, grade changes, velocity, and top improved/regressed pages. The type `ProjectProgress` is already defined in `api.ts`.

**Step 1: Create the progress card component**

Create `apps/web/src/components/cards/project-progress-card.tsx`:

```tsx
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
```

**Step 2: Add to overview tab**

In `apps/web/src/components/tabs/overview-tab.tsx`, import and place after the Score Trends chart (line 147):

```tsx
import { ProjectProgressCard } from "@/components/cards/project-progress-card";

// After <ScoreTrendChart projectId={projectId} /> (line 147):
<ProjectProgressCard projectId={projectId} />;
```

**Step 3: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/web/src/components/cards/project-progress-card.tsx \
  apps/web/src/components/tabs/overview-tab.tsx
git commit -m "feat(web): add project progress card to overview tab"
```

---

### Task 4: Fix Branding Settings Tab

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx:1233-1254`

**Context:** The Branding tab in account settings passes `projectId=""` which makes it non-functional. Branding is per-project and already works in `/dashboard/projects/[id]` settings tab. The fix: replace the broken form with a helpful redirect message.

**Step 1: Replace the broken branding tab content**

In `apps/web/src/app/dashboard/settings/page.tsx`, replace the branding `TabsContent` (around line 1233-1254) with:

```tsx
<TabsContent value="branding" className="pt-4">
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Report Branding</CardTitle>
      <CardDescription>
        Branding is configured per-project to support multiple clients.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        To customize your report branding (logo, company name, colors), go to
        any project and open its <strong>Settings</strong> tab.
      </p>
      {projectsData?.items && projectsData.items.length > 0 && (
        <div className="mt-4 space-y-2">
          {projectsData.items.slice(0, 5).map((p) => (
            <a
              key={p.id}
              href={`/dashboard/projects/${p.id}?tab=settings`}
              className="block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              {p.name} <span className="text-muted-foreground">→ Settings</span>
            </a>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

**Step 2: Remove BrandingSettingsForm import if no longer used here**

Check if `BrandingSettingsForm` is still imported — remove the import if this was the only usage in this file.

**Step 3: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/web/src/app/dashboard/settings/page.tsx
git commit -m "fix(web): replace broken branding tab with per-project redirect"
```

---

### Task 5: Remove Orphaned pageFacts Table

**Files:**

- Modify: `packages/db/src/schema.ts` (remove `factTypeEnum` and `pageFacts` table)
- Create: migration to drop the table

**Context:** The `pageFacts` table and `factTypeEnum` are defined in the schema but never queried or written to anywhere. The fact extraction feature works in-memory via `FactExtractor` and returns results through the API without persistence. Removing dead schema keeps the codebase honest (YAGNI — we add it back when we actually need persistence).

**Step 1: Remove from schema.ts**

In `packages/db/src/schema.ts`, delete the `factTypeEnum` definition (around line 639-644) and the `pageFacts` table (around line 646-669).

**Step 2: Generate a migration**

Run: `cd packages/db && npx drizzle-kit generate`

This will generate a migration that drops the `page_facts` table and `fact_type` enum.

**Step 3: Verify no references remain**

Run: `grep -r "pageFacts\|page_facts\|factType\|fact_type" packages/ apps/ --include="*.ts" --include="*.tsx"`

Should return zero results (besides the migration file).

**Step 4: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add packages/db/src/schema.ts packages/db/migrations/
git commit -m "chore(db): remove orphaned pageFacts table and factTypeEnum"
```

---

## Final Verification

After all 5 tasks:

```bash
pnpm typecheck  # All packages clean
pnpm test       # All tests pass
```
