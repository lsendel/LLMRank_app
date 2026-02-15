# System Audit & Auth Cleanup Design

**Date:** 2026-02-14
**Goal:** Full end-to-end system audit — remove Clerk, wire up Better Auth with cookie-based sessions, verify every page and the crawl-to-report pipeline.

## Current State

- Better Auth is implemented in API (`apps/api/src/lib/auth.ts`) and web (`apps/web/src/lib/auth-client.ts`)
- `@clerk/nextjs` is still in web's `package.json` but never actually imported — tsconfig path aliases redirect it to `mock-clerk.tsx`
- `mock-clerk.tsx` wraps Better Auth to mimic Clerk's API (`useAuth`, `useUser`, `SignedIn`, etc.)
- Dashboard auth guards are **commented out** ("MOCK AUTH")
- `use-api.ts` and `use-api-swr.ts` inject tokens via `getToken()` — unnecessary with cookie-based auth
- Homepage imports `SignedIn`/`SignedOut` from `@clerk/nextjs` (aliased to mock-clerk)

## Design

### Phase 1: Auth Cleanup (Cookie-Based)

**Key decision:** Better Auth uses cookies natively. Switch all API calls to `credentials: 'include'` — no more token threading.

1. **Remove `@clerk/nextjs`** from `apps/web/package.json`
2. **Remove tsconfig path aliases** for `@clerk/nextjs` and `@clerk/nextjs/server`
3. **Create `apps/web/src/lib/auth-hooks.ts`** — clean auth hooks module:
   - `useAuth()` → `{ userId, isSignedIn, isLoaded, signOut }`
   - `useUser()` → `{ user, isLoaded, isSignedIn }`
   - `SignedIn` / `SignedOut` — conditional render components
   - `UserButton` — avatar + sign out
4. **Simplify `api.ts`** — remove `token` param from all methods, add `credentials: 'include'` to `request()`
5. **Simplify `use-api.ts`** — no token injection, just call the function
6. **Simplify `use-api-swr.ts`** — no token injection
7. **Update all 25+ consumer files** — remove `(token) =>` callbacks
8. **Update root layout** — remove `MockClerkProvider`, use plain wrapper or AuthProvider if needed
9. **Update homepage** — import `SignedIn`/`SignedOut` from `@/lib/auth-hooks`
10. **Re-enable dashboard auth guard** — check session, redirect if not authenticated
11. **Add Next.js middleware** — protect `/dashboard/*` routes
12. **Delete** `mock-clerk.tsx`, `mock-clerk-server.ts`
13. **Remove onboarding gate** — go straight to dashboard (phone check removed)

### Phase 2: Page-by-Page Verification

Walk each user journey, fix broken imports/types:

| Flow           | Pages                                     | Verify                               |
| -------------- | ----------------------------------------- | ------------------------------------ |
| Landing        | `/`                                       | Auth-aware nav                       |
| Sign Up        | `/sign-up`                                | Creates user, redirects to dashboard |
| Sign In        | `/sign-in`                                | Email/password + Google OAuth        |
| Dashboard      | `/dashboard`                              | Stats load, auth works               |
| New Project    | `/dashboard/projects/new`                 | Form → API → redirect                |
| Project List   | `/dashboard/projects`                     | Pagination, links                    |
| Project Detail | `/dashboard/projects/[id]`                | Latest crawl, scores                 |
| Crawl Status   | `/dashboard/crawl/[id]`                   | Status, quick wins                   |
| Pages List     | `/dashboard/projects/[id]/pages`          | Table, sorting                       |
| Page Detail    | `/dashboard/projects/[id]/pages/[pageId]` | All 8 sections                       |
| Settings       | `/dashboard/settings`                     | Billing, subscription                |
| Admin          | `/dashboard/admin`                        | Stats, ingest, customers             |
| Public Scan    | `/scan` → `/scan/results`                 | No auth required                     |
| Shared Report  | `/report/[token]`                         | Public access                        |

### Phase 3: Pipeline & Build Verification

1. `pnpm typecheck` — all packages compile
2. `pnpm test` — existing tests pass
3. `pnpm build` — web and API build succeed
4. Verify API middleware reads Better Auth cookies correctly
5. Verify CORS allows credentials for cross-origin (if API and web on different origins)

## Files Changed

### Deleted

- `apps/web/src/lib/mock-clerk.tsx`
- `apps/web/src/lib/mock-clerk-server.ts`

### Created

- `apps/web/src/lib/auth-hooks.ts` — clean Better Auth hooks
- `apps/web/src/middleware.ts` — route protection

### Modified (major)

- `apps/web/package.json` — remove `@clerk/nextjs`
- `apps/web/tsconfig.json` — remove path aliases
- `apps/web/src/lib/api.ts` — cookie-based, remove token params
- `apps/web/src/lib/use-api.ts` — simplified
- `apps/web/src/lib/use-api-swr.ts` — simplified
- `apps/web/src/app/layout.tsx` — remove MockClerkProvider
- `apps/web/src/app/page.tsx` — import from auth-hooks
- `apps/web/src/app/dashboard/layout.tsx` — re-enable auth guard

### Modified (token removal)

- All 25+ dashboard pages and components that use `useApi`/`useApiSWR`

## Risks

- **CORS:** If API (port 8787) and web (port 3000) are on different origins, `credentials: 'include'` requires proper CORS headers with `Access-Control-Allow-Credentials: true` and specific origin (not `*`)
- **Server components:** Better Auth's `useSession` is client-only. Server components (like dashboard layout) need to read the session cookie directly or use Better Auth's server-side API
- **Existing tests:** API tests mock auth middleware — should still work since middleware interface doesn't change
