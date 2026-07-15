# tws.bio — Comprehensive Code Audit

**Scope:** full repository (~7k LOC) — Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, Supabase (Postgres + Auth).
**Method:** orchestrated multi-agent audit — 1 recon agent → 7 parallel domain agents → 4 verification agents (adversarial falsification) → 1 targeted follow-up sweep → 1 focused re-verification. 14 agents total, 3 iterations. Every finding below carries file:line evidence and survived a second independent pass.

---

## 1. Executive Summary

Overall the app is competently built — the redirect hot path is minimal and correctly ordered, the deep-link interstitial HTML is properly escaped (no XSS), SQL access is fully parameterized, the Supabase three-client boundary is respected everywhere, and DB indexing is well-provisioned. The problems cluster in three places: **a leaked management credential**, **a trust boundary that treats the public anon key as if it were a trusted server**, and **an analytics subsystem that is simultaneously duplicated, partly dead, non-atomic, and carrying a live function-overload bug**.

| Domain | Grade | One-line justification |
|---|---|---|
| Security | **D** | Live management-token leak + anonymous full-table read + ownership forgery; but no XSS/SQLi and sound redirect escaping. |
| Data & State / DB | **D+** | Fatal fresh-migration bug, `record_click` overload bug, non-atomic click writes, raw PII. |
| Correctness | **C** | Core redirect/detection logic correct; analytics recording + races are the weak spots. |
| Error Handling | **C−** | Systemic silent-failure culture (~15 ignored `{error}` sites → false-empty UI). |
| Architecture | **C−** | Analytics aggregation triplicated, chart components & range pickers duplicated, two dead features. |
| Performance | **C** | Unbounded `clicks` fetches + JS aggregation; indexes and hot path are good. |
| Deps & Config | **C** | Secret in tracked config, env-var doc mismatch; lockfile present, deps genuinely used. |
| Frontend | **B−** | 911-LOC module in the public bundle + a WCAG contrast fail; no XSS, good button a11y. |
| Testing | **F** | No test framework, no tests, no CI. |

### Top 5 risks
1. **Supabase management PAT (`sbp_…`) committed in git-tracked `.cursor/mcp.json`** — account-level takeover of the Supabase project. *(CRITICAL)*
2. **`record_click` exists as two overloads (7-arg + 12-arg)** — PostgREST `PGRST203` ambiguity silently fails click recording for the majority (no-UTM / no-referrer) of clicks. *(HIGH)*
3. **Any anonymous holder of the public anon key can enumerate the entire `links` table** — the migration meant to close this is stale and never took effect. *(HIGH)*
4. **Ownership forgery** — `create_link`/`create_deep_link` insert a client-supplied `p_user_id` with no `auth.uid()` check. *(HIGH)*
5. **A clean migration run aborts** — the drop-policy migration lacks `IF EXISTS` and targets an already-renamed policy. *(HIGH)*

---

## 2. Findings (confirmed, sorted by severity)

### CRITICAL

**C-1 — Live Supabase management token committed to git**
`.cursor/mcp.json:13` (git-tracked; `.cursor/` is *not* gitignored)
```json
"SUPABASE_ACCESS_TOKEN": "sbp_77fcac7df2ddbf364c0b55a5a494ee6a5516bb3c"
```
An `sbp_`-prefixed token is a Supabase **personal/management API token** granting account-level control (list/modify/delete projects, run arbitrary SQL, rotate keys). It is committed and present in history. Anyone with repo access — or anyone, if the repo is ever public — has full control of the Supabase account.
**Fix:** (1) Revoke/rotate the token now in Supabase → Account → Access Tokens. (2) `git rm --cached .cursor/mcp.json`; add `.cursor/` to `.gitignore`. (3) Purge from history (BFG / `git filter-repo`). *Verified by 2 independent agents; `git ls-files` + `git check-ignore` confirm tracked & not ignored.*

### HIGH

**H-1 — `record_click` function-overload ambiguity silently drops most click detail**
`supabase/migrations/007_security_hardening.sql:146` (7 args) + `008_add_utm_to_record_click.sql:5` (12 args); call site `src/app/[shortCode]/route.ts:108-121`
Both are `CREATE OR REPLACE FUNCTION` with no `DROP`; the signature changes 7→12 args, so 008 creates a **second overload** instead of replacing. The single call site derives UTM values as `searchParams.get('utm_source') || undefined` (`route.ts:68-72`); for a click without those params the keys are `undefined` and dropped by `JSON.stringify`, so the request body's key-set is a subset of *both* overloads. PostgREST cannot disambiguate → returns `PGRST203 "Could not choose the best candidate function"`. The call runs in `after()` under a catch that only `console.error`s, so it fails invisibly. Meanwhile `increment_link_clicks` (a separate RPC) succeeds, so `links.total_clicks` climbs while `clicks` gains no row — permanent undercount.
**Fix:** `DROP FUNCTION IF EXISTS record_click(uuid,text,text,text,text,text,device_type);` before creating the 12-arg version, leaving exactly one overload. *Verified by dedicated trace of arg derivation + PostgREST resolution.*

**H-2 — Anonymous full enumeration of the `links` table (intended fix is stale/ineffective)**
Effective SELECT policy after all migrations: `supabase/migrations/003_fix_security_and_performance.sql:13-14`
```sql
CREATE POLICY "Combined view policy" ON links
  FOR SELECT USING (is_active = true OR auth.uid() = user_id);
```
The public anon key ships to the browser, so `supabase.from('links').select('*')` with no filter returns every active row — harvesting all `original_url`s, deep-link targets, and `user_id`s (which enables H-3 targeting). The later `20250715073856_drop_public_links_policy.sql` was meant to remove public read, but it drops `"Public can view active links"` — a name migration 003 already replaced with `"Combined view policy"` — so it changes nothing (see H-4). **Interaction risk:** the public redirect handler (`route.ts:80-85`, anon role) *relies* on this anon SELECT, so the fix must route redirects through a `SECURITY DEFINER get_link_by_short_code(text)` RPC **before** the broad policy is removed, or redirects break.
**Fix:** Replace anon SELECT with a definer single-row lookup by `short_code`; keep only the `auth.uid() = user_id` owner branch in RLS.

**H-3 — Ownership forgery via unchecked `p_user_id`**
`supabase/migrations/007_security_hardening.sql:22-63` (`create_link`), `:68-125` (`create_deep_link`); call `src/components/CreateLinkForm.tsx:106,127`
```sql
INSERT INTO public.links (short_code, original_url, user_id, title)
VALUES (p_short_code, p_original_url, p_user_id, p_original_url);  -- p_user_id trusted verbatim
```
Both are `SECURITY DEFINER` (RLS-bypassing), granted to PUBLIC (no REVOKE), and set `user_id` from the caller-supplied parameter with no `auth.uid()` comparison. Any anon/authenticated caller can `rpc('create_link', { p_user_id: '<victim-uuid>' })` and plant links (including malicious/illegal redirect targets) attributed to a victim's account.
**Fix:** `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION …` (or derive `user_id := auth.uid()` and drop the param). Apply to both functions.

**H-4 — A fresh migration run aborts (missing `IF EXISTS`)**
`supabase/migrations/20250715073856_drop_public_links_policy.sql:1`
```sql
DROP POLICY "Public can view active links" ON links;   -- no IF EXISTS
```
This migration sorts last (`2025… > 009`). By then the named policy no longer exists (dropped/renamed in 003). With no `IF EXISTS`, a clean apply on an empty DB — or any re-run — fails with `policy … does not exist`, blocking migration deployment.
**Fix:** Add `IF EXISTS`, or delete the migration (003/005 already handle this policy idempotently). *Independently reached by 2 agents.*

**H-5 — Unbounded `clicks` fetch + JS aggregation on analytics pages**
`src/lib/analytics.ts:31-135` (six helpers) consumed by `dashboard/links/[id]/page.tsx:45-52`, `campaigns/[id]/page.tsx:56-63`; and `dashboard/analytics/page.tsx:64-153`
Each detail page fires five separate `select('<one col>')` queries over `clicks` with **no `.limit()`**, each grouped in a JS loop rather than SQL `GROUP BY` — ~5×N rows transferred per load (N = clicks in range). Default range `'30d'` caps N in practice, but `range=all` is fully unbounded; the analytics page additionally builds an unbounded `IN (…all user link ids…)` list. At millions of clicks these pages stop rendering (memory/transfer), not merely slow down.
**Fix:** Replace with `GROUP BY` aggregation in `SECURITY DEFINER` RPCs keyed on `link_id`/`user_id`, returning tens of rows. One fix covers both pages.

**H-6 — 911-LOC `deeplinks.ts` ships in the public home-page client bundle**
`src/components/CreateLinkForm.tsx:7` → `src/lib/deeplinks.ts`
`page.tsx → HomeInteractive → CreateLinkForm` (`'use client'`) statically imports `detectDeepLinks`, whose dispatcher references all 29 platform generators, so tree-shaking can't drop it. Every anonymous visitor to the busiest route downloads the whole module.
**Fix:** Dynamic-import inside a debounced `handleUrlChange` (`const { detectDeepLinks } = await import('@/lib/deeplinks')`), or move detection to a server action.

**H-7 — Analytics logic triplicated, chart components & range pickers duplicated (both live)**
`src/lib/analytics.ts` vs inline in `dashboard/analytics/page.tsx:84-153` vs `dashboard/page.tsx:81-90`; `components/charts/*` vs `components/dashboard/*Chart.tsx`; `TimeRangePicker` vs `dashboard/DateRangePicker`
Date-grouping is implemented three independent times; device/browser/referrer twice. Two full chart families coexist — `charts/*` (raw recharts, hardcoded hex `#00B03B`/`#111111`, **breaks in light theme**) and `dashboard/*Chart.tsx` (shadcn `ChartContainer`, CSS vars) — and `analytics/page.tsx` imports *both*. Two range pickers use incompatible vocabularies (`'7d'` vs `'7'`), so `?range=30` is valid on one page and invalid on another. Nothing is dead code; it's live divergence.
**Fix:** Consolidate onto `lib/analytics.ts` + the shadcn chart family + one `TimeRange` vocabulary; delete `components/charts/*` and `DateRangePicker`.

### MEDIUM

**M-1 — Two dead analytics features: `referrer_domain` and `country` are never written.**
`record_click` (008:30-41) inserts `referrer_url` but never `referrer_domain`; no geo lookup ever sets `country`. `getTopReferrers` (`analytics.ts:55`) and `getCountryBreakdown` (`:98`) read those always-NULL columns, so "Top Referrers" always collapses to "Direct" and "Countries" to "Unknown". *Confirmed by 4 agents.* **Fix:** derive domain in `record_click` (`split_part`) from `referrer_url`; add geo-IP or remove the Countries chart.

**M-2 — Anonymous analytics inflation / poisoning.** `increment_link_clicks` (007:130) and `record_click` (008) are PUBLIC `SECURITY DEFINER`, take an arbitrary link id, and have no ownership check. With enumerable link ids (H-2), an attacker can loop `increment_link_clicks` to trip a victim's `max_clicks` (disabling the link) and insert unlimited fabricated `clicks` rows. **Fix:** rate-limit; gate analytics writes behind a redirect-issued nonce.

**M-3 — Non-atomic click writes + read-then-defer `max_clicks` race.** `route.ts:96-99` checks `total_clicks` from the initial read; the increment is deferred to `after()` (`:104-126`) and is an unconditional `+1` with no cap guard, so concurrent hits overshoot `max_clicks`. The two RPCs aren't transactional and `increment_link_clicks` lacks the `is_active` gate `record_click` has, so counts drift; `record_click` has no idempotency key, so prefetch/double-fetch double-counts. **Fix:** single transactional RPC that conditionally increments (`WHERE total_clicks < max_clicks`) and inserts, with the same `is_active` gate.

**M-4 — SSRF/abuse blocklist is bypassable.** `src/lib/utils.ts:31` `BLOCKED_HOSTNAMES` regex misses `127.1`, full-form/ULA/link-local IPv6, general octal, and DNS names resolving to internal IPs (`localtest.me`). Currently low-impact (redirect is a browser 302, no server-side fetch), but becomes exploitable SSRF the moment any server-side fetch of `original_url` is added (metadata previews, QR, etc.). **Fix:** parse with `new URL()`, canonicalize the host, range-check decoded IPv4/IPv6; if server-fetch is ever added, resolve DNS and check the resolved IP.

**M-5 — Raw client IPs stored indefinitely (PII).** `route.ts:76` + `record_click` insert the full IP into `clicks.ip_address` with no hashing/truncation. GDPR/CCPA exposure for anonymous visitors. **Fix:** truncate (IPv4 /24, IPv6 /48) or HMAC-hash inside `record_click`; set retention.

**M-6 — Systemic silent Supabase-error swallowing.** ~15 sites destructure `{ data }` without `error` and render false-empty/zeroed UI: `useLinks.ts:43-60`, `dashboard/page.tsx:63,73`, `analytics/page.tsx:39,78`, `campaigns/page.tsx:10,17`, `CreateLinkForm.tsx:37-42`, `analytics.ts` (checks `error` but discards it with no log, `:38-39` et al.). A failed query looks identical to "no data." **Fix:** destructure and log `error`; throw to an `error.tsx` boundary for server pages; distinct "failed to load" state for hooks.

**M-7 — Campaign association is a silent partial failure.** `CreateLinkForm.tsx:114-115,132-133` fires `.update({ campaign_id })` unchecked, then shows `toast.success` regardless — a link can be created but silently not filed under its campaign. **Fix:** check the update error; warn on failure. (Better: add `p_campaign_id` to the create RPCs and drop the follow-up update.)

**M-8 — No app-wide security headers.** `next.config.ts` is empty; only the deep-link interstitial sets CSP/X-Frame-Options. Login/signup/dashboard ship no HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or baseline CSP. **Fix:** add a `headers()` block; set `poweredByHeader: false`.

**M-9 — No rate limiting anywhere.** Link creation and the redirect/analytics RPCs have no throttle (compounds M-2 and enables mass link creation). **Fix:** Upstash/Redis token bucket keyed on client IP.

**M-10 — Env-var documentation mismatch.** Code reads `NEXT_PUBLIC_APP_URL` (`utils.ts:26`, auth routes); `.env.local.example:6` documents `NEXT_PUBLIC_BASE_URL` (read nowhere) and omits `NEXT_PUBLIC_SHORT_DOMAIN`. If provisioned from the example, `getShortUrl()` falls back to `http://localhost:3000` server-side → wrong short URLs in prod. Downgraded from HIGH because CLAUDE.md documents the correct var. **Fix:** correct the example file.

**M-11 — WCAG contrast failure on the primary action color.** `globals.css:62-63` white on `--primary: #00B03B` ≈ 2.88:1 (AA needs 4.5:1) — affects every primary button (Shorten, Sign in, Save). **Fix:** darken to ~`#00802B`.

**M-12 — `useLinks` fetch race.** `useLinks.ts:37-70` async effect has no cancel guard; on `userId` change (anon→auth) a slow earlier fetch can clobber newer data. **Fix:** `let ignore=false` + cleanup.

**M-13 — No `short_code` collision retry.** `create_link` (007:60) raises `unique_violation` with no retry; `CreateLinkForm.tsx:86` generates once. A random-code collision surfaces to the user as "Short code … is already taken" for a code they never chose. **Fix:** catch `unique_violation` and regenerate/retry for auto-generated codes.

**M-14 — `deeplinks.ts` should be table-driven.** `src/lib/deeplinks.ts` — 30 near-identical copy-paste generators (~90 repetitions of the `{ios,android,fallback,platform}` shape) invite drift (e.g. inconsistent `encodeURIComponent`, Apple Maps `android` divergence). **Fix:** registry array + one `find` over hostnames.

**M-15 — Redundant duplicate `useAuth` instances.** Home route mounts `useAuth` three times (`Navbar`, `CreateLinkForm`, `LinksList`) → 3 `getUser()` round-trips + 3 listeners on load. **Fix:** hoist to a Context provider. (Cleanup itself is correct — no leak.)

### LOW

- **L-1** Analytics date-fill mixes local-time bounds with UTC bucket keys (`analytics/page.tsx:92-121`) → off-by-one filled buckets on non-UTC servers. Fix: use `setUTCDate`/UTC consistently.
- **L-2** Pagination clamps `page` low but not to `totalPages` (`dashboard/links/page.tsx:29,39`) → `?page=9999` shows the "No links yet" empty state with no Previous control. Fix: `page = min(page, totalPages)`.
- **L-3** `CreateLinkForm.handleUrlChange` only resets deep-link detection inside the valid-URL guard (`:47-70`) → stale "detected" banner/mode if the field is cleared/invalidated. Fix: reset in an `else`.
- **L-4** Amazon ASIN extraction uses a wrong fallback index when `dp` is last and `gp` absent (`deeplinks.ts:692-702`) → bogus deep link. Fix: resolve the marker index before indexing.
- **L-5** `X-Forwarded-For` `.pop()` records the nearest proxy IP and is client-spoofable off a trusted proxy (`route.ts:76`). Fix: use the platform's trusted IP signal.
- **L-6** Interstitial CSP relies on `script-src 'unsafe-inline'` (`route.ts:209`) — escaping is currently sound, but add a nonce + `frame-ancestors 'none'`/`base-uri 'none'`.
- **L-7** `create_deep_link` stores `ios_deep_link`/`android_deep_link` with no scheme validation (007:68-125) — only the render-time `isSafeUrl` prevents stored-XSS. Defense-in-depth: validate at persistence.
- **L-8** Cross-tab lost-update on `anon_links` localStorage (`useLinks.ts:22-31`) → an anon link can vanish from the list. Fix: re-read+merge before write / `storage` listener.
- **L-9** Redundant indexes: `idx_links_short_code` duplicates the `UNIQUE` index; `idx_clicks_link_id` is a prefix of the `(link_id, clicked_at DESC)` composite (001:120,123 vs 003:17). Drop both (write amplification on the high-write `clicks` table).
- **L-10** `record_click` re-checks link existence the GET handler already proved (008:26) — trivial extra PK lookup; fold into the merged RPC (M-3).
- **L-11** `signOut()` result unchecked (`auth/signout/route.ts:9-13`) — always redirects even on failure.
- **L-12** `.env.local.example` is matched by `.gitignore`'s `.env*` (`:34`) so it isn't committed — a fresh clone has no env template. Fix: `!.env.local.example`.
- **L-13** Stray committed artifacts: `commit_message.txt`, `.playwright-mcp/console-*.log`, and `docs/plans/*` (which disclose internal security-fix design). Stale `.vercelignore` references non-existent files.
- **L-14** `(supabase as any)` cast + eslint-disable on the campaigns query (`CreateLinkForm.tsx:37`) although `campaigns` is fully typed. Remove.
- **L-15** `database.ts` `Functions` block is hand-patched over generated output (`:339-380`) → a future `supabase gen types` silently changes RPC types. Regenerate; keep custom typings separate.
- **L-16** Chart cells/legend keyed by array index (`DonutChart.tsx:29`, `chart.tsx:209,307`); `DeviceChart` slice colors (by name) can mismatch legend colors (by index). Key by stable field; single color source.
- **L-17** Charts lack `accessibilityLayer`/aria — no screen-reader representation of analytics.
- **L-18** `login`/`signup` use `catch (err: any)`; prefer `unknown` + `instanceof Error` (as `CreateLinkForm` does).
- **L-19** `CLAUDE.md` "Known Issues" wrongly says `recharts`/`react-qr-code` are unused — both are load-bearing now. Update to avoid a maintainer removing them.
- **L-20** `EditLinkDialog` seeds state once and never unmounts (`LinkActions.tsx:104`) → potential stale fields after refresh. Reset on open or `key={link.id}`.
- **L-21** Floating `^` deps with no CI to run `build`/`lint`/`audit`; `shadcn` (a CLI) shipped as a prod dependency for one CSS import. Add a minimal CI; consider `npm ci` in Vercel.

---

## 3. Systemic Patterns

1. **The public anon key is treated as a trusted server.** C-1 (a real management token leak makes it worse), H-2 (anon table read), H-3 (client-supplied `user_id`), and M-2 (anon analytics writes) are one root cause: security-critical decisions (ownership, row visibility, write authorization) are made client-side or in PUBLIC `SECURITY DEFINER` functions that trust their arguments. Fix direction: move every trust decision server-side behind `auth.uid()` and definer RPCs that don't accept identity/authorization as parameters.

2. **The analytics subsystem is the weakest area on every axis at once** — triplicated aggregation (H-7), duplicated live charts (H-7), two dead dimensions (M-1), a live overload bug (H-1), non-atomic/racy writes (M-3), unbounded fetches (H-5). It needs a single consolidation pass, not point fixes.

3. **Silent-failure culture (M-6).** The codebase consistently discards Supabase `error` and renders false-empty UI, which also *hides* H-1/M-1 in production (a broken analytics insert looks like "no traffic"). Making failures loud would have surfaced several of these findings operationally.

4. **Migration hygiene is patch-heavy** — functions redefined across 004/006/007 and 007/008, one fatal fresh-apply bug (H-4), one overload bug (H-1), redundant indexes (L-9). The final *security* state (search_path, FK ordering) is actually clean; the *process* is fragile.

### Cross-domain interaction risks
- **H-2 fix ↔ redirect availability:** removing the anon SELECT policy breaks the redirect handler unless the definer `short_code` lookup lands first. **Order-dependent — do the RPC first.**
- **H-1 fix is a prerequisite for M-1:** UTM/referrer analytics can't work at all until the duplicate `record_click` overload is dropped.
- **M-3 fix ↔ M-2:** folding increment+insert into one gated transactional RPC also narrows the anonymous-inflation surface.

---

## 4. Prioritized Remediation Roadmap

### Quick wins (< 1 day each)
1. **Revoke + rotate the `sbp_` token; untrack `.cursor/`; scrub history.** (C-1) — do first, blast radius is the whole account.
2. **Drop the duplicate 7-arg `record_click`** in a new migration. (H-1) — restores click recording immediately.
3. **Add `IF EXISTS` to / delete the drop-policy migration.** (H-4) — unblocks clean deploys.
4. **Guard `p_user_id` against `auth.uid()`** in both create functions. (H-3)
5. Correct `.env.local.example` + un-ignore it (M-10, L-12); remove stray artifacts (L-13); darken the primary color (M-11); drop redundant indexes (L-9); fix the `useLinks` race guard (M-12).

### High-impact (about 1 week)
6. **Redirect via a `SECURITY DEFINER get_link_by_short_code` RPC, then remove the anon SELECT policy.** (H-2 — order matters.)
7. **Single transactional `record_click_and_increment` RPC** with conditional cap + `is_active` gate + IP hashing. (M-3, M-2, M-5, L-10)
8. **Consolidate analytics:** one `lib/analytics` with `GROUP BY` RPCs; delete `components/charts/*` and `DateRangePicker`; one `TimeRange` vocabulary. (H-5, H-7)
9. Populate `referrer_domain` (and decide on `country`). (M-1)
10. App-wide security headers + rate limiting. (M-8, M-9)
11. Lazy-load `deeplinks.ts` off the home bundle. (H-6)
12. Sweep the silent `{error}` sites; add an `error.tsx`. (M-6, M-7)

### Structural (longer)
13. Introduce a test suite (see §6) — start with the redirect/URL-safety and `utils.ts` pure functions.
14. Make `deeplinks.ts` table-driven. (M-14)
15. Auth Context provider (M-15); regenerate `database.ts` from schema and stop hand-editing (L-15); add CI. (L-21)

---

## 5. What Was NOT Audited (honest scope limits)
- **No live database was inspected.** All RLS/policy/function conclusions are derived from the migration files as source of truth; the *actual* deployed schema could differ if migrations were applied out of band or partially (directly relevant to H-1/H-4, whose manifestation depends on which migrations ran). Verify against the live DB.
- **No runtime/dynamic testing** — no requests issued, no bundle analyzer run, no `EXPLAIN ANALYZE`. Performance magnitudes (H-5) are reasoned from query shape, not measured; the bundle claim (H-6) is from import-graph analysis, not a build.
- **No dependency CVE scan** — `npm audit`/lockfile-vs-advisory was not run; "deps genuinely used" was verified by import grep, not vulnerability status.
- **`node_modules`, generated `.next`, and third-party shadcn/ui primitives** were reviewed only where the app imports them, not line-by-line.
- **Secret history depth** — C-1 confirms the token is tracked now; a full `git log -p` history scan for *other* historical secrets was not performed.
- **Auth provider config** (Supabase dashboard OAuth/redirect settings, email templates) is outside the repo and unverified.

---

## 6. Critical Paths Most Needing Tests (none exist today)
1. `src/app/[shortCode]/route.ts` + `utils.ts` `isValidUrl`/`BLOCKED_HOSTNAMES`/scheme allowlist — adversarial inputs (encoded IPs, octal/hex hosts, `javascript:`/`data:`). A regression here is open-redirect/XSS.
2. `getShortUrl`/`generateShortCode` — pure, cheap; the env-fallback (M-10) is exactly a test-catchable prod bug.
3. `detectDeepLinks` across the 30 platform mappings.
4. Auth callback/signout origin resolution (no localhost leakage in a prod-like env).
5. Anonymous `localStorage` cap/merge logic (L-8).

---

## 7. Iteration Log
- **Iteration 1 — Phase 0 + 1:** dispatched 1 recon agent + 7 parallel domain agents (security, correctness, architecture, performance, error-handling, frontend, deps/config). ~60 raw findings.
- **Iteration 2 — Phase 2 verification:** dispatched 4 adversarial falsification agents. Confirmed the CRITICAL/HIGH security, perf, and dead-feature findings; **downgraded 3 findings** originally rated HIGH — middleware "500 cascade" → LOW (`getUser()` returns `{error}` rather than throwing on network failure), links-page missing guard → LOW (`dashboard/layout.tsx` already guards the segment), env-var mismatch → MEDIUM (CLAUDE.md documents the correct var); refined 2 magnitudes (perf default-30d cap; redundant recheck → LOW). 0 findings survived as false positives in the confirmed set.
- **Iteration 3 — Phase 3 follow-up + re-verify:** a race + a broken migration triggered a concurrency+migration-safety sweep, which found **5 new issues including 1 previously-missed CRITICAL-class migration bug (H-4) and 1 HIGH (H-1)**. A dedicated verification agent then confirmed H-1 at HIGH via a full argument-derivation + PostgREST-resolution trace.
- **Convergence:** met — every source directory covered by ≥2 lenses; all surviving CRITICAL/HIGH confirmed at HIGH confidence with file:line; follow-up sweeps completed with no new unexplored areas. 14 agents, 3 iterations.
