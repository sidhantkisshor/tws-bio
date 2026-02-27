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

### Middleware Warning

The session-refresh middleware lives in `src/proxy.ts` (exports `proxy` function + route matcher config). **Next.js expects `middleware.ts` at the project root or `src/middleware.ts`** — the current `proxy.ts` naming means this middleware may not execute. If adding or fixing middleware, use the standard `src/middleware.ts` naming convention.

### Route Structure

| Route | Type | Purpose |
|---|---|---|
| `/` | Client Component | Home page with link creation form |
| `/login` | Client Component | Email/password + Google OAuth login |
| `/signup` | Client Component | Registration |
| `/dashboard` | Server Component | Auth-guarded, fetches user's links server-side via `redirect('/login')` |
| `/[shortCode]` | Route Handler (GET) | Core redirect logic + deep link handling + analytics tracking |
| `/auth/callback` | Route Handler (GET) | PKCE OAuth code exchange |
| `/auth/signout` | Route Handler | Signs out user, clears session |

### Key Data Flow

1. **Link creation**: Client calls `create_link` or `create_deep_link` Supabase RPC (SECURITY DEFINER, allows anonymous creation with null `user_id`)
2. **Redirect**: `GET /[shortCode]` looks up active link → for deep links, returns HTML page with JS redirect + fallback timeout; for standard links, `NextResponse.redirect()`
3. **Analytics**: Tracked asynchronously (fire-and-forget) during redirect via insert to `link_analytics` + `increment_click_count` RPC
4. **Auth**: Email/password or Google OAuth → PKCE exchange at `/auth/callback` → session refreshed by middleware on every request

### Deep Link System

`src/lib/deeplinks.ts` maps 30+ platform URLs to native app URI schemes (iOS/Android). `CreateLinkForm` calls `detectDeepLinks()` on URL input change to auto-fill deep link fields and switch form mode.

### Security in Redirect Handler

The `[shortCode]/route.ts` handler validates URLs against a `SAFE_DEEP_LINK_SCHEMES` allowlist and `BLOCKED_HOSTNAMES` regex, rejects `javascript:`, `data:`, and `vbscript:` schemes, and sets `Content-Security-Policy` and `X-Frame-Options: DENY` headers on deep link HTML responses.

### Database Tables

- `links` — short_code, original_url, ios/android deep links, fallback_url, link_type enum, click_count
- `link_analytics` — per-click records (ip, country, user_agent, browser, os, device)
- `profiles` — extends auth.users (email, full_name, avatar_url)

RLS is enabled on all tables. `SECURITY DEFINER` RPCs (`create_link`, `create_deep_link`, `increment_link_clicks`) bypass RLS intentionally — all have `SET search_path = 'public'` to prevent search path injection.

Migrations are in `supabase/migrations/` (7 files, 001–006 + a timestamped drop) — run manually via Supabase SQL Editor.

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Components**: Named exports (not default), props typed with inline interfaces
- **DB types**: Derived from `Database` type in `src/types/database.ts` — e.g. `Database['public']['Tables']['links']['Row']`
- **Styling**: Inline Tailwind utility classes only, blue-600 as primary action color
- **Short codes**: 6-char alphanumeric random string; custom codes are lowercase alphanumeric + hyphens
- **Utility functions**: `cn()`, `generateShortCode()`, `getShortUrl()`, `isValidUrl()` in `src/lib/utils.ts`

## Known Issues

- TypeScript types in `database.ts` were manually edited and may not match actual DB column names (e.g. `qr_code` vs `qr_code_url`, `click_count` vs `total_clicks`)
- A `clicks` table exists in migrations but the app uses `link_analytics` — schema divergence from earlier design
- Middleware file is named `src/proxy.ts` instead of `src/middleware.ts` — may not be picked up by Next.js
