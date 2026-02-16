# Crawler Reliability & Health Monitoring Design

**Date:** 2026-02-15
**Status:** Approved
**Problem:** Production users see "Failed to connect to crawler service" (502) when the Fly.io crawler is slow to respond or cold-starting. No retry logic, no health monitoring, misleading error messages.

## Approach: Resilient Dispatch + Periodic Health Scan

Add retry-with-backoff to crawler dispatch, extend the existing monitoring service with crawler health checks, and improve error specificity for users.

## 1. Retry with Exponential Backoff

**File:** `apps/api/src/services/crawl-service.ts`

- Add `fetchWithRetry()` utility wrapping the crawler dispatch
- 3 attempts with exponential backoff: 1s, 3s, 9s (covers Fly.io cold start ~5-8s)
- Each attempt has a 15s timeout via `AbortController`
- Only retry on network errors and 5xx responses (not 4xx)
- Log each retry attempt for observability
- **Bug fix:** Re-throw `ServiceError` instances directly in the catch block instead of wrapping them (current code at line 132 catches and re-wraps the `ServiceError` thrown at line 121)

## 2. Crawler Health Scanner

**File:** `apps/api/src/services/monitoring-service.ts` (extend existing)

- Add `checkCrawlerHealth(crawlerUrl: string, kv: KVNamespace)` method
- Pings `GET ${CRAWLER_URL}/api/v1/health` with 5s timeout
- Records result to KV:
  - `crawler:health:latest` — `{ status, latency, error?, checkedAt }` with 1-hour TTL
  - `crawler:health:history` — rolling array of last 50 checks
- Called from existing `runScheduledTasks()` in `index.ts` (every-5-minute cron)
- Logs warnings when down; logs errors after 3+ consecutive failures
- KV chosen over DB: ephemeral data, no migration, ms-level reads, auto-TTL

**Fast-fail path:** Dispatch logic can read `crawler:health:latest` from KV. If crawler is known-down, return a friendlier error immediately instead of waiting for retries to exhaust.

## 3. Better Error Handling & User Feedback

**API-side** (`apps/api/src/services/crawl-service.ts`):

- Distinguish error types: network timeout vs. connection refused vs. crawler error vs. known-down
- Specific error codes replacing generic `CRAWLER_ERROR`:
  - `CRAWLER_UNAVAILABLE` (503) — down from health check or all retries exhausted
  - `CRAWLER_TIMEOUT` (504) — no response within timeout
  - `CRAWLER_REJECTED` (502) — crawler responded with error
- Include `retryAfter` hint in error response when crawler is known-down

**Frontend-side** (`apps/web`):

- Show specific messages for `CRAWLER_UNAVAILABLE` / `CRAWLER_TIMEOUT`: "The crawler service is temporarily unavailable. Please try again in a few minutes."
- Optional status indicator on dashboard when crawler health reports down

## 4. Fly.io Configuration Tweaks

**File:** `apps/crawler/fly.toml`

- Keep `auto_stop_machines = true` (cost savings; retries handle cold starts)
- Add `grace_period = "30s"` to health check (prevents premature unhealthy marking on cold start)
- Add `[http_service.concurrency]` with `soft_limit = 10` (auto-scales under load)
- No changes to machine size or min_machines_running

## Files Changed

| Component      | File(s)                                       | Change Type |
| -------------- | --------------------------------------------- | ----------- |
| Retry logic    | `apps/api/src/services/crawl-service.ts`      | Modified    |
| Health scanner | `apps/api/src/services/monitoring-service.ts` | Modified    |
| Cron wiring    | `apps/api/src/index.ts`                       | Modified    |
| Error codes    | `apps/api/src/services/crawl-service.ts`      | Modified    |
| Frontend UX    | `apps/web/src/...` (crawl trigger component)  | Modified    |
| Fly.io config  | `apps/crawler/fly.toml`                       | Modified    |

## Constraints

- No new packages
- No database migrations
- No new cron schedules (uses existing 5-minute cron)
- Uses existing KV namespace binding
