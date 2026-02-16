# Crawler Reliability & Health Monitoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate "Failed to connect to crawler service" production errors by adding retry logic, health monitoring, and specific error feedback.

**Architecture:** Extend the existing crawl dispatch in `crawl-service.ts` with a `fetchWithRetry` wrapper (3 attempts, exponential backoff). Extend `monitoring-service.ts` to ping the crawler health endpoint on the existing 5-minute cron, storing results in Cloudflare KV. Improve error codes and frontend messaging.

**Tech Stack:** Hono Workers, Cloudflare KV, Vitest, Fly.io

---

### Task 1: Add `fetchWithRetry` utility

**Files:**

- Create: `apps/api/src/lib/fetch-retry.ts`
- Test: `apps/api/src/__tests__/lib/fetch-retry.test.ts`

**Step 1: Write the failing tests**

```ts
// apps/api/src/__tests__/lib/fetch-retry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry } from "../../lib/fetch-retry";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns response on first success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error and succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws after all retries exhausted on network error", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    await expect(
      fetchWithRetry("https://crawler.test/api/v1/jobs", { method: "POST" }),
    ).rejects.toThrow("fail 3");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns last 5xx response after all retries exhausted", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 504 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(504);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxRetries", async () => {
    mockFetch.mockRejectedValue(new Error("fail"));

    await expect(
      fetchWithRetry(
        "https://crawler.test/api/v1/jobs",
        { method: "POST" },
        { maxRetries: 2 },
      ),
    ).rejects.toThrow("fail");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/__tests__/lib/fetch-retry.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `fetchWithRetry`**

```ts
// apps/api/src/lib/fetch-retry.ts
import { createLogger } from "./logger";

const log = createLogger({ context: "fetch-retry" });

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  timeoutMs: 15_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const { maxRetries, baseDelayMs, timeoutMs } = { ...DEFAULTS, ...opts };

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Don't retry 4xx — those are client errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx — retry
      lastResponse = response;
      log.warn(`Attempt ${attempt}/${maxRetries} got ${response.status}`, {
        url,
        status: response.status,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn(
        `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        {
          url,
        },
      );
    }

    // Exponential backoff: 1s, 3s, 9s
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(3, attempt - 1);
      await sleep(delay);
    }
  }

  // All retries exhausted
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError ?? new Error("All retries exhausted");
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/__tests__/lib/fetch-retry.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/lib/fetch-retry.ts apps/api/src/__tests__/lib/fetch-retry.test.ts
git commit -m "feat: add fetchWithRetry utility with exponential backoff"
```

---

### Task 2: Fix catch-block bug and wire retry into crawl dispatch

**Files:**

- Modify: `apps/api/src/services/crawl-service.ts:105-142` (requestCrawl dispatch)
- Modify: `apps/api/src/services/crawl-service.ts:310-329` (dispatchScheduledJobs dispatch)
- Test: `apps/api/src/__tests__/services/crawl-service.test.ts`

**Step 1: Update existing tests for new error codes**

In `apps/api/src/__tests__/services/crawl-service.test.ts`, update the test at line 157-173:

```ts
// Change: "marks job failed when crawler dispatch returns non-OK"
it("marks job failed when crawler dispatch returns non-OK", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
  });
  const service = createCrawlService({ crawls, projects, users, scores });

  await expect(
    service.requestCrawl({
      userId: "user-1",
      projectId: "proj-1",
      requestUrl: "https://api.test",
      env,
    }),
  ).rejects.toThrow("Crawler rejected the request");
});
```

Add new tests:

```ts
it("retries on network error and succeeds", async () => {
  mockFetch
    .mockRejectedValueOnce(new Error("Connection refused"))
    .mockResolvedValueOnce({ ok: true, status: 202 });
  const service = createCrawlService({ crawls, projects, users, scores });

  const result = await service.requestCrawl({
    userId: "user-1",
    projectId: "proj-1",
    requestUrl: "https://api.test",
    env,
  });

  expect(result.id).toBe("crawl-1");
  expect(crawls.updateStatus).toHaveBeenCalledWith("crawl-1", {
    status: "queued",
    startedAt: expect.any(Date),
  });
});

it("throws CRAWLER_UNAVAILABLE after all retries exhausted", async () => {
  mockFetch.mockRejectedValue(new Error("Connection refused"));
  const service = createCrawlService({ crawls, projects, users, scores });

  await expect(
    service.requestCrawl({
      userId: "user-1",
      projectId: "proj-1",
      requestUrl: "https://api.test",
      env,
    }),
  ).rejects.toThrow("Crawler service is temporarily unavailable");
});
```

**Step 2: Run tests to verify the new tests fail and the updated test fails**

Run: `cd apps/api && npx vitest run src/__tests__/services/crawl-service.test.ts`
Expected: 3 tests fail (the updated one + 2 new ones)

**Step 3: Refactor dispatch logic in `crawl-service.ts`**

Replace lines 105-142 in `requestCrawl` with:

```ts
import { fetchWithRetry } from "../lib/fetch-retry";

// ... inside requestCrawl, replace the try/catch block:

try {
  const response = await fetchWithRetry(`${args.env.crawlerUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    },
    body: payloadJson,
  });

  if (!response.ok) {
    await deps.crawls.updateStatus(crawlJob.id, {
      status: "failed",
      errorMessage: `Crawler dispatch failed: ${response.status} ${response.statusText}`,
    });
    throw new ServiceError(
      "CRAWLER_REJECTED",
      502,
      "Crawler rejected the request",
    );
  }

  await deps.crawls.updateStatus(crawlJob.id, {
    status: "queued",
    startedAt: new Date(),
  });
} catch (error) {
  if (error instanceof ServiceError) throw error;

  await deps.crawls.updateStatus(crawlJob.id, {
    status: "failed",
    errorMessage: `Crawler dispatch error: ${error instanceof Error ? error.message : "Unknown error"}`,
  });

  const isTimeout = error instanceof Error && error.name === "AbortError";

  throw new ServiceError(
    isTimeout ? "CRAWLER_TIMEOUT" : "CRAWLER_UNAVAILABLE",
    isTimeout ? 504 : 503,
    "Crawler service is temporarily unavailable. Please try again in a few minutes.",
  );
}
```

Also replace lines 310-319 in `dispatchScheduledJobs` with:

```ts
try {
  await fetchWithRetry(`${env.crawlerUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    },
    body: payloadJson,
  });
  await deps.crawls.updateStatus(job.id, {
    status: "queued",
    startedAt: new Date(),
  });
} catch (err) {
  // ... existing error handling unchanged
```

**Step 4: Run all crawl-service tests**

Run: `cd apps/api && npx vitest run src/__tests__/services/crawl-service.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/crawl-service.ts apps/api/src/__tests__/services/crawl-service.test.ts
git commit -m "fix: add retry logic to crawler dispatch, fix catch-block bug"
```

---

### Task 3: Add crawler health check to monitoring service

**Files:**

- Modify: `apps/api/src/services/monitoring-service.ts`
- Test: `apps/api/src/__tests__/services/monitoring-service.test.ts`

**Step 1: Write failing tests for crawler health check**

Add to `apps/api/src/__tests__/services/monitoring-service.test.ts`:

```ts
describe("checkCrawlerHealth", () => {
  it("stores healthy status in KV when crawler responds OK", async () => {
    const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok" }),
    });

    const db = createMockDb();
    db._whereMock.mockResolvedValueOnce([]); // for stalled jobs check
    const service = createMonitoringService(db, notifier as any);
    await service.checkCrawlerHealth("https://crawler.test", kv as any);

    expect(kv.put).toHaveBeenCalledWith(
      "crawler:health:latest",
      expect.stringContaining('"status":"up"'),
      expect.objectContaining({ expirationTtl: 3600 }),
    );
  });

  it("stores down status when crawler responds with error", async () => {
    const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const db = createMockDb();
    db._whereMock.mockResolvedValueOnce([]);
    const service = createMonitoringService(db, notifier as any);
    await service.checkCrawlerHealth("https://crawler.test", kv as any);

    expect(kv.put).toHaveBeenCalledWith(
      "crawler:health:latest",
      expect.stringContaining('"status":"down"'),
      expect.objectContaining({ expirationTtl: 3600 }),
    );
  });

  it("stores down status when fetch throws", async () => {
    const kv = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) };
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const db = createMockDb();
    db._whereMock.mockResolvedValueOnce([]);
    const service = createMonitoringService(db, notifier as any);
    await service.checkCrawlerHealth("https://crawler.test", kv as any);

    expect(kv.put).toHaveBeenCalledWith(
      "crawler:health:latest",
      expect.stringContaining('"status":"down"'),
      expect.objectContaining({ expirationTtl: 3600 }),
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/__tests__/services/monitoring-service.test.ts`
Expected: FAIL — `checkCrawlerHealth` is not a function

**Step 3: Implement `checkCrawlerHealth`**

In `apps/api/src/services/monitoring-service.ts`, add the method to the interface and implementation:

```ts
export interface MonitoringService {
  checkSystemHealth(): Promise<void>;
  checkCrawlerHealth(crawlerUrl: string, kv: KVNamespace): Promise<void>;
  getSystemMetrics(): Promise<Record<string, unknown>>;
}
```

Implementation:

```ts
async checkCrawlerHealth(crawlerUrl: string, kv: KVNamespace) {
  const start = Date.now();
  let status: "up" | "down" = "down";
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${crawlerUrl}/api/v1/health`, {
      signal: controller.signal,
    });

    clearTimeout(timer);
    status = response.ok ? "up" : "down";
    if (!response.ok) {
      error = `HTTP ${response.status}`;
    }
  } catch (err) {
    status = "down";
    error = err instanceof Error ? err.message : "Unknown error";
  }

  const latencyMs = Date.now() - start;
  const entry = {
    status,
    latencyMs,
    error,
    checkedAt: new Date().toISOString(),
  };

  // Store latest
  await kv.put("crawler:health:latest", JSON.stringify(entry), {
    expirationTtl: 3600,
  });

  // Append to rolling history (last 50 checks)
  const historyRaw = await kv.get("crawler:health:history");
  const history: typeof entry[] = historyRaw
    ? JSON.parse(historyRaw)
    : [];
  history.push(entry);
  if (history.length > 50) history.splice(0, history.length - 50);
  await kv.put("crawler:health:history", JSON.stringify(history), {
    expirationTtl: 86400,
  });

  // Log warnings
  if (status === "down") {
    const recentDownCount = history
      .slice(-3)
      .filter((h) => h.status === "down").length;
    if (recentDownCount >= 3) {
      log.error("CRITICAL: Crawler down for 3+ consecutive checks", {
        crawlerUrl,
        error,
      });
    } else {
      log.warn("Crawler health check failed", {
        crawlerUrl,
        error,
        latencyMs,
      });
    }
  } else {
    log.info("Crawler health check passed", { crawlerUrl, latencyMs });
  }
},
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/__tests__/services/monitoring-service.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/monitoring-service.ts apps/api/src/__tests__/services/monitoring-service.test.ts
git commit -m "feat: add crawler health check to monitoring service"
```

---

### Task 4: Wire health check into scheduled cron + expose in metrics

**Files:**

- Modify: `apps/api/src/index.ts:242-267` (runScheduledTasks)
- Modify: `apps/api/src/routes/admin.ts:26-39` (metrics endpoint)

**Step 1: Add `checkCrawlerHealth` call to `runScheduledTasks`**

In `apps/api/src/index.ts`, after line 253 (`await monitor.checkSystemHealth()`), add:

```ts
// 2b. Crawler health check
await monitor.checkCrawlerHealth(env.CRAWLER_URL, env.KV);
```

**Step 2: Add crawler health to metrics endpoint**

In `apps/api/src/routes/admin.ts`, update the `/metrics` handler to include crawler health from KV:

```ts
adminRoutes.get("/metrics", async (c) => {
  const db = c.get("db");
  const notifications = createNotificationService(db, c.env.RESEND_API_KEY, {
    appBaseUrl: c.env.APP_BASE_URL,
  });
  const monitor = createMonitoringService(db, notifications);

  try {
    const metrics = await monitor.getSystemMetrics();

    // Include crawler health from KV
    const crawlerHealthRaw = await c.env.KV.get("crawler:health:latest");
    const crawlerHealth = crawlerHealthRaw
      ? JSON.parse(crawlerHealthRaw)
      : null;

    return c.json({
      data: { ...metrics, crawlerHealth },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 3: Run full test suite to verify nothing breaks**

Run: `cd apps/api && npx vitest run`
Expected: All existing tests PASS

**Step 4: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/admin.ts
git commit -m "feat: wire crawler health check into cron and metrics endpoint"
```

---

### Task 5: Add KV-based fast-fail to crawl dispatch

**Files:**

- Modify: `apps/api/src/services/crawl-service.ts` (add KV param, fast-fail check)
- Modify: `apps/api/src/__tests__/services/crawl-service.test.ts`

**Step 1: Write failing test**

```ts
it("fast-fails with friendly message when crawler is known-down", async () => {
  const kv = {
    get: vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ status: "down", checkedAt: new Date().toISOString() }),
      ),
  };
  const service = createCrawlService({ crawls, projects, users, scores });

  await expect(
    service.requestCrawl({
      userId: "user-1",
      projectId: "proj-1",
      requestUrl: "https://api.test",
      env: { ...env, kv },
    }),
  ).rejects.toThrow("Crawler service is temporarily unavailable");

  // Should NOT attempt fetch at all
  expect(mockFetch).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/services/crawl-service.test.ts`
Expected: FAIL

**Step 3: Add KV fast-fail to `requestCrawl`**

Update `CrawlerDispatchEnv`:

```ts
export interface CrawlerDispatchEnv {
  crawlerUrl?: string;
  sharedSecret: string;
  queue?: any;
  kv?: KVNamespace;
}
```

Add fast-fail check before dispatch (after the `if (!args.env.crawlerUrl)` block, before the payload construction):

```ts
// Fast-fail if crawler is known-down
if (args.env.kv) {
  const healthRaw = await args.env.kv.get("crawler:health:latest");
  if (healthRaw) {
    const health = JSON.parse(healthRaw);
    if (health.status === "down") {
      await deps.crawls.updateStatus(crawlJob.id, {
        status: "failed",
        errorMessage: "Crawler is currently down (detected by health check)",
      });
      throw new ServiceError(
        "CRAWLER_UNAVAILABLE",
        503,
        "Crawler service is temporarily unavailable. Please try again in a few minutes.",
      );
    }
  }
}
```

**Step 4: Run tests**

Run: `cd apps/api && npx vitest run src/__tests__/services/crawl-service.test.ts`
Expected: All tests PASS

**Step 5: Wire KV into route handler**

In the crawl route file where `requestCrawl` is called, pass `kv: c.env.KV` into the env object. Find this by searching for `requestCrawl` in the routes directory and adding `kv: c.env.KV` to the env argument.

**Step 6: Commit**

```bash
git add apps/api/src/services/crawl-service.ts apps/api/src/__tests__/services/crawl-service.test.ts
git commit -m "feat: fast-fail crawl dispatch when crawler is known-down via KV"
```

---

### Task 6: Improve frontend error messages

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx:92-108`

**Step 1: Update `handleStartCrawl` error handling**

Replace the catch block in the `handleStartCrawl` function:

```tsx
} catch (err) {
  if (err instanceof ApiError) {
    const messages: Record<string, string> = {
      CRAWLER_UNAVAILABLE:
        "The crawler service is temporarily unavailable. Please try again in a few minutes.",
      CRAWLER_TIMEOUT:
        "The crawler service took too long to respond. Please try again.",
      CRAWLER_REJECTED:
        "The crawler could not process this request. Please contact support if this persists.",
      CRAWL_IN_PROGRESS:
        "A crawl is already running for this project.",
      CRAWL_LIMIT_REACHED:
        "You've used all your crawl credits for this month.",
    };
    setCrawlError(messages[err.code] ?? err.message);
  } else {
    setCrawlError("Failed to start crawl. Please try again.");
  }
  setStartingCrawl(false);
}
```

**Step 2: Verify the `ApiError` class includes `code`**

Check `apps/web/src/lib/api.ts` — the `ApiError` class already has a `code` property (line 8). Verify the API response parsing populates it correctly.

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/page.tsx
git commit -m "feat: show specific error messages for crawler failures"
```

---

### Task 7: Update Fly.io configuration

**Files:**

- Modify: `apps/crawler/fly.toml`

**Step 1: Update health check and concurrency settings**

```toml
[checks]
  [checks.health]
    type = "http"
    port = 8080
    path = "/api/v1/health"
    interval = "15s"
    timeout = "2s"
    method = "GET"
    grace_period = "30s"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "connections"
    soft_limit = 10
    hard_limit = 25
```

**Step 2: Commit**

```bash
git add apps/crawler/fly.toml
git commit -m "fix: add grace_period and concurrency limits to Fly.io config"
```

---

### Task 8: Run full test suite and typecheck

**Step 1: Run all API tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "chore: fix any remaining type/test issues"
```
