export const meta = {
  name: 'dashboard-improve',
  description: 'Implement P0/P1 dashboard findings sequentially (Sonnet improvers) and review each (Fable)',
  phases: [
    { title: 'Improve', detail: 'one Sonnet 5 improver per file-group, run sequentially' },
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

// args can arrive as a JSON string depending on how it was passed — parse defensively.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
const findings = A.findings ?? []
const backlogPath = A.backlogPath ?? ''

// Group findings by primary file.
const groups = {}
for (const f of findings) {
  const key = (f.files && f.files[0]) || f.surface
  ;(groups[key] ||= []).push(f)
}

// Foundation-first ordering: design tokens, then shell/layout, then shared components, then pages.
// Sequential execution means later agents see earlier edits (e.g. a new token), so ordering matters.
const priority = (file) => {
  if (file.endsWith('globals.css')) return 0
  if (file.endsWith('layout.tsx')) return 1
  if (file.includes('DashboardSidebar')) return 2
  if (file.includes('/components/ui/')) return 3
  if (file.includes('/components/charts/') || file.includes('/components/dashboard/')) return 4
  if (file.includes('/components/')) return 5
  if (file.includes('/dashboard/page.tsx')) return 6
  return 7
}
const groupList = Object.entries(groups)
  .map(([file, items]) => ({ file, items }))
  .sort((a, b) => priority(a.file) - priority(b.file))

// Sequential: improve -> review, one group at a time. No two agents touch the tree concurrently,
// which eliminates cross-group file collisions (worktree isolation is intentionally NOT used because
// its edits would strand on a separate branch and never reach the tree we gate + commit).
const out = []
for (const g of groupList) {
  const ids = g.items.map((i) => i.id)
  const titles = g.items.map((i) => `- ${i.id} [${i.severity}]: ${i.title}`).join('\n')

  phase('Improve')
  const applied = await agent(
    `You are a senior frontend engineer on tws.bio (Next.js 16 App Router, React 19, Tailwind v4, shadcn-style components, Supabase).\n` +
    `Read the full findings backlog at "${backlogPath}" (a JSON array). Implement ONLY the findings with these ids: ${JSON.stringify(ids)}.\n` +
    `They center on "${g.file}". For reference:\n${titles}\n\n` +
    `Use each finding's "detail" and "suggested_change" fields from the backlog file as your spec.\n\n` +
    `Hard rules:\n` +
    `- Edit ONLY within: src/app/dashboard/**, src/components/dashboard/**, src/components/charts/**, src/components/ui/**, src/components/CreateLinkForm.tsx, src/components/TimeRangePicker.tsx, src/components/SocialIcon.tsx, and src/app/globals.css (tokens only).\n` +
    `- NO database, RPC, Supabase query-shape, auth, middleware, or public/marketing-page changes. NO new npm dependencies.\n` +
    `- Preserve server/client component boundaries: keep server components server-only; add "use client" only when introducing interactivity, and factor interactivity into a small child client component rather than converting a data-fetching server component.\n` +
    `- Earlier improvers in this same run may have ALREADY added design tokens or refactors — re-read globals.css and any shared file before editing so you build on (not clobber) prior changes.\n` +
    `- Match conventions: named exports, inline Tailwind, green primary (#00802B solid-fill only; use the AA-legible green token for green TEXT on dark — check globals.css for --ring/#00B03B or a --primary-text token), --font-heading (DM Serif) for display headings, existing Card/Table/Badge/Button primitives.\n` +
    `- Make the change genuinely better and cohesive, not merely different. Keep the diff focused on the findings. No type errors, no unused imports, valid JSX.\n\n` +
    `Return the exact list of files you changed and a one-paragraph summary.`,
    { label: `improve:${g.file}`, phase: 'Improve', model: 'sonnet', schema: APPLIED_SCHEMA }
  )

  phase('Review')
  const review = await agent(
    `Review this dashboard change for correctness and whether it actually resolves its findings without regressions or scope creep.\n\n` +
    `Findings it was meant to fix (ids): ${JSON.stringify(ids)} — read their full detail/suggested_change from the backlog at "${backlogPath}".\n${titles}\n\n` +
    `Reported change:\n${JSON.stringify(applied, null, 2)}\n\n` +
    `Read the changed files to verify. Set ok=false (with specific notes) if it: misses the finding's intent, introduces a type/JSX error, converts a server component to client unnecessarily, edits outside the allowed fence, adds a dependency, or changes data/auth logic. Otherwise ok=true.`,
    { label: `review:${g.file}`, phase: 'Review', model: 'fable', schema: REVIEW_SCHEMA }
  )

  out.push({
    id: g.items.map((i) => i.id).join(','),
    files: applied?.files ?? [],
    summary: applied?.summary ?? '',
    review: { ok: review?.ok ?? false, notes: review?.notes ?? '' },
  })
}

return {
  applied: out.map((r) => ({ id: r.id, files: r.files, summary: r.summary })),
  review: out.map((r) => ({ id: r.id, ok: r.review.ok, notes: r.review.notes })),
}
