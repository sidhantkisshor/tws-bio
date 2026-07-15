# APPLY_RUNBOOK.md — how to land the gated fixes safely

Everything on branch `audit-fixes`. The autonomous fixes are already safe to merge. The items below are **gated** — they touch your live Supabase DB, auth visibility, a real credential, and git history, so they need you in the loop. Follow the order; some steps break the app if done out of sequence.

---

## 0. DO THIS FIRST — rotate the leaked token (CRITICAL, minutes)

The `sbp_` Supabase **management** token was committed in `.cursor/mcp.json`. This branch already untracked the file and gitignored `.cursor/`, but **the value still exists in git history and is fully valid until you rotate it.**

1. **Rotate now:** Supabase Dashboard → Account → Access Tokens → revoke the `sbp_`-prefixed token (the one that was in `.cursor/mcp.json`) → generate a new one → put it in your local `.cursor/mcp.json` (now gitignored, won't be committed).
2. **Purge history** (destructive rewrite — coordinate with anyone who has the repo cloned). With [git-filter-repo](https://github.com/newren/git-filter-repo):
   ```bash
   # from a fresh mirror clone, ideally
   git filter-repo --path .cursor/mcp.json --invert-paths
   ```
   or with BFG:
   ```bash
   bfg --delete-files mcp.json
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```
   Then force-push and have all collaborators re-clone. **Rotation (step 1) is what actually neutralizes the leak** — the purge just removes the stale value from history.

---

## 1. Apply the DB migrations (in a Supabase branch first, then prod)

All migration files are in `supabase/migrations/`. **Apply in this order** (also the natural lexical order except the timestamped one). Ideally test on a [Supabase preview branch](https://supabase.com/docs/guides/platform/branching) before prod.

| Order | File | Effect | App coupling |
|---|---|---|---|
| 1 | `010_drop_record_click_overload.sql` | Drops the stale 7-arg `record_click` → fixes silent click loss (PGRST203). | None — safe standalone. Fixes analytics immediately. |
| 2 | `011_secure_link_creation.sql` | `create_link`/`create_deep_link` reject a forged `p_user_id`; deep-link scheme validation. | None — the app already passes the honest `user?.id`. |
| 3 | `015_drop_redundant_indexes.sql` | Drops two redundant indexes. | None. |
| 4 | `20250715073856_drop_public_links_policy.sql` | Now `IF EXISTS` — safe/no-op re-apply. | None. |
| 5 | `012_lock_down_links_read.sql` | **Removes anon table-read**; adds `get_link_by_short_code` RPC + owner-only SELECT. | **YES — see step 2.** After this, redirects only work via the RPC. |
| 6 | `013_atomic_click_tracking.sql` | Adds atomic `record_click_and_increment` (IP-masked, referrer_domain derived); drops old `record_click`/`increment_link_clicks`. | **YES — route.ts must call the new RPC.** |
| 7 | `014_analytics_aggregation_rpcs.sql` | Adds `GROUP BY` aggregation RPCs (SECURITY INVOKER). | **YES — analytics.ts must call them.** |

> Steps 5–7 (migrations 012/013/014) and the paired app deploy (step 2) are a **lockstep pair**: apply the migrations, then deploy the app. If you deploy the app first, redirects/analytics break; if you apply 012/013 without the app, redirects break (old code selects a table it can no longer read, and calls dropped functions).

## 2. Deploy the app commit (only after step 1 migrations 012/013/014 are live)

Commit `ffa8e0d` (`fix(app): use gated RPCs…`) switches `route.ts` and `lib/analytics.ts` to the new RPCs. Deploy it **after** the migrations are applied. Merging the whole branch is fine as long as the DB migrations are applied before the new build serves traffic.

## 3. Post-apply verification (do these against the live DB)

- **Redirect + 404:** hit a real short code (redirects), then a nonexistent one (must return **404, not 500** — the `SETOF` return type was specifically fixed to guarantee this).
- **Click recording:** click a link, confirm a row lands in `clicks` AND `links.total_clicks` increments by exactly 1 (no double-count, no PGRST203).
- **IP masking:** confirm stored `clicks.ip_address` is masked (e.g. `x.x.x.0/24`), not the raw IP.
- **Anon lockdown:** with only the anon key, `supabase.from('links').select('*')` must now return **0 rows** (or RLS error), not the table.
- **Ownership guard:** try `rpc('create_link', { p_user_id: '<someone-else-uuid>' })` with the anon key → must RAISE (rejected).
- **Analytics:** dashboard charts still render for the owner (aggregation RPCs honor clicks RLS). Referrers now show real domains (once new clicks accrue).
- **Countries:** `record_click_and_increment` now stores `country` from Vercel's `x-vercel-ip-country` edge header (migration 017), so the Countries chart populates for real traffic on Vercel (it stays empty in local dev, where the header is absent).

## 4. Regenerate types (recommended, after migrations land)

Once the schema is live, regenerate `src/types/database.ts` from the source of truth to replace the hand-added RPC types and drop the stale `record_click`/`increment_link_clicks` entries (finding L-15 / G-13):
```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

---

## Still NOT done (need decisions/infra)

- **G-9 rate limiting + anonymous analytics-write authz (M-2, M-9)** — needs Upstash/Redis (or similar). Not authored; the atomic RPC narrows the surface but does not throttle. Provision infra, then add a token-bucket in the redirect + creation paths.
- **G-8 `country` population** — DONE (migration 017). `record_click_and_increment` + `route.ts` capture `country` from Vercel's `x-vercel-ip-country` header (no external geo-IP service). Populates on Vercel; null in local dev.
- **Backlog (autonomous, deferred):** H-7 chart/aggregation component consolidation (now unblocked by 014 — do next), M-14 deeplinks table-driven refactor, M-15 useAuth context, `text-primary` contrast token, exotic-IPv6 SSRF residuals. See REMEDIATION_SUMMARY.md §5.

## Rollback
Each gated migration is reversible: 010/013/015 restore by recreating the dropped functions/indexes from 007/008/002/001; 011/012/014 are `CREATE OR REPLACE`/policy swaps — revert by reapplying the prior definitions (007 for create fns; recreate "Combined view policy" for 012). The app commit `ffa8e0d` reverts with `git revert`. Because 012 changes anon visibility, roll back the app deploy and migration 012 together.
