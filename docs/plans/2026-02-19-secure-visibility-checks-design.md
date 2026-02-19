# Secure Keyword-Based Visibility Checks

**Date:** 2026-02-19
**Status:** Approved

## Problem

The current "Run visibility check" flow has three issues:

1. **Prompt injection risk** — Users type free-text queries sent raw to LLM APIs (Anthropic, OpenAI, etc.). No validation, no length limit, no sanitization at any layer.
2. **Poor onboarding** — New projects show an empty text box with no guidance. Users don't know what queries to check.
3. **Friction** — Users must manually type every query. No pre-populated suggestions.

## Design

### Core Change: No Free-Text Queries

Replace the free-text input with a keyword picker. Users select from three DB-sourced groups:

| Source              | Origin                   | How it gets there                                                                 |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| **Your Keywords**   | `saved_keywords` table   | Auto-generated on first crawl, or manually added via keyword manager              |
| **Persona Queries** | `personas.sampleQueries` | Auto-generated personas (existing feature)                                        |
| **AI Suggestions**  | On-demand Haiku call     | User clicks "Suggest more" → AI generates 5-10 queries → user picks which to save |

### API Change

`POST /api/visibility/check` changes from:

```json
{ "projectId": "...", "query": "free text", "providers": ["chatgpt", "claude"] }
```

to:

```json
{
  "projectId": "...",
  "keywordIds": ["uuid-1", "uuid-2"],
  "providers": ["chatgpt", "claude"]
}
```

Server resolves keyword IDs to query text from the database. The client never sends query text at check time.

### Auto-Generated Keywords on First Crawl

A new `auto-keyword-service` runs in the post-processing pipeline when a crawl completes:

- Uses Haiku with domain + page titles/H1s from crawl data
- Generates 5-10 seed keywords across funnel stages (education, comparison, purchase)
- Saves to `saved_keywords` with `source: "auto_discovered"`
- Skips if keywords already exist (same guard pattern as auto-personas)

Result: Keyword picker is pre-populated on first visit.

### "Suggest More" AI Feature

When user clicks "Suggest more queries":

1. Frontend calls `POST /api/visibility/:projectId/suggest-keywords`
2. Backend uses Haiku with domain + existing keywords (to deduplicate)
3. Returns 5-10 temporary suggestions (not yet saved)
4. User checks which ones to keep → clicks "Add selected" → saves to `saved_keywords`
5. Free unlimited, no plan gating (Haiku cost ~$0.001/call)

### Keyword Picker UX

A card with three collapsible sections:

```
┌──────────────────────────────────────────────┐
│ Select Queries                               │
├──────────────────────────────────────────────┤
│ ▼ Your Keywords (8)                          │
│   ☑ best project management software         │
│   ☑ project management tool comparison       │
│   ☐ agile project management for startups    │
│   ☐ ...                                      │
│                                              │
│ ▼ Persona Queries (6)                        │
│   ☐ what's the easiest PM tool for solopren  │
│   ☐ enterprise project management with SSO   │
│   ☐ ...                                      │
│                                              │
│ ▶ AI Suggestions (click to load)             │
│                                              │
│ [Select All]  [Clear]     4 queries selected │
└──────────────────────────────────────────────┘
```

- Each keyword has a checkbox
- Sections are collapsible, "Your Keywords" expanded by default
- "AI Suggestions" section loads on click (calls suggest endpoint)
- Bottom shows selected count + Select All / Clear controls

### Security Model

| Layer               | Protection                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**        | No free-text input for checks. Only checkboxes on DB-sourced keywords                                                                                         |
| **API (check)**     | Accepts `keywordIds: UUID[]` only. Resolves from DB server-side                                                                                               |
| **API (suggest)**   | AI suggestions returned as options, not executed. User must explicitly save                                                                                   |
| **DB**              | Keywords created only via controlled paths: auto-gen, AI suggest + approval, keyword manager                                                                  |
| **Keyword manager** | Manual keyword input validated: max 200 chars, alphanumeric + basic punctuation, block injection patterns (`ignore previous`, `system:`, `<\|`, `INST`, etc.) |
| **LLM calls**       | Query text comes from DB, never from client request body                                                                                                      |

### Backward Compatibility

- Keep `query` text field on `visibility_checks` table (stores resolved text for display)
- Add `keywordId UUID` FK column linking check → keyword
- Old checks: keep `query` text, `keywordId` = null
- Scheduled checks: add `keywordIds UUID[]` column, deprecate `query TEXT`
- Old schedules continue running via their existing `query` field until migrated

### Schema Changes

```sql
-- Add keyword reference to visibility checks
ALTER TABLE visibility_checks ADD COLUMN keyword_id UUID REFERENCES saved_keywords(id);

-- Add keyword IDs to scheduled checks
ALTER TABLE scheduled_visibility_queries ADD COLUMN keyword_ids UUID[];
```

### Affected Files

**Backend (apps/api):**

- `routes/visibility.ts` — Change POST /check to accept keywordIds, add POST /suggest-keywords
- `services/auto-keyword-service.ts` — New: auto-generate keywords after crawl
- `services/post-processing-service.ts` — Wire auto-keyword-service
- `routes/keywords.ts` — Add input validation (injection patterns, length)

**Frontend (apps/web):**

- `components/tabs/visibility-tab.tsx` — Replace free-text input with keyword picker
- `components/visibility/keyword-picker.tsx` — New: grouped checkbox picker component
- `lib/api.ts` — Update check method signature, add suggest-keywords method

**Database (packages/db):**

- `schema.ts` — Add `keywordId` to visibility_checks, `keywordIds` to scheduled queries
- `queries/visibility.ts` — Update insert to include keywordId
- `queries/keywords.ts` — Add keyword validation helpers

**Shared (packages/shared):**

- Add keyword validation constants (max length, blocked patterns)
