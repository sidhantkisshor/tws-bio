# MODERNIZATION_SUMMARY.md — tws.bio

**Branch:** `deps-update` (off `audit-fixes`) · **Not merged to main.**
**Date:** 2026-07-15 · **Runtime:** Node 22 (pinned) · **Package manager:** npm

Orchestrated dependency modernization: Phase 0 recon → Phase 1 Context7-backed intelligence (5 parallel group agents) → Phase 2 adversarial verification → Phase 3 plan → Phase 4 execution (per-unit gated commits + fresh-reviewer on the one code migration) → Phase 5 deprecation sweep → Phase 6 regression sweep → Phase 7 convergence. Every classification was justified against **current Context7 docs**, not training memory.

## Headline

The codebase was already on bleeding-edge majors (Next 16, React 19, Tailwind 4, Vitest 3). **Every package was a drop-in bump — zero breaking migrations touched app code — except one security-relevant change** in the Supabase middleware that the adversarial verifier caught (the Phase 1 pass had missed it).

## Before / after dependency table

| Package | Before | After | Type |
|---|---|---|---|
| next | 16.1.6 | **16.2.10** | dep |
| @next/eslint-plugin-next | 16.1.6 | **16.2.10** | dev |
| react / react-dom | 19.2.4 | **19.2.7** | dep |
| @types/react | 19.2.14 | **19.2.17** | dev |
| @supabase/ssr | 0.8.0 | **0.12.3** | dep (migration) |
| @supabase/supabase-js | 2.98.0 | **2.110.5** | dep |
| @base-ui/react | 1.3.0 | **1.6.0** | dep |
| lucide-react | 1.0.1 | **1.24.0** | dep |
| recharts | 3.8.0 | **3.9.2** | dep |
| react-qr-code | 2.0.18 | **2.2.0** | dep |
| shadcn | 4.1.0 | **4.13.0** | dep (CLI) |
| tailwind-merge | 3.5.0 | **3.6.0** | dep |
| tailwindcss / @tailwindcss/postcss | 4.2.1 | **4.3.2** | dev |
| typescript | 5.8.3 | **5.9.3** | dev |
| eslint | 9.39.3 | **10.7.0** | dev (major) |
| vitest | 3.2.7 | **4.1.10** | dev (major) |
| @types/node | 22.19.13 | **22.20.1** | dev (held on 22.x) |
| **Node runtime** | *unpinned* | **`engines >=22.13.0 <23.0.0` + `.nvmrc 22`** | new pin |

Already current, untouched: `class-variance-authority`, `clsx`, `next-themes`, `sonner`, `tw-animate-css`, `@types/react-dom`.

## Migrations performed

**@supabase/ssr 0.8 → 0.12 (`src/lib/supabase/middleware.ts`)** — the only code change.
`SetAllCookies` gained a second `headers` argument in the 0.10–0.12 line (anti-cache headers: `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache`). The middleware `setAll` now applies them to the returned response, closing a **CDN/reverse-proxy cross-user session-bleed** vector. The old code compiled fine without it — so this would have been a silent security gap had the adversarial pass not caught it. `server.ts` correctly left as-is (Server Component context can't set response headers; middleware is the single choke point). Verified first-hand against Context7 `/supabase/ssr`; a fresh reviewer independently APPROVED.

## Human-gated decisions (your calls)

| Item | Decision | Result |
|---|---|---|
| TypeScript 5→7 (native port) | Stay on 5.x | Bumped to 5.9.3; TS7 deferred |
| @supabase/ssr auth lib | Upgrade + verify | Migrated (above) |
| @types/node 22→26 / runtime | Hold 22 + pin Node 22 | @types/node 22.20.1; engines + .nvmrc added |
| eslint 10 / vitest 4 majors | Both in | Both bumped; zero config/test edits needed |

## Packages skipped / blocked / deferred

- **TypeScript 7.0** — SKIP (your decision). Native Go-port major; whole-build blast radius. Revisit deliberately.
- **@types/node 26** — SKIP. Held on 22.x to match the Node 22 runtime; typing APIs ahead of the runtime would be incorrect.
- **BLOCKED:** none.

## Vulnerability audit — before / after

| | High | Critical | Moderate | Low |
|---|---|---|---|---|
| Before remediation | 7 | 0 | 7 | 1 |
| **After** | **0** | **0** | **2** | 0 |

`npm audit fix` (non-`--force`) cleared all high-severity advisories — most lived in the **`shadcn` CLI's** `@modelcontextprotocol/sdk` → `express@5` tree (path-to-regexp, qs, express-rate-limit, js-yaml) and `picomatch`, none of which ship into the runtime bundle. **2 moderate residuals remain** (`postcss` < 8.5.10, pulled transitively by `next`); the only available fix is `npm audit fix --force`, which downgrades `next` to 9.3.3 — declined as a regression. These will clear when Next ships a patched postcss. **Zero high/critical in the final lockfile** — Phase 7 security gate met.

## Deprecation backlog (works fine — optional, deferred)

- **`<ChartContext.Provider>` → `<ChartContext>`** in `src/components/ui/chart.tsx:63,80`. React 19 renders Context directly as a provider; the old form is documented as "deprecated in a *future* version" — not yet, no removal release. A codemod exists. (Context7 `/reactjs/react.dev`, React 19 release notes.)
- **Note only:** 3 `useMemo`/`useCallback` sites (`chart.tsx:149`, `useLinks.ts:89`, `QRCodeDialog.tsx:30`) would be obviated by the React Compiler *if/when* adopted. No action.

## ⚠️ Items needing your attention

1. **A non-dependency commit rode onto this branch.** `b2cf37a — fix(security): enforce deep-link scheme validation on edit path [push-review XSS]` was committed by an **external security-review process** mid-run (it also touched `src/components/dashboard/EditLinkDialog.tsx` and added `supabase/migrations/016_validate_deep_link_schemes_on_write.sql`). It is a legitimate, benign XSS-hardening fix and all gates passed with it included — but it is **not dependency work**. Decide whether to keep it on `deps-update` or cherry-pick it elsewhere. I did **not** rewrite history to remove a valid security fix.
2. **Uncommitted working-tree edits (left for you, not staged):** `APPLY_RUNBOOK.md` and `AUDIT_REPORT.md` were edited by a secret-scanning process to **redact a live Supabase management token** (`sbp_...`) that was in plaintext. Beneficial, but out of scope for deps — review and commit separately. **The token itself still exists in git history and remains valid until rotated** (per your own APPLY_RUNBOOK C-1).
3. **CLAUDE.md is stale:** it claims "No test framework is configured," but Vitest is fully wired with 46 passing tests across 4 files, and `test` + `typecheck` scripts exist. Worth correcting.

## Commit log (this branch, dependency work)

```
13c0471 chore(deps): tighten engines.node floor to 22.13.0 (eslint 10 requirement)
7f62d67 chore(deps): npm audit fix — clear all high-severity transitive vulns
5784f9f chore(deps): bump UI libraries
e00347e refactor(migrate): @supabase/ssr 0.8->0.12 setAll headers [security]
f35190e chore(deps): react 19.2.4->19.2.7
436baa7 chore(deps): next 16.1.6->16.2.10
0ec5ae8 chore(deps): pin Node 22 + @types/node 22.20.1
d20ea87 chore(deps): tailwindcss 4.2.1->4.3.2
50bfe5c chore(deps): vitest 3.2.7->4.1.10
3c13a3e chore(deps): eslint 9.39.3->10.7.0
fabfb7c chore(deps): typescript 5.8.3->5.9.3
217f00e docs(deps): add UPDATE_PLAN for dependency modernization
```
(`b2cf37a` — external security commit, see item 1 — also present, interleaved.)

## Final gate

**build ✅ · typecheck ✅ · lint ✅ · test 46/46 ✅ · npm audit high/critical = 0 ✅**
