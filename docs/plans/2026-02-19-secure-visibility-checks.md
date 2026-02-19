# Secure Keyword-Based Visibility Checks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace free-text visibility check queries with a keyword picker backed by DB-sourced keywords, eliminating prompt injection risk and improving onboarding.

**Architecture:** The `POST /api/visibility/check` endpoint switches from accepting a `query: string` to `keywordIds: UUID[]`. Server resolves IDs to text from the `saved_keywords` table. A new auto-keyword service generates seed keywords on first crawl. Frontend replaces the text input with a grouped checkbox picker.

**Tech Stack:** Drizzle ORM (pgTable), Hono routes, React (Next.js), `@anthropic-ai/sdk` (Haiku for suggestions)

**Design Doc:** `docs/plans/2026-02-19-secure-visibility-checks-design.md`

---

### Task 1: Add keyword validation to shared package

**Files:**

- Create: `packages/shared/src/validation/keyword-validation.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create the validation module**

```typescript
// packages/shared/src/validation/keyword-validation.ts
export const KEYWORD_MAX_LENGTH = 200;

const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /system\s*:/i,
  /<\|/,
  /\|>/,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /you\s+are\s+(now|a)\s/i,
  /pretend\s+you/i,
  /act\s+as\s+(if|a)\s/i,
  /forget\s+(all|everything|your)/i,
  /do\s+not\s+follow/i,
  /override\s+(your|the)/i,
  /new\s+instructions/i,
];

const ALLOWED_CHARS = /^[\p{L}\p{N}\s.,!?'"()\-/:&@#%+]+$/u;

export function validateKeyword(keyword: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) return { valid: false, reason: "Keyword is empty" };
  if (trimmed.length > KEYWORD_MAX_LENGTH)
    return {
      valid: false,
      reason: `Keyword exceeds ${KEYWORD_MAX_LENGTH} characters`,
    };
  if (!ALLOWED_CHARS.test(trimmed))
    return { valid: false, reason: "Keyword contains invalid characters" };
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed))
      return { valid: false, reason: "Keyword contains blocked pattern" };
  }
  return { valid: true };
}
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export {
  validateKeyword,
  KEYWORD_MAX_LENGTH,
} from "./validation/keyword-validation";
```

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/shared typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/validation/keyword-validation.ts packages/shared/src/index.ts
git commit -m "feat(shared): add keyword validation with injection pattern blocking"
```

---

### Task 2: Add `keywordId` column to visibility_checks schema

**Files:**

- Modify: `packages/db/src/schema.ts:504-522` (visibility_checks table)
- Modify: `packages/db/src/queries/visibility.ts` (create method)

**Step 1: Add keywordId column**

In `packages/db/src/schema.ts`, add to the `visibilityChecks` table definition (after `r2ResponseKey`):

```typescript
keywordId: uuid("keyword_id").references(() => savedKeywords.id, {
  onDelete: "set null",
}),
```

**Step 2: Update the visibility create query**

In `packages/db/src/queries/visibility.ts`, find the `create` method and ensure the insert accepts `keywordId` (it uses a spread `...data` pattern, so the type just needs updating). Check the interface/type that feeds the insert and add `keywordId?: string | null` to it.

**Step 3: Push schema**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Applies `ALTER TABLE visibility_checks ADD COLUMN keyword_id UUID REFERENCES saved_keywords(id) ON DELETE SET NULL`

**Step 4: Verify typecheck**

Run: `pnpm --filter @llm-boost/db typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/visibility.ts
git commit -m "feat(db): add keywordId FK to visibility_checks"
```

---

### Task 3: Add keyword validation to keyword routes

**Files:**

- Modify: `apps/api/src/routes/keywords.ts:34-77` (POST create)
- Modify: `apps/api/src/routes/keywords.ts:80-138` (POST batch)

**Step 1: Add validation to single-create route**

In `apps/api/src/routes/keywords.ts`, in the `POST /:projectId` handler (around line 60, before the `savedKeywordQueries(db).create()` call), add:

```typescript
import { validateKeyword } from "@llm-boost/shared";

// After parsing body.keyword:
const validation = validateKeyword(body.keyword);
if (!validation.valid) {
  return c.json(
    { error: { code: "VALIDATION_ERROR", message: validation.reason } },
    422,
  );
}
```

**Step 2: Add validation to batch-create route**

In the `POST /:projectId/batch` handler, validate each keyword before inserting. Filter out invalid ones silently (they came from AI suggestions, not user-typed):

```typescript
const validKeywords = body.keywords.filter(
  (kw: string) => validateKeyword(kw).valid,
);
```

Use `validKeywords` instead of `body.keywords` in the dedup/insert logic.

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/keywords.ts
git commit -m "feat(api): validate keywords against injection patterns"
```

---

### Task 4: Create auto-keyword-service for post-crawl seeding

**Files:**

- Create: `apps/api/src/services/auto-keyword-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create the service**

````typescript
// apps/api/src/services/auto-keyword-service.ts
import {
  createDb,
  savedKeywordQueries,
  projectQueries,
  userQueries,
  pageQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS, validateKeyword } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoKeywordInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoKeywordGeneration(
  input: AutoKeywordInput,
): Promise<void> {
  const log = createLogger({ context: "auto-keyword" });
  const db = createDb(input.databaseUrl);

  const existing = await savedKeywordQueries(db).countByProject(
    input.projectId,
  );
  if (existing > 0) {
    log.info("Auto-keyword skipped: keywords already exist", {
      projectId: input.projectId,
    });
    return;
  }

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];

  // Gather context from crawled pages
  const pages = await pageQueries(db).listByJob(input.crawlJobId);
  const titles = pages
    .map((p) => p.title)
    .filter(Boolean)
    .slice(0, 20)
    .join("\n");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Generate 10 search queries that a potential customer would type into an AI assistant (ChatGPT, Claude, Perplexity) when looking for a product/service like this website offers.

Domain: ${project.domain}
Name: ${project.name}
Page titles:
${titles}

Return ONLY a valid JSON array of objects: [{"keyword": "the search query", "funnelStage": "education"|"comparison"|"purchase"}]

Mix of funnel stages. Keep queries under 100 characters. Natural language, not SEO-stuffed.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const keywords = JSON.parse(cleaned);

    if (!Array.isArray(keywords)) return;

    const maxToCreate = Math.min(
      keywords.length,
      limits.savedKeywordsPerProject,
    );

    const validRows = keywords
      .slice(0, maxToCreate)
      .filter(
        (k: { keyword?: string }) =>
          k.keyword && validateKeyword(k.keyword).valid,
      )
      .map((k: { keyword: string; funnelStage?: string }) => ({
        projectId: input.projectId,
        keyword: k.keyword.trim(),
        source: "auto_discovered" as const,
        funnelStage: (["education", "comparison", "purchase"].includes(
          k.funnelStage ?? "",
        )
          ? k.funnelStage
          : "education") as "education" | "comparison" | "purchase",
      }));

    if (validRows.length > 0) {
      await savedKeywordQueries(db).createMany(validRows);
    }

    log.info(`Auto-keyword created ${validRows.length} keywords`, {
      projectId: input.projectId,
    });
  } catch (err) {
    log.error("Auto-keyword generation failed", { error: String(err) });
  }
}
````

**Step 2: Wire into post-processing**

In `apps/api/src/services/post-processing-service.ts`, add import and call (after the auto-competitor block, same pattern):

```typescript
import { runAutoKeywordGeneration } from "./auto-keyword-service";

// Inside schedule(), after auto-competitor block, still within is_final guard:
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoKeywordGeneration({
      databaseUrl: env.databaseUrl,
      projectId,
      crawlJobId: args.crawlJobId,
      anthropicApiKey: env.anthropicApiKey,
    }).catch(() => {}),
  );
}
```

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/services/auto-keyword-service.ts apps/api/src/services/post-processing-service.ts
git commit -m "feat(api): auto-generate seed keywords after first crawl"
```

---

### Task 5: Add `POST /suggest-keywords` endpoint

**Files:**

- Modify: `apps/api/src/routes/visibility.ts` (add new route)

**Step 1: Add suggest-keywords endpoint**

Add after the existing `discover-keywords` route (around line 629):

```typescript
// POST /:projectId/suggest-keywords — AI-powered keyword suggestions
visibilityRoutes.post(
  "/:projectId/suggest-keywords",
  rateLimit({ limit: 10, windowSeconds: 60, keyPrefix: "rl:vis-suggest" }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");

    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    // Get existing keywords to avoid duplicates
    const { savedKeywordQueries: savedKwQueries } =
      await import("@llm-boost/db");
    const existing = await savedKwQueries(db).listByProject(projectId);
    const existingSet = new Set(existing.map((k) => k.keyword.toLowerCase()));

    const { suggestKeywords } = await import("@llm-boost/llm");
    const context =
      existing.length > 0
        ? `Existing keywords (avoid duplicates): ${existing.map((k) => k.keyword).join(", ")}`
        : "";

    const suggestions = await suggestKeywords(
      c.env.ANTHROPIC_API_KEY,
      project.domain,
      context,
    );

    // Filter out duplicates
    const { validateKeyword } = await import("@llm-boost/shared");
    const fresh = suggestions
      .filter((kw: string) => !existingSet.has(kw.toLowerCase()))
      .filter((kw: string) => validateKeyword(kw).valid)
      .slice(0, 10);

    return c.json({ data: fresh });
  },
);
```

This returns an array of suggestion strings (not yet saved). The frontend will let users pick which to save.

**Step 2: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/routes/visibility.ts
git commit -m "feat(api): add suggest-keywords endpoint for on-demand AI suggestions"
```

---

### Task 6: Modify `POST /check` to accept `keywordIds`

**Files:**

- Modify: `apps/api/src/routes/visibility.ts:32-85` (POST /check handler)
- Modify: `apps/api/src/services/visibility-service.ts:23-30` (runCheck args)

**Step 1: Update the route handler**

Replace the existing POST /check body parsing and validation (lines 38-55) to accept `keywordIds` instead of `query`. Resolve keywords server-side:

```typescript
visibilityRoutes.post("/check", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    projectId: string;
    keywordIds: string[];
    providers: string[];
  }>();

  if (!body.projectId || !body.keywordIds?.length || !body.providers?.length) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId, keywordIds, and providers are required",
        },
      },
      422,
    );
  }

  // Resolve keyword IDs to text from DB
  const { savedKeywordQueries: savedKwQueries } = await import("@llm-boost/db");
  const allKeywords = await savedKwQueries(db).listByProject(body.projectId);
  const keywordMap = new Map(allKeywords.map((k) => [k.id, k]));

  const resolvedKeywords = body.keywordIds
    .map((id) => keywordMap.get(id))
    .filter(Boolean);

  if (resolvedKeywords.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid keywords found for the provided IDs",
        },
      },
      422,
    );
  }

  try {
    const service = createVisibilityService({
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      visibility: createVisibilityRepository(db),
      competitors: createCompetitorRepository(db),
    });

    const allResults = [];
    for (const keyword of resolvedKeywords) {
      const stored = await service.runCheck({
        userId,
        projectId: body.projectId,
        query: keyword.keyword,
        keywordId: keyword.id,
        providers: body.providers,
        apiKeys: {
          chatgpt: c.env.OPENAI_API_KEY,
          claude: c.env.ANTHROPIC_API_KEY,
          perplexity: c.env.PERPLEXITY_API_KEY,
          gemini: c.env.GOOGLE_API_KEY,
          copilot: c.env.BING_API_KEY,
          gemini_ai_mode: c.env.GOOGLE_API_KEY,
          grok: c.env.XAI_API_KEY,
        },
      });
      allResults.push(...stored);
    }

    return c.json({ data: allResults }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Update the visibility service**

In `apps/api/src/services/visibility-service.ts`, add `keywordId?: string` to the `runCheck` args interface (line 26):

```typescript
async runCheck(args: {
  userId: string;
  projectId: string;
  query: string;
  keywordId?: string;
  providers: string[];
  competitors?: string[];
  apiKeys: Record<string, string | undefined>;
}) {
```

And pass `keywordId` to the `visibility.create()` call (around line 73):

```typescript
deps.visibility.create({
  projectId: project.id,
  llmProvider: result.provider as ...,
  query: result.query,
  keywordId: args.keywordId ?? null,
  // ...rest
```

**Step 3: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/visibility.ts apps/api/src/services/visibility-service.ts
git commit -m "feat(api): accept keywordIds instead of free-text query in visibility check"
```

---

### Task 7: Update frontend API client

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Update `api.visibility.run()`**

Change the signature from `query: string` to `keywordIds: string[]`:

```typescript
async run(data: {
  projectId: string;
  keywordIds: string[];
  providers: string[];
}): Promise<VisibilityCheck[]> {
  const res = await apiClient.post<ApiEnvelope<VisibilityCheck[]>>(
    "/api/visibility/check",
    data,
  );
  return res.data;
},
```

**Step 2: Add `api.visibility.suggestKeywords()`**

Add to the visibility object:

```typescript
async suggestKeywords(projectId: string): Promise<string[]> {
  const res = await apiClient.post<ApiEnvelope<string[]>>(
    `/api/visibility/${projectId}/suggest-keywords`,
    {},
  );
  return res.data;
},
```

**Step 3: Add `keywordId` to `VisibilityCheck` type**

Add to the `VisibilityCheck` interface:

```typescript
keywordId?: string | null;
```

**Step 4: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: FAIL (visibility-tab.tsx still uses old `query: string` API — fixed in Task 8)

**Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update API client for keyword-based visibility checks"
```

---

### Task 8: Create KeywordPicker component

**Files:**

- Create: `apps/web/src/components/visibility/keyword-picker.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/components/visibility/keyword-picker.tsx
"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type SavedKeyword } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Persona {
  id: string;
  name: string;
  sampleQueries: string[];
}

interface KeywordPickerProps {
  projectId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const FUNNEL_LABELS: Record<string, string> = {
  education: "Education",
  comparison: "Comparison",
  purchase: "Purchase",
};

export function KeywordPicker({
  projectId,
  selectedIds,
  onSelectionChange,
}: KeywordPickerProps) {
  const { toast } = useToast();
  const [keywordsOpen, setKeywordsOpen] = useState(true);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { data: keywords, mutate: mutateKeywords } = useApiSWR<SavedKeyword[]>(
    `keywords-${projectId}`,
    useCallback(() => api.keywords.list(projectId), [projectId]),
  );

  const { data: personas } = useApiSWR<Persona[]>(
    `personas-${projectId}`,
    useCallback(() => api.personas.list(projectId), [projectId]),
  );

  const toggleKeyword = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((k) => k !== id)
        : [...selectedIds, id],
    );
  };

  const selectAll = () => {
    const allIds = (keywords ?? []).map((k) => k.id);
    onSelectionChange(allIds);
  };

  const clearAll = () => onSelectionChange([]);

  const handleLoadSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestionsOpen(true);
    try {
      const result = await api.visibility.suggestKeywords(projectId);
      setSuggestions(result);
    } catch {
      toast({
        title: "Failed to load suggestions",
        variant: "destructive",
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddSuggestion = async (keyword: string) => {
    try {
      await api.keywords.create(projectId, { keyword });
      setSuggestions((prev) => prev.filter((s) => s !== keyword));
      mutateKeywords();
      toast({ title: `Added "${keyword}"` });
    } catch {
      toast({ title: "Failed to add keyword", variant: "destructive" });
    }
  };

  // Persona queries mapped to virtual IDs for selection
  const personaQueries = (personas ?? []).flatMap((p) =>
    (p.sampleQueries ?? []).map((q) => ({
      id: `persona:${p.id}:${q}`,
      keyword: q,
      personaName: p.name,
    })),
  );

  const isEmpty =
    (!keywords || keywords.length === 0) && personaQueries.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Select Queries</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEmpty && (
          <p className="text-sm text-muted-foreground">
            No keywords yet. Click &ldquo;Suggest Queries&rdquo; below to get AI-powered suggestions.
          </p>
        )}

        {/* Your Keywords section */}
        {keywords && keywords.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-sm font-medium"
              onClick={() => setKeywordsOpen(!keywordsOpen)}
            >
              {keywordsOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Your Keywords ({keywords.length})
            </button>
            {keywordsOpen && (
              <div className="mt-2 space-y-1.5 pl-5">
                {keywords.map((kw) => (
                  <label
                    key={kw.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.includes(kw.id)}
                      onCheckedChange={() => toggleKeyword(kw.id)}
                    />
                    <span className="flex-1">{kw.keyword}</span>
                    {kw.funnelStage && (
                      <Badge variant="secondary" className="text-[10px]">
                        {FUNNEL_LABELS[kw.funnelStage] ?? kw.funnelStage}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Persona Queries section */}
        {personaQueries.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-sm font-medium"
              onClick={() => setPersonasOpen(!personasOpen)}
            >
              {personasOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Persona Queries ({personaQueries.length})
            </button>
            {personasOpen && (
              <div className="mt-2 space-y-1.5 pl-5">
                {personaQueries.map((pq) => (
                  <label
                    key={pq.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.includes(pq.id)}
                      onCheckedChange={() => toggleKeyword(pq.id)}
                    />
                    <span className="flex-1">{pq.keyword}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {pq.personaName}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions section */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-sm font-medium"
            onClick={
              suggestions.length > 0
                ? () => setSuggestionsOpen(!suggestionsOpen)
                : handleLoadSuggestions
            }
          >
            {loadingSuggestions ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : suggestionsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {suggestions.length > 0
              ? `AI Suggestions (${suggestions.length})`
              : "Suggest Queries"}
          </button>
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="mt-2 space-y-1.5 pl-5">
              {suggestions.map((kw) => (
                <div key={kw} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{kw}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleAddSuggestion(kw)}
                  >
                    + Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selection count */}
        <div className="border-t pt-2 text-xs text-muted-foreground">
          {selectedIds.length} quer{selectedIds.length === 1 ? "y" : "ies"}{" "}
          selected
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: May have issues if `api.personas.list` doesn't exist — check and add if needed.

**Step 3: Commit**

```bash
git add apps/web/src/components/visibility/keyword-picker.tsx
git commit -m "feat(web): create KeywordPicker component with grouped sections"
```

---

### Task 9: Replace free-text input with KeywordPicker in visibility tab

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Replace query input state and UI**

Replace the `selectedQueries` string array state and custom query input with:

```typescript
import { KeywordPicker } from "@/components/visibility/keyword-picker";

// Replace: const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
// With:
const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
```

**Step 2: Replace the query input section**

Replace the free-text input card (lines ~290-360 — the "Enter Queries" section with Input, Add button, and query toggle buttons) with:

```tsx
<KeywordPicker
  projectId={projectId}
  selectedIds={selectedKeywordIds}
  onSelectionChange={setSelectedKeywordIds}
/>
```

**Step 3: Update handleRunCheck**

The run handler needs to handle two types of selected IDs:

- Regular keyword IDs (UUIDs from `saved_keywords`)
- Persona query virtual IDs (`persona:{personaId}:{query}`)

For persona queries, the handler needs to save them as keywords first, then use the real IDs:

```typescript
async function handleRunCheck() {
  if (selectedKeywordIds.length === 0 || selectedProviders.length === 0) return;
  setLoading(true);
  setError(null);

  try {
    // Separate real keyword IDs from persona virtual IDs
    const realIds: string[] = [];
    const personaQueries: string[] = [];
    for (const id of selectedKeywordIds) {
      if (id.startsWith("persona:")) {
        const query = id.split(":").slice(2).join(":");
        personaQueries.push(query);
      } else {
        realIds.push(id);
      }
    }

    // Save persona queries as keywords first
    if (personaQueries.length > 0) {
      const saved = await api.keywords.createBatch(projectId, personaQueries);
      realIds.push(...saved.map((k) => k.id));
    }

    await withAuth(async () => {
      const data = await api.visibility.run({
        projectId,
        keywordIds: realIds,
        providers: selectedProviders,
      });
      setResults(data);
    });

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

**Step 4: Update the cost indicator**

Change from `selectedQueries.length` to `selectedKeywordIds.length`:

```tsx
<p className="text-xs text-muted-foreground">
  {selectedKeywordIds.length} queries × {selectedProviders.length} providers ={" "}
  {selectedKeywordIds.length * selectedProviders.length} checks
</p>
```

**Step 5: Update the Run button disabled state**

```tsx
disabled={loading || selectedKeywordIds.length === 0 || selectedProviders.length === 0}
```

**Step 6: Remove old imports and state**

Remove: `customQuery` state, `setCustomQuery`, `addCustomQuery` function, `curatedQueries` logic, and any imports only used by the old free-text input (e.g., `Input` if not used elsewhere).

**Step 7: Verify**

Run: `pnpm --filter @llm-boost/web typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): replace free-text query input with keyword picker"
```

---

### Task 10: Update auto-visibility-service to use keyword IDs

**Files:**

- Modify: `apps/api/src/services/auto-visibility-service.ts`

**Step 1: Update the auto-visibility service**

The existing auto-visibility service fetches saved keywords and calls the check endpoint with `query: keyword.keyword`. Update it to pass `keywordId` as well so checks are linked:

Find the part where it iterates over keywords and calls the visibility checker. Add `keywordId: keyword.id` to each `visibility.create()` call (or pass through to the service).

The exact change: in the loop where results are stored, ensure `keywordId` is passed:

```typescript
await visibilityQueries(db).create({
  projectId: input.projectId,
  llmProvider: result.provider as any,
  query: result.query,
  keywordId: keyword.id, // Add this
  responseText: result.responseText,
  brandMentioned: result.brandMentioned,
  urlCited: result.urlCited,
  citationPosition: result.citationPosition ?? null,
  competitorMentions: result.competitorMentions ?? [],
});
```

**Step 2: Verify**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api/src/services/auto-visibility-service.ts
git commit -m "feat(api): link auto-visibility checks to keyword IDs"
```

---

### Task 11: Full typecheck, lint, and test

**Files:** None (verification only)

**Step 1: Typecheck all packages**

Run: `pnpm typecheck`
Expected: 12/12 packages pass

**Step 2: Lint**

Run: `pnpm --filter @llm-boost/api lint && pnpm --filter @llm-boost/web lint`
Expected: No new errors (pre-existing warnings OK)

**Step 3: Test**

Run: `pnpm --filter @llm-boost/shared test`
Expected: All pass

Run: `pnpm --filter @llm-boost/api test`
Expected: Same pre-existing failures as main, no new failures

**Step 4: Commit any fixes**

If typecheck/lint found issues, fix and commit:

```bash
git commit -m "fix: address typecheck/lint issues from keyword-based visibility"
```
