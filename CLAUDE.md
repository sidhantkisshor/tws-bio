# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tws.bio is a URL shortener with analytics and mobile deep linking, built with Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, and Supabase (PostgreSQL + Auth).

## Commands

```bash
npm run dev       # Start dev server (Next.js)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint 10 (flat config, eslint.config.mjs)
npm run test      # Vitest (run mode) — unit tests for pure functions
npm run typecheck # tsc --noEmit
```

Testing uses **Vitest** (`vitest.config.ts`, `environment: node`). Specs live in `src/**/__tests__/`
(currently 4 files / 46 tests covering `utils`, `deeplinks`, and the `anonLinks` hook). Add tests
for pure/logic functions; there is no component/E2E harness.

**Runtime:** Node 22 is pinned via `engines.node` (`>=22.13.0 <23.0.0`) and `.nvmrc`. This floor is
required by ESLint 10; Vercel and local dev should run Node 22.x.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=              # e.g. http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=         # e.g. tws.bio
```

## Architecture

### Supabase Client Pattern (critical)

Three distinct Supabase clients exist — never mix them:
- `src/lib/supabase/client.ts` — Browser client (`createBrowserClient`), for Client Components and hooks
- `src/lib/supabase/server.ts` — Server client (async, uses `cookies()` from `next/headers`), for Server Components and Route Handlers
- `src/lib/supabase/middleware.ts` — Middleware client (operates on `NextRequest`), only used by `src/proxy.ts`

### Middleware

The session-refresh middleware lives in `src/proxy.ts` (exports `proxy` function + route matcher config). Next.js 16 picks this up as a "Proxy (Middleware)" — visible in the build output. This is a Next.js 16 convention; if downgrading, rename to `src/middleware.ts`.

### Route Structure

| Route | Type | Purpose |
|---|---|---|
| `/` | Server Component + Client islands | Home page with link creation form |
| `/login` | Client Component | Email/password + Google OAuth login |
| `/signup` | Client Component | Registration |
| `/dashboard` | Server Component | Auth-guarded, fetches user's links server-side via `redirect('/login')` |
| `/[shortCode]` | Route Handler (GET) | Core redirect logic + deep link handling + analytics tracking |
| `/auth/callback` | Route Handler (GET) | PKCE OAuth code exchange |
| `/auth/signout` | Route Handler | Signs out user, clears session |

### Server/Client Boundary Pattern

The home page demonstrates the app's core split: `page.tsx` is a Server Component that renders `HomeInteractive` — the Client boundary. `HomeInteractive` wraps `useAuth()` + `useLinks()` hooks and passes state down to `CreateLinkForm` and `LinksList`. This keeps the page shell server-rendered while isolating interactivity.

### Key Data Flow

1. **Link creation**: Requires authentication. Client calls `create_link` or `create_deep_link` Supabase RPC (SECURITY DEFINER); since migration 019 both reject callers with no session (`auth.uid() IS NULL` → "You must be signed in to create links") and always own the row to the caller via `COALESCE(p_user_id, auth.uid())`. These RPCs are the only write path to `links` (direct INSERT is blocked by RLS), so this holds for raw REST calls too. `CreateLinkForm` shows a sign-in/create-account gate to anonymous visitors instead of the form. The `anon_links` localStorage system + `get_links_by_ids` RPC now only surface links created anonymously *before* migration 019 — no new anonymous links can be created.
2. **Redirect**: `GET /[shortCode]` looks up active link → for deep links, returns HTML page with JS redirect + fallback timeout; for standard links, `NextResponse.redirect()`
3. **Analytics**: Tracked asynchronously via `after()` callback during redirect — calls `record_click` RPC (inserts into `clicks`) + `increment_link_clicks` RPC
4. **Auth**: Email/password or Google OAuth → PKCE exchange at `/auth/callback` → session refreshed by middleware on every request. Sign-out uses `<form action="/auth/signout" method="post">` for progressive enhancement. Auth redirect routes resolve origin from `NEXT_PUBLIC_APP_URL` with fallback to `requestUrl.origin`.
5. **Dashboard**: Server-side paginated (PAGE_SIZE 20) using async `searchParams` — fully server-rendered, no client JS

### Deep Link System

`src/lib/deeplinks.ts` maps 30+ platform URLs to native app URI schemes (iOS/Android). `CreateLinkForm` calls `detectDeepLinks()` on URL input change to auto-fill deep link fields and switch form mode.

### Security in Redirect Handler

The `[shortCode]/route.ts` handler validates URLs against a `SAFE_DEEP_LINK_SCHEMES` allowlist and `BLOCKED_HOSTNAMES` regex, rejects `javascript:`, `data:`, and `vbscript:` schemes, and sets `Content-Security-Policy` and `X-Frame-Options: DENY` headers on deep link HTML responses.

### Database Tables

- `links` — short_code, original_url, ios/android deep links, fallback_url, link_type enum, total_clicks
- `clicks` — per-click records (ip_address, user_agent, browser_name, os_name, device_type, referrer_url)
- `profiles` — extends auth.users (email, full_name, avatar_url)

Ghost tables (exist in schema but not wired into the app): `custom_domains`, `api_keys`. Ghost columns on `links`: `password_hash`, `unique_clicks`, `custom_meta`, `tags`, `qr_code_url`.

RLS is enabled on all tables. `SECURITY DEFINER` RPCs (`create_link`, `create_deep_link`, `get_link_by_short_code`, `record_click_and_increment`) bypass RLS intentionally — all have `SET search_path = 'public'` to prevent search path injection. The analytics aggregation RPCs (`get_clicks_over_time`, `get_*_breakdown`, `get_total_clicks`) are SECURITY INVOKER on purpose so clicks RLS applies. Anonymous SELECT on `links` is disabled (owner-only policy); the redirect path uses `get_link_by_short_code`.

Migrations are in `supabase/migrations/` (001–016 + a timestamped drop). The remote DB is managed via the Supabase MCP `apply_migration` tool (tracked migration history); local files are the canonical intent but the remote drifted historically — always preflight actual remote state (`pg_proc`, `pg_indexes`, `pg_policies`) before applying. All migrations through 016 were applied to production on 2026-07-15.

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Components**: Named exports (not default), props typed with inline interfaces. Exception: `page.tsx` files use `export default` (Next.js requirement)
- **DB types**: Derived from `Database` type in `src/types/database.ts` — e.g. `Database['public']['Tables']['links']['Row']`
- **Styling**: Inline Tailwind utility classes only, blue-600 as primary action color
- **Short codes**: 6-char alphanumeric random string; custom codes are lowercase alphanumeric + hyphens
- **Utility functions**: `cn()`, `generateShortCode()`, `getShortUrl()`, `isValidUrl()` in `src/lib/utils.ts`

## Known Issues

- Ghost columns on `links` table (`password_hash`, `unique_clicks`, `custom_meta`, `tags`, `qr_code_url`) are unused — harmless but add schema noise
- `unique_clicks` on `links` is always 0 — no logic increments it
- `custom_domains` and `api_keys` tables exist but have no application code
- No rate limiting on link creation or redirect endpoints (would require Redis/Upstash)
- `clicks` rows recorded before 2026-07-15 have raw IPs, NULL `referrer_domain`, and NULL `country`; newer rows get masked IPs, derived referrer domains, and country from Vercel's `x-vercel-ip-country` header (migration 017 — country stays NULL in local dev where the header is absent)
- Anonymous users' home-page link list goes through the `get_links_by_ids(uuid[])` definer RPC (migration 018) since direct `links` reads are owner-only under RLS — possession of a link UUID is treated as proof of creation
