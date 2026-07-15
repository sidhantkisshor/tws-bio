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
| 1 | TypeScript | typescript 5.8.3 → 5.9.3 | PATCH-SAFE | `chore(deps): typescript 5.8.3→5.9.3` | pending |
| 2 | ESLint | eslint 9.39.3 → 10.7.0 | MAJOR (no code) | `chore(deps): eslint 9.39.3→10.7.0` | pending |
| 3 | Vitest | vitest 3.2.7 → 4.1.10 | MAJOR (no code) | `chore(deps): vitest 3.2.7→4.1.10` | pending |
| 4 | Tailwind | tailwindcss + @tailwindcss/postcss 4.2.1 → 4.3.2 | PATCH-SAFE | `chore(deps): tailwindcss 4.2.1→4.3.2` | pending |
| 5 | Node types + pin | @types/node → 22.20.1; add `engines.node` + `.nvmrc` | CONFIG | `chore(deps): pin Node 22 + @types/node 22.20.1` | pending |
| 6 | Next.js | next + @next/eslint-plugin-next 16.1.6 → 16.2.10 | PATCH-SAFE | `chore(deps): next 16.1.6→16.2.10` | pending |
| 7 | React | react + react-dom 19.2.4 → 19.2.7; @types/react → 19.2.17 | PATCH-SAFE | `chore(deps): react 19.2.4→19.2.7` | pending |
| 8 | Supabase | @supabase/ssr 0.8.0 → 0.12.3 + @supabase/supabase-js 2.98.0 → 2.110.5 + **middleware `setAll(headers)` fix** | MIGRATION | `refactor(migrate): @supabase/ssr 0.8→0.12 setAll headers` | pending |
| 9 | UI libs | @base-ui/react 1.6.0, lucide-react 1.24.0, recharts 3.9.2, react-qr-code 2.2.0, shadcn 4.13.0, tailwind-merge 3.6.0 | PATCH-SAFE batch | `chore(deps): bump UI libraries` | pending |

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
