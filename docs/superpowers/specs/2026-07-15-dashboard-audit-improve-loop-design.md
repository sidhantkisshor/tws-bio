# Dashboard Audit → Improve Loop — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)
**Scope owner:** siddhanthkishore

## Goal

Iteratively raise the quality of the **authenticated dashboard** on three axes:

1. **UX / usability** — information hierarchy, empty/loading/error states, mobile responsiveness, friction in core flows.
2. **Visual redesign** — typography, color, spacing, motion; move the dashboard off templated shadcn defaults into a distinctive, intentional look.
3. **Gap analysis** — surface important missing affordances (search/filter/sort on links, trend deltas on stat cards, export, per-link sparklines, bulk actions, etc.).

Delivered via a **multi-agent audit → improve loop** that runs fully autonomously until the dashboard audit surfaces no new high-priority findings.

## Orchestration Model

The mechanism is **two Workflow runs per round**, driven by the Opus main loop between rounds:

- **Fable 5** = orchestration role — the AUDIT synthesis/prioritization agent and the IMPROVE review agent.
- **Sonnet 5** = execution role — the per-surface auditor agents and the per-finding improver agents.

```
Round N:
  [AUDIT workflow]
    Sonnet 5 auditors  (1 per surface, 3 lenses each)  ─┐
                                                          ├─►  Fable 5 synthesis ──► ranked P0/P1/P2 backlog
    (parallel fan-out, structured findings)             ─┘
  [IMPROVE workflow]
    Sonnet 5 improvers (1 per actioned finding, worktree-isolated)
        └─► build/typecheck/lint gate
        └─► Playwright visual verification (seeded login)
        └─► Fable 5 review agent (change matches finding intent?)
  [Re-audit] → next round's AUDIT confirms remaining P0/P1
```

**Autonomy:** fully autonomous — no human checkpoints between rounds. Each round is committed separately so the diff is reviewable/revertable after the fact.

**Termination:** stop when an AUDIT round yields **zero new P0/P1** findings, **capped at 3 rounds** regardless.

## Scope

### In scope (surfaces)
| Surface | File |
|---|---|
| Shell / nav | `src/app/dashboard/layout.tsx`, `src/components/dashboard/DashboardSidebar.tsx` |
| Overview | `src/app/dashboard/page.tsx` |
| Links list | `src/app/dashboard/links/page.tsx` |
| Link detail | `src/app/dashboard/links/[id]/page.tsx` |
| Analytics | `src/app/dashboard/analytics/page.tsx` |
| Campaigns | `src/app/dashboard/campaigns/page.tsx`, `.../[id]/page.tsx` |
| Create link | `src/app/dashboard/create/page.tsx` |
| Dashboard components | `src/components/dashboard/*`, `src/components/charts/*` |

### Editable also-if-needed
- `src/app/globals.css` design tokens — only when the visual redesign genuinely requires new/adjusted tokens. Token changes must be additive/safe (they cascade to public pages too), and any such change is called out explicitly in the round's commit message.

### Hard out of scope
- Public pages (home, resources, auth), DB schema, RPCs, Supabase auth config, middleware.
- No new npm dependencies without flagging in the round report.

## Audit Detail

Each Sonnet 5 auditor owns **one surface** and scores it on the **three lenses**. It returns structured findings:

```json
{
  "surface": "overview",
  "findings": [
    {
      "lens": "ux | visual | gap",
      "severity": "P0 | P1 | P2",
      "title": "short imperative",
      "detail": "what's wrong / missing and why it matters",
      "files": ["src/app/dashboard/page.tsx"],
      "suggested_change": "concrete direction"
    }
  ]
}
```

**Severity rubric:**
- **P0** — broken/confusing enough to block a core task, accessibility failure (contrast/keyboard/focus), or a glaring visual defect.
- **P1** — meaningful UX friction, notable visual inconsistency, or a high-value missing affordance.
- **P2** — polish, nice-to-have, minor inconsistency.

The **Fable 5 synthesis** agent dedupes cross-surface findings, resolves conflicts, and emits a single ranked backlog. Only **P0 + P1** are actioned per round; P2 carried forward.

## Improve Detail

- One **Sonnet 5 improver** per actioned finding, each in an **isolated git worktree** (`isolation: 'worktree'`) so parallel edits to shared files don't collide. Improvers touching the same file are serialized into one agent to avoid merge conflicts.
- After merge-back, a **gate** runs `npm run typecheck && npm run lint && npm run build`. A failing gate blocks the round; the improver's change is reverted and re-attempted or dropped with a logged reason.
- **Fable 5 review** agent confirms each landed change addresses its finding without regressions or scope creep.

## Visual Verification (seeded login)

Real Playwright verification against a running dev server:

1. **Seed a test account** — create a confirmed Supabase auth user with a known password (via SQL insert into `auth.users` with a bcrypt-hashed password + confirmed email, or the signup flow if email confirmation is disabled — resolved in the plan after checking auth settings).
2. **Seed fixture data** — a handful of links (URL + deep link) and clicks across dates/devices/browsers/referrers so charts and tables render non-empty states.
3. **Drive** — `npm run dev`, Playwright logs in, navigates each surface at desktop + mobile widths, screenshots before/after per round.
4. Auditors and the review agent consult screenshots, not just source.

Test account + fixtures are clearly namespaced and removable; not committed as app data.

## Guardrails

- Nothing is pushed; no PR opened. Work stays on a working branch, one commit per round.
- Each round's report (backlog + what landed + what was deferred + any token/dep/scope notes) is surfaced to the user.
- Silent scope expansion is disallowed — token edits, new deps, or out-of-fence touches must appear in the round report.

## Success Criteria

- 1–3 rounds executed; loop terminates on a clean (no new P0/P1) audit or the 3-round cap.
- `typecheck`, `lint`, `build` all green at the end of every accepted round.
- Playwright confirms each in-scope surface renders correctly (desktop + mobile) with seeded data.
- Final report lists every landed change mapped to its originating finding, plus carried-forward P2s.

## Out of Scope / Non-Goals

- Rewriting data-fetching or analytics aggregation logic beyond what a UX/visual fix requires.
- Backend, auth, or schema changes.
- Public marketing surfaces.
