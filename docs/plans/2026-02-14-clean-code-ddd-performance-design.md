# Clean Code, DDD & Performance — Design Document

**Date:** 2026-02-14

**Goal:** Eliminate code duplication, introduce lightweight DDD patterns, and fix the highest-impact performance bottlenecks.

## Problem Statement

Analysis identified 3 categories of tech debt:

1. **Clean Code** — `letterGrade()` duplicated 4×, `avg()` duplicated 3×, `scoreColor()` duplicated 2×, `assertProjectOwnership` reimplemented in 7 services, 126 `as any` casts in `apps/api/src`.
2. **DDD** — Anemic domain model (no value objects), services as grab-bags (ingest-service: 344 lines, 7+ responsibilities), no shared ownership assertion utility.
3. **Performance** — Serial LLM scoring (sequential `for` loop in `llm-scoring.ts:29`), frontend waterfall fetches, 1098-line page detail component, heavy dynamic imports (force-graph ~180KB loaded eagerly in page detail).

## Approach

Pragmatic refactoring in 4 phases, each independently shippable. No Big Rewrite — each phase is a focused commit that keeps all 714 tests green.

### Phase 1: Extract Shared Utilities

**What:** Consolidate duplicated functions into canonical locations.

| Function                   | Canonical Location                                      | Duplicated In                                                                                                                                           |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `letterGrade()`            | `packages/shared/src/utils/scoring.ts` (already exists) | `insights-service.ts`, `progress-service.ts`, `apps/web/src/lib/utils.ts`                                                                               |
| `averageScores()`          | `packages/shared/src/utils/scoring.ts` (already exists) | `progress-service.ts` (`avg`), `intelligence-service.ts` (`avg`), `insights-service.ts` (`avg`)                                                         |
| `scoreColor()`             | `apps/web/src/lib/utils.ts`                             | `crawl/[id]/page.tsx`, `projects/[id]/pages/page.tsx`                                                                                                   |
| `assertProjectOwnership()` | New: `apps/api/src/services/shared/assert-ownership.ts` | `crawl-service.ts`, `strategy-service.ts`, `page-service.ts`, `log-service.ts`, `progress-service.ts`, `intelligence-service.ts`, `insights-service.ts` |

**Risk:** Low. Pure refactoring — extract, import, delete duplicate.

### Phase 2: Reduce `as any` Casts

**What:** Replace the most impactful `as any` casts in production code (not test files). Focus on `monitoring-service.ts` (7 casts) and `repositories/index.ts` (2 casts) where raw SQL uses `as any` for type coercion.

**Approach:** Use Drizzle's typed `sql<T>` operator and proper type imports. Test files are lower priority — `as any` in mocks is acceptable.

### Phase 3: Parallelize LLM Scoring (Performance)

**What:** `llm-scoring.ts:29` processes pages sequentially — each page waits for the previous LLM API call. With 100-page crawls at ~2s per call, that's 200s serial time.

**Fix:** Use `Promise.allSettled` with a concurrency limiter (p=5). Expected speedup: ~5× for paid tier crawls.

**Implementation:** Simple `pMap`-style helper — no new dependencies needed.

### Phase 4: Frontend Performance

**What:**

- Page detail component is 1098 lines — extract tab content into separate components
- `scoreColor()` duplicated — extract to shared util
- Force-graph already dynamically imported (good), but page detail loads all tabs eagerly

**Fix:** Split page detail into `<PageOverviewTab>`, `<PageIssuesTab>`, `<PageEnrichmentsTab>`, `<PageLinkGraphTab>`. Each tab is its own component, lazy-loaded like the project page already does for VisibilityTab/IntegrationsTab.

## Out of Scope

- Full DDD entity/aggregate refactoring (too large, deferred)
- DB index additions (need production query analysis first)
- React virtualization (no evidence of real user perf issues on table sizes yet)
- Splitting ingest-service responsibilities (would require significant test rewrites)

## Test Strategy

All changes are refactoring — existing 714 tests must continue to pass. No new tests needed (behavior doesn't change). Run `pnpm test` after each phase.
