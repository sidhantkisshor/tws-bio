# Security-First Audit Design

**Date:** 2026-02-27
**Scope:** 6 security vulnerabilities in tws.bio URL shortener
**Approach:** Surgical fixes, minimal blast radius

## Fixes

### 1. XSS in Deep Link Redirect (`src/app/[shortCode]/route.ts`)

Deep link URLs interpolated into `<script>` tags without escaping. Fix: validate URI schemes against allowlist, use `JSON.stringify()` for safe JS embedding, reject `javascript:`/`data:`/`vbscript:` schemes.

### 2. URL Validation (`src/lib/utils.ts`)

`isValidUrl()` only checks `new URL()` parse success. Fix: add protocol whitelist (http/https only), block private/internal IPs, add 2048-char length limit.

### 3. Short Code RNG (`src/lib/utils.ts`)

`Math.random()` is predictable. Fix: replace with `crypto.getRandomValues()`.

### 4. Deep Link Parameter Encoding (`src/lib/deeplinks.ts`)

Extracted URL parameters injected directly into URI scheme strings. Fix: apply `encodeURIComponent()` to all extracted parameters, add format validation for platform-specific IDs.

### 5. Database Type Sync (`src/types/database.ts`)

TypeScript types use wrong column names (`click_count` vs `total_clicks`, `qr_code` vs `qr_code_url`). Fix: align types to match actual database schema.

### 6. RLS Policy Consolidation (`supabase/migrations/`)

Multiple overlapping SELECT policies on `links` table. Fix: new migration to drop redundant policies, keep single combined policy.

## Files Affected

- `src/app/[shortCode]/route.ts`
- `src/lib/utils.ts`
- `src/lib/deeplinks.ts`
- `src/types/database.ts`
- `supabase/migrations/` (new migration)

## Risk Assessment

Low - each fix is isolated and testable independently.
