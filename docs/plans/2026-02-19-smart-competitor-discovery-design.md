# Smart Competitor Discovery

**Date:** 2026-02-19
**Status:** Approved

## Problem

The current competitor discovery relies on Claude Haiku guessing competitors from just a domain name — no real-time search, no understanding of what the site actually does. Users have to manually add competitors, and new projects start with no competitive context.

## Design

### Site Description Detection

After the first crawl completes, a new `auto-site-description-service` runs in the post-processing pipeline:

1. Gathers page titles, H1s, meta descriptions, and the AI-generated `summary` from the crawl
2. Uses Haiku to generate a 1-sentence site description + detected industry/niche
3. Stores on the `projects` table in two new columns: `siteDescription TEXT` and `industry TEXT`
4. User can edit both in project settings

If the AI returns a generic result, the competitors tab shows: "We couldn't determine what your site does. Add a description in settings for better competitor discovery."

### Competitor Discovery via Perplexity + Grok

The existing `auto-competitor-service` is upgraded:

1. Queries Perplexity (Sonar model, real-time search) and Grok (X/social data) with: "What are the top 5 direct competitors to [domain] in the [industry] space? Return only domain names."
2. Merges and deduplicates results from both providers
3. Takes up to the plan's competitor limit
4. Validates each domain (resolves, not the user's own domain, not a generic site like wikipedia.org)
5. Auto-benchmarks each discovered competitor (existing flow)
6. Falls back to Haiku-based approach if both APIs fail

### Notification Card

On the competitors tab, when auto-discovered competitors exist and the user hasn't dismissed the notification:

```
+----------------------------------------------------+
| We found 3 competitors for you                     |
|                                                    |
| Based on your site's niche (project management),   |
| we identified these competitors:                   |
|                                                    |
|   monday.com (benchmarked: B+)                     |
|   asana.com (benchmarked: A-)                      |
|   clickup.com (benchmarked: B)                     |
|                                                    |
| [Looks Good]  [Edit in Settings]            [x]    |
+----------------------------------------------------+
```

Dismissable via localStorage (same `useSyncExternalStore` pattern as other banners).

### User Override in Project Settings

A new "Site Context" section in project settings:

- **Site Description** — text input, pre-filled by AI, user can edit
- **Industry** — text input, pre-filled by AI, user can edit
- When user updates either field, a "Re-discover competitors" button appears
- Clicking it re-runs the competitor discovery with the updated context

### Schema Changes

```sql
ALTER TABLE projects ADD COLUMN site_description TEXT;
ALTER TABLE projects ADD COLUMN industry TEXT;
```

### Affected Files

**Backend (apps/api):**

- `services/auto-site-description-service.ts` — New: detect site purpose from crawl data
- `services/auto-competitor-service.ts` — Upgrade: use Perplexity + Grok instead of Haiku-only
- `services/post-processing-service.ts` — Wire auto-site-description-service
- `routes/projects.ts` — Add PATCH for siteDescription/industry fields
- `routes/competitors.ts` — Add POST re-discover endpoint

**Frontend (apps/web):**

- `components/competitor-discovery-banner.tsx` — New: notification card for auto-discovered competitors
- `components/tabs/competitors-tab.tsx` — Add banner integration
- Project settings page — Add Site Context section with description/industry fields
- `lib/api.ts` — Add new methods

**Database (packages/db):**

- `schema.ts` — Add `siteDescription` and `industry` to projects table
- `queries/projects.ts` — Update methods to handle new fields

**LLM (packages/llm):**

- Perplexity and Grok providers already exist — reuse for competitor queries
