# Production Deployment Design — llmrank.app

**Date:** 2026-02-13
**Scope:** Frontend + Workers API + Neon DB live. Crawler deferred.

## Architecture

```
Cloudflare Workers (OpenNext)         Cloudflare Workers (Hono)
┌─────────────────────────┐          ┌──────────────────────┐
│ Next.js 15 Frontend     │──fetch──►│ llm-boost-api        │
│ @opennextjs/cloudflare  │          │ Neon PG / R2 / KV    │
│ llmrank.app             │          │ api.llmrank.app      │
└─────────────────────────┘          └──────────────────────┘
```

## Decisions

- **@opennextjs/cloudflare** over @cloudflare/next-on-pages — Cloudflare's current recommendation, deploys Next.js as a Worker, full App Router support without edge runtime requirement.
- **Cloudflare native CI** — Git integration from Cloudflare dashboard for auto-deploy on push.
- **Stripe test mode** — Billing UI fully functional with test keys; switch to live when ready.
- **Clerk auth** — Email + Google + GitHub sign-in.
- **Crawler deferred** — Crawl endpoints exist in API but return graceful "crawler offline" status. Dashboard shows appropriate messaging.

## External Service Setup (Manual)

1. **Clerk** — Create app at dashboard.clerk.com with email, Google OAuth, GitHub OAuth. Get `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. **Stripe** — Create 3 products in test mode: Starter ($79/mo), Pro ($149/mo), Agency ($299/mo). Get `STRIPE_SECRET_KEY` and price IDs.
3. **Cloudflare** — Create KV namespace (`llm-boost-cache`), R2 bucket (`ai-seo-storage`). Set wrangler secrets: `DATABASE_URL`, `SHARED_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
4. **Domain** — Route `llmrank.app` to frontend Worker, `api.llmrank.app` to API Worker.

## Code Changes

### 1. Frontend: Add OpenNext adapter

- Install `@opennextjs/cloudflare` + `wrangler`
- Add `wrangler.jsonc` with nodejs_compat flag
- Add `open-next.config.ts`
- Update build scripts

### 2. Frontend: Wire up API integration

Replace all hardcoded placeholder data with real API calls:

- **Dashboard home** — GET /api/projects aggregate stats
- **Projects list** — GET /api/projects
- **Create project** — POST /api/projects
- **Project detail** — GET /api/projects/:id (tabs: overview, pages, issues)
- **Pages list** — GET /api/pages (per project)
- **Issues list** — GET /api/pages/:id/issues
- **Start crawl** — POST /api/crawls (graceful "crawler offline" handling)
- **Crawl status** — GET /api/crawls/:id (polling)
- **Billing** — POST /api/billing/checkout, GET /api/billing/usage, POST /api/billing/portal
- **Settings** — user preferences

Each page gets: loading skeleton, error state, empty state.

### 3. API: Environment + CORS

- Configure CORS to allow `llmrank.app` origin
- Add `NEXT_PUBLIC_API_URL` env var for frontend
- Ensure all routes return proper error envelopes
- Crawl dispatch returns 503 with message when CRAWLER_URL is empty

### 4. Database

- Run `drizzle-kit push` against production Neon DB
- Verify all 7 tables created correctly

## Deploy Sequence

1. Push DB schema to Neon
2. Deploy API Worker (`wrangler deploy` from packages/api/)
3. Verify API health: `curl https://api.llmrank.app/api/health`
4. Deploy frontend via Cloudflare Git integration
5. Verify: https://llmrank.app loads, auth works, dashboard renders
