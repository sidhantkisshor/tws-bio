export const meta = {
  name: 'dashboard-audit',
  description: 'Audit each dashboard surface on UX, visual, and gap lenses; synthesize a ranked backlog',
  phases: [
    { title: 'Audit', detail: 'one Sonnet 5 auditor per surface' },
    { title: 'Synthesize', detail: 'Fable 5 ranks + dedupes into P0/P1/P2 backlog' },
  ],
}

// baseline screenshots are named <shot>-desktop.png / <shot>-mobile.png in baselineDir.
const SURFACES = [
  { key: 'shell',      shot: 'overview',   label: 'Sidebar + dashboard layout', files: ['src/app/dashboard/layout.tsx', 'src/components/dashboard/DashboardSidebar.tsx'] },
  { key: 'overview',   shot: 'overview',   label: 'Overview',    files: ['src/app/dashboard/page.tsx', 'src/components/dashboard/StatCard.tsx', 'src/components/dashboard/ClickChart.tsx', 'src/components/charts/ClicksOverTimeChart.tsx'] },
  { key: 'links',      shot: 'links',      label: 'Links list',  files: ['src/app/dashboard/links/page.tsx', 'src/components/dashboard/LinkActions.tsx'] },
  { key: 'linkDetail', shot: 'linkDetail', label: 'Link detail', files: ['src/app/dashboard/links/[id]/page.tsx', 'src/components/charts/BarChart.tsx', 'src/components/charts/DonutChart.tsx', 'src/components/TimeRangePicker.tsx'] },
  { key: 'analytics',  shot: 'analytics',  label: 'Analytics',   files: ['src/app/dashboard/analytics/page.tsx', 'src/components/dashboard/DeviceChart.tsx', 'src/components/dashboard/BrowserChart.tsx', 'src/components/dashboard/ReferrerChart.tsx', 'src/components/dashboard/DateRangePicker.tsx'] },
  { key: 'campaigns',  shot: 'campaigns',  label: 'Campaigns',   files: ['src/app/dashboard/campaigns/page.tsx', 'src/app/dashboard/campaigns/[id]/page.tsx'] },
  { key: 'create',     shot: 'create',     label: 'Create link', files: ['src/app/dashboard/create/page.tsx', 'src/components/CreateLinkForm.tsx'] },
]

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
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
  type: 'object', additionalProperties: false, required: ['backlog'],
  properties: {
    backlog: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
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
    `You are a senior product designer auditing the tws.bio dashboard surface "${s.label}" (round ${round}).\n` +
    `Read these source files: ${s.files.join(', ')}.\n` +
    `Also read the current rendered screenshots if present: ${baselineDir}/${s.shot}-desktop.png and ${baselineDir}/${s.shot}-mobile.png.\n\n` +
    `Score the surface on THREE lenses and report concrete, actionable findings:\n` +
    `- ux: information hierarchy, empty/loading/error states, mobile responsiveness, friction in the core task.\n` +
    `- visual: typography, color, spacing, motion. Flag anything that reads as a templated shadcn default rather than intentional design. Context: green primary is #00802B / ring #00B03B; a DM Serif display font is available as the "font-heading" / --font-heading token (currently used on some CardTitles). Note contrast problems (e.g. chart lines/series too dark on the #0a0a0a background).\n` +
    `- gap: important MISSING affordances. Known examples to check for: the links table has no search / filter / sort / bulk-actions; stat cards show no trend delta vs prior period; no CSV/export; per-link rows have no sparkline; the Create and Link-detail pages render a REDUNDANT inner page header (back-arrow + max-w-7xl) stacked on top of the shared sidebar layout.\n\n` +
    `Severity: P0 = blocks a task / accessibility failure (contrast, keyboard, focus) / glaring visual defect; P1 = real friction, notable inconsistency, or high-value gap; P2 = polish.\n` +
    `Rules: stay within dashboard UI. Do NOT propose backend, database, RPC, or auth changes. Be specific about which file and what to change.`,
    { label: `audit:${s.key}`, phase: 'Audit', model: 'sonnet', schema: FINDINGS_SCHEMA }
  ).then((r) => ({ surface: s.key, findings: r?.findings ?? [] }))
))

const flat = perSurface.filter(Boolean).flatMap((s) =>
  s.findings.map((f) => ({ ...f, surface: s.surface }))
)

phase('Synthesize')
const synth = await agent(
  `You are the lead design reviewer consolidating raw per-surface audit findings for the tws.bio dashboard.\n\n` +
  `Raw findings (JSON):\n${JSON.stringify(flat)}\n\n` +
  `Findings already resolved in prior rounds — do NOT re-report these or near-duplicates:\n${prior}\n\n` +
  `Produce a single ranked backlog:\n` +
  `- dedupe cross-surface duplicates and merge closely related items;\n` +
  `- assign each a stable, descriptive kebab-case id (e.g. "links-add-search-filter");\n` +
  `- keep every field (surface, lens, severity, title, detail, files, suggested_change);\n` +
  `- sort most-severe first: all P0, then P1, then P2;\n` +
  `- return ONLY new, unresolved findings.`,
  { label: 'synthesize', phase: 'Synthesize', model: 'fable', schema: BACKLOG_SCHEMA }
)

return { backlog: synth?.backlog ?? [] }
