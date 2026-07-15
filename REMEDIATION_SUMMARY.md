# REMEDIATION_SUMMARY.md

Branch: `audit-fixes` (from `feat/frontend-redesign`, snapshot `7f8bddb`). **Not merged** — ready for your review.
Process: 8 fixer subagents (2 required a reject→refix→approve cycle) → 6 reviewer subagents (fresh context) → 2-agent regression sweep → 1 final convergence verifier. 12 per-unit commits.

---

## 1. Headline

All **autonomous** findings are fixed, reviewed, tested, and committed. The bulk of the CRITICAL/HIGH severity, however, is **HUMAN-GATED** — those fixes require DB migrations applied to your live Supabase project, an auth-flow change, a credential rotation only you can perform, and a git-history rewrite. They are **not** done; they are documented below and await your decision. **Nothing has been merged to main.**

A test suite now exists (Vitest, 46 tests) where there was none — the SSRF host-blocking and Amazon deep-link fixes are proven by unit tests.

## 2. Before / after health grades

| Domain | Before | After (this branch) | After gated work lands |
|---|---|---|---|
| Security | D | **C** (SSRF hardened, headers added, IP source fixed) | A− (once secret rotated + RLS/ownership migrations applied) |
| Data & State / DB | D+ | **D+** (unchanged — all DB fixes are gated) | B+ |
| Correctness | C | **B** (races guarded, pagination, ASIN, UTC dates) | B+ |
| Error Handling | C− | **B** (silent failures now logged) | B+ |
| Architecture | C− | **C** (dead-code note corrected; dedup deferred) | B (after chart/agg consolidation) |
| Performance | C | **C** (unbounded fetches are gated — need RPCs) | B+ |
| Deps & Config | C | **B** (env fixed, artifacts removed, lockfile) | B+ |
| Frontend | B− | **B+** (bundle split, contrast, a11y, race guards) | A− |
| Testing | F | **C** (Vitest + 46 tests on critical pure logic) | B (after route/integration tests) |

## 3. Fixed this branch (16 findings, 12 commits)

| Finding | Sev | What changed | Commit |
|---|---|---|---|
| M-4 | MED(sec) | SSRF/internal-host blocking rewritten: URL-parse + IPv4/IPv6 canonicalization + range checks; catches `127.1`, octal/hex/integer IPs, `[::1]`/ULA/link-local, IPv4-mapped/compatible/NAT64, trailing-dot FQDNs. 36 tests. | `59b9ddb` |
| H-6 | HIGH | 911-LOC `deeplinks.ts` lazy-loaded out of the public home bundle, with a `latestUrlRef` stale-guard (a first attempt introduced an out-of-order race — caught in review, fixed) + `.catch`. | `11d80dd`,`8c43cb1` |
| M-8 | MED | App-wide security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, frame-ancestors) + `poweredByHeader:false`. | `6dacaaa` |
| M-6 | MED | ~12 silent `{data}`-only Supabase queries now log their `error` (contracts unchanged, no new throws). | `5eafcd2` |
| M-7 | MED | Campaign-assignment failure now surfaces a warning toast instead of a false success. | `11d80dd` |
| M-11 | MED(a11y) | `--primary` darkened `#00B03B`→`#00802B` (2.89:1 → 5.09:1 on white). | `3c04fb4` |
| M-12 | MED | `useLinks` fetch effect cancel-guarded against out-of-order overwrite. | `69433aa` |
| L-1 | LOW | Analytics date bucketing converted to UTC (fixes off-by-one on non-UTC servers). | `5eafcd2` |
| L-2 | LOW | Links pagination clamps page to `totalPages` (no more empty-state trap). | `69433aa` |
| L-3 | LOW | Deep-link detection state resets when the URL is cleared/invalidated. | `11d80dd` |
| L-4 | LOW | Amazon ASIN extracted marker-aware (dp vs gp); graceful fallback. 4 tests. | `d04e648` |
| L-5 | LOW | Client IP from `x-real-ip`/first-XFF instead of spoofable last entry. | `498987b` |
| L-6 | LOW | Interstitial CSP gains `frame-ancestors 'none'` + `base-uri 'none'`. | `498987b` |
| L-8 | LOW | `anon_links` merge extracted to a tested pure helper (`mergeAnonLinkId`). | `69433aa` |
| L-11 | LOW | Sign-out result checked/logged. | `5eafcd2` |
| L-14 | LOW | Removed needless `(supabase as any)` on the campaigns query. | `11d80dd` |
| L-16/L-17 | LOW | Stable chart keys + `accessibilityLayer`/aria on DonutChart. | `3c04fb4` |
| L-18 | LOW | `catch (err: unknown)` narrowing in login/signup. | `3c04fb4` |
| L-19/L-20 | LOW | Corrected stale CLAUDE.md note; EditLinkDialog re-seeds on open. | `332ef9f`,`69433aa` |
| M-10/L-12/L-13 | MED/LOW | `.env.local.example` fixed to real vars + un-ignored; stray artifacts untracked. | `332ef9f` |

**Diff stats (excluding lockfile):** 28 source/config files, ~+520/−155 lines, +4 test files (46 tests).
**Verification:** `next build` ✓, `tsc --noEmit` ✓, `eslint` ✓ (0 errors), `vitest` 46/46 ✓. Regression sweep across all changed files found **zero** new CRITICAL/HIGH/MEDIUM.

## 4. §Gate — DEFERRED, awaiting your decision (the high-severity core)

These are **not fixed** because your rules gate DB/migration/auth/credential/history changes. They remain exactly as the audit found them (confirmed still-present by the final verifier).

| ID | Finding | Sev | Why it needs you |
|---|---|---|---|
| **G-1** | **`sbp_` Supabase management token in tracked `.cursor/mcp.json`** | CRITICAL | **Only you can rotate it** (Supabase dashboard). Repo-side removal + history purge (BFG/filter-repo) rewrites history — destructive, needs your go-ahead. |
| **G-2** | `record_click` duplicate overload → `PGRST203`, click recording silently fails | HIGH | New migration dropping the 7-arg overload; must be applied to the live DB. |
| **G-3** | Anonymous full-table read of `links` (Combined view policy) | HIGH | New `SECURITY DEFINER` short-code lookup RPC + drop anon SELECT + rewrite redirect handler; **order-sensitive** and changes anon data visibility. |
| **G-4** | Ownership forgery via unchecked `p_user_id` | HIGH | Migration altering `create_link`/`create_deep_link` to enforce `auth.uid()`. |
| **G-5** | Drop-policy migration aborts a fresh migration run | HIGH | Edit the migration (`IF EXISTS` / delete it). |
| **G-6** | Unbounded `clicks` fetch + JS aggregation | HIGH | New `GROUP BY` RPCs + rewrite `lib/analytics.ts`; the H-7 aggregation dedup rides on this. |
| **G-7** | Non-atomic click write (increment vs insert) | MED | Merged transactional RPC. |
| **G-8** | `referrer_domain` / `country` dead columns | MED | Migration to derive/populate; decide geo-IP vs drop the Countries chart. |
| **G-9** | No rate limiting / anon analytics write authz | MED | Needs Upstash/Redis infra provisioning. |
| **G-10** | Raw IP PII | MED | Hash/truncate inside `record_click` (fold into G-7). |
| **G-11** | Redundant indexes | LOW | `DROP INDEX` migration. |
| **G-12** | Deep-link scheme not validated at persistence | LOW | Add scheme check in `create_deep_link` (fold into G-4). |
| **G-13** | `database.ts` regeneration | LOW | Needs live schema via Supabase CLI/MCP after G-2…G-8 land. |

I can author every migration/code change for G-2…G-8/G-10…G-12 as **proposed files for your manual apply** the moment you approve — I just won't apply them to your live DB or rewrite history without your say-so.

## 5. Backlog (autonomous but deferred, with rationale)

- **H-7 chart/aggregation consolidation** — large refactor entangled with the gated analytics RPCs (G-6); do together to avoid double-churn.
- **M-14 deeplinks table-driven rewrite** — 900-LOC structural change; wants a fuller deep-link test matrix first.
- **M-15 useAuth Context provider** — cross-cutting state refactor.
- **`text-primary` contrast** — the M-11 button fix (darker green) drops small green *text-on-dark* links to ~3.89:1 (fails normal-text AA). Proper fix is a separate lighter token for `text-primary` usages — deferred as it touches ~25 sites.
- **Exotic IPv6 SSRF residuals** — 6to4 (`2002::/16`) and RFC 8215 NAT64 local-use (`64:ff9b:1::/48`) embeddings still decode-through; non-blocking (deprecated transition mechanisms, client-side redirect only), worth closing if server-side fetching is ever added.
- **Chart key uniqueness** — currently guaranteed by upstream aggregation; revisit if a non-aggregated caller is added.

## 6. Remaining risk if merged as-is
This branch materially improves correctness, resilience, frontend, and config, and hardens one real SSRF surface — but **the top-line security/data risks (leaked token, anon table read, ownership forgery, broken click recording) are still open** because they are gated on you. Do not consider the audit's CRITICAL/HIGH closed until the §Gate items are executed. The single most urgent action remains **rotating the `sbp_` token**, which no code change on this branch can do for you.
