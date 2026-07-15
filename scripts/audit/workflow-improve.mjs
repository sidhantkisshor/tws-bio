export const meta = {
  name: 'dashboard-improve',
  description: 'Implement P0/P1 dashboard findings (Sonnet improvers) and review each (Fable)',
  phases: [
    { title: 'Improve', detail: 'one Sonnet 5 improver per file-group' },
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
  // Stage 1: implement directly in the working tree. Findings are grouped by primary
  // file so no two concurrent improvers own the same file; each is told to edit ONLY
  // its group's files. (Worktree isolation is intentionally NOT used — its edits would
  // strand on a separate branch and never reach the tree we gate + commit.)
  (g) => agent(
    `You are a senior frontend engineer on tws.bio (Next.js 16 App Router, React 19, Tailwind v4, shadcn-style components, Supabase).\n` +
    `Implement these dashboard findings, all centered on "${g.file}":\n${JSON.stringify(g.items, null, 2)}\n\n` +
    `Hard rules:\n` +
    `- Edit ONLY within: src/app/dashboard/**, src/components/dashboard/**, src/components/charts/**, src/components/CreateLinkForm.tsx, src/components/TimeRangePicker.tsx, src/components/SocialIcon.tsx. You may touch src/app/globals.css ONLY to add/adjust design tokens and ONLY if strictly required — if you do, state it explicitly in your summary.\n` +
    `- NO database, RPC, Supabase, auth, middleware, or public/marketing-page changes. NO new npm dependencies.\n` +
    `- Preserve all existing data-fetching and server/client component boundaries. Keep server components server-only; add "use client" only when introducing interactivity, and factor client interactivity into a child component rather than converting a data-fetching server component.\n` +
    `- Match conventions: named exports, inline Tailwind utility classes, green primary (#00802B / ring #00B03B), the --font-heading (DM Serif) token for display headings, existing Card/Table/Badge/Button primitives in src/components/ui.\n` +
    `- Make the change genuinely better and cohesive, not merely different. Keep the diff focused on the findings.\n` +
    `- Run \`npx tsc --noEmit\` mentally over your edit; do not leave type errors, unused imports, or broken JSX.\n\n` +
    `- Edit ONLY the files listed in the findings above (plus globals.css tokens if strictly required). Do NOT refactor unrelated files — another agent may be editing them concurrently.\n\n` +
    `Return the exact list of files you changed and a one-paragraph summary of what you did and why.`,
    { label: `improve:${g.file}`, phase: 'Improve', model: 'sonnet', schema: APPLIED_SCHEMA }
  ).then((r) => ({ group: g, applied: r })),
  // Stage 2: review (Fable) as soon as each group's change lands.
  (res) => agent(
    `Review this dashboard change for correctness and whether it actually resolves its findings without regressions or scope creep.\n\n` +
    `Findings it was meant to fix:\n${JSON.stringify(res.group.items, null, 2)}\n\n` +
    `Reported change:\n${JSON.stringify(res.applied, null, 2)}\n\n` +
    `Read the changed files to verify. Set ok=false (with specific notes) if it: misses the finding's intent, introduces a type/JSX error, converts a server component to client unnecessarily, edits outside the allowed fence, adds a dependency, or changes data/auth logic. Otherwise ok=true.`,
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
