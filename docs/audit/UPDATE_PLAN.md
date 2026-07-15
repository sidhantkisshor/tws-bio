# UPDATE_PLAN.md — tws.bio Dependency Modernization

Branch: `deps-update` (off `audit-fixes`). One commit per unit. No merge to main.
Runtime: Node v22.14.0 (satisfies eslint 10 `^22.13` and vitest 4 floors).

## Human-gate decisions (locked)

| Item | Decision |
|---|---|
| TypeScript 5.8 → 7.0 | **Stay on 5.x** → target 5.9.3 |
| @supabase/ssr 0.8 → 0.12 | **Upgrade** with migration + auth re-verify |
| @types/node 22 → 26 | **Hold at 22** (22.20.1) + add Node 22 pin |
| eslint 9→10, vitest 3→4 | **Both in**, each gated |

## Classification summary (Phase 1 + Phase 2 verified)

Every package is a **drop-in bump**. Phase 2 adversarial verification confirmed eslint 10 and vitest 4 require **no** config/test edits (repo touches zero removed APIs; test outcomes unchanged) and caught the **one real code migration**: `@supabase/ssr` `setAll` gained a second `headers` argument (anti-cache headers preventing CDN/proxy session-bleed) that the middleware must apply.

Context7 sources consulted: `/vercel/next.js`, `/react/react`, `/supabase/ssr`, `/supabase/supabase-js`, `/mui/base-ui`, `/lucide-icons/lucide`, `/recharts/recharts`, `/tailwindlabs/tailwindcss.com`, `/microsoft/typescript`, `/eslint/eslint`, `/vitest-dev/vitest`.

## Gate per unit
`npm run build` + `npm run typecheck` + `npm run lint` + `npm run test` must be green.

## Execution units (order: build tooling → framework → data/auth → UI)

| # | Unit | Change | Class | Commit | Status |
|---|---|---|---|---|---|
| 1 | TypeScript | typescript 5.8.3 → 5.9.3 | PATCH-SAFE | `fabfb7c` | ✅ done |
| 2 | ESLint | eslint 9.39.3 → 10.7.0 | MAJOR (no code) | `3c13a3e` | ✅ done |
| 3 | Vitest | vitest 3.2.7 → 4.1.10 | MAJOR (no code) | `50bfe5c` | ✅ done |
| 4 | Tailwind | tailwindcss + @tailwindcss/postcss 4.2.1 → 4.3.2 | PATCH-SAFE | `d20ea87` | ✅ done |
| 5 | Node types + pin | @types/node → 22.20.1; add `engines.node` + `.nvmrc` | CONFIG | `0ec5ae8` (+ `13c0471` floor→22.13.0) | ✅ done |
| 6 | Next.js | next + @next/eslint-plugin-next 16.1.6 → 16.2.10 | PATCH-SAFE | `436baa7` | ✅ done |
| 7 | React | react + react-dom 19.2.4 → 19.2.7; @types/react → 19.2.17 | PATCH-SAFE | `f35190e` | ✅ done |
| 8 | Supabase | @supabase/ssr 0.8.0 → 0.12.3 + @supabase/supabase-js 2.98.0 → 2.110.5 + **middleware `setAll(headers)` fix** | MIGRATION | `e00347e` | ✅ done (reviewer APPROVED) |
| 9 | UI libs | @base-ui/react 1.6.0, lucide-react 1.24.0, recharts 3.9.2, react-qr-code 2.2.0, shadcn 4.13.0, tailwind-merge 3.6.0 | PATCH-SAFE batch | `5784f9f` | ✅ done |
| 10 | Vuln remediation | `npm audit fix` (non-force) — cleared all high-severity | SECURITY | `7f62d67` | ✅ done |

**Convergence: all units green.** Final gate — build ✅ · typecheck ✅ · lint ✅ · test 46/46 ✅ · `npm audit --audit-level=high` → 0 high/critical (2 moderate residual, see summary).

Already current (no action): sonner, class-variance-authority, clsx, tw-animate-css, next-themes, @types/react-dom.

## The one code migration (Unit 8)

`src/lib/supabase/middleware.ts` — `setAll` must accept and apply the new `headers` arg:
```ts
setAll(cookiesToSet, headers) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
  supabaseResponse = NextResponse.next({ request })
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options)
  )
  Object.entries(headers ?? {}).forEach(([k, v]) => supabaseResponse.headers.set(k, v))
}
```
`src/lib/supabase/server.ts` — leave as-is (Server Component context can't set response headers; already try/caught). `client.ts` — unchanged.

**Auth flows to re-verify after Unit 8:** middleware session refresh, email/password login, signup, Google OAuth PKCE callback, sign-out, client session hydration, link-creation + redirect + analytics RPCs.

## Notes / deviations
- Orchestrator executes mechanical PATCH-SAFE bumps directly (no source to write) and runs the full gate; a **fresh REVIEWER subagent** reviews the Unit 8 code migration diff against Context7 docs.
- No CI exists; local `build`/`typecheck`/`lint`/`test` is the only gate.
