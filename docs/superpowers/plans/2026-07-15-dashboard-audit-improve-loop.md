# Dashboard Audit → Improve Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a fully-autonomous, multi-agent audit→improve loop that raises the tws.bio authenticated dashboard on UX, visual-design, and gap-analysis lenses, verifying each round against a real seeded browser session.

**Architecture:** Each round = two Workflow runs. AUDIT fans out Sonnet 5 auditors (one per dashboard surface, three lenses each) → a Fable 5 synthesis agent ranks findings into a P0/P1/P2 backlog. IMPROVE fans out Sonnet 5 improvers (one per actioned P0/P1 finding, worktree-isolated) → build/typecheck/lint gate → Playwright visual check → Fable 5 review agent. The main session drives rounds, commits one commit per round, and stops when an audit yields no new P0/P1 or after 3 rounds.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 / Supabase; Claude Workflow tool (Fable 5 + Sonnet 5 agents); Playwright MCP browser tools; existing `npm run typecheck|lint|build`.

## Global Constraints

- Node 22.x (`engines.node >=22.13.0 <23.0.0`) — do not use features requiring Node 23.
- Edit fence (hard): `src/app/dashboard/**`, `src/components/dashboard/**`, `src/components/charts/**`, and `src/app/globals.css` tokens **only if** a visual change requires it. NO changes to DB schema, RPCs, Supabase auth config, `src/proxy.ts`, or public/auth pages.
- No new npm dependencies without surfacing them in the round report.
- Every accepted round must leave `npm run typecheck`, `npm run lint`, and `npm run build` green.
- Work stays on branch `dashboard-audit-improve`; one commit per round; nothing pushed, no PR.
- Models: synthesis + review agents = `fable`; auditor + improver agents = `sonnet`.
- Actioned per round = P0 + P1 only; P2 carried forward. Round cap = 3. Terminate early on a zero-new-P0/P1 audit.
- Test account + fixtures are namespaced (`audit-bot@tws.bio`) and removable; never treated as real app data.

## File Structure

Created by this plan (harness + artifacts; NOT dashboard source — that is edited by the IMPROVE workflow at runtime):

- `scripts/audit/seed-test-account.sql` — idempotent SQL to create the confirmed test user + fixture links/clicks.
- `scripts/audit/workflow-audit.mjs` — AUDIT workflow script (persisted copy for re-runs).
- `scripts/audit/workflow-improve.mjs` — IMPROVE workflow script (persisted copy for re-runs).
- `docs/superpowers/audit-runs/round-<n>-backlog.json` — ranked backlog per round (written by the driver).
- `docs/superpowers/audit-runs/report.md` — final human-readable report.
- Baseline/after screenshots live in the session scratchpad (not committed).

---

### Task 1: Seed the test account + fixture data

**Files:**
- Create: `scripts/audit/seed-test-account.sql`

**Interfaces:**
- Produces: a confirmed Supabase auth user `audit-bot@tws.bio` / password `__AUDIT_BOT_PASSWORD__`, with ~8 links (mix of `url` and `deep_link`, active + inactive) and ~200 `clicks` rows spread across dates (last 60 days), devices, browsers, and referrer domains — enough that every dashboard chart and table renders a populated state.

- [ ] **Step 1: Write the seed SQL**

Create `scripts/audit/seed-test-account.sql`:

```sql
-- Idempotent seed for the dashboard-audit test account.
-- Safe to re-run: deletes prior audit-bot data first.

-- 1. Remove any prior test user + its data (cascade via FKs on user_id/link_id).
delete from auth.users where email = 'audit-bot@tws.bio';

-- 2. Create a confirmed email/password user.
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'audit-bot@tws.bio', crypt('__AUDIT_BOT_PASSWORD__', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ) returning id
),
ident as (
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    created_at, updated_at, last_sign_in_at
  )
  select gen_random_uuid(), id, id::text,
         jsonb_build_object('sub', id::text, 'email', 'audit-bot@tws.bio'),
         'email', now(), now(), now()
  from new_user
  returning user_id
)
-- 3. Ensure a profiles row exists (in case no trigger creates it).
insert into profiles (id, email, full_name)
select id, 'audit-bot@tws.bio', 'Audit Bot' from new_user
on conflict (id) do nothing;

-- 4. Seed links for the test user.
with u as (select id from auth.users where email = 'audit-bot@tws.bio')
insert into links (id, user_id, short_code, original_url, link_type, is_active, total_clicks, created_at)
select gen_random_uuid(), u.id, v.short_code, v.original_url, v.link_type::link_type, v.is_active, 0,
       now() - (v.age_days || ' days')::interval
from u, (values
  ('promo01', 'https://example.com/spring-sale',            'url',       true,  55),
  ('promo02', 'https://example.com/blog/launch',            'url',       true,  30),
  ('igbio01', 'https://instagram.com/thewellnessstudio',    'deep_link', true,  20),
  ('ytvid01', 'https://youtube.com/watch?v=dQw4w9WgXcQ',    'deep_link', true,  15),
  ('spot001', 'https://open.spotify.com/track/abc',         'deep_link', true,  10),
  ('shop001', 'https://shop.example.com/product/42',        'url',       true,   8),
  ('old0001', 'https://example.com/archived',               'url',       false,  5),
  ('empty01', 'https://example.com/no-clicks-yet',          'url',       true,   0)
) as v(short_code, original_url, link_type, is_active, age_days);

-- 5. Seed ~200 clicks spread across the seeded links.
with u as (select id from auth.users where email = 'audit-bot@tws.bio'),
     lk as (select id, row_number() over (order by short_code) rn from links
            where user_id = (select id from u))
insert into clicks (id, link_id, clicked_at, device_type, browser_name, os_name, referrer_domain, country)
select
  gen_random_uuid(),
  (select id from lk where rn = 1 + (g % 6)),
  now() - ((g % 60) || ' days')::interval - ((g % 24) || ' hours')::interval,
  (array['mobile','desktop','tablet'])[1 + (g % 3)],
  (array['Chrome','Safari','Firefox','Edge','Samsung Internet'])[1 + (g % 5)],
  (array['iOS','Android','Windows','macOS'])[1 + (g % 4)],
  (array['instagram.com','youtube.com','google.com','t.co','Direct','linkedin.com'])[1 + (g % 6)],
  (array['US','GB','IN','CA','DE','AU'])[1 + (g % 6)]
from generate_series(0, 199) as g;

-- 6. Sync total_clicks to the seeded click counts.
update links l set total_clicks = c.n
from (select link_id, count(*) n from clicks group by link_id) c
where l.id = c.link_id and l.user_id = (select id from auth.users where email='audit-bot@tws.bio');
```

- [ ] **Step 2: Apply the seed via Supabase MCP**

Run the file contents through the Supabase MCP `execute_sql` tool against the project. (Preflight: confirm `pgcrypto` is available via `list_extensions`; it is standard on Supabase. Confirm the `link_type` enum name and the `clicks` column names with `list_tables` before running — adjust the cast/columns if the schema differs.)

Expected: no error; final `update` reports 8 rows.

- [ ] **Step 3: Verify the account logs in and data renders**

Start dev server (Task 2 covers reuse). Using Playwright MCP: navigate to `http://localhost:3000/login`, fill `audit-bot@tws.bio` / `__AUDIT_BOT_PASSWORD__`, submit.
Expected: redirect to `/dashboard`; Overview shows non-zero Total Links / Total Clicks and a populated Recent Links table.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/seed-test-account.sql
git commit -m "chore(audit): seed test account + fixtures for dashboard visual verification"
```

---

### Task 2: Capture baseline screenshots

**Files:**
- No source files. Output: PNGs in the session scratchpad under `.../scratchpad/audit/baseline/`.

**Interfaces:**
- Consumes: the running dev server + logged-in `audit-bot` session from Task 1.
- Produces: `baseline/<surface>-<desktop|mobile>.png` for every in-scope surface, referenced by auditor agents and by the after/before diff at each round's end.

- [ ] **Step 1: Start the dev server (background)**

Run: `npm run dev` in the background. Wait until it serves `http://localhost:3000`.

- [ ] **Step 2: Screenshot every surface at two widths**

Using Playwright MCP, logged in as audit-bot, for each URL below, resize to desktop (1440×900) then mobile (390×844) and take a full-page screenshot:

- `/dashboard` (Overview)
- `/dashboard/links` (Links list)
- `/dashboard/links/<seeded-link-id>` (Link detail) — grab an id from the links table
- `/dashboard/analytics` (Analytics)
- `/dashboard/campaigns` (Campaigns list)
- `/dashboard/create` (Create link)

Save as `.../scratchpad/audit/baseline/<surface>-<desktop|mobile>.png`.

- [ ] **Step 3: Verify coverage**

Expected: 12 baseline PNGs exist (6 surfaces × 2 widths). Missing any → re-shoot before proceeding.

---

### Task 3: Author the AUDIT workflow

**Files:**
- Create: `scripts/audit/workflow-audit.mjs`

**Interfaces:**
- Consumes: `args` = `{ round: number, baselineDir: string, priorFindings: object[] }`.
- Produces: return value `{ backlog: Finding[] }` where `Finding = { id, surface, lens: 'ux'|'visual'|'gap', severity: 'P0'|'P1'|'P2', title, detail, files: string[], suggested_change }`, ranked most-severe first, deduped against `priorFindings`.

- [ ] **Step 1: Write the AUDIT workflow script**

Create `scripts/audit/workflow-audit.mjs`:

```javascript
export const meta = {
  name: 'dashboard-audit',
  description: 'Audit each dashboard surface on UX, visual, and gap lenses; synthesize a ranked backlog',
  phases: [
    { title: 'Audit', detail: 'one Sonnet 5 auditor per surface' },
    { title: 'Synthesize', detail: 'Fable 5 ranks + dedupes into P0/P1/P2 backlog' },
  ],
}

const SURFACES = [
  { key: 'shell',     label: 'Sidebar + dashboard layout', files: ['src/app/dashboard/layout.tsx', 'src/components/dashboard/DashboardSidebar.tsx'] },
  { key: 'overview',  label: 'Overview',      files: ['src/app/dashboard/page.tsx', 'src/components/dashboard/StatCard.tsx', 'src/components/dashboard/ClickChart.tsx'] },
  { key: 'links',     label: 'Links list',    files: ['src/app/dashboard/links/page.tsx', 'src/components/dashboard/LinkActions.tsx'] },
  { key: 'linkDetail',label: 'Link detail',   files: ['src/app/dashboard/links/[id]/page.tsx'] },
  { key: 'analytics', label: 'Analytics',     files: ['src/app/dashboard/analytics/page.tsx', 'src/components/dashboard/DeviceChart.tsx', 'src/components/dashboard/BrowserChart.tsx', 'src/components/dashboard/ReferrerChart.tsx'] },
  { key: 'campaigns', label: 'Campaigns',     files: ['src/app/dashboard/campaigns/page.tsx', 'src/app/dashboard/campaigns/[id]/page.tsx'] },
  { key: 'create',    label: 'Create link',   files: ['src/app/dashboard/create/page.tsx', 'src/components/CreateLinkForm.tsx'] },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lens', 'severity', 'title', 'detail', 'files', 'suggested_change'],
        properties: {
          lens: { type: 'string', enum: ['ux', 'visual', 'gap'] },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          suggested_change: { type: 'string' },
        },
      },
    },
  },
}

const BACKLOG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['backlog'],
  properties: {
    backlog: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'surface', 'lens', 'severity', 'title', 'detail', 'files', 'suggested_change'],
        properties: {
          id: { type: 'string' },
          surface: { type: 'string' },
          lens: { type: 'string', enum: ['ux', 'visual', 'gap'] },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          suggested_change: { type: 'string' },
        },
      },
    },
  },
}

const round = args?.round ?? 1
const baselineDir = args?.baselineDir ?? ''
const prior = JSON.stringify(args?.priorFindings ?? [])

phase('Audit')
const perSurface = await parallel(SURFACES.map((s) => () =>
  agent(
    `You are a senior product designer auditing the tws.bio dashboard surface "${s.label}".\n` +
    `Read these files: ${s.files.join(', ')}.\n` +
    `A baseline screenshot set is at: ${baselineDir} (files named ${s.key}-desktop.png / ${s.key}-mobile.png when present) — read them.\n` +
    `Score the surface on THREE lenses and report concrete findings:\n` +
    `- ux: hierarchy, empty/loading/error states, responsiveness, friction.\n` +
    `- visual: typography, color, spacing, motion; call out anything that reads as templated shadcn default rather than intentional design. The app has a green primary (#00802B) and an UNUSED DM Serif heading font available as font-heading — note where it should be used.\n` +
    `- gap: important MISSING affordances (e.g. links table lacks search/filter/sort; stat cards lack trend deltas; no export; redundant inner page headers stacked on the sidebar layout).\n` +
    `Severity: P0 = blocks a task / a11y failure / glaring defect; P1 = real friction, notable inconsistency, high-value gap; P2 = polish.\n` +
    `Be specific and actionable. Do NOT propose backend/DB/auth changes.`,
    { label: `audit:${s.key}`, phase: 'Audit', model: 'sonnet', schema: FINDINGS_SCHEMA }
  ).then((r) => ({ surface: s.key, findings: r?.findings ?? [] }))
))

const flat = perSurface.filter(Boolean).flatMap((s) =>
  s.findings.map((f) => ({ ...f, surface: s.surface }))
)

phase('Synthesize')
const synth = await agent(
  `You are the lead design reviewer. Here are raw findings from per-surface auditors (JSON):\n` +
  `${JSON.stringify(flat)}\n\n` +
  `Findings already resolved in prior rounds (do NOT re-report these or near-duplicates):\n${prior}\n\n` +
  `Produce a single ranked backlog: dedupe cross-surface duplicates, merge related items, assign a stable short kebab-case id to each, and sort most-severe first (all P0, then P1, then P2). Keep every field. Return ONLY new, unresolved findings.`,
  { label: 'synthesize', phase: 'Synthesize', model: 'fable', schema: BACKLOG_SCHEMA }
)

return { backlog: synth?.backlog ?? [] }
```

- [ ] **Step 2: Dry-run the AUDIT workflow (round 1)**

Invoke the Workflow tool with `{ scriptPath: 'scripts/audit/workflow-audit.mjs', args: { round: 1, baselineDir: '<scratchpad>/audit/baseline', priorFindings: [] } }`.
Expected: completes; returns `{ backlog: [...] }` with a non-empty, ranked list; at least the known "redundant inner headers on create/link-detail" gap and "DM Serif heading font unused" visual finding appear.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit/workflow-audit.mjs
git commit -m "feat(audit): AUDIT workflow — per-surface Sonnet auditors + Fable synthesis"
```

---

### Task 4: Author the IMPROVE workflow

**Files:**
- Create: `scripts/audit/workflow-improve.mjs`

**Interfaces:**
- Consumes: `args` = `{ round: number, findings: Finding[] }` (the P0+P1 slice of the backlog).
- Produces: return value `{ applied: {id, files, summary}[], review: {id, ok, notes}[] }`. Improver agents edit files in worktrees; the workflow returns what changed. The gate + commit happen in the driver (Task 5), NOT here.

- [ ] **Step 1: Write the IMPROVE workflow script**

Create `scripts/audit/workflow-improve.mjs`:

```javascript
export const meta = {
  name: 'dashboard-improve',
  description: 'Implement P0/P1 dashboard findings (Sonnet improvers) and review each (Fable)',
  phases: [
    { title: 'Improve', detail: 'one Sonnet 5 improver per finding group' },
    { title: 'Review', detail: 'Fable 5 verifies each change matches intent' },
  ],
}

const APPLIED_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['files', 'summary'],
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}
const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['ok', 'notes'],
  properties: { ok: { type: 'boolean' }, notes: { type: 'string' } },
}

const findings = args?.findings ?? []

// Group findings by primary file so two agents never edit the same file in parallel.
const groups = {}
for (const f of findings) {
  const key = (f.files && f.files[0]) || f.surface
  ;(groups[key] ||= []).push(f)
}
const groupList = Object.entries(groups).map(([file, items]) => ({ file, items }))

phase('Improve')
const results = await pipeline(
  groupList,
  // Stage 1: implement (worktree-isolated so parallel edits don't collide).
  (g) => agent(
    `You are a senior frontend engineer on tws.bio (Next.js 16, React 19, Tailwind v4, shadcn-style components).\n` +
    `Implement these dashboard findings, all touching around "${g.file}":\n${JSON.stringify(g.items)}\n\n` +
    `Rules:\n` +
    `- Edit ONLY within src/app/dashboard/**, src/components/dashboard/**, src/components/charts/**, or src/components/CreateLinkForm.tsx. Touch src/app/globals.css tokens ONLY if strictly required, and say so in your summary.\n` +
    `- No DB/RPC/auth changes. No new npm dependencies.\n` +
    `- Match existing conventions (named exports, inline Tailwind, green primary, font-heading = DM Serif).\n` +
    `- Make the change genuinely better, not just different. Keep diffs focused.\n` +
    `Return the files you changed and a one-paragraph summary.`,
    { label: `improve:${g.file}`, phase: 'Improve', model: 'sonnet', isolation: 'worktree', schema: APPLIED_SCHEMA }
  ).then((r) => ({ group: g, applied: r })),
  // Stage 2: review (Fable) as soon as each group's change lands.
  (res) => agent(
    `Review this dashboard change for correctness and whether it actually resolves its findings without regressions or scope creep.\n` +
    `Findings: ${JSON.stringify(res.group.items)}\n` +
    `Reported change: ${JSON.stringify(res.applied)}\n` +
    `Read the changed files to verify. Return ok=false with notes if it misses intent, breaks types, or edits out of fence.`,
    { label: `review:${res.group.file}`, phase: 'Review', model: 'fable', schema: REVIEW_SCHEMA }
  ).then((rev) => ({
    ids: res.group.items.map((i) => i.id),
    files: res.applied?.files ?? [],
    summary: res.applied?.summary ?? '',
    review: rev,
  }))
)

const clean = results.filter(Boolean)
return {
  applied: clean.map((r) => ({ id: r.ids.join(','), files: r.files, summary: r.summary })),
  review: clean.map((r) => ({ id: r.ids.join(','), ok: r.review?.ok ?? false, notes: r.review?.notes ?? '' })),
}
```

- [ ] **Step 2: Smoke-test IMPROVE on a single low-risk finding**

Pick one P2-ish visual finding from Task 3's backlog (e.g. "apply font-heading to dashboard h1 titles"), invoke Workflow `{ scriptPath: 'scripts/audit/workflow-improve.mjs', args: { round: 0, findings: [thatFinding] } }`.
Expected: returns `applied` with the changed file + a `review.ok = true`. Then run the gate:

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass. If they pass, revert this smoke change (`git restore` / `git checkout -- <file>`) so Round 1 starts clean, OR keep it and let it count as round 1 — driver decides. For the smoke test, revert.

- [ ] **Step 3: Commit the workflow script**

```bash
git add scripts/audit/workflow-improve.mjs
git commit -m "feat(audit): IMPROVE workflow — Sonnet improvers (worktree) + Fable review"
```

---

### Task 5: Run the round loop (driver runbook)

**Files:**
- Create per round: `docs/superpowers/audit-runs/round-<n>-backlog.json`
- Modified per round: dashboard source (by the IMPROVE workflow)

**Interfaces:**
- Consumes: Tasks 1–4 artifacts.
- Produces: up to 3 round commits on `dashboard-audit-improve`, each green on the gate and Playwright-verified.

This task is executed by the main session, not a subagent. Repeat the round body for round `n = 1, 2, 3`, carrying `priorFindings` forward.

- [ ] **Step 1: AUDIT** — Invoke Workflow `workflow-audit.mjs` with `args = { round: n, baselineDir, priorFindings: <all findings resolved in rounds < n> }`. Write the returned backlog to `docs/superpowers/audit-runs/round-<n>-backlog.json`.

- [ ] **Step 2: Termination check** — If the backlog has **zero P0 and zero P1** findings, stop the loop (record P2s as carried-forward) and go to Task 6. Else continue.

- [ ] **Step 3: IMPROVE** — Slice the backlog to P0+P1, invoke Workflow `workflow-improve.mjs` with `args = { round: n, findings: <P0+P1> }`.

- [ ] **Step 4: Gate** — Run `npm run typecheck && npm run lint && npm run build`. If any fail, inspect the offending change; revert just that finding's files (`git checkout -- <files>`) and note it as deferred. Re-run until green.

- [ ] **Step 5: Reconcile review** — Drop any change whose Fable review returned `ok: false` (revert its files). Keep only reviewed-ok, gate-green changes.

- [ ] **Step 6: Visual verify** — With the dev server running and logged in as audit-bot, re-screenshot each surface (desktop + mobile) to `.../scratchpad/audit/round-<n>/`. Compare against baseline/previous round: confirm no surface is broken (blank, overflowing, unstyled). Any regression → revert the responsible change.

- [ ] **Step 7: Commit the round**

```bash
git add -A -- src/ docs/superpowers/audit-runs/
git commit -m "feat(dashboard): audit→improve round <n> — <k> findings resolved"
```

- [ ] **Step 8: Loop** — Append this round's resolved findings to `priorFindings` and repeat from Step 1 as round `n+1`, unless `n == 3` (cap reached) → go to Task 6.

---

### Task 6: Final report + finish the branch

**Files:**
- Create: `docs/superpowers/audit-runs/report.md`

- [ ] **Step 1: Write the report**

Summarize, per round: findings surfaced (by severity/lens), what landed (id → change → files), what was deferred/reverted and why, any token edits / dependency notes / out-of-fence flags, and the carried-forward P2 list. Include a before/after note per surface.

- [ ] **Step 2: Verify final state**

Run: `npm run typecheck && npm run lint && npm run build && npm run test`
Expected: all pass.

- [ ] **Step 3: Commit the report**

```bash
git add docs/superpowers/audit-runs/report.md
git commit -m "docs(audit): final dashboard audit→improve report"
```

- [ ] **Step 4: Finish**

Invoke `superpowers:finishing-a-development-branch` to choose merge/PR/cleanup for `dashboard-audit-improve`. Note whether the test account/fixtures should be torn down (re-run of seed SQL's delete step) before merge.

---

## Self-Review Notes

- **Spec coverage:** three lenses (Task 3 auditor prompt) ✓; per-surface auditors + Fable synthesis ✓; Sonnet improvers worktree-isolated + gate + Fable review (Task 4) ✓; seeded login + Playwright verify (Tasks 1, 2, 5·6) ✓; fully autonomous, ≤3 rounds, terminate on clean (Task 5) ✓; scope fence + commit-per-round + nothing pushed (Global Constraints, Task 5·7) ✓; final report (Task 6) ✓.
- **Fence risk:** globals.css token edits are allowed-if-needed per spec; improver prompt + review both enforce the "say so" rule.
- **Model assignment:** `sonnet` for auditors/improvers, `fable` for synthesis/review — consistent across Tasks 3–4.
- **Known constraint carried into execution:** exact `clicks`/`links` column names + `link_type` enum must be confirmed against live schema in Task 1 Step 2 before running the seed.
