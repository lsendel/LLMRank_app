# Clean Code, DDD & Performance — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate code duplication, introduce a shared ownership guard, parallelize LLM scoring, and split a 1098-line component.

**Architecture:** Pure refactoring — extract duplicated functions to canonical homes, replace local copies with imports, parallelize serial async work, split oversized component.

**Tech Stack:** TypeScript, Drizzle ORM, Hono, Next.js, Vitest

---

### Task 1: Consolidate `letterGrade` and `averageScores` in Shared Utils

**Files:**

- Keep: `packages/shared/src/utils/scoring.ts` (canonical — already has both functions)
- Modify: `apps/api/src/services/insights-service.ts:16-22` — delete local `letterGrade`, add import
- Modify: `apps/api/src/services/progress-service.ts:16-26` — delete local `avg` and `letterGrade`, add imports
- Modify: `apps/api/src/services/intelligence-service.ts:21-23` — delete local `avg`, add import
- Modify: `apps/web/src/lib/utils.ts:21-27` — delete local `letterGrade`, re-export from shared

**Step 1: Verify shared exports exist**

Run: `grep -n "export function" packages/shared/src/utils/scoring.ts`
Expected: `letterGrade`, `averageScores`, `aggregatePageScores`

**Step 2: Update `insights-service.ts`**

Replace lines 16-22 (the local `letterGrade`) with:

```ts
import { letterGrade } from "@llm-boost/shared";
```

Remove the local function definition.

**Step 3: Update `progress-service.ts`**

Replace lines 16-26 (local `avg` and `letterGrade`) with:

```ts
import { letterGrade, averageScores } from "@llm-boost/shared";
```

Then replace all `avg(...)` calls with `averageScores(...)`. Note: `averageScores` accepts `(number | null | undefined)[]` and rounds — same behavior as the local `avg` but more permissive input types.

**Step 4: Update `intelligence-service.ts`**

Replace lines 21-23 (local `avg`) with:

```ts
import { letterGrade, averageScores } from "@llm-boost/shared";
```

Replace all `avg(...)` calls with `averageScores(...)`.

**Step 5: Update `apps/web/src/lib/utils.ts`**

Replace lines 21-27 (local `letterGrade`) with:

```ts
export { letterGrade } from "@llm-boost/shared/utils/scoring";
```

**Step 6: Run tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm test`
Expected: All 714+ tests pass

**Step 7: Commit**

```bash
git add packages/shared/src/utils/scoring.ts apps/api/src/services/insights-service.ts apps/api/src/services/progress-service.ts apps/api/src/services/intelligence-service.ts apps/web/src/lib/utils.ts
git commit -m "refactor: consolidate letterGrade and avg into shared utils"
```

---

### Task 2: Extract `scoreColor` to Shared Frontend Util

**Files:**

- Modify: `apps/web/src/lib/utils.ts` — add `scoreColor` function
- Modify: `apps/web/src/app/dashboard/crawl/[id]/page.tsx:43-48` — delete local, add import
- Modify: `apps/web/src/app/dashboard/projects/[id]/pages/page.tsx:27-32` — delete local, add import

**Step 1: Add `scoreColor` to `apps/web/src/lib/utils.ts`**

Add after the existing `scoreBarColor` function:

```ts
export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}
```

Check the exact implementation in the duplicated files first — they may have slightly different color values. Use the one from `crawl/[id]/page.tsx` as canonical.

**Step 2: Update both consumer files**

In each file, delete the local `function scoreColor(...)` definition and add:

```ts
import { scoreColor } from "@/lib/utils";
```

**Step 3: Run frontend typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app/apps/web && npx tsc --noEmit`
Expected: No new errors (pre-existing ones may appear — only check for new)

**Step 4: Commit**

```bash
git add apps/web/src/lib/utils.ts apps/web/src/app/dashboard/crawl/\[id\]/page.tsx apps/web/src/app/dashboard/projects/\[id\]/pages/page.tsx
git commit -m "refactor: extract scoreColor to shared frontend util"
```

---

### Task 3: Extract `assertProjectOwnership` to Shared Service Guard

**Files:**

- Create: `apps/api/src/services/shared/assert-ownership.ts`
- Modify: `apps/api/src/services/crawl-service.ts:315-322` — delete local, import shared
- Modify: `apps/api/src/services/strategy-service.ts:199-210` — delete local, import shared
- Modify: `apps/api/src/services/page-service.ts:78-86` — delete local, import shared
- Modify: `apps/api/src/services/log-service.ts:118-126` — delete local, import shared
- Modify: `apps/api/src/services/insights-service.ts:25-34` — delete local `assertAccess`, import shared
- Modify: `apps/api/src/services/intelligence-service.ts:26-32` — delete local `assertAccess`, import shared
- Modify: `apps/api/src/services/progress-service.ts:29-36` — delete local `assertAccess`, import shared

**Step 1: Create shared guard**

Create `apps/api/src/services/shared/assert-ownership.ts`:

```ts
import type { ProjectRepository, CrawlRepository } from "../../repositories";
import { ServiceError } from "../errors";

/**
 * Assert that a project belongs to a user. Returns the project if valid.
 * Throws NOT_FOUND if project doesn't exist or doesn't belong to user.
 */
export async function assertProjectOwnership(
  projects: Pick<ProjectRepository, "getById">,
  userId: string,
  projectId: string,
) {
  const project = await projects.getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }
  return project;
}

/**
 * Assert that a crawl belongs to a user (via its project).
 * Returns { crawl, project } if valid.
 */
export async function assertCrawlAccess(
  deps: {
    crawls: Pick<CrawlRepository, "getById">;
    projects: Pick<ProjectRepository, "getById">;
  },
  userId: string,
  crawlId: string,
) {
  const crawl = await deps.crawls.getById(crawlId);
  if (!crawl) {
    throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
  }
  const project = await deps.projects.getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }
  return { crawl, project };
}
```

**Step 2: Update each service one at a time**

For each service, replace the local `assertProjectOwnership` / `assertOwnership` / `assertAccess` with a call to the shared version. The calling convention changes slightly — pass `deps.projects` as first arg instead of relying on closure:

**crawl-service.ts** — replace local function at line 315:

```ts
// Before (line 315):
async function assertProjectOwnership(userId: string, projectId: string) {
  const project = await deps.projects.getById(projectId);
  ...
}

// After: import at top
import { assertProjectOwnership } from "./shared/assert-ownership";
// Then replace calls from:
//   await assertProjectOwnership(userId, projectId)
// to:
//   await assertProjectOwnership(deps.projects, userId, projectId)
```

Apply the same pattern for `strategy-service.ts`, `page-service.ts`, `log-service.ts`.

For `insights-service.ts`, `intelligence-service.ts`, `progress-service.ts` — these use `assertAccess` (crawl-based). Replace with `assertCrawlAccess`:

```ts
import { assertCrawlAccess } from "./shared/assert-ownership";
// Replace: await assertAccess(userId, crawlId)
// With:    await assertCrawlAccess(deps, userId, crawlId)
```

**Step 3: Run tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm test`
Expected: All tests pass — the mock structure hasn't changed.

**Step 4: Commit**

```bash
git add apps/api/src/services/shared/assert-ownership.ts apps/api/src/services/crawl-service.ts apps/api/src/services/strategy-service.ts apps/api/src/services/page-service.ts apps/api/src/services/log-service.ts apps/api/src/services/insights-service.ts apps/api/src/services/intelligence-service.ts apps/api/src/services/progress-service.ts
git commit -m "refactor: extract assertProjectOwnership to shared service guard"
```

---

### Task 4: Parallelize LLM Scoring

**Files:**

- Create: `apps/api/src/lib/concurrent.ts` — generic concurrency limiter
- Modify: `apps/api/src/services/llm-scoring.ts:29-65` — replace serial loop with parallel processing

**Step 1: Write a test for the concurrency helper**

Create `apps/api/src/__tests__/lib/concurrent.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { pMap } from "../../lib/concurrent";

describe("pMap", () => {
  it("processes items with limited concurrency", async () => {
    let running = 0;
    let maxRunning = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    const results = await pMap(
      items,
      async (item) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        return item * 2;
      },
      { concurrency: 3 },
    );

    expect(results).toEqual(items.map((i) => i * 2));
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("handles errors without stopping other items", async () => {
    const items = [1, 2, 3];
    const results = await pMap(
      items,
      async (item) => {
        if (item === 2) throw new Error("fail");
        return item;
      },
      { concurrency: 2, settle: true },
    );

    expect(results).toEqual([1, null, 3]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api test -- src/__tests__/lib/concurrent.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the concurrency helper**

Create `apps/api/src/lib/concurrent.ts`:

```ts
interface PMapOptions {
  concurrency: number;
  settle?: boolean;
}

/**
 * Map over items with limited concurrency.
 * If settle=true, failed items return null instead of throwing.
 */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  opts: PMapOptions,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        if (!opts.settle) throw err;
        results[i] = null;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(opts.concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api test -- src/__tests__/lib/concurrent.test.ts`
Expected: PASS

**Step 5: Update `llm-scoring.ts` to use pMap**

In `apps/api/src/services/llm-scoring.ts`, replace the serial loop (lines 29-65):

```ts
// Before:
for (let i = 0; i < input.insertedPages.length; i++) {
  // ... sequential processing
}

// After:
import { pMap } from "../lib/concurrent";

await pMap(
  input.insertedPages,
  async (insertedPage, i) => {
    const crawlPage = input.batchPages[i];
    const scoreRow = input.insertedScores[i];

    if (!scoreRow) return;
    if (crawlPage.word_count < 200 || !crawlPage.content_hash) return;

    try {
      const r2Obj = await input.r2Bucket.get(crawlPage.html_r2_key);
      if (!r2Obj) return;

      let html: string;
      if (r2Obj.httpMetadata?.contentEncoding === "gzip") {
        const ds = r2Obj.body.pipeThrough(new DecompressionStream("gzip"));
        html = await new Response(ds).text();
      } else {
        html = await r2Obj.text();
      }

      const text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const llmScores = await scorer.scoreContent(text, crawlPage.content_hash);
      if (!llmScores) return;

      await scoreQueries(db).updateDetail(scoreRow.id, {
        llmContentScores: llmScores,
      });
    } catch (err) {
      log.error("LLM scoring failed for page", {
        pageId: scoreRow.pageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  { concurrency: 5, settle: true },
);
```

**Step 6: Run all tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add apps/api/src/lib/concurrent.ts apps/api/src/__tests__/lib/concurrent.test.ts apps/api/src/services/llm-scoring.ts
git commit -m "perf: parallelize LLM scoring with concurrency=5"
```

---

### Task 5: Split Page Detail Component (1098 → ~200 lines each)

**Files:**

- Create: `apps/web/src/components/page-detail/page-overview-section.tsx`
- Create: `apps/web/src/components/page-detail/page-issues-section.tsx`
- Create: `apps/web/src/components/page-detail/page-enrichments-section.tsx`
- Create: `apps/web/src/components/page-detail/page-link-graph-section.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx` — replace inline tab content with component imports

**Step 1: Read and understand the component structure**

Read: `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx`

Identify the tab boundaries — each `<TabsContent value="...">` block becomes its own component.

**Step 2: Extract each tab section**

For each tab (`overview`, `issues`, `enrichments`, `links`):

1. Create a new component file
2. Move the JSX from `<TabsContent>` into the new component
3. Pass required props (page data, enrichments, etc.)
4. Import the new component in the parent

The parent page should become ~150-200 lines: just the header, tab navigation, and lazy-loaded tab components.

**Step 3: Dynamic import heavy tabs**

The link graph tab uses `ForceGraph2D` (~180KB). Wrap it with `dynamic()`:

```ts
const PageLinkGraphSection = dynamic(
  () => import("@/components/page-detail/page-link-graph-section"),
  { ssr: false, loading: () => <div>Loading graph...</div> },
);
```

**Step 4: Run frontend typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app/apps/web && npx tsc --noEmit`
Expected: No new type errors

**Step 5: Commit**

```bash
git add apps/web/src/components/page-detail/ apps/web/src/app/dashboard/projects/\[id\]/pages/\[pageId\]/page.tsx
git commit -m "refactor: split 1098-line page detail into focused tab components"
```

---

### Task 6: Reduce `as any` in Monitoring Service

**Files:**

- Modify: `apps/api/src/services/monitoring-service.ts` — replace 7 `as any` casts

**Step 1: Replace raw SQL casts with typed Drizzle operators**

The monitoring service uses `sql\`...\` as any` for type coercion. Replace with Drizzle's typed operators:

```ts
// Before (line 32):
) as any,

// After — use proper Drizzle where clause:
import { inArray } from "drizzle-orm";

.where(
  and(
    inArray(crawlJobs.status, ["crawling", "scoring"]),
    lt(crawlJobs.createdAt, oneHourAgo),
  ),
)
```

For the update (lines 42-46):

```ts
// Before:
.set({ status: "failed", errorMessage: "..." } as any)

// After:
.set({ status: "failed", errorMessage: "Crawl stalled: No activity for > 1 hour" })
```

For the where clause (line 46):

```ts
// Before:
.where(sql`${crawlJobs.id} = ${job.id}` as any)

// After:
.where(eq(crawlJobs.id, job.id))
```

For metrics queries (lines 56-69): use `inArray` and typed `count()`:

```ts
import { count } from "drizzle-orm";

const activeCount = await db
  .select({ count: count() })
  .from(crawlJobs)
  .where(inArray(crawlJobs.status, ["crawling", "scoring"]));
```

**Step 2: Run tests**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter api test -- src/__tests__/services/monitoring-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/monitoring-service.ts
git commit -m "refactor: replace as-any casts with typed Drizzle operators in monitoring service"
```

---

## Summary

| Task                                | Category    | Impact                                 | Risk   |
| ----------------------------------- | ----------- | -------------------------------------- | ------ |
| 1. Consolidate `letterGrade`/`avg`  | Clean Code  | Removes 4 duplicated functions         | Low    |
| 2. Extract `scoreColor`             | Clean Code  | Removes 2 duplicated functions         | Low    |
| 3. Extract `assertProjectOwnership` | DDD         | Removes 7 duplicated ownership checks  | Medium |
| 4. Parallelize LLM scoring          | Performance | ~5× speedup for LLM processing         | Medium |
| 5. Split page detail component      | Performance | Better code splitting, smaller bundles | Low    |
| 6. Reduce `as any` in monitoring    | Clean Code  | Type safety in critical health checks  | Low    |

**Total: 6 tasks, ~30 minutes execution time.**
