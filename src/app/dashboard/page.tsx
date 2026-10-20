import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  dayKey,
  getClicksOverTimeResult,
  getDeviceBreakdownResult,
  parseTimeRange,
  rangeWindow,
  zeroFillDays,
} from '@/lib/analytics'
import {
  getClickHeatmapResult,
  getLinkClickWindowsResult,
  getReferrerRowsResult,
} from '@/lib/insights'
import { computeMovers, topDecliners, topGainers } from '@/lib/movers'
import { groupByPlatform } from '@/lib/sources'
import { formatNumber, formatShare, sharesToHundred } from '@/lib/ledgerFormat'
import { SHORT_MONTHS, cn } from '@/lib/utils'
import { PageHeader, Section } from '@/components/dashboard/PageHeader'
import { KpiRow, StatCell, computeTrend } from '@/components/dashboard/StatCard'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { BarChart, ChartLegend, shortDay, type BarChartMark } from '@/components/charts/BarChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { NeedsALook } from '@/components/dashboard/NeedsALook'
import { TopMovers, type MoverRow } from '@/components/dashboard/TopMovers'
import { TopLinksTable, type TopLinkRow } from '@/components/dashboard/TopLinksTable'
import { ExportLinksButton } from '@/components/dashboard/ExportLinksButton'
import { buttonVariants } from '@/components/ui/button-variants'
import { loadOwnerLinks, rankLinkHealth } from '@/app/dashboard/health/data'
import { fixLinkClass } from '@/app/dashboard/health/styles'

// The root layout's template adds " - tws.bio".
export const metadata: Metadata = { title: 'Overview' }

// The owner-links read selects every column the CSV holds (ExportRow).
// Rows handed to the export button. More links than this and a click
// re-reads every link in the browser, the same path the Links page uses.
const EXPORT_INLINE_ROWS = 20
const EXPORT_FILTERS = { q: '', type: 'all', status: 'all', sort: 'created_desc' } as const

/** '2026-09-21' gives { d: 21, m: 'Sep', y: 2026 }. */
function dayParts(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return { d, m: SHORT_MONTHS[m - 1], y }
}

/** "21 Sep to 20 Oct 2026", with the year on both ends when they differ. */
function windowText(startKey: string, endKey: string): string {
  const a = dayParts(startKey)
  const b = dayParts(endKey)
  const start = a.y === b.y ? `${a.d} ${a.m}` : `${a.d} ${a.m} ${a.y}`
  return `${start} to ${b.d} ${b.m} ${b.y}`
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  desktop: 'Desktop',
  tablet: 'Tablet',
  unknown: 'Unknown',
}
const DEVICE_FILLS = ['bg-hm5', 'bg-hm3', 'bg-hm2', 'bg-hm1']

function DevicesSplit({ rows, error }: { rows: { name: string; value: number }[]; error: boolean }) {
  if (error) {
    return (
      <p role="status" className="py-2 text-sm text-text-2">
        Devices could not load. Reload the page to try again.
      </p>
    )
  }
  const list = rows.filter((r) => r.value > 0)
  const total = list.reduce((s, r) => s + r.value, 0)
  if (total === 0) return <p className="py-2 text-sm text-text-2">No clicks in the last 90 days.</p>

  const shares = sharesToHundred(list.map((r) => r.value))
  const items = list.map((r, i) => ({
    key: r.name,
    label: DEVICE_LABELS[r.name.toLowerCase()] ?? r.name.charAt(0).toUpperCase() + r.name.slice(1),
    value: r.value,
    share: shares[i],
    fill: DEVICE_FILLS[Math.min(i, DEVICE_FILLS.length - 1)],
  }))
  const desktop = items.find((r) => r.key.toLowerCase() === 'desktop')?.share ?? 0
  const mobile = items.find((r) => r.key.toLowerCase() === 'mobile')?.share ?? 0
  let note: string | null = null
  if (desktop >= 0.2) {
    note = `${Math.round(desktop * 100)}% of clicks come from a computer, so check every destination on desktop too.`
  } else if (mobile >= 0.7) {
    note = `${Math.round(mobile * 100)}% of clicks come from phones, so check every destination on a phone first.`
  }

  return (
    <>
      <div
        role="img"
        aria-label={items.map((r) => `${r.label} ${formatShare(r.share)}`).join(', ')}
        className="flex h-2.5 gap-0.5"
      >
        {items.map((r) => (
          <i key={r.key} className={cn('block', r.fill)} style={{ width: `${r.share * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3">
        {items.map((r) => (
          <li
            key={r.key}
            className="grid grid-cols-[12px_minmax(0,1fr)_72px_60px] items-center gap-2.5 border-b border-rule py-[7px] text-sm"
          >
            <i aria-hidden className={cn('block size-2.5', r.fill)} />
            <span className="text-ink">{r.label}</span>
            <span className="text-right tabular-nums text-ink">{formatNumber(r.value)}</span>
            <span className="text-right tabular-nums text-text-2">{formatShare(r.share)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-[13px] text-text-3">{note}</p>}
    </>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const params = await searchParams
  const parsed = parseTimeRange(typeof params.range === 'string' ? params.range : undefined)
  // Overview compares a window with the one before it, so "All time" (no
  // bounds, nothing before it) shows the default 30 days instead.
  const range = parsed === 'all' ? '30d' : parsed

  const now = new Date()
  const { since, priorSince, days } = rangeWindow(range, now)
  const last30 = rangeWindow('30d', now)
  const last90 = rangeWindow('90d', now)

  const supabase = await createClient()
  const linksResult = await loadOwnerLinks(supabase, user.id)
  const links = linksResult.data
  const linksError = linksResult.error
  const linkIds = links.map((l) => l.id)

  const startKey = dayKey(since)
  const endKey = dayKey(now)
  const description = `${windowText(startKey, endKey)}, India time. Changes compare with the ${days} days before.`
  const header = (
    <PageHeader
      title="Overview"
      description={description}
      actions={
        <>
          {!linksError && links.length > 0 && (
            <div className="hidden md:block">
              <ExportLinksButton
                links={links.slice(0, EXPORT_INLINE_ROWS)}
                totalCount={links.length}
                filters={EXPORT_FILTERS}
              />
            </div>
          )}
          <TimeRangePicker current={range} basePath="/dashboard" showAllTime={false} />
        </>
      }
    />
  )

  if (!linksError && links.length === 0) {
    return (
      <div>
        {header}
        <section className="rule-open flex flex-col items-start gap-4 pt-6">
          <p className="text-sm text-text-2">
            No links yet. Create your first link and its clicks show here within a minute.
          </p>
          <Link href="/dashboard/create" className={buttonVariants({ variant: 'outline' })}>
            Create a link
          </Link>
        </section>
      </div>
    )
  }

  // Everything below needs the link ids, and nothing needs anything else, so
  // it all runs together.
  const [series, windows, windows30, referrers, heatmap, devices] = await Promise.all([
    // One series from the start of the prior window gives both periods: the
    // chart bars, the dotted prior line, both totals and both busiest days.
    getClicksOverTimeResult({ timeRange: range, linkIds, since: priorSince.toISOString() }),
    getLinkClickWindowsResult({ linkIds, priorSince, since }),
    // linkHealth's "quiet" rule is about the last 30 days whatever the range.
    range === '30d'
      ? null
      : getLinkClickWindowsResult({ linkIds, priorSince: last30.priorSince, since: last30.since }),
    getReferrerRowsResult({ linkIds, since }),
    getClickHeatmapResult({ linkIds, since: last90.since }),
    getDeviceBreakdownResult({ timeRange: '90d', linkIds, since: last90.since.toISOString() }),
  ])

  // A failed links read leaves every panel without its ids: say so per panel.
  const seriesError = linksError || series.error
  const windowsError = linksError || windows.error
  const w30 = windows30 ?? windows
  const clicks30 = linksError || w30.error ? null : w30.data.current

  // Needs a look: one row per link, the top three whose worst issue is high
  // or medium; quieter ones (turned off, no recent clicks) wait on the
  // Health page.
  const ranked = linksError ? [] : rankLinkHealth(links, clicks30, now)
  const urgent = ranked.filter((r) => r.issues[0].severity !== 'low').slice(0, 3)

  // Clicks per day, this window and the one before.
  const currentDays = zeroFillDays(series.data, since, days)
  const priorDays = zeroFillDays(series.data, priorSince, days)
  const clicksNow = currentDays.reduce((s, d) => s + d.clicks, 0)
  const clicksBefore = priorDays.reduce((s, d) => s + d.clicks, 0)
  const busiest = currentDays.reduce((best, d) => (d.clicks > best.clicks ? d : best), currentDays[0])
  const busiestBefore = priorDays.reduce((m, d) => Math.max(m, d.clicks), 0)

  // Links created in each window.
  const sinceMs = since.getTime()
  const priorMs = priorSince.getTime()
  let createdNow = 0
  let createdBefore = 0
  for (const l of links) {
    const t = Date.parse(l.created_at ?? '')
    if (!Number.isFinite(t)) continue
    if (t >= sinceMs) createdNow++
    else if (t >= priorMs) createdBefore++
  }

  // Per-link clicks in the window and the one before.
  const cur = windows.data.current
  const pri = windows.data.prior
  const clickedNow = Object.values(cur).filter((n) => n > 0).length
  const clickedBefore = Object.values(pri).filter((n) => n > 0).length
  const windowTotal = Object.values(cur).reduce((s, n) => s + n, 0)

  const byId = new Map(links.map((l) => [l.id, l]))
  const movers = computeMovers(cur, pri)
  const toRow = (m: (typeof movers)[number]): MoverRow | null => {
    const link = byId.get(m.linkId)
    return link
      ? { id: m.linkId, shortCode: link.short_code, current: m.current, prior: m.prior, delta: m.delta }
      : null
  }
  const gaining = topGainers(movers, 4).map(toRow).filter((r): r is MoverRow => r !== null)
  const losing = topDecliners(movers, 4).map(toRow).filter((r): r is MoverRow => r !== null)

  // Chart marks: the day a top-gaining link went live, when that day is in
  // the window. At most two, on different days.
  const marks: BarChartMark[] = []
  for (const m of topGainers(movers, 10)) {
    if (marks.length >= 2) break
    const link = byId.get(m.linkId)
    const t = Date.parse(link?.created_at ?? '')
    if (!link || !Number.isFinite(t) || t < sinceMs) continue
    const key = dayKey(new Date(t))
    if (marks.some((x) => x.date === key)) continue
    const code = link.short_code
    const short = code.length > 14 ? `${code.slice(0, 13)}...` : code
    marks.push({
      date: key,
      label: `${code} went live, ${shortDay(key)}`,
      shortLabel: `${short}, ${shortDay(key)}`,
    })
  }

  const topLinks: TopLinkRow[] = links
    .map((link) => ({ link, current: cur[link.id] ?? 0, prior: pri[link.id] ?? 0 }))
    .filter((r) => r.current > 0)
    .sort((a, b) => b.current - a.current || a.link.short_code.localeCompare(b.link.short_code))
    .slice(0, 10)

  const everClicked = links.some((l) => (l.total_clicks ?? 0) > 0)
  const windowLabel = `Last ${days} days`
  const before = `${days} days before`

  return (
    <div>
      {header}

      {linksError && (
        <p role="status" className="mb-4 border-t border-rule pt-4 text-sm text-text-2">
          Your links could not load, so the figures below are incomplete.{' '}
          <Link href={`/dashboard?range=${range}`} className={fixLinkClass}>
            Try again
          </Link>
        </p>
      )}

      <NeedsALook rows={urgent} total={ranked.length} />

      <KpiRow label={windowLabel} className="mb-2">
        <StatCell
          title="Clicks"
          value={seriesError ? '---' : clicksNow}
          prior={seriesError ? null : clicksBefore}
          trend={seriesError ? null : computeTrend(clicksNow, clicksBefore)}
        />
        <StatCell
          title={!seriesError && busiest && busiest.clicks > 0 ? `Busiest day, ${shortDay(busiest.date)}` : 'Busiest day'}
          value={seriesError ? '---' : (busiest?.clicks ?? 0)}
          prior={seriesError ? null : busiestBefore}
          trend={seriesError ? null : computeTrend(busiest?.clicks ?? 0, busiestBefore)}
          deltaFormat="count"
        />
        <StatCell
          title="Links created"
          value={linksError ? '---' : createdNow}
          prior={linksError ? null : createdBefore}
          trend={linksError ? null : computeTrend(createdNow, createdBefore)}
          deltaFormat="count"
        />
        <StatCell
          title="Links that got clicks"
          value={windowsError ? '---' : clickedNow}
          unit={windowsError ? undefined : `of ${formatNumber(links.length)}`}
          prior={windowsError ? null : clickedBefore}
          trend={windowsError ? null : computeTrend(clickedNow, clickedBefore)}
          deltaFormat="count"
        />
      </KpiRow>
      {(seriesError || windowsError) && !linksError && (
        <p role="status" className="text-[13px] text-text-2">
          Some figures could not load. Reload the page to try again.
        </p>
      )}

      <div className="mt-8 mb-9 grid grid-cols-1 gap-9 md:mt-10 lg:mb-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <Section title="Clicks per day" actions={<ChartLegend priorLabel={before} />}>
          <BarChart
            data={currentDays}
            prior={priorDays}
            marks={marks}
            error={seriesError}
            label="Clicks per day"
            priorLabel={before}
            emptyText={
              everClicked
                ? `No clicks in the last ${days} days.`
                : 'No clicks yet. Share your first link and its clicks show here within a minute.'
            }
          />
        </Section>
        <TopMovers
          gaining={gaining}
          losing={losing}
          caption={`Clicks vs the ${before}`}
          error={windowsError}
        />
      </div>

      <div className="mb-9 grid grid-cols-1 gap-9 lg:mb-12 lg:grid-cols-2 lg:gap-12">
        <SourcesPanel
          groups={groupByPlatform(referrers.data)}
          windowLabel={windowLabel}
          recordedSince={referrers.recordedSince}
          error={linksError || referrers.error}
          emptyText={`No clicks in the last ${days} days.`}
        />
        <Section title="Best time to post" caption="Clicks by hour, India time, last 90 days">
          <Heatmap
            data={heatmap.data}
            error={linksError || heatmap.error}
            emptyText="No clicks in the last 90 days."
          />
          <Section title="Devices" caption="Last 90 days" level={3} className="mt-9">
            <DevicesSplit rows={devices.data} error={linksError || devices.error} />
          </Section>
        </Section>
      </div>

      <Section
        title="Top links"
        caption={windowLabel}
        actions={
          <Link href="/dashboard/links" className={fixLinkClass}>
            All {formatNumber(links.length)} links
          </Link>
        }
      >
        {windowsError ? (
          <p role="status" className="py-4 text-sm text-text-2">
            Top links could not load. Reload the page to try again.
          </p>
        ) : topLinks.length === 0 ? (
          <p className="py-4 text-sm text-text-2">No clicks in the last {days} days.</p>
        ) : (
          <TopLinksTable rows={topLinks} total={windowTotal} linkCount={links.length} />
        )}
      </Section>
    </div>
  )
}
