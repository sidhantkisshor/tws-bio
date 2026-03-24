# tws.bio — Comprehensive Codebase Audit

**Date**: 2026-03-24
**Scope**: Full source code, database migrations, configuration, and architecture review

---

## 1. Project Overview

**Type**: Full-stack web application — URL shortener with analytics and mobile deep linking

**Tech Stack**:
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.0 |
| Styling | Tailwind CSS | 4.2.1 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.98.0 |
| Auth | Supabase Auth (@supabase/ssr) | 0.8.0 |
| Charts | Recharts | 3.7.0 |
| QR Codes | react-qr-code | 2.0.18 |
| Deployment | Vercel | vercel.json configured |

**Architecture Pattern**: Monolithic Next.js application with server-rendered dashboard, client-rendered home page, and Supabase as the complete backend (auth, database, RPC functions).

---

## 2. Directory Structure Analysis

```
tws.bio/
├── src/
│   ├── app/                    # Next.js App Router pages & routes
│   │   ├── page.tsx            # Home page (Client Component) — link creation UI
│   │   ├── layout.tsx          # Root layout with Inter font, metadata
│   │   ├── globals.css         # Tailwind v4 import + theme config
│   │   ├── login/page.tsx      # Email/password + Google OAuth login
│   │   ├── signup/page.tsx     # Registration with email confirmation
│   │   ├── dashboard/page.tsx  # Server Component — auth-guarded stats + table
│   │   ├── [shortCode]/route.ts# Core redirect handler + deep link + analytics
│   │   └── auth/
│   │       ├── callback/route.ts  # PKCE OAuth code exchange
│   │       └── signout/route.ts   # POST handler for sign out
│   ├── components/
│   │   ├── CreateLinkForm.tsx  # URL input, deep link auto-detection, form submission
│   │   └── LinksList.tsx       # Displays user's recent shortened links
│   ├── hooks/
│   │   ├── useAuth.ts          # Client-side auth state hook (getUser + onAuthStateChange)
│   │   └── useLinks.ts         # Client-side link fetching hook with optimistic addLink
│   ├── lib/
│   │   ├── deeplinks.ts        # 30+ platform URL → native app URI scheme mappings
│   │   ├── utils.ts            # cn(), generateShortCode(), isValidUrl(), BLOCKED_HOSTNAMES
│   │   └── supabase/
│   │       ├── client.ts       # Browser client (createBrowserClient)
│   │       ├── server.ts       # Server client (async, uses cookies())
│   │       └── middleware.ts   # Middleware client (operates on NextRequest)
│   ├── proxy.ts                # Next.js 16 proxy (middleware) — session refresh
│   └── types/
│       └── database.ts         # Supabase-generated types (manually edited)
├── supabase/
│   └── migrations/             # 7 SQL migration files (001–006 + timestamped)
├── next.config.ts              # Empty config (defaults)
├── vercel.json                 # Vercel deployment config
├── eslint.config.mjs           # Flat ESLint config with Next.js plugin
├── tsconfig.json               # TypeScript strict mode, @/* path alias
├── package.json                # Dependencies and scripts
└── CLAUDE.md                   # Project context documentation
```

**Source lines of code** (excluding generated types and build artifacts): ~2,400 lines across 18 source files.

---

## 3. File-by-File Breakdown

### Core Application Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/[shortCode]/route.ts` | 226 | **Hottest code path** — redirect handler, deep link HTML generation, analytics fire-and-forget, URL safety validation |
| `src/app/page.tsx` | 122 | Home page with hero, link creation form, feature cards for unauthenticated visitors |
| `src/app/dashboard/page.tsx` | 142 | Server-side auth check, stats cards (total links, total clicks, avg), links table |
| `src/app/login/page.tsx` | 155 | Email/password form + Google OAuth, error display, redirect to dashboard |
| `src/app/signup/page.tsx` | 212 | Registration form + Google OAuth, email confirmation success state |
| `src/components/CreateLinkForm.tsx` | 352 | Main form — URL input, custom code, deep link auto-detection, advanced options panel |
| `src/components/LinksList.tsx` | 107 | Recent links display with copy-to-clipboard and click counts |
| `src/lib/deeplinks.ts` | 912 | 30+ platform deep link generators (YouTube, Instagram, Twitter, Spotify, etc.) |
| `src/lib/utils.ts` | 52 | `cn()`, `generateShortCode()`, `getShortUrl()`, `isValidUrl()`, `BLOCKED_HOSTNAMES` |

### Infrastructure & Config

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Next.js 16 proxy — delegates to `updateSession()` for Supabase session refresh |
| `src/lib/supabase/client.ts` | Browser Supabase client (for Client Components) |
| `src/lib/supabase/server.ts` | Server Supabase client (async, uses `cookies()` from `next/headers`) |
| `src/lib/supabase/middleware.ts` | Middleware Supabase client (operates on `NextRequest/NextResponse`) |
| `src/types/database.ts` | Full Supabase type definitions — 5 tables, 3 RPCs, 2 enums |
| `next.config.ts` | Empty — all defaults |
| `vercel.json` | Framework: nextjs, standard build/dev/install commands |
| `eslint.config.mjs` | Next.js recommended + core-web-vitals rules |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `001_create_url_shortener_schema.sql` | Full schema: 5 tables, enums, indexes, triggers, RLS policies |
| `002_add_increment_function.sql` | `increment_link_clicks` SECURITY DEFINER RPC |
| `003_fix_security_and_performance.sql` | Set search_path, add FK indexes, consolidate RLS |
| `004_create_link_atomic_function.sql` | `create_link` SECURITY DEFINER RPC |
| `005_consolidate_rls_policies.sql` | Cleanup duplicate policies, dead `link_analytics` conditional |
| `006_create_deep_link_function.sql` | `create_deep_link` RPC + re-create `create_link` with search_path |
| `20250715073856_drop_public_links_policy.sql` | Drop redundant "Public can view active links" policy |

---

## 4. API Endpoints Analysis

| Method | Route | Auth Required | Purpose |
|--------|-------|---------------|---------|
| GET | `/[shortCode]` | No | Core redirect — lookup link, track analytics, redirect or serve deep link HTML |
| GET | `/auth/callback` | No | PKCE OAuth code exchange, redirects to `/dashboard` or `/login` |
| POST | `/auth/signout` | Implicit (session) | Sign out, redirect to `/` with 303 |

**Supabase RPC endpoints** (called via client SDK):
| RPC | Auth | Purpose |
|-----|------|---------|
| `create_link` | Anonymous allowed | Atomic link creation with unique constraint handling |
| `create_deep_link` | Anonymous allowed | Atomic deep link creation with iOS/Android fields |
| `increment_link_clicks` | Anonymous allowed | Atomic click counter increment |

**Authentication pattern**: Supabase Auth with PKCE flow. Session tokens stored in cookies, refreshed by the proxy middleware on every request matching the route pattern.

---

## 5. Architecture Deep Dive

### Visual Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  proxy.ts (Middleware)                                │  │
│  │  └─ updateSession() → refresh Supabase auth cookies   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────────┐
    │ page.tsx │    │dashboard │    │[shortCode]   │
    │ (Client) │    │(Server)  │    │  route.ts    │
    │          │    │          │    │  (Handler)   │
    │ useAuth()│    │getUser() │    │              │
    │useLinks()│    │  query   │    │ SELECT link  │
    │          │    │  links   │    │ Track click  │
    └────┬─────┘    └────┬─────┘    │ Redirect/    │
         │               │          │ Deep link    │
         │               │          └──────┬───────┘
         ▼               ▼                 ▼
    ┌──────────────────────────────────────────┐
    │           SUPABASE                        │
    │  ┌──────────┐  ┌─────────┐  ┌─────────┐ │
    │  │  Auth    │  │  links  │  │  clicks  │ │
    │  │  (PKCE)  │  │  table  │  │  table   │ │
    │  └──────────┘  └─────────┘  └─────────┘ │
    │  ┌──────────────────────────────────────┐│
    │  │  RPCs (SECURITY DEFINER)             ││
    │  │  create_link | create_deep_link      ││
    │  │  increment_link_clicks               ││
    │  └──────────────────────────────────────┘│
    └──────────────────────────────────────────┘
```

### Request Lifecycle: Link Redirect

```
Browser → GET /abc123
  → proxy.ts (session refresh — unnecessary for public redirect)
  → [shortCode]/route.ts
    → Supabase SELECT * FROM links WHERE short_code = 'abc123' AND is_active = true
    → Check expires_at, max_clicks
    → Fire-and-forget: increment_link_clicks RPC + clicks INSERT
    → If deep_link + mobile UA → serve HTML with JS redirect + timeout fallback
    → If standard link → 307 redirect to original_url
```

### Key Design Patterns

1. **Three Supabase clients**: Browser (`createBrowserClient`), Server (`createServerClient` with `cookies()`), Middleware (`createServerClient` with `NextRequest`). Never mixed — correct pattern.
2. **SECURITY DEFINER RPCs**: Allow anonymous link creation (null `user_id`) while bypassing RLS. Correct for the use case but lacks input validation.
3. **Optimistic client state**: `useLinks.addLink()` prepends new links to React state without refetching.
4. **Deep link auto-detection**: `detectDeepLinks()` maps 30+ platforms on URL input change to auto-populate iOS/Android URI schemes.

---

## 6. Environment & Setup

### Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key (public)
NEXT_PUBLIC_APP_URL=            # Application base URL (e.g., https://tws.bio)
NEXT_PUBLIC_SHORT_DOMAIN=       # Display domain (e.g., tws.bio)
```

### Setup Process

1. Clone repository, `npm install`
2. Create Supabase project
3. Run migrations 001–006 + timestamped migration via Supabase SQL Editor
4. Configure `.env.local` with Supabase credentials
5. `npm run dev` → localhost:3000

### Production Deployment

- Vercel deployment configured via `vercel.json`
- No CI/CD pipeline (no `.github/workflows`)
- No Docker configuration
- No test framework configured

---

## 7. Security Audit

### CRITICAL Findings

#### S1. Stored XSS via `fallbackUrl` in HTML attribute (single-quote bypass)
**File**: `src/app/[shortCode]/route.ts:121`

The `fallbackUrlAttr` only escapes double quotes:
```ts
const fallbackUrlAttr = fallbackUrl.replace(/"/g, '&quot;')
```
This is injected into `<a href="${fallbackUrlAttr}">`. A URL containing single quotes can break out of the attribute context. Combined with CSP `script-src 'unsafe-inline'`, this enables stored XSS via inline event handlers.

**Fix**: Use proper HTML attribute encoding or `encodeURI()` for href values.

#### S2. SSRF blocklist misses critical address forms
**File**: `src/lib/utils.ts:31`

`BLOCKED_HOSTNAMES` does not block:
- **Cloud metadata**: `169.254.169.254` (AWS/GCP/Azure IMDS) — highest impact omission
- **Hex IPs**: `0x7f000001` → 127.0.0.1
- **Octal IPs**: `0177.0.0.1` → 127.0.0.1
- **Decimal IPs**: `2130706433` → 127.0.0.1
- **IPv6 mapped IPv4**: `[::ffff:127.0.0.1]`

An attacker can create a link pointing to internal infrastructure via the public RPC.

**Fix**: Add `169.254.\d+.\d+` to the regex. Reject hostnames that are purely numeric or hex. Consider resolving to canonical IP before checking.

#### S3. RPCs perform zero input validation
**File**: `supabase/migrations/006_create_deep_link_function.sql`

`create_link` and `create_deep_link` accept raw TEXT for all URL fields and `short_code` with no format, scheme, or length validation. Any unauthenticated client can store `javascript:`, `data:`, or arbitrarily long values directly via the Supabase REST API.

**Fix**: Add `CHECK` constraints and validation logic inside RPCs before INSERT.

#### S4. IP address spoofable via X-Forwarded-For
**File**: `src/app/[shortCode]/route.ts:63-64`

```ts
const forwardedFor = headersList.get('x-forwarded-for')
const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null
```

Takes the leftmost (attacker-controlled) entry. On Vercel, use `request.ip` from `NextRequest` instead.

### HIGH Findings

#### S5. No rate limiting anywhere
No rate limiting on link creation RPCs, redirect handler, or auth endpoints. Anonymous users can:
- Create millions of short codes (filling the `links` table)
- Trigger unlimited analytics writes per short code
- Brute-force auth credentials

**Fix**: Implement rate limiting via Vercel WAF, `@upstash/ratelimit`, or database-level quotas.

#### S6. `</script>` injection in deep link HTML
**File**: `src/app/[shortCode]/route.ts:119`

`JSON.stringify(deepLink)` does not escape `</script>` sequences. A deep link containing `</script><script>alert(1)` breaks out of the script tag. CSP `script-src 'unsafe-inline'` allows execution.

**Fix**: After `JSON.stringify`, replace `<` with `\u003c` and `>` with `\u003e`.

#### S7. OAuth callback uses request-supplied origin
**File**: `src/app/auth/callback/route.ts:7`

`requestUrl.origin` derives from the incoming request URL. Behind certain proxies, this could be attacker-controlled.

**Fix**: Use `process.env.NEXT_PUBLIC_APP_URL` as the redirect base.

#### S8. `increment_link_clicks` missing `search_path` in migration 002
**File**: `supabase/migrations/002_add_increment_function.sql`

Created without `SET search_path = 'public'`. Fixed by migration 003 only if applied in order (migrations are run manually).

### MEDIUM Findings

#### S9. `clicks` table allows fake analytics injection
The RLS policy `"Anyone can insert clicks" FOR INSERT WITH CHECK (true)` lets any client with the public anon key inject fabricated click records for any `link_id`.

#### S10. PII stored indefinitely with no retention policy
IP addresses and user agents stored in `clicks` with no TTL, deletion mechanism, or privacy notice. GDPR compliance gap.

#### S11. No server-side length cap on `short_code`
The `short_code` column is `TEXT` with no length constraint. Error messages echo the full submitted value.

---

## 8. Architecture & Code Quality Issues

### CRITICAL

#### A1. Analytics silently dropped on serverless
**File**: `src/app/[shortCode]/route.ts:89-102`

```ts
Promise.all([
  supabase.rpc('increment_link_clicks', { link_id: link.id }),
  supabase.from('clicks').insert({...})
]).catch(err => { console.error('Error tracking analytics:', err) })
```

This `Promise.all` is never `await`ed. On Vercel serverless, the function execution freezes or terminates after the response is sent. Analytics writes are silently dropped.

**Fix**: Use Next.js `after()` from `next/server`:
```ts
import { after } from 'next/server'
after(() => Promise.all([...]))
```

#### A2. Unsafe URL redirect fails silently
**File**: `src/app/[shortCode]/route.ts:194`

When `original_url` fails `isSafeUrl()`, the user is silently redirected to `/` with no explanation. This is confusing and hides potential attacks.

### HIGH

#### A3. Home page unnecessarily a full Client Component
**File**: `src/app/page.tsx:1`

The entire home page is `'use client'`, causing auth checks and link fetching to happen client-side with visible loading states and layout shifts. Compare with `dashboard/page.tsx` which correctly uses Server Components. The form and nav state need client interactivity, but the page wrapper, hero section, and feature cards don't.

#### A4. Anonymous links unretrievable after page reload
Links created without auth have `user_id = null`. The `useLinks` hook sets `links = []` for anonymous users on mount. After a page reload, the user's created links disappear from the UI (though they still exist in the DB).

#### A5. `unique_clicks` column permanently zero
The `unique_clicks` counter on `links` and the `visitor_id` tracking on `clicks` exist in the schema but are never connected. `increment_link_clicks` only increments `total_clicks`.

#### A6. `password_hash` protection never enforced
The `links` table has a `password_hash` column, but the redirect handler never checks it. Password-protected links redirect anyone.

### MEDIUM

#### A7. Table naming confusion: `clicks` vs. `link_analytics`
CLAUDE.md states "the app uses `link_analytics`" — this is incorrect. The live table is `clicks` (migration 001). Migration 005 has a dead conditional block for `link_analytics` that was never created. All application code correctly targets `clicks`.

#### A8. `SELECT *` in the redirect handler
**File**: `src/app/[shortCode]/route.ts:69`

Fetches all 20+ columns when only ~8 are needed for the redirect logic. Adds unnecessary serialization overhead on the hottest code path.

#### A9. No pagination on dashboard
**File**: `src/app/dashboard/page.tsx:14`

`.select('*')` with no `.limit()` — a user with thousands of links loads them all at once.

#### A10. `ip_address` typed as `unknown`
**File**: `src/types/database.ts:84`

PostgreSQL `INET` maps to `unknown` in generated types, preventing TypeScript from checking the analytics insert payload.

---

## 9. Ghost Infrastructure (Defined but Unused)

| Feature | Where Defined | Status |
|---------|--------------|--------|
| `custom_domains` table | Migration 001, `database.ts` | Full schema with SSL/verification fields, RLS policies. Zero application code. |
| `api_keys` table | Migration 001, `database.ts` | Full schema with hash/expiry fields, RLS policies. Zero application code. |
| `unique_clicks` counter | Migration 001 `links` table | Column exists, `increment_link_clicks` ignores it, no visitor dedup logic. |
| `password_hash` | Migration 001 `links` table | Column exists, redirect handler never checks it. |
| `qr_code_url` | Migration 001 `links` table | Column exists, `react-qr-code` is installed, home page advertises QR codes. No generation code exists. |
| `custom_meta` (JSONB) | Migration 001 `links` table | Never written or read. |
| `tags` (TEXT[]) | Migration 001 `links` table | Never written or read. |
| `is_bot` flag | Migration 001 `clicks` table | Always defaults to `false`. No bot detection logic. |
| `visitor_id` | Migration 001 `clicks` table | Never set. RPC overload with `visitor_id` param exists but is never called. |
| UTM tracking columns | Migration 001 `clicks` table | 5 UTM columns exist. Never populated from the redirect handler. |
| Geo columns | Migration 001 `clicks` table | `country`, `city`, `region`, `latitude`, `longitude`, `timezone` — never populated. |

---

## 10. README vs. Reality

The `README.md` advertises several features that don't exist in the codebase:

| README Claim | Reality |
|---|---|
| "Next.js 14" | Actually Next.js 16.1.6 |
| "UTM Tracking — Built-in UTM parameter tracking" | UTM columns exist in DB but are never populated |
| "QR Codes — Auto-generated QR codes for each link" | `react-qr-code` installed, `qr_code_url` column exists, zero generation code |
| "Privacy Controls — Password protection, expiration dates, and click limits" | `expires_at` and `max_clicks` work. `password_hash` is never checked. |
| "Custom Domains — Use your own domain for branded links" | Table exists, zero implementation |
| "Click fraud detection (bot filtering)" | `is_bot` column always false, no detection logic |
| "API rate limiting" | No rate limiting anywhere |
| "Detailed analytics: Geographic location, UTM parameters, time-based analytics" | Only browser, OS, device type, referrer, and IP are populated. Geo, UTM, and time-based analytics are unimplemented. |
| "Tables: clicks, custom_domains, api_keys" | Only `links`, `clicks`, and `profiles` are actively used |

---

## 11. Prioritized Recommendations

### Immediate (Security — Fix Before Next Deploy)

1. **Escape deep link HTML properly** — Replace `</` with `\u003c/` after `JSON.stringify`. Escape single quotes in `fallbackUrlAttr`. (`route.ts:119-121`)
2. **Add `169.254.169.254` and numeric IP forms to BLOCKED_HOSTNAMES** (`utils.ts:31`)
3. **Add input validation in RPCs** — URL scheme check, short_code format/length check in `create_link`/`create_deep_link`
4. **Use `request.ip` instead of `x-forwarded-for`** for analytics IP (`route.ts:63`)
5. **Fix fire-and-forget analytics** — Wrap in `after()` from `next/server` (`route.ts:89`)

### Short-Term (Functionality & Reliability)

6. **Add rate limiting** — At minimum on link creation and auth endpoints
7. **Use `process.env.NEXT_PUBLIC_APP_URL`** for auth callback redirects (`auth/callback/route.ts:7`)
8. **Select only needed columns** in redirect handler instead of `SELECT *`
9. **Add pagination** to dashboard links query
10. **Show meaningful error** when `isSafeUrl()` rejects a stored `original_url` on redirect

### Medium-Term (Architecture)

11. **Refactor home page** — Server Component wrapper with Client Component islands for form/nav
12. **Implement anonymous link session tracking** — Store created link IDs in a cookie or localStorage
13. **Route click inserts through a SECURITY DEFINER RPC** — Remove the open `clicks` insert policy
14. **Add data retention policy** for analytics PII
15. **Update CLAUDE.md** — Fix the `clicks` vs. `link_analytics` description

### Long-Term (Feature Completion or Cleanup)

16. **Either implement or remove ghost infrastructure** — `custom_domains`, `api_keys`, `qr_code_url`, `tags`, `custom_meta`, `password_hash`, `unique_clicks`, `visitor_id`, UTM columns, geo columns, `is_bot`
17. **Update README.md** — Align advertised features with actual implementation
18. **Add test framework** — No tests exist for any code path
19. **Add CI/CD pipeline** — No GitHub Actions or similar
20. **Consider Vercel Analytics/Speed Insights** — No observability configured

---

## 12. Summary

tws.bio is a functional URL shortener with a well-implemented deep link detection system covering 30+ platforms. The core redirect flow works correctly, auth is properly structured with the three-client Supabase pattern, and the Next.js 16 proxy convention is correctly used.

**The critical gaps are security-focused**: the HTML generation in the redirect handler has XSS vectors, the SSRF blocklist is incomplete, RPCs lack input validation, and there is no rate limiting. These should be addressed before production traffic.

**Architecturally**, the main concerns are the fire-and-forget analytics pattern (which silently drops data on serverless), the unnecessarily broad Client Component boundary on the home page, and significant ghost infrastructure that creates false expectations from the schema and README.

**By the numbers**:
- 4 CRITICAL security findings
- 4 HIGH security findings
- 3 MEDIUM security findings
- 2 CRITICAL architecture issues
- 4 HIGH architecture issues
- 4 MEDIUM architecture issues
- 11 ghost infrastructure items
- 8 README claims that don't match reality
- 0 tests
