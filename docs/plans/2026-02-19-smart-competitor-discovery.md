# Smart Competitor Discovery — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-detect what a site does from crawl data, then use Perplexity + Grok to find real competitors and benchmark them automatically.

**Architecture:** A new `auto-site-description-service` runs post-crawl to classify the site. The upgraded `auto-competitor-service` queries Perplexity and Grok for real-time competitor discovery using the site description, falling back to Haiku. A notification banner on the competitors tab shows what was found.

**Tech Stack:** Drizzle ORM, Hono routes, `@anthropic-ai/sdk` (Haiku), OpenAI SDK (Perplexity sonar, Grok grok-3-fast), React/Next.js

**Design Doc:** `docs/plans/2026-02-19-smart-competitor-discovery-design.md`

---

### Task 1: Add `siteDescription` and `industry` columns to projects table

**Files:**

- Modify: `packages/db/src/schema.ts:278-301` (projects table)

**Step 1: Add columns**

In `packages/db/src/schema.ts`, add to the `projects` table definition (after `updatedAt`):

```typescript
siteDescription: text("site_description"),
industry: text("industry"),
```

**Step 2: Push schema**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Applies `ALTER TABLE projects ADD COLUMN site_description TEXT` and `ALTER TABLE projects ADD COLUMN industry TEXT`

**Step 3: Verify typecheck**

Run: `pnpm --filter @llm-boost/db typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add siteDescription and industry columns to projects"
```

---

### Task 2: Create auto-site-description-service

**Files:**

- Create: `apps/api/src/services/auto-site-description-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create the service**

````typescript
// apps/api/src/services/auto-site-description-service.ts
import {
  createDb,
  projectQueries,
  pageQueries,
  crawlQueries,
} from "@llm-boost/db";
import { createLogger } from "../lib/logger";

export interface AutoSiteDescriptionInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoSiteDescription(
  input: AutoSiteDescriptionInput,
): Promise<void> {
  const log = createLogger({ context: "auto-site-description" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  // Skip if user already set a description manually
  if (project.siteDescription) {
    log.info("Auto-site-description skipped: already set", {
      projectId: input.projectId,
    });
    return;
  }

  // Gather context from crawl
  const crawl = await crawlQueries(db).getById(input.crawlJobId);
  const pages = await pageQueries(db).listByJob(input.crawlJobId);

  const titles = pages
    .map((p) => p.title)
    .filter(Boolean)
    .slice(0, 15)
    .join("\n");

  const metaDescs = pages
    .map((p) => p.metaDesc)
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");

  const summary = crawl?.summary ?? "";

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Analyze this website and determine what it does and what industry it belongs to.

Domain: ${project.domain}
Name: ${project.name}
${summary ? `AI Summary: ${summary}` : ""}

Page titles:
${titles}

Meta descriptions:
${metaDescs}

Return ONLY valid JSON: {"siteDescription": "One sentence describing what this website/product does", "industry": "The industry or niche in 2-4 words"}

If you cannot determine the site's purpose, return: {"siteDescription": "", "industry": ""}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    if (result.siteDescription || result.industry) {
      await projectQueries(db).update(input.projectId, {
        siteDescription: result.siteDescription || null,
        industry: result.industry || null,
      });
      log.info("Auto-site-description completed", {
        projectId: input.projectId,
        industry: result.industry,
      });
    }
  } catch (err) {
    log.error("Auto-site-description failed", { error: String(err) });
  }
}
````

**Step 2: Check that `projectQueries(db).update()` exists and accepts these fields**

Read `packages/db/src/queries/projects.ts` and verify there's an `update` method. If it uses a spread pattern like `db.update(projects).set(data)`, the new columns will work automatically since Drizzle infers from the schema. If it has a typed interface, add `siteDescription?: string | null` and `industry?: string | null` to it.

**Step 3: Wire into post-processing**

In `apps/api/src/services/post-processing-service.ts`, add import and call. This should run **before** auto-competitor so the competitor service can use the description. Add it as the first auto-service in the `is_final` block:

```typescript
import { runAutoSiteDescription } from "./auto-site-description-service";

// Inside schedule(), at the start of the is_final block (before auto-visibility):
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoSiteDescription({
      databaseUrl: env.databaseUrl,
      projectId,
      crawlJobId: args.crawlJobId,
      anthropicApiKey: env.anthropicApiKey,
    }).catch(() => {}),
  );
}
```

**Important:** Since `waitUntil` tasks run concurrently, and the competitor service needs the site description, the competitor service should re-fetch the project to get the latest description. The auto-site-description call is fast (single Haiku call + 1 DB write), so by the time the competitor service starts its heavier work, the description should usually be available. Add a small delay in the competitor service as a safety measure (see Task 3).

**Step 4: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/auto-site-description-service.ts apps/api/src/services/post-processing-service.ts
git commit -m "feat(api): auto-detect site description and industry after crawl"
```

---

### Task 3: Upgrade auto-competitor-service to use Perplexity + Grok

**Files:**

- Modify: `apps/api/src/services/auto-competitor-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts` (pass new API keys)

**Step 1: Rewrite the competitor discovery logic**

Replace the existing `auto-competitor-service.ts` with an upgraded version. The new flow:

1. Wait 3 seconds (let site description service finish)
2. Re-fetch project to get fresh `siteDescription` and `industry`
3. Query Perplexity for competitors
4. Query Grok for competitors
5. Merge, deduplicate, validate
6. Fall back to Haiku if both fail
7. Auto-benchmark each

````typescript
// apps/api/src/services/auto-competitor-service.ts
import {
  createDb,
  competitorQueries,
  competitorBenchmarkQueries,
  projectQueries,
  userQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";
import { createCompetitorBenchmarkService } from "./competitor-benchmark-service";

export interface AutoCompetitorInput {
  databaseUrl: string;
  projectId: string;
  anthropicApiKey: string;
  perplexityApiKey?: string;
  grokApiKey?: string;
}

const BLOCKED_DOMAINS = new Set([
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "linkedin.com",
  "github.com",
  "medium.com",
  "quora.com",
  "amazon.com",
  "google.com",
]);

function extractDomains(text: string): string[] {
  // Match domain-like patterns
  const domainRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/g;
  const matches = [...text.matchAll(domainRegex)].map((m) =>
    m[1].toLowerCase().replace(/^www\./, ""),
  );
  return [...new Set(matches)];
}

function isValidCompetitorDomain(
  domain: string,
  projectDomain: string,
): boolean {
  if (!domain || domain.length < 4) return false;
  if (domain === projectDomain.toLowerCase()) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (!domain.includes(".")) return false;
  return true;
}

async function queryPerplexity(
  apiKey: string,
  domain: string,
  description: string,
  industry: string,
): Promise<string[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const query = description
    ? `What are the top 5 direct competitors to ${domain}? ${description}. Industry: ${industry}. Return only domain names, one per line.`
    : `What are the top 5 direct competitors to ${domain}? Return only domain names, one per line.`;

  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [{ role: "user", content: query }],
    max_tokens: 512,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return extractDomains(text);
}

async function queryGrok(
  apiKey: string,
  domain: string,
  description: string,
  industry: string,
): Promise<string[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

  const query = description
    ? `List the top 5 direct business competitors to ${domain}. ${description}. Industry: ${industry}. Return only domain names, one per line.`
    : `List the top 5 direct business competitors to ${domain}. Return only domain names, one per line.`;

  const response = await client.chat.completions.create({
    model: "grok-3-fast",
    messages: [{ role: "user", content: query }],
    max_tokens: 512,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return extractDomains(text);
}

async function queryHaikuFallback(
  apiKey: string,
  domain: string,
  name: string,
): Promise<string[]> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Given the website domain "${domain}" (named "${name}"), identify 3 direct competitor domains. Return ONLY a JSON array of domain strings, e.g. ["competitor1.com", "competitor2.com", "competitor3.com"]`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const domains = JSON.parse(cleaned);
    return Array.isArray(domains) ? domains : [];
  } catch {
    return extractDomains(text);
  }
}

export async function runAutoCompetitorDiscovery(
  input: AutoCompetitorInput,
): Promise<void> {
  const log = createLogger({ context: "auto-competitor" });
  const db = createDb(input.databaseUrl);

  // Small delay to let site description service finish
  await new Promise((r) => setTimeout(r, 3000));

  // Re-fetch project for fresh siteDescription/industry
  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];
  if (limits.competitorsPerProject === 0) {
    log.info("Auto-competitor skipped: plan has no competitor slots", {
      projectId: input.projectId,
    });
    return;
  }

  const existing = await competitorQueries(db).listByProject(input.projectId);
  if (existing.length > 0) {
    log.info("Auto-competitor skipped: competitors already exist", {
      projectId: input.projectId,
    });
    return;
  }

  const description = project.siteDescription ?? "";
  const industry = project.industry ?? "";

  // Query Perplexity and Grok in parallel
  const results = await Promise.allSettled([
    input.perplexityApiKey
      ? queryPerplexity(
          input.perplexityApiKey,
          project.domain,
          description,
          industry,
        )
      : Promise.resolve([]),
    input.grokApiKey
      ? queryGrok(input.grokApiKey, project.domain, description, industry)
      : Promise.resolve([]),
  ]);

  const perplexityDomains =
    results[0].status === "fulfilled" ? results[0].value : [];
  const grokDomains = results[1].status === "fulfilled" ? results[1].value : [];

  // Merge and deduplicate
  let allDomains = [...new Set([...perplexityDomains, ...grokDomains])].filter(
    (d) => isValidCompetitorDomain(d, project.domain),
  );

  // Fallback to Haiku if both returned nothing
  if (allDomains.length === 0) {
    log.info("Perplexity/Grok returned no results, falling back to Haiku", {
      projectId: input.projectId,
    });
    try {
      const haikuDomains = await queryHaikuFallback(
        input.anthropicApiKey,
        project.domain,
        project.name,
      );
      allDomains = haikuDomains.filter((d) =>
        isValidCompetitorDomain(d, project.domain),
      );
    } catch (err) {
      log.error("Haiku fallback also failed", { error: String(err) });
      return;
    }
  }

  const maxToAdd = Math.min(allDomains.length, limits.competitorsPerProject);
  const domainsToAdd = allDomains.slice(0, maxToAdd);

  log.info(
    `Auto-competitor discovered ${domainsToAdd.length} competitors (perplexity: ${perplexityDomains.length}, grok: ${grokDomains.length})`,
    { projectId: input.projectId },
  );

  // Benchmark each competitor
  const benchmarkService = createCompetitorBenchmarkService({
    competitors: competitorQueries(db),
    benchmarks: competitorBenchmarkQueries(db),
  });

  for (const domain of domainsToAdd) {
    try {
      await benchmarkService.benchmarkCompetitor({
        projectId: input.projectId,
        competitorDomain: domain,
        competitorLimit: limits.competitorsPerProject,
      });
    } catch (err) {
      log.error(`Failed to benchmark ${domain}`, { error: String(err) });
    }
  }
}
````

**Step 2: Update PostProcessingEnv and ingest route**

In `apps/api/src/services/post-processing-service.ts`, add `perplexityApiKey` and `grokApiKey` to `PostProcessingEnv` if not already present. Also update the `runAutoCompetitorDiscovery` call to pass these keys:

```typescript
// In PostProcessingEnv, ensure these exist:
perplexityApiKey?: string;
grokApiKey?: string;  // (may be same as xaiApiKey)

// Update the auto-competitor call:
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoCompetitorDiscovery({
      databaseUrl: env.databaseUrl,
      projectId,
      anthropicApiKey: env.anthropicApiKey,
      perplexityApiKey: env.perplexityApiKey,
      grokApiKey: env.xaiApiKey,
    }).catch(() => {}),
  );
}
```

In `apps/api/src/services/ingest-service.ts`, ensure `perplexityApiKey` is in `BatchEnvironment`. In `apps/api/src/routes/ingest.ts`, pass `perplexityApiKey: c.env.PERPLEXITY_API_KEY` to the env.

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/services/auto-competitor-service.ts apps/api/src/services/post-processing-service.ts apps/api/src/services/ingest-service.ts apps/api/src/routes/ingest.ts
git commit -m "feat(api): upgrade competitor discovery with Perplexity + Grok"
```

---

### Task 4: Add project settings update for siteDescription/industry

**Files:**

- Modify: `apps/api/src/routes/projects.ts`

**Step 1: Add or update the PATCH endpoint**

Check if there's already a PATCH route for project updates. If so, extend it to accept `siteDescription` and `industry`. If not, add one:

```typescript
// PATCH /:id/site-context — Update site description and industry
projectRoutes.patch("/:id/site-context", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const body = await c.req.json<{
    siteDescription?: string;
    industry?: string;
  }>();

  await projectQueries(db).update(projectId, {
    ...(body.siteDescription !== undefined && {
      siteDescription: body.siteDescription,
    }),
    ...(body.industry !== undefined && { industry: body.industry }),
  });

  return c.json({ data: { success: true } });
});
```

**Step 2: Add re-discover endpoint**

```typescript
// POST /:id/rediscover-competitors — Re-run competitor discovery with updated context
projectRoutes.post("/:id/rediscover-competitors", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  // Clear existing auto-discovered competitors
  const existing = await competitorQueries(db).listByProject(projectId);
  for (const comp of existing) {
    if (comp.source === "auto_discovered") {
      await competitorQueries(db).remove(comp.id);
    }
  }

  // Import and run discovery
  const { runAutoCompetitorDiscovery } =
    await import("../services/auto-competitor-service");

  // Fire-and-forget with executionCtx if available, otherwise await
  const promise = runAutoCompetitorDiscovery({
    databaseUrl: c.env.DATABASE_URL,
    projectId,
    anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    perplexityApiKey: c.env.PERPLEXITY_API_KEY,
    grokApiKey: c.env.XAI_API_KEY,
  });

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(promise.catch(() => {}));
    return c.json({ data: { status: "discovering" } }, 202);
  }

  await promise;
  return c.json({ data: { status: "complete" } });
});
```

Add necessary imports at top of file: `competitorQueries` from `@llm-boost/db`.

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/projects.ts
git commit -m "feat(api): add site context update and re-discover competitors endpoints"
```

---

### Task 5: Update frontend API client

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add new methods to the projects section**

```typescript
// In the projects object, add:
async updateSiteContext(
  projectId: string,
  data: { siteDescription?: string; industry?: string },
): Promise<void> {
  await apiClient.patch(`/api/projects/${projectId}/site-context`, data);
},

async rediscoverCompetitors(projectId: string): Promise<void> {
  await apiClient.post(
    `/api/projects/${projectId}/rediscover-competitors`,
    {},
  );
},
```

**Step 2: Add `siteDescription` and `industry` to the Project type**

Find the `Project` interface and add:

```typescript
siteDescription?: string | null;
industry?: string | null;
```

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add API client methods for site context and competitor rediscovery"
```

---

### Task 6: Create competitor discovery notification banner

**Files:**

- Create: `apps/web/src/components/competitor-discovery-banner.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/competitor-discovery-banner.tsx
"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import Link from "next/link";

interface CompetitorBenchmark {
  competitorDomain: string;
  letterGrade: string | null;
  crawledAt: string;
}

const EMPTY_SUB = () => () => {};
const SERVER_SNAPSHOT = true;

export function CompetitorDiscoveryBanner({
  projectId,
}: {
  projectId: string;
}) {
  const storageKey = `competitor-discovery-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => SERVER_SNAPSHOT,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const dismissed = isDismissedFromStorage || manuallyDismissed;

  const { data } = useApiSWR<{
    competitors: CompetitorBenchmark[];
    projectScores: Record<string, number>;
  }>(
    dismissed ? null : `benchmarks-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  if (dismissed || !data || data.competitors.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" />
            We found {data.competitors.length} competitor
            {data.competitors.length !== 1 ? "s" : ""} for you
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {data.competitors.map((c) => (
            <li
              key={c.competitorDomain}
              className="flex items-center gap-2 text-sm"
            >
              <span className="font-medium">{c.competitorDomain}</span>
              {c.letterGrade && (
                <Badge variant="secondary" className="text-[10px]">
                  {c.letterGrade}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" onClick={handleDismiss}>
            Looks Good
          </Button>
          <Link href={`/dashboard/settings`}>
            <Button size="sm" variant="outline">
              Edit in Settings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/competitor-discovery-banner.tsx
git commit -m "feat(web): create competitor discovery notification banner"
```

---

### Task 7: Add banner to competitors tab

**Files:**

- Modify: `apps/web/src/components/tabs/competitors-tab.tsx`

**Step 1: Import and render the banner**

Add at the top of the file:

```typescript
import { CompetitorDiscoveryBanner } from "@/components/competitor-discovery-banner";
```

Render it at the top of the tab's return JSX, before the existing content (the input field and competitor cards):

```tsx
<CompetitorDiscoveryBanner projectId={projectId} />
```

The `competitors-tab.tsx` should already receive `projectId` as a prop. Verify this by reading the file. If it doesn't, check how it gets project context and pass `projectId` accordingly.

**Step 2: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/tabs/competitors-tab.tsx
git commit -m "feat(web): show competitor discovery banner in competitors tab"
```

---

### Task 8: Add Site Context section to project settings

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx` or the project settings component

**Step 1: Find the project settings page**

Search for the settings page that shows project-level configuration. It may be at:

- `apps/web/src/app/dashboard/settings/page.tsx`
- `apps/web/src/app/dashboard/projects/[id]/settings/page.tsx`
- Or embedded in the project detail page

Read the file to understand its structure.

**Step 2: Add Site Context section**

Add a new card/section for "Site Context" with:

- **Site Description** — text input bound to `project.siteDescription`, editable
- **Industry** — text input bound to `project.industry`, editable
- **Save** button that calls `api.projects.updateSiteContext(projectId, { siteDescription, industry })`
- **Re-discover Competitors** button that appears after saving, calls `api.projects.rediscoverCompetitors(projectId)` and shows a toast "Discovering competitors..."

```tsx
// Site Context section (add within the settings form)
<Card>
  <CardHeader>
    <CardTitle className="text-base">Site Context</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Site Description</Label>
      <Input
        value={siteDescription}
        onChange={(e) => setSiteDescription(e.target.value)}
        placeholder="What does your site/product do?"
      />
      <p className="text-xs text-muted-foreground">
        Auto-detected from your crawl data. Edit if incorrect.
      </p>
    </div>
    <div className="space-y-2">
      <Label>Industry</Label>
      <Input
        value={industry}
        onChange={(e) => setIndustry(e.target.value)}
        placeholder="e.g., Project Management, E-commerce, Healthcare"
      />
    </div>
    <div className="flex gap-2">
      <Button onClick={handleSaveSiteContext} disabled={saving}>
        Save
      </Button>
      <Button
        variant="outline"
        onClick={handleRediscoverCompetitors}
        disabled={rediscovering}
      >
        Re-discover Competitors
      </Button>
    </div>
  </CardContent>
</Card>
```

State and handlers:

```typescript
const [siteDescription, setSiteDescription] = useState(
  project?.siteDescription ?? "",
);
const [industry, setIndustry] = useState(project?.industry ?? "");
const [saving, setSaving] = useState(false);
const [rediscovering, setRediscovering] = useState(false);

async function handleSaveSiteContext() {
  setSaving(true);
  try {
    await api.projects.updateSiteContext(projectId, {
      siteDescription,
      industry,
    });
    toast({ title: "Site context saved" });
  } catch {
    toast({ title: "Failed to save", variant: "destructive" });
  } finally {
    setSaving(false);
  }
}

async function handleRediscoverCompetitors() {
  setRediscovering(true);
  try {
    await api.projects.rediscoverCompetitors(projectId);
    toast({
      title: "Discovering competitors...",
      description: "This may take a minute. Check the Competitors tab shortly.",
    });
  } catch {
    toast({ title: "Failed to start discovery", variant: "destructive" });
  } finally {
    setRediscovering(false);
  }
}
```

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx
git commit -m "feat(web): add site context section to project settings"
```

---

### Task 9: Full typecheck, lint, and test

**Files:** None (verification only)

**Step 1: Typecheck all packages**

Run: `pnpm typecheck`
Expected: 12/12 packages pass

**Step 2: Lint**

Run: `pnpm --filter @llm-boost/api lint && pnpm --filter @llm-boost/web lint`
Expected: No new errors

**Step 3: Test**

Run: `pnpm --filter @llm-boost/api test`
Expected: Same pre-existing failures, no new ones

**Step 4: Fix and commit any issues**

```bash
git commit -m "fix: address typecheck/lint issues from competitor discovery"
```
