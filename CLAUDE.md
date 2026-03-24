# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tws.bio is a URL shortener with analytics and mobile deep linking, built with Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, and Supabase (PostgreSQL + Auth).

## Commands

```bash
npm run dev       # Start dev server (Next.js)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint (flat config, eslint.config.mjs)
```

No test framework is configured.

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

### Key Data Flow

1. **Link creation**: Client calls `create_link` or `create_deep_link` Supabase RPC (SECURITY DEFINER, allows anonymous creation with null `user_id`)
2. **Redirect**: `GET /[shortCode]` looks up active link → for deep links, returns HTML page with JS redirect + fallback timeout; for standard links, `NextResponse.redirect()`
3. **Analytics**: Tracked asynchronously via `after()` callback during redirect — calls `record_click` RPC (inserts into `clicks`) + `increment_link_clicks` RPC
4. **Auth**: Email/password or Google OAuth → PKCE exchange at `/auth/callback` → session refreshed by middleware on every request

### Deep Link System

`src/lib/deeplinks.ts` maps 30+ platform URLs to native app URI schemes (iOS/Android). `CreateLinkForm` calls `detectDeepLinks()` on URL input change to auto-fill deep link fields and switch form mode.

### Security in Redirect Handler

The `[shortCode]/route.ts` handler validates URLs against a `SAFE_DEEP_LINK_SCHEMES` allowlist and `BLOCKED_HOSTNAMES` regex, rejects `javascript:`, `data:`, and `vbscript:` schemes, and sets `Content-Security-Policy` and `X-Frame-Options: DENY` headers on deep link HTML responses.

### Database Tables

- `links` — short_code, original_url, ios/android deep links, fallback_url, link_type enum, total_clicks
- `clicks` — per-click records (ip_address, user_agent, browser_name, os_name, device_type, referrer_url)
- `profiles` — extends auth.users (email, full_name, avatar_url)

Ghost tables (exist in schema but not wired into the app): `custom_domains`, `api_keys`. Ghost columns on `links`: `password_hash`, `unique_clicks`, `custom_meta`, `tags`, `qr_code_url`.

RLS is enabled on all tables. `SECURITY DEFINER` RPCs (`create_link`, `create_deep_link`, `increment_link_clicks`, `record_click`) bypass RLS intentionally — all have `SET search_path = 'public'` to prevent search path injection.

Migrations are in `supabase/migrations/` (8 files, 001–007 + a timestamped drop) — run manually via Supabase SQL Editor. Migration 007 must be applied before deploying code changes from the security audit fix.

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Components**: Named exports (not default), props typed with inline interfaces
- **DB types**: Derived from `Database` type in `src/types/database.ts` — e.g. `Database['public']['Tables']['links']['Row']`
- **Styling**: Inline Tailwind utility classes only, blue-600 as primary action color
- **Short codes**: 6-char alphanumeric random string; custom codes are lowercase alphanumeric + hyphens
- **Utility functions**: `cn()`, `generateShortCode()`, `getShortUrl()`, `isValidUrl()` in `src/lib/utils.ts`

## Known Issues

- Ghost columns on `links` table (`password_hash`, `unique_clicks`, `custom_meta`, `tags`, `qr_code_url`) are unused — harmless but add schema noise
- `unique_clicks` on `links` is always 0 — no logic increments it
- `custom_domains` and `api_keys` tables exist but have no application code
- No rate limiting on link creation or redirect endpoints (would require Redis/Upstash)
- IP addresses are stored raw in `clicks` — consider hashing/truncating for privacy compliance
