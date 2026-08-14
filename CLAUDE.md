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
(currently 10 files, covering `utils`, `deeplinks`, the `anonLinks` hook, and the measurement layer:
`gtm`, `sgtm`, `forwardParams`, `shortLinkAttribution`). Add tests for pure/logic functions; there is
no component/E2E harness.

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

Optional, for the measurement layer (see "Measurement and Tagging" below). Every one of these
degrades to "tagging disabled" when unset, nothing errors:
```
NEXT_PUBLIC_GTM_ID=               # public, GTM web container ID (e.g. GTM-XXXXXXX)
SGTM_ENDPOINT=                    # server-only, GTM server container base URL
GA4_MEASUREMENT_ID=               # server-only, GA4 property the server container forwards to
SGTM_CID_SALT=                    # server-only, salt for the derived cookieless client ID
SHORTLINK_AUTOTAG=                # optional, `off` disables default utm auto-tagging (anything else, or unset, leaves it on)
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

### Measurement and Tagging

Two GTM containers, shared with the rest of the business rather than tws.bio-only:
- Web container `GTM-P3PR2NBT` ("Trading with Sidhant", also used by tradingwithsidhant.com). Reports into GA4 `G-L7PYFJM9QB` via `transport_url` pointed at the server container.
- Server container `GTM-PTXDM3M7` at `https://sgtm.tradingwithsidhant.com`. Its GA4 client claims `/g/collect`; an "All GA4 client events" trigger forwards everything on to GA4.

**Client-side path**: `src/lib/gtm.ts` exports `GTM_ID` (shape-checked against `/^GTM-[A-Z0-9]+$/`), `gtmEvent()`, `ensureDataLayer()`, and `TWS_EVENTS`. `src/components/analytics/GoogleTagManager.tsx` exports `GoogleTagManager` and `GoogleTagManagerNoScript`, rendered from `src/app/layout.tsx`. Both render null when `NEXT_PUBLIC_GTM_ID` is unset, so local dev and preview deploys stay free of third-party calls.

**Server-side click path**: a short link is a 302, so there is no page to run the web container's tag on. `src/lib/sgtm.ts` posts a GA4 Measurement Protocol v2 hit straight from the `[shortCode]` redirect's `after()` block to the server container (`sendClickToServerContainer`, event `short_link_click`). The client ID is derived from IP + user agent + `SGTM_CID_SALT` (`deriveClientId`), since a server hit has no cookie to read; the session ID buckets by a 30-minute window (`deriveSessionId`). `isLikelyBot()` drops crawler and uptime-monitor traffic before it reaches GA4.

**Naming constraint (important)**: the server container forwards a whitelist of standard GA4/Meta event names on to the Meta Conversions API (pixel `1139413964970750`) as business conversions. tws.bio is an internal link tool, not a storefront, so every dataLayer event it emits is prefixed `tws_` (see `TWS_EVENTS`) and the server click event is named `short_link_click`, both deliberately off that whitelist. Anyone adding a new event must keep its name off the whitelist, or internal tool activity gets counted as a business conversion. A tag in the web container fires a GA4 event on any custom dataLayer event (regex `.+`, `gtm.` excluded), so new `tws_*` events reach GA4 with no container change required.

**Attribution forwarding and auto-tagging**: `src/lib/forwardParams.ts` forwards an explicit allowlist of inbound `utm_*` params and vendor click IDs (`gclid`, `fbclid`, `ttclid`, ...) through to the destination, so a paid click keeps its attribution. `src/lib/shortLinkAttribution.ts` stamps default `utm_source`/`utm_medium`/`utm_campaign` on links that arrive with none, naming the individual short link instead of letting GA4 file the visit as `tws.bio / referral`. `resolveDestination()` in `route.ts` runs both, in order: forward the click's own params first, then stamp defaults only if neither the destination nor the click already carries a `utm_source`/`medium`/`campaign`. Kill switch: `SHORTLINK_AUTOTAG=off`, takes effect on the next request, no deploy.

### Security in Redirect Handler

The `[shortCode]/route.ts` handler validates URLs against a `SAFE_DEEP_LINK_SCHEMES` allowlist and `BLOCKED_HOSTNAMES` regex, rejects `javascript:`, `data:`, and `vbscript:` schemes, and sets `Content-Security-Policy` and `X-Frame-Options: DENY` headers on deep link HTML responses.

### Database Tables

- `links` — short_code, original_url, ios/android deep links, fallback_url, link_type enum, total_clicks
- `clicks` — per-click records (ip_address, user_agent, browser_name, os_name, device_type, referrer_url)
- `profiles` — extends auth.users (email, full_name, avatar_url)

Ghost tables (exist in schema but not wired into the app): `custom_domains`, `api_keys`. Ghost columns on `links`: `password_hash`, `unique_clicks`, `custom_meta`, `tags`, `qr_code_url`.

RLS is enabled on all tables. `SECURITY DEFINER` RPCs (`create_link`, `create_deep_link`, `get_link_by_short_code`, `record_click_and_increment`) bypass RLS intentionally — all have `SET search_path = 'public'` to prevent search path injection. The analytics aggregation RPCs (`get_clicks_over_time`, `get_*_breakdown`, `get_total_clicks`) are SECURITY INVOKER on purpose so clicks RLS applies. Anonymous SELECT on `links` is disabled (owner-only policy); the redirect path uses `get_link_by_short_code`.

Migrations are in `supabase/migrations/` (001–020 + a timestamped drop). The remote DB is managed via the Supabase MCP `apply_migration` tool (tracked migration history); local files are the canonical intent but the remote drifted historically — always preflight actual remote state (`pg_proc`, `pg_indexes`, `pg_policies`) before applying. All migrations through 020 were applied to production (020 on 2026-07-18: ownership consolidation to the active user account, `youtube:///` URI repair, `total_clicks` reconciliation, unconditional counter increment in `record_click_and_increment`; pre-repair state snapshotted in `_repair_backup_20260718`).

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
- A tag-server outage surfaces only as a `console.error` from `route.ts` (`'failed'` is logged, `'skipped'` deliberately is not). There is no alert on it, so a sustained GA4 gap is found by reading logs, not by being told
