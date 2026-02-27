# Security Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 security vulnerabilities identified in the tws.bio codebase audit.

**Architecture:** Surgical, isolated fixes to existing files. No new architectural patterns introduced. Each task is independent and can be committed separately.

**Tech Stack:** Next.js 15, TypeScript 5, Supabase, Node.js crypto API

---

### Task 1: Fix XSS in Deep Link Redirect

**Files:**
- Modify: `src/app/[shortCode]/route.ts:64-140`

**Context:** Lines 120 and 124 interpolate `deepLink` and `fallbackUrl` directly into `<script>` and `<a href>` tags. If these contain `"; alert('xss'); "` or `javascript:` URIs, arbitrary JS executes.

**Step 1: Add URL sanitization helper at top of file**

Add after line 15 (after the `isMobile` function):

```typescript
// Allowlist of safe URI schemes for deep links
const SAFE_DEEP_LINK_SCHEMES = [
  'http:', 'https:', 'ftp:',
  // App-specific schemes used by deeplinks.ts
  'youtube:', 'vnd.youtube:', 'instagram:', 'twitter:', 'tiktok:',
  'spotify:', 'linkedin:', 'fb:', 'reddit:', 'whatsapp:', 'tg:',
  'discord:', 'slack:', 'pinterest:', 'snapchat:', 'twitch:',
  'nflx:', 'soundcloud:', 'comgooglemaps:', 'google.navigation:',
  'maps:', 'geo:', 'com.amazon.mobile.shopping:', 'ebay:',
  'airbnb:', 'uber:', 'venmo:', 'cashapp:', 'paypal:',
  'medium:', 'github:', 'zoomus:',
]

function isSafeUrl(url: string): boolean {
  try {
    // Check for javascript:/data:/vbscript: schemes
    const trimmed = url.trim().toLowerCase()
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
      return false
    }
    // For URLs with known schemes, validate against allowlist
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      const scheme = trimmed.substring(0, colonIndex + 1)
      return SAFE_DEEP_LINK_SCHEMES.includes(scheme)
    }
    return false
  } catch {
    return false
  }
}
```

**Step 2: Use JSON.stringify for safe JS embedding and validate URLs**

Replace lines 73-139 (the `if (deepLink)` block) with:

```typescript
    if (deepLink && isSafeUrl(deepLink)) {
      const fallbackUrl = link.fallback_url || link.original_url
      const safeFallback = isSafeUrl(fallbackUrl) ? fallbackUrl : link.original_url

      // Use JSON.stringify to safely embed strings in JavaScript
      const safeDeepLink = JSON.stringify(deepLink)
      const safeFallbackJs = JSON.stringify(safeFallback)
      // For href attribute, encode to prevent attribute injection
      const safeFallbackHref = safeFallback.replace(/"/g, '&quot;')

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redirecting...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
            p { color: #666; margin: 10px 0; }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #007AFF;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
            }
            a:hover { background: #0051D5; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Opening app...</h1>
            <p>If the app doesn't open automatically, click below:</p>
            <a href="${safeFallbackHref}" id="fallback">Continue to website</a>
          </div>
          <script>
            // Attempt to open the deep link
            window.location.href = ${safeDeepLink};

            // Fallback to web URL after a delay
            setTimeout(function() {
              window.location.href = ${safeFallbackJs};
            }, 2500);
          </script>
        </body>
        </html>
      `

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }
```

**Step 3: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 4: Commit**

```bash
git add src/app/\[shortCode\]/route.ts
git commit -m "fix: prevent XSS in deep link redirect via URL scheme allowlist and JSON.stringify"
```

---

### Task 2: Harden URL Validation

**Files:**
- Modify: `src/lib/utils.ts:23-29`

**Context:** `isValidUrl()` only checks if `new URL()` parses successfully. This allows `javascript:`, `data:`, `file:` schemes and internal network targets (SSRF).

**Step 1: Replace isValidUrl with hardened version**

Replace lines 23-29:

```typescript
const BLOCKED_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|\[::1\]|\[::0\])$/i

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    // Block internal/private network targets (SSRF prevention)
    if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
      return false
    }
    // Length limit
    if (url.length > 2048) {
      return false
    }
    return true
  } catch {
    return false
  }
}
```

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "fix: harden URL validation with protocol allowlist and SSRF prevention"
```

---

### Task 3: Replace Math.random with Crypto RNG

**Files:**
- Modify: `src/lib/utils.ts:8-15`

**Context:** `generateShortCode()` uses `Math.random()` which is cryptographically insecure and predictable. Short codes could be enumerated.

**Step 1: Replace generateShortCode implementation**

Replace lines 8-15:

```typescript
export function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomValues = crypto.getRandomValues(new Uint8Array(length))
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length)
  }
  return result
}
```

Note: `crypto.getRandomValues` is available globally in Node.js 19+ and all modern browsers. Next.js 15 runs on Node.js 18+ which also has it via the Web Crypto API.

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "fix: use crypto.getRandomValues for secure short code generation"
```

---

### Task 4: Sanitize Deep Link Parameters

**Files:**
- Modify: `src/lib/deeplinks.ts` (multiple functions)

**Context:** Extracted URL path parameters (usernames, video IDs, etc.) are interpolated directly into URI scheme strings without encoding. Malicious characters could alter the URI structure.

**Step 1: Add encodeURIComponent to all user-extracted parameters**

Apply `encodeURIComponent()` to every parameter extracted from URLs before embedding in deep link URIs. The key changes are:

In `generateYouTubeDeepLinks` (line 177-178):
```typescript
      ios: `youtube://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      android: `vnd.youtube:${encodeURIComponent(videoId)}`,
```

In `generateInstagramDeepLinks` (lines 199, 209, 219):
```typescript
      ios: `instagram://media?id=${encodeURIComponent(pathParts[1])}`,
      android: `instagram://media?id=${encodeURIComponent(pathParts[1])}`,
      // ... profile:
      ios: `instagram://user?username=${encodeURIComponent(pathParts[0])}`,
      android: `instagram://user?username=${encodeURIComponent(pathParts[0])}`,
      // ... reel:
      ios: `instagram://reel?id=${encodeURIComponent(pathParts[1])}`,
      android: `instagram://reel?id=${encodeURIComponent(pathParts[1])}`,
```

In `generateTwitterDeepLinks` (lines 241, 250):
```typescript
      ios: `twitter://status?id=${encodeURIComponent(pathParts[2])}`,
      android: `twitter://status?id=${encodeURIComponent(pathParts[2])}`,
      // ... profile:
      ios: `twitter://user?screen_name=${encodeURIComponent(pathParts[0])}`,
      android: `twitter://user?screen_name=${encodeURIComponent(pathParts[0])}`,
```

In `generateTikTokDeepLinks` (lines 271, 281):
```typescript
      ios: `tiktok://video/${encodeURIComponent(pathParts[2])}`,
      android: `tiktok://video/${encodeURIComponent(pathParts[2])}`,
      // ... profile:
      ios: `tiktok://user?username=${encodeURIComponent(pathParts[0].substring(1))}`,
      android: `tiktok://user?username=${encodeURIComponent(pathParts[0].substring(1))}`,
```

In `generateSpotifyDeepLinks` (line 301):
```typescript
    const spotifyUri = `spotify:${pathParts[0]}:${encodeURIComponent(pathParts[1])}`
```

In `generateLinkedInDeepLinks` (lines 323, 333):
```typescript
      ios: `linkedin://profile/${encodeURIComponent(pathParts[1])}`,
      android: `linkedin://profile/${encodeURIComponent(pathParts[1])}`,
      // ... company:
      ios: `linkedin://company/${encodeURIComponent(pathParts[1])}`,
      android: `linkedin://company/${encodeURIComponent(pathParts[1])}`,
```

In `generateFacebookDeepLinks` (lines 355, 365):
```typescript
      ios: `fb://profile/${encodeURIComponent(pathParts[0])}`,
      android: `fb://page/${encodeURIComponent(pathParts[0])}`,
      // ... group:
      ios: `fb://group/${encodeURIComponent(pathParts[1])}`,
      android: `fb://group/${encodeURIComponent(pathParts[1])}`,
```

In `generateWhatsAppDeepLinks` (line 430):
```typescript
      ios: `whatsapp://send?phone=${encodeURIComponent(phoneNumber)}`,
      android: `whatsapp://send?phone=${encodeURIComponent(phoneNumber)}`,
```

In `generateTelegramDeepLinks` (line 451):
```typescript
      ios: `tg://resolve?domain=${encodeURIComponent(pathParts[0])}`,
      android: `tg://resolve?domain=${encodeURIComponent(pathParts[0])}`,
```

In `generateDiscordDeepLinks` (line 469):
```typescript
      ios: `discord://discord.gg/${encodeURIComponent(inviteCode)}`,
      android: `discord://discord.gg/${encodeURIComponent(inviteCode)}`,
```

In `generateSlackDeepLinks` (line 492):
```typescript
      ios: `slack://workspace?team=${encodeURIComponent(pathParts[0])}`,
      android: `slack://workspace?team=${encodeURIComponent(pathParts[0])}`,
```

In `generatePinterestDeepLinks` (lines 514, 524):
```typescript
      ios: `pinterest://pin/${encodeURIComponent(pathParts[1])}`,
      android: `pinterest://pin/${encodeURIComponent(pathParts[1])}`,
      // ... user:
      ios: `pinterest://user/${encodeURIComponent(pathParts[0])}`,
      android: `pinterest://user/${encodeURIComponent(pathParts[0])}`,
```

In `generateSnapchatDeepLinks` (line 545):
```typescript
      ios: `snapchat://add/${encodeURIComponent(pathParts[1])}`,
      android: `snapchat://add/${encodeURIComponent(pathParts[1])}`,
```

In `generateTwitchDeepLinks` (lines 567, 577):
```typescript
      ios: `twitch://stream/${encodeURIComponent(pathParts[0])}`,
      android: `twitch://stream/${encodeURIComponent(pathParts[0])}`,
      // ... video:
      ios: `twitch://video/${encodeURIComponent(pathParts[1])}`,
      android: `twitch://video/${encodeURIComponent(pathParts[1])}`,
```

In `generateNetflixDeepLinks` (line 598):
```typescript
      ios: `nflx://www.netflix.com/title/${encodeURIComponent(pathParts[1])}`,
      android: `nflx://www.netflix.com/title/${encodeURIComponent(pathParts[1])}`,
```

In `generateAmazonDeepLinks` (line 696):
```typescript
        ios: `com.amazon.mobile.shopping://www.amazon.com/dp/${encodeURIComponent(asin)}`,
        android: `com.amazon.mobile.shopping://www.amazon.com/dp/${encodeURIComponent(asin)}`,
```

In `generateEbayDeepLinks` (line 718):
```typescript
      ios: `ebay://launch?itm=${encodeURIComponent(pathParts[1])}`,
      android: `ebay://launch?itm=${encodeURIComponent(pathParts[1])}`,
```

In `generateAirbnbDeepLinks` (line 739):
```typescript
      ios: `airbnb://rooms/${encodeURIComponent(pathParts[1])}`,
      android: `airbnb://rooms/${encodeURIComponent(pathParts[1])}`,
```

In `generateVenmoDeepLinks` (line 789):
```typescript
      ios: `venmo://users/${encodeURIComponent(pathParts[0])}`,
      android: `venmo://users/${encodeURIComponent(pathParts[0])}`,
```

In `generateCashAppDeepLinks` (line 809):
```typescript
      ios: `cashapp://cash.app/${encodeURIComponent(pathParts[0])}`,
      android: `cashapp://cash.app/${encodeURIComponent(pathParts[0])}`,
```

In `generatePayPalDeepLinks` (line 831):
```typescript
        ios: `paypal://paypalme/${encodeURIComponent(username)}`,
        android: `paypal://paypalme/${encodeURIComponent(username)}`,
```

In `generateMediumDeepLinks` (line 853):
```typescript
      ios: `medium://p/${encodeURIComponent(pathParts[pathParts.length - 1])}`,
      android: `medium://p/${encodeURIComponent(pathParts[pathParts.length - 1])}`,
```

In `generateGitHubDeepLinks` (line 876):
```typescript
      ios: `github://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      android: `github://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
```

In `generateZoomDeepLinks` (line 899):
```typescript
      ios: `zoomus://zoom.us/join?confno=${encodeURIComponent(meetingId)}`,
      android: `zoomus://zoom.us/join?confno=${encodeURIComponent(meetingId)}`,
```

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/deeplinks.ts
git commit -m "fix: encode all deep link parameters to prevent URI injection"
```

---

### Task 5: Fix Database Type Mismatch

**Files:**
- Modify: `src/types/database.ts:25-26` (Row), `42-43` (Insert), `59-60` (Update)

**Context:** TypeScript types use `click_count` and `qr_code` but the actual DB columns (from migration 001) are `total_clicks`, `unique_clicks`, and `qr_code_url`. The code also references `link_analytics` table which is defined in types but the migration creates a `clicks` table. Since the app uses `link_analytics` and the types already define it, we align the `links` table types to match the actual schema.

**Step 1: Update links Row type**

In `src/types/database.ts`, replace line 25-26:
```typescript
          click_count: number
          qr_code: string | null
```
with:
```typescript
          total_clicks: number
          unique_clicks: number
          qr_code_url: string | null
```

**Step 2: Update links Insert type**

Replace line 42-43:
```typescript
          click_count?: number
          qr_code?: string | null
```
with:
```typescript
          total_clicks?: number
          unique_clicks?: number
          qr_code_url?: string | null
```

**Step 3: Update links Update type**

Replace line 59-60:
```typescript
          click_count?: number
          qr_code?: string | null
```
with:
```typescript
          total_clicks?: number
          unique_clicks?: number
          qr_code_url?: string | null
```

**Step 4: Add missing columns from migration schema**

Add the following fields that exist in the migration but are missing from types. In the Row type (after `qr_code_url`):
```typescript
          expires_at: string | null
          password_hash: string | null
          max_clicks: number | null
          custom_meta: Record<string, unknown>
          tags: string[]
```

And corresponding optional fields in Insert and Update types:
```typescript
          expires_at?: string | null
          password_hash?: string | null
          max_clicks?: number | null
          custom_meta?: Record<string, unknown>
          tags?: string[]
```

**Step 5: Fix any TypeScript errors caused by rename**

Search for `click_count` in all `.ts`/`.tsx` files and update references. Check:
- `src/components/LinksList.tsx` - may reference `click_count`
- `src/app/dashboard/page.tsx` - may reference `click_count`

**Step 6: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds (fix any type errors)

**Step 7: Commit**

```bash
git add src/types/database.ts src/components/LinksList.tsx src/app/dashboard/page.tsx
git commit -m "fix: align TypeScript types with actual database schema columns"
```

---

### Task 6: Consolidate RLS Policies

**Files:**
- Create: `supabase/migrations/005_consolidate_rls_policies.sql`

**Context:** Migration 001 creates "Public can view active links" and "Users can view own links" policies. Migration 003 drops both and creates "Combined view policy". Migration `20250715073856` tries to drop "Public can view active links" again (which was already dropped by 003). This is messy but functionally correct after all migrations run. However, we also need an INSERT policy that allows the `link_analytics` table to accept inserts from anon users (redirect handler tracks analytics without auth).

**Step 1: Create cleanup migration**

```sql
-- Cleanup: ensure only the combined view policy exists on links
-- These are idempotent (IF EXISTS) so safe to run even if already dropped
DROP POLICY IF EXISTS "Public can view active links" ON links;
DROP POLICY IF EXISTS "Users can view own links" ON links;

-- Ensure the combined policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'links' AND policyname = 'Combined view policy'
  ) THEN
    CREATE POLICY "Combined view policy" ON links
      FOR SELECT USING (is_active = true OR auth.uid() = user_id);
  END IF;
END $$;

-- Ensure link_analytics table has proper RLS if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'link_analytics') THEN
    ALTER TABLE link_analytics ENABLE ROW LEVEL SECURITY;

    -- Allow anonymous inserts for analytics tracking
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'link_analytics' AND policyname = 'Anyone can insert analytics'
    ) THEN
      CREATE POLICY "Anyone can insert analytics" ON link_analytics
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Allow users to view analytics for their own links
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'link_analytics' AND policyname = 'Users can view own link analytics'
    ) THEN
      CREATE POLICY "Users can view own link analytics" ON link_analytics
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM links
            WHERE links.id = link_analytics.link_id
            AND links.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END $$;
```

**Step 2: Commit**

```bash
git add supabase/migrations/005_consolidate_rls_policies.sql
git commit -m "fix: consolidate RLS policies and ensure link_analytics security"
```

---

### Final: Verify Complete Build

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new lint errors introduced

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix any remaining build/lint issues from security audit"
```
