# FIX_PLAN.md — Remediation of AUDIT_REPORT.md

Branch: `audit-fixes` (snapshot commit `7f8bddb`). Do not merge to main automatically.
Test infra: Vitest added for pure-function units (see INFRA-1). Frontend/config units verified by `next build` + `eslint` + `tsc --noEmit`.

Legend — Status: ☐ pending · ⧗ in progress · ✅ done · ⛔ AWAITING HUMAN GATE · ⏭ deferred to backlog
Gate reason codes: **DB** (alters schema/migrations, must be applied to live Supabase) · **AUTH** (touches auth/session/authz) · **DATA** (deletes/rewrites data or history) · **INFRA** (needs new infra e.g. Redis).

---

## HUMAN-GATE units (paused — require your decision; see REMEDIATION_SUMMARY.md §Gate)

| Unit | Findings | Gate | Why gated | Proposed action |
|---|---|---|---|---|
| G-1 Secret token | C-1 | DATA+AUTH | Token rotation is a Supabase-dashboard action only you can do; history purge rewrites git history (destructive). | You rotate `sbp_…`; I then `git rm --cached .cursor/mcp.json`, gitignore `.cursor/`, and you run BFG/`filter-repo`. |
| G-2 record_click overload | H-1 | DB | New migration dropping the 7-arg overload; must be applied to live DB. | Author `010_fix_record_click_overload.sql` for your manual apply. |
| G-3 Anon links enumeration | H-2 | DB+AUTH | New definer lookup RPC + drop anon SELECT policy + rewrite redirect handler; order-sensitive, changes anon data visibility. | Author migration + `route.ts` change together; apply migration first. |
| G-4 Ownership forgery | H-3 | DB+AUTH | Migration altering `create_link`/`create_deep_link` to enforce `auth.uid()`. | Author `011_*` guarding `p_user_id`. |
| G-5 Migration fresh-apply abort | H-4 | DB | Edit/replace the `20250715…drop_public_links_policy.sql` migration. | Add `IF EXISTS` or delete the redundant migration. |
| G-6 Analytics aggregation RPCs | H-5, H-7(agg half) | DB | New `GROUP BY` definer RPCs; app rewrite depends on them existing. | Author RPCs + rewrite `lib/analytics.ts`. |
| G-7 Atomic click write | M-3, L-10 | DB | Merged transactional increment+insert RPC. | Author RPC; simplify `route.ts` after() block. |
| G-8 referrer_domain / country | M-1 | DB | Migration to derive/populate columns. | Author migration; decide country (geo-IP vs drop chart). |
| G-9 Analytics-write authz + rate limit | M-2, M-9 | INFRA+DB | Needs Redis/Upstash token bucket + nonce-gated RPC. | Requires infra provisioning decision. |
| G-10 IP PII hashing | M-5 | DB | Hash/truncate inside `record_click`. | Fold into G-7 RPC. |
| G-11 Redundant indexes | L-9 | DB | `DROP INDEX` migration. | Author migration. |
| G-12 Deep-link scheme validation at persist | L-7 | DB | Add scheme check inside `create_deep_link`. | Fold into G-4 migration. |
| G-13 database.ts regeneration | L-15 | DB | Needs live schema via Supabase CLI/MCP. | Regenerate after G-2..G-8 land. |

## Deferred to backlog (autonomous but large blast radius / dependent on gated work)
| Unit | Findings | Rationale |
|---|---|---|
| B-1 Chart family consolidation | H-7 (chart half) | Large refactor; the aggregation half is gated (G-6). Do together after RPCs land to avoid double-churn. |
| B-2 deeplinks table-driven refactor | M-14 | 900-LOC structural rewrite; high regression risk; needs the full deeplink test matrix first (partially built in AU-7). |
| B-3 useAuth Context provider | M-15 | Cross-cutting state refactor touching Navbar/CreateLinkForm/LinksList; defer to a focused change. |
| B-4 CreateLinkForm decomposition | Arch M-cluster | Depends on G-4 (p_campaign_id RPC param) to remove the follow-up update. |

---

## AUTONOMOUS units (executing this session)

### INFRA-1 — Add Vitest for pure-function tests
- Files: `package.json`, `vitest.config.ts`, `src/lib/__tests__/`.
- Acceptance: `npm test` runs; sample test green. No change to app runtime.
- Rollback: remove devDep + config + test dir.

### AU-1 — URL safety hardening (SECURITY) — **M-4**
- Files: `src/lib/utils.ts`.
- Change: replace the brittle `BLOCKED_HOSTNAMES` regex approach with `new URL()` parse + host canonicalization + RFC1918/loopback/link-local/IPv6 range checks in `isValidUrl`/a helper.
- Acceptance: rejects `127.1`, `0177.0.0.1`, `[::1]`, `[fc00::1]`, `[fe80::1]`, `2130706433`, `localhost`, `169.254.169.254`; accepts normal public https URLs. Existing callers (`route.ts:43`, `utils.ts:41`) unaffected in signature.
- Tests: unit matrix of bypass vectors + valid URLs (Vitest).
- Rollback: revert utils.ts.

### AU-2 — Redirect handler hardening — **L-5 (XFF), L-6 (CSP)**
- Files: `src/app/[shortCode]/route.ts`.
- Change: derive client IP from platform-trusted header; add `frame-ancestors 'none'` + `base-uri 'none'` to interstitial CSP. Minimal, no behavior change to redirect.
- Acceptance: build/typecheck clean; CSP string includes new directives; IP derivation documented.
- Rollback: revert route.ts.

### AU-3 — Lazy-load deeplinks off home bundle (HIGH) — **H-6**
- Files: `src/components/CreateLinkForm.tsx`.
- Change: convert static `import { detectDeepLinks }` to a dynamic `await import()` inside the (debounced) URL-change handler.
- Acceptance: no top-level static import of `@/lib/deeplinks`; typecheck/build clean; detection still works.
- Rollback: revert to static import.

### AU-4 — App-wide security headers — **M-8**
- Files: `next.config.ts`.
- Change: add `headers()` (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, baseline CSP) + `poweredByHeader:false`.
- Acceptance: build clean; headers present in config.
- Rollback: revert next.config.ts.

### AU-5 — Surface Supabase errors (resilience) — **M-6, M-7, L-11**
- Files: `src/hooks/useLinks.ts`, `src/lib/analytics.ts`, `src/app/dashboard/page.tsx`, `analytics/page.tsx`, `campaigns/page.tsx`, `src/components/CreateLinkForm.tsx`, `src/app/auth/signout/route.ts`.
- Change: destructure + log `error`; distinct failure state where cheap; warn toast on campaign-assoc failure; log signout failure. No control-flow/auth change.
- Acceptance: no silent `{ data }`-only destructures remain in listed files; build/lint clean.
- Rollback: per-file revert.

### AU-6 — Client correctness batch — **M-12, L-2, L-3, L-8, L-20**
- Files: `src/hooks/useLinks.ts`, `src/app/dashboard/links/page.tsx`, `src/components/CreateLinkForm.tsx`, `src/components/dashboard/EditLinkDialog.tsx`.
- Change: cancel-guard in useLinks effect; clamp page to totalPages; reset deep-link detection on invalid/empty URL; re-read+merge `anon_links`; reset EditLinkDialog fields on open.
- Acceptance: unit tests for `saveAnonLinkId` merge + pagination clamp helper; build/lint clean.
- Tests: Vitest for the pure pieces.
- Rollback: per-file revert.

### AU-7 — Deep-link ASIN fix — **L-4**
- Files: `src/lib/deeplinks.ts` (Amazon generator only).
- Acceptance: unit test — `/dp/<asin>` and `/gp/product/<asin>` resolve correctly; `dp` as last segment does not fall through to a wrong index.
- Rollback: revert the Amazon branch.

### AU-8 — Analytics date bucketing in UTC — **L-1**
- Files: `src/app/dashboard/analytics/page.tsx`.
- Acceptance: date-fill uses UTC consistently (`setUTCDate`/`toISOString`); build clean. (Verified by reasoning + build; server-timezone-independent.)
- Rollback: revert.

### AU-9 — Polish batch — **M-11, L-14, L-16, L-17, L-18**
- Files: `src/app/globals.css`, `src/components/CreateLinkForm.tsx` (cast), `src/components/charts/DonutChart.tsx` + `src/components/ui/chart.tsx` (keys/a11y), `src/app/login/page.tsx`, `src/app/signup/page.tsx`.
- Change: darken `--primary` to meet AA; remove `(supabase as any)`; stable chart keys + `accessibilityLayer`/aria; `catch (err: unknown)`.
- Acceptance: contrast ≥4.5:1; no `as any` on campaigns; build/lint clean.
- Rollback: per-file revert.

### AU-10 — Config & docs — **M-10, L-12, L-13, L-19**
- Files: `.env.local.example`, `.gitignore`, `CLAUDE.md`, remove `commit_message.txt` + `.playwright-mcp/*.log`.
- Change: correct example env vars; `!.env.local.example` negation; update stale Known Issues; `git rm` cruft.
- Acceptance: example lists the vars the code actually reads; cruft untracked.
- Note: removing committed artifacts is repo cruft (not user data) — treated autonomous; `docs/plans/*` left in place (your call whether internal).
- Rollback: `git checkout` the files.

---

## Execution status (all autonomous units complete — reviewed, tested, committed)

| Unit | Findings | Commit | Reviewer | Tests |
|---|---|---|---|---|
| INFRA-1 | Vitest | `ca8306c` | — | smoke green |
| AU-1 | M-4 | `59b9ddb` | REJECT→fixed→APPROVE (2 bypasses closed) | 36 unit tests |
| AU-2 | L-5, L-6 | `498987b` | APPROVE | typecheck |
| AU-3 | H-6, M-7, L-3, L-14 | `11d80dd` | REJECT→fixed→APPROVE (race guard) | typecheck+build |
| AU-4 | M-8 | `6dacaaa` | APPROVE | typecheck |
| AU-5/8 | M-6, L-11, L-1 | `5eafcd2` | APPROVE (UTC traced) | typecheck |
| AU-6 | M-12, L-2, L-20, L-8 | `69433aa` | APPROVE | 5 unit tests |
| AU-7 | L-4 | `d04e648` | APPROVE | 4 unit tests |
| AU-9 | M-11, L-18, L-16, L-17 | `3c04fb4` | APPROVE (text-primary caveat→backlog) | typecheck |
| AU-10 | M-10, L-12, L-13, L-19 | `332ef9f` | (config/docs) | — |
| sweep-fix | IIFE .catch | `8c43cb1` | regression-sweep | build |

- G-1…G-13: ⛔ AWAITING HUMAN GATE (see REMEDIATION_SUMMARY.md §Gate) · B-1…B-4 + text-primary token + exotic-IPv6: ⏭ backlog
- Final convergence verifier: **CONVERGED** — 16/16 autonomous findings confirmed fixed, 5/5 gated findings confirmed present-as-expected. Build + 46 tests + typecheck + lint all green.
