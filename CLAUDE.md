# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tws.bio is a URL shortener with analytics and mobile deep linking, built with Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, and Supabase (PostgreSQL + Auth).

## Commands

```bash
npm run dev       # Start dev server (Next.js)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint 10 (flat config, eslint.config.mjs): typescript-eslint recommended, Next.js rules, react-hooks
npm run test      # Vitest (run mode), unit tests for pure functions and the redirect routes
npm run typecheck # tsc --noEmit
```

`next build` (Next.js 16) does not run ESLint and there is no CI, so run `npm run lint`,
`npm run typecheck` and `npm run test` before pushing.

Testing uses **Vitest** (`vitest.config.ts`, `environment: node`). Specs live in `src/**/__tests__/`.
They cover the two redirect route handlers (`[shortCode]` and `r/[slug]`, run with Supabase and
`after()` mocked), URL safety (`redirectSafety`, `utils`), short codes (including checks that every
top-level route is reserved and that migration 027's SQL list matches), the measurement layer
(`sgtm`, `forwardParams`, `shortLinkAttribution`, `clickContext`), `deeplinks`, `resourceDrop`,
`userAgent`, the dashboard's date windows and filters (`analytics`, `linkFilters`), the Edit Link
checks (`linkEdit`) and the session cookie check in `useAuth`. Add tests for pure/logic functions;
there is no component/E2E harness.

**Runtime:** Node 24 is pinned via `engines.node` (`^24.0.0`) and `.nvmrc`. Vercel reads
`engines.node` and builds with it, which is what actually decides the production runtime: the
project's dashboard "Node.js Version" setting still reads 22.x and is overridden. Keep the two
files in step, and check the build log after changing them, because a range Vercel cannot resolve
to a supported major (20.x, 22.x, 24.x) fails the build rather than falling back.

**Region:** functions are pinned to `bom1` (Mumbai) by `"regions"` in `vercel.json`, because the
Supabase database is in AWS `ap-south-1` (Mumbai) and most clicks come from India. Every
redirect waits on one database lookup, so a function in another region pays a cross-continent
round trip on every click: in `iad1` (the default) a short-link lookup took about 1 second.
Keep the function region next to the database. Check it on a live response: `X-Vercel-Id`
reads `<edge>::<function region>::<id>`. Use one region only, a second one would sit far from
the database.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=              # e.g. http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=         # e.g. tws.bio
```

Optional, for server-side click measurement (see "Measurement and Tagging" below). Every one of
these degrades to "measurement disabled" when unset, nothing errors. There is no client-side
container ID here on purpose:
```
SGTM_CLICKS=                      # server-only, must be `on` to send clicks at all (off by default, see below)
SGTM_ENDPOINT=                    # server-only, GTM server container base URL
GA4_MEASUREMENT_ID=               # server-only, GA4 property the server container forwards to
SGTM_CID_SALT=                    # server-only, salt for the derived cookieless client ID
SHORTLINK_AUTOTAG=                # optional, `off` disables default utm auto-tagging (anything else, or unset, leaves it on)
```

## Architecture

### Supabase Client Pattern

Three Supabase clients exist, one per runtime. Each reads the auth session from a different place (browser cookies, `next/headers` cookies, the `NextRequest`), so use the one that matches where the code runs:
- `src/lib/supabase/client.ts` — Browser client (`createBrowserClient`), for Client Components and hooks
- `src/lib/supabase/server.ts` — Server client (async, uses `cookies()` from `next/headers`), for Server Components and Route Handlers
- `src/lib/supabase/middleware.ts` — Middleware client (operates on `NextRequest`), only used by `src/proxy.ts`

The two redirect route handlers (`[shortCode]` and `r/[slug]`) use a fourth kind: a module-level
anon `supabase-js` client with no session. They only call SECURITY DEFINER RPCs that anon may
execute, so they skip the cookie work on the hottest path. Every call they make has a timeout
(`.abortSignal(AbortSignal.timeout(...))`): 2.5 s for the link lookup, 5 s for the click write
(`CLICK_RPC_TIMEOUT_MS` in `src/lib/clickContext.ts`).

### Middleware

The session-refresh middleware lives in `src/proxy.ts` (exports `proxy` function + route matcher config). Next.js 16 picks this up as a "Proxy (Middleware)" — visible in the build output. This is a Next.js 16 convention; if downgrading, rename to `src/middleware.ts`.

### Route Structure

| Route | Type | Purpose |
|---|---|---|
| `/` | Server Component + Client islands | Home page with link creation form. Static |
| `/login` | Server Component + client form | Email/password + Google OAuth login. Static |
| `/signup` | Server Component | Invite-only notice. Sign-ups are disabled on the Supabase project and the owner creates accounts, so there is no registration form. Static |
| `/resources` | Server Component | Public list of trading tools and resources. Static |
| `/dashboard/*` | Server Components | Overview, links, link detail, analytics, campaigns, campaign detail, create. `dashboard/layout.tsx` guards them all (`redirect('/login')`); each has a `loading.tsx` skeleton |
| `/[shortCode]` | Route Handler (GET) | Core redirect logic + deep link handling + analytics tracking. Next.js also runs it for HEAD |
| `/r/[slug]` | Route Handler (GET) | TWS Resource Drop short links: 302 to `twsgurukulx.com/r/{slug}` without waiting on the DB (see `src/lib/resourceDrop.ts`). The Resource Drop Desk writes to the TWS CRM and cannot reach this database, so there is no link created up front. In `after()`, `resource_drop_link_id` (migration 021, definer, anon-callable) finds or creates a `links` row `short_code = 'r/{slug}'` tagged `resource-drop`, then `record_click_and_increment` logs the click. Bots skipped; creation capped at 20 new rows an hour. |
| `/auth/callback` | Route Handler (GET) | PKCE OAuth code exchange |
| `/auth/signout` | Route Handler | Signs out user, clears session |

### Server/Client Boundary Pattern

The home page demonstrates the app's core split: `page.tsx` is a Server Component that renders `HomeInteractive` — the Client boundary. `HomeInteractive` wraps `useAuth()` + `useLinks()` hooks and passes state down to `CreateLinkForm` and `LinksList`. This keeps the page shell server-rendered while isolating interactivity.

### Key Data Flow

1. **Link creation**: Requires authentication. Client calls `create_link` or `create_deep_link` Supabase RPC (SECURITY DEFINER); since migration 019 both reject callers with no session (`auth.uid() IS NULL` → "You must be signed in to create links") and always own the row to the caller via `COALESCE(p_user_id, auth.uid())`. These RPCs are the only write path to `links`: since migration 026 there is no INSERT policy, so RLS refuses a direct REST insert from anyone. `CreateLinkForm` shows a sign-in gate (accounts are invite-only) to anonymous visitors instead of the form. It also refuses a reserved code (`RESERVED_SHORT_CODES` in `src/lib/shortCodes.ts`: the app's own top-level route names, which Next.js serves before `[shortCode]`; migration 027 adds the same list as a CHECK) and a destination that is another tws.bio short link (`isValidUrl`). The `anon_links` localStorage system + `get_links_by_ids` RPC now only surface links created anonymously *before* migration 019. No new anonymous links can be created.
2. **Redirect**: `GET /[shortCode]` first checks that the path has the shape of a stored code (`hasShortCodeShape`), so `/favicon.ico`, `/robots.txt` and scanner probes get the branded 404 with no database call. Then it looks up the active link. A failed or timed-out lookup returns a logged 503 page with `Retry-After`, never "not found". An expired link, a link at its click limit, and a link whose destination or web fallback is the same short link (a loop) get a 410 page. Deep links get an Android intent redirect or the HTML page with a JS redirect and fallback timeout; standard links get a `no-store` 307. The status pages are in `src/lib/linkPages.ts`.
3. **Analytics**: Tracked asynchronously via `after()` callback during redirect. Calls the `record_click_and_increment` RPC (inserts into `clicks` and bumps `links.total_clicks` in one call). Only the three responses that send the visitor on record a click (307, Android intent, deep-link page), and only for a GET from a user agent that is not a bot or link preview (`shouldRecordClick` in `src/lib/clickContext.ts`). Click totals from before this filter shipped (October 2026) still include some bot and HEAD requests: they were left in on purpose.
4. **Auth**: Email/password or Google OAuth → PKCE exchange at `/auth/callback` → session refreshed by middleware on every request. Sign-out uses `<form action="/auth/signout" method="post">` for progressive enhancement. Auth redirect routes resolve origin from `NEXT_PUBLIC_APP_URL` with fallback to `requestUrl.origin`.
5. **Dashboard**: Server Components. Each page starts its queries together rather than one after another, and a query that fails shows an error card instead of failing the page. Charts (recharts) load lazily through `src/components/charts/lazy.tsx`, so recharts is in no first-load bundle. Days are India Standard Time days (`src/lib/analytics.ts`, and `get_clicks_over_time` since migration 022). The Links page is server-paginated (`PAGE_SIZE` 20) through async `searchParams`.
6. **Auth on public pages**: `useAuth` (`src/hooks/useAuth.ts`) checks `document.cookie` for a Supabase session cookie first. With none, it settles to signed-out without loading supabase-js, so anonymous visitors never download it.

### Deep Link System

`src/lib/deeplinks.ts` maps 30+ platform URLs to native app URI schemes (iOS/Android). `CreateLinkForm` calls `detectDeepLinks()` on URL input change to auto-fill deep link fields and switch form mode.

### Measurement and Tagging

tws.bio reports into the business's shared measurement stack. It uses exactly one piece of it:
- Server container `GTM-PTXDM3M7` at `https://sgtm.tradingwithsidhant.com`. Its GA4 client claims `/g/collect`; an "All GA4 client events" trigger forwards everything on to GA4 `G-L7PYFJM9QB`, the same property tradingwithsidhant.com reports into.
- Web container `GTM-P3PR2NBT` is the business's browser container. It is **not** installed here, on purpose (see below).

**There is deliberately no client-side tagging.** The app pages (`/`, `/dashboard/*`, `/login`, ...) load no GTM container, no GA4, no pixel and no session recorder, and push nothing to a dataLayer. tws.bio is a private link tool built to replace a Bitly subscription, not an audience source: the people using the app are the business itself, so there is no audience to build from them and no reason to hand a third party a record of internal work. Installing the shared web container here would also have fired the Meta pixel and Microsoft Clarity on every dashboard page, because those tags fire on all pages with no hostname condition. Do not add a container here without deciding that question again.

What tws.bio measures is the **click**, not the app. That path is server-side and runs whether or not anyone has the dashboard open.

**Server-side click path**: a short link is a redirect, so there is no page to run the web container's tag on. `src/lib/sgtm.ts` posts a GA4 Measurement Protocol v2 hit straight from the `[shortCode]` redirect's `after()` block to the server container (`sendClickToServerContainer`, event `short_link_click`). The client ID is derived from IP + user agent + `SGTM_CID_SALT` (`deriveClientId`), since a server hit has no cookie to read; the session ID buckets by a 30-minute window (`deriveSessionId`). `isLikelyBot()` drops crawler and uptime-monitor traffic before it reaches GA4, and `shouldRecordClick()` uses it to keep the same traffic out of the `clicks` table.

**This path is off by default.** It only sends when `SGTM_CLICKS=on` (`isClickTaggingEnabled`). A cookieless server hit cannot join the visitor's browser session, so in the shared property G-L7PYFJM9QB each click shows up as a new user with an "Unassigned / (not set)" session and drowns the real website numbers. Clicks are still stored in the `clicks` table, and the destination visit keeps the link's `utm_*` tags. Before you turn this back on, point `GA4_MEASUREMENT_ID` at a separate GA4 property.

**Naming constraint (important)**: the server container forwards a whitelist of standard GA4/Meta event names on to the Meta Conversions API (pixel `1139413964970750`) as business conversions. The whitelist includes `page_view`, `sign_up` and `purchase`. tws.bio is an internal link tool, not a storefront, so its server click event is named `short_link_click`, deliberately off that whitelist. Any new event sent from here must stay off it, or tool activity gets counted as a business conversion and corrupts Meta's ad optimisation.

**Attribution forwarding and auto-tagging**: `src/lib/forwardParams.ts` forwards an explicit allowlist of inbound `utm_*` params and vendor click IDs (`gclid`, `fbclid`, `ttclid`, ...) through to the destination, so a paid click keeps its attribution. `src/lib/shortLinkAttribution.ts` stamps default `utm_source`/`utm_medium`/`utm_campaign` on clicks that arrive with none: `utm_medium=short_link` and `utm_campaign=<short code>`, so GA4 can name the individual link. `utm_source` is the site the link was clicked on, from the click's `Referer` (`attributionSource`): the host without `www.`, or the app's package name for an `android-app://` referrer. The standard redirect is a 307, and a browser keeps the original page as the referrer across it, so a fixed `tws.bio` here would erase the real platform (YouTube, Instagram) in GA4. With no referrer, or a referrer on tws.bio itself, `utm_source` is `tws.bio`. A click from one of the business's own sites (`BUSINESS_DOMAINS`: tradingwithsidhant.com, twsgurukulx.com, hitpoint.app and their subdomains, all in one GA4 property) gets nothing stamped, so the session keeps the source that brought the visitor there. `resolveDestination()` in `src/lib/redirectSafety.ts` runs both, in order: forward the click's own params first, then stamp defaults only if neither the destination nor the click already carries a `utm_source`/`medium`/`campaign`. Kill switch: `SHORTLINK_AUTOTAG=off`, takes effect on the next request, no deploy. Because the `Location` header now depends on the `Referer`, every redirect must stay `no-store`; a cacheable redirect would also need `Vary: Referer`. `utm_medium=short_link` matches no GA4 default channel rule, so a click from a site GA4 does not already classify (a known social, video or search site) lands in "Unassigned" unless the property gets a custom channel group for it.

### Security in Redirect Handler

`src/lib/redirectSafety.ts` (used by `[shortCode]/route.ts`) validates URLs against a `SAFE_DEEP_LINK_SCHEMES` allowlist and the `BLOCKED_HOSTNAMES` regex, and rejects `javascript:`, `data:`, and `vbscript:` schemes. The route sets `Content-Security-Policy` and `X-Frame-Options: DENY` headers on deep link HTML responses.

### Database Tables

- `links` — short_code, original_url, ios/android deep links, fallback_url, link_type enum, total_clicks
- `clicks` — per-click records (ip_address, user_agent, browser_name, os_name, device_type, referrer_url)
- `profiles` — extends auth.users (email, full_name, avatar_url)

Ghost tables (exist in schema but not wired into the app): `custom_domains`, `api_keys`. Ghost columns on `links`: `password_hash`, `unique_clicks`, `custom_meta`, `qr_code_url`. `tags` is live: Resource Drop rows carry `resource-drop` (migration 021).

RLS is enabled on all tables. `SECURITY DEFINER` RPCs (`create_link`, `create_deep_link`, `get_link_by_short_code`, `record_click_and_increment`) bypass RLS intentionally — all have `SET search_path = 'public'` to prevent search path injection. The analytics aggregation RPCs (`get_clicks_over_time`, `get_*_breakdown`, `get_total_clicks`) are SECURITY INVOKER on purpose so clicks RLS applies. Anonymous SELECT on `links` is disabled (owner-only policy); the redirect path uses `get_link_by_short_code`.

Migrations are in `supabase/migrations/` (001-029 + a timestamped drop). The remote DB is managed via the Supabase MCP `apply_migration` tool (tracked migration history); local files are the canonical intent but the remote drifted historically, so always preflight actual remote state (`pg_proc`, `pg_indexes`, `pg_policies`) before applying. Migrations 001-029 are applied to production. Some (021 among them) were run in the SQL editor, so they are missing from `supabase_migrations.schema_migrations`: confirm what is applied from `pg_proc` / `pg_policies`, not from that table. `_repair_backup_20260718` holds the pre-repair state from migration 020 (link ownership, deep-link URIs, `total_clicks`); keep it until nobody needs a rollback.

Migrations 022-029 were applied on 2026-10-20 through the Supabase MCP, in order, each after its
preflight and followed by its verify query (they are in `supabase_migrations.schema_migrations`).
The preflight found two drifts: the two indexes 024 drops were already gone, so 024 changed
nothing; and most RLS policies called `public.uid()`, a SQL wrapper that returns `auth.uid()`, so
025 rewrote them with the same meaning and its final check also refuses a leftover `public.uid()`
call. 029 masked the full IPs of 17,219 clicks from before 2026-07-15; that cannot be undone.

Since 028, `authenticated` may UPDATE only these columns of `links`: `original_url`,
`ios_deep_link`, `android_deep_link`, `fallback_url`, `expires_at`, `max_clicks`, `is_active`
and `campaign_id`, and `anon` may UPDATE nothing. A new column the dashboard edits needs its
own `GRANT UPDATE (<column>) ON public.links TO authenticated` in a migration first, or that save
fails with "permission denied for table links". Since 027 and 028, links also refuse a reserved
short code and a non-http(s) `original_url` (CHECK constraints, NOT VALID).

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Components**: Named exports (not default), props typed with inline interfaces. Exception: `page.tsx` files use `export default` (Next.js requirement)
- **DB types**: Derived from `Database` type in `src/types/database.ts` — e.g. `Database['public']['Tables']['links']['Row']`
- **Styling**: Inline Tailwind utility classes only. The primary action color is the brand green: `bg-primary` (#00802B) for solid fills, `text-primary-text` for green text on dark surfaces (tokens in `src/app/globals.css`). Green marks a signal (an action, a live state, a rising trend), not decoration: no glow or blur inside the dashboard
- **Design system**: controls come from the primitive sizes, 44px tall on phones and 36px on desktop (`size="lg"` 40px, `size="sm"` 32px); do not add one-off heights. Keyboard focus uses the `focus-ring` utility. Dashboard page titles use `PageHeader` (`src/components/dashboard/PageHeader.tsx`), the wordmark is `Wordmark`, and ranked breakdowns use the server-rendered `BarList` (`src/components/charts/BarList.tsx`); recharts is only for the clicks chart. A link that looks like a button is `<Link className={buttonVariants(...)}>`, never `<Button render={<Link />}>`. Short codes and numbers use `font-mono` (Geist Mono, weight 400 only, so never bold mono) with tabular figures. Dates go through `formatDate` ("20 Oct 2026", India time). The branded status pages in `src/lib/linkPages.ts` stay webfont-free
- **Short codes**: 6-char alphanumeric random string; custom codes are lowercase alphanumeric + hyphens, and never a reserved route name (`RESERVED_SHORT_CODES`). A path that does not match `SHORT_CODE_PATTERN` never reaches the database
- **Utility functions**: `cn()`, `generateShortCode()`, `getShortUrl()`, `isValidUrl()`, `normalizeUrl()` in `src/lib/utils.ts`

## Known Issues

- Ghost columns on `links` table (`password_hash`, `unique_clicks`, `custom_meta`, `qr_code_url`) are unused, harmless but add schema noise
- `unique_clicks` on `links` is always 0 — no logic increments it
- `custom_domains` and `api_keys` tables exist but have no application code
- No rate limiting on link creation or redirect endpoints (would require Redis/Upstash)
- `clicks` rows recorded before 2026-07-15 have NULL `referrer_domain` and NULL `country` (their IPs were masked like newer rows by migration 029); newer rows get masked IPs, derived referrer domains, and country from Vercel's `x-vercel-ip-country` header (migration 017; country stays NULL in local dev where the header is absent)
- Anonymous users' home-page link list goes through the `get_links_by_ids(uuid[])` definer RPC (migration 018) since direct `links` reads are owner-only under RLS — possession of a link UUID is treated as proof of creation
- A tag-server outage surfaces only as a `console.error` from `route.ts` (`'failed'` is logged, `'skipped'` deliberately is not). There is no alert on it, so a sustained GA4 gap is found by reading logs, not by being told
- `max_clicks` is a soft cap: the redirect checks the count, then records the click in a separate call, so a burst of clicks at the same moment can pass the limit by a few. The Edit Link dialog says so ("Approximate")
- Safari on an iPad (iPadOS 13 and later) sends the same user agent as Safari on a Mac, so those clicks are stored as macOS desktop and get the desktop redirect, not the app deep link (see `src/lib/userAgent.ts`)
- The markdown files in `docs/` are historical records of finished or superseded work. Do not execute them; this file and the code are the current state
