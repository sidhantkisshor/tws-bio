import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  dayKey,
  getBrowserBreakdownResult,
  getClicksOverTimeResult,
  getCountryBreakdownResult,
  getDeviceBreakdownResult,
  getTotalClicksResult,
  parseTimeRange,
  priorWindowTotal,
  rangeWindow,
  zeroFillDays,
  type DailyClicks,
  type TimeRange,
} from '@/lib/analytics'
import {
  getClickHeatmapResult,
  getLinkClickWindowsResult,
  getReferrerRowsResult,
} from '@/lib/insights'
import { groupByPlatform, type PlatformGroup } from '@/lib/sources'
import { computeMovers, topGainers } from '@/lib/movers'
import { formatNumber, formatShare } from '@/lib/ledgerFormat'
import { plural } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader, Section } from '@/components/dashboard/PageHeader'
import { KpiRow, StatCell, computeTrend } from '@/components/dashboard/StatCard'
import { BarChart, ChartLegend, shortDay } from '@/components/charts/BarChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { ChangeCount, TopLinksTable } from '@/components/dashboard/TopLinksTable'
import { fixLinkClass } from '@/app/dashboard/health/styles'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// The root layout's template adds " - tws.bio".
export const metadata: Metadata = { title: 'Analytics' }

function AnalyticsHeader({ timeRange, days }: { timeRange: TimeRange; days: number | null }) {
  return (
    <PageHeader
      title="Analytics"
      description={
        days !== null
          ? `Every link, last ${days} days in India time. Changes compare with the ${days} days before.`
          : 'Every link, all time, in India time.'
      }
      actions={<TimeRangePicker current={timeRange} basePath="/dashboard/analytics" />}
    />
  )
}

function InlineError({ children, retryHref }: { children: React.ReactNode; retryHref: string }) {
  return (
    <p role="status" className="py-4 text-sm text-text-2">
      {children}{' '}
      <Link
        href={retryHref}
        className="focus-ring rounded-ctl text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current"
      >
        Try again
      </Link>
    </p>
  )
}

function platformName(group: PlatformGroup): string {
  if (group.key === 'none') return 'No referrer'
  if (group.key === 'tws') return 'tws.bio itself'
  if (group.key === 'app') return 'Android apps'
  return group.label
}

function busiest(days: DailyClicks[]): DailyClicks | null {
  let best: DailyClicks | null = null
  for (const d of days) if (d.clicks > 0 && (!best || d.clicks > best.clicks)) best = d
  return best
}

// Shape of the links select below: the embedded clicks(count) is the ranged
// per-link count (clicks RLS still applies to it).
interface LinkRow {
  id: string
  short_code: string
  original_url: string
  campaign_id: string | null
  created_at: string | null
  clicks: { count: number }[]
}

const LINK_SELECT = 'id, short_code, original_url, campaign_id, created_at, clicks(count)'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect('/login')
  }

  const { range: rangeParam } = await searchParams
  // Old bookmarks with ?range=30 still parse; the picker writes ?range=30d.
  const timeRange = parseTimeRange(rangeParam)
  const { since: windowStart, priorSince, days } = rangeWindow(timeRange)
  // One exact window boundary shared by every aggregation below (the
  // embedded per-link counts, the RPC helpers and the prior-period count),
  // so no two queries disagree about where the range starts.
  const since = windowStart?.toISOString() ?? null
  const retryHref = `/dashboard/analytics?range=${timeRange}`

  // Wave 1: the owner's links (id, code and a ranged click count ride along
  // through the embedded clicks(count) aggregate) and campaign names.
  let firstLinksQuery = supabase
    .from('links')
    .select(LINK_SELECT, { count: 'exact' })
    .eq('user_id', user.id)
    .order('id', { ascending: true })
    .range(0, 999)
  if (since) firstLinksQuery = firstLinksQuery.gte('clicks.clicked_at', since)

  const [firstLinksResult, campaignsResult] = await Promise.all([
    firstLinksQuery.overrideTypes<LinkRow[], { merge: false }>(),
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])
  let userLinks: LinkRow[] = firstLinksResult.data || []
  let userLinksError = firstLinksResult.error

  // PostgREST caps response rows. Page through any remaining links so the
  // downstream RPCs receive every owned ID instead of silently stopping at
  // the project's row limit. The common case remains a single request.
  const totalOwnedLinks = firstLinksResult.count || 0
  if (!userLinksError && totalOwnedLinks > userLinks.length && userLinks.length > 0) {
    const pageSize = userLinks.length
    const pageRequests = []
    for (let from = pageSize; from < totalOwnedLinks; from += pageSize) {
      let pageQuery = supabase
        .from('links')
        .select(LINK_SELECT)
        .eq('user_id', user.id)
        .order('id', { ascending: true })
        .range(from, Math.min(from + pageSize - 1, totalOwnedLinks - 1))
      if (since) pageQuery = pageQuery.gte('clicks.clicked_at', since)
      pageRequests.push(pageQuery.overrideTypes<LinkRow[], { merge: false }>())
    }

    const extraPages = await Promise.all(pageRequests)
    const failedPage = extraPages.find((page) => page.error)
    if (failedPage?.error) {
      userLinksError = failedPage.error
    } else {
      userLinks = userLinks.concat(extraPages.flatMap((page) => page.data || []))
    }
  }

  // A failed fetch must never render identically to "you have no links yet".
  if (userLinksError) {
    console.error('[analytics-page] userLinks query:', userLinksError)
    return (
      <div>
        <AnalyticsHeader timeRange={timeRange} days={days} />
        <div className="rule-open">
          <InlineError retryHref={retryHref}>Your links could not load.</InlineError>
        </div>
      </div>
    )
  }

  if (userLinks.length === 0) {
    return (
      <div>
        <AnalyticsHeader timeRange={timeRange} days={days} />
        <div className="rule-open flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-text-2">
            No links yet. Create a link and its clicks show here within a minute.
          </p>
          <Link href="/dashboard/create" className={buttonVariants({ variant: 'outline' })}>
            Create a link
          </Link>
        </div>
      </div>
    )
  }

  const linkIds = userLinks.map((l) => l.id)
  const filter = { timeRange, linkIds, since }
  const heatSince = timeRange === 'all' ? null : rangeWindow('90d').since

  // Wave 2: every aggregation runs DB-side through the SECURITY INVOKER RPC
  // helpers (clicks RLS applies), with the link ids in the POST body.
  const [
    seriesResult,
    totalResult,
    combinedResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    heatmapResult,
    windowsResult,
  ] = await Promise.all([
    // The current and prior windows in one series: split below into the bars
    // and the dotted prior line.
    getClicksOverTimeResult({ ...filter, since: priorSince?.toISOString() ?? since }),
    getTotalClicksResult(filter),
    // Current + prior span; subtracting the current total (priorWindowTotal)
    // gives the prior window. 'all' has no prior window.
    priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
    getReferrerRowsResult({ linkIds, since }),
    getDeviceBreakdownResult(filter),
    getCountryBreakdownResult(filter),
    getBrowserBreakdownResult(filter),
    getClickHeatmapResult({ linkIds, since: heatSince }),
    windowStart && priorSince
      ? getLinkClickWindowsResult({ linkIds, priorSince, since: windowStart })
      : null,
  ])

  if (combinedResult?.error) console.error('[analytics-page] prior clicks query failed')

  const totalError = totalResult.error
  const totalClicks = totalResult.data
  // On a prior-count failure hide the change rather than comparing against a
  // fake zero baseline.
  const priorClicks = priorWindowTotal(combinedResult, totalResult)
  const clicksTrend = priorClicks !== null ? computeTrend(totalClicks, priorClicks) : null

  let current: DailyClicks[]
  let prior: DailyClicks[] | null = null
  if (priorSince && days !== null) {
    const both = zeroFillDays(seriesResult.data, priorSince, days * 2)
    prior = both.slice(0, days)
    current = both.slice(days)
  } else {
    current = zeroFillDays(seriesResult.data, null, null)
  }
  const peak = seriesResult.error ? null : busiest(current)
  const priorPeak = prior ? busiest(prior) : null
  const peakTrend = peak && prior ? computeTrend(peak.clicks, priorPeak?.clicks ?? 0) : null

  const groups = referrersResult.error ? [] : groupByPlatform(referrersResult.data)
  // The top source is a place a click came from, so the no-referrer group
  // (chats, apps, typed links) is never picked.
  const topGroup = groups.find((g) => g.key !== 'none' && g.count > 0) ?? null

  // Per-link counts in this window and the one before (bounded ranges only).
  const windows = windowsResult && !windowsResult.error ? windowsResult.data : null
  const linkById = new Map(userLinks.map((l) => [l.id, l]))
  const rangedClicks = (l: LinkRow) => l.clicks[0]?.count ?? 0
  const clickedLinks = userLinks.filter((l) => rangedClicks(l) > 0).length
  const priorClickedLinks = windows
    ? Object.values(windows.prior).filter((n) => n > 0).length
    : null

  // Chart marks: the launch day of the links that gained most, when the
  // launch is inside the window.
  const inWindow = new Set(current.map((d) => d.date))
  const marks = windows
    ? topGainers(computeMovers(windows.current, windows.prior), 20)
        .map((m) => linkById.get(m.linkId))
        .filter((l): l is LinkRow => Boolean(l?.created_at))
        .map((l) => ({ code: l.short_code, date: dayKey(new Date(l.created_at as string)) }))
        .filter((m) => inWindow.has(m.date))
        .slice(0, 2)
        .map((m) => ({
          date: m.date,
          label: `${m.code} went live, ${shortDay(m.date)}`,
          shortLabel: `${m.code}, ${shortDay(m.date)}`,
        }))
    : []

  // Top links: which links actually drive these clicks.
  const ranked = userLinks
    .map((l) => ({ link: l, clicks: rangedClicks(l) }))
    .filter((r) => r.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
  const topLinks = ranked.slice(0, 10).map((r) => ({
    link: r.link,
    current: r.clicks,
    prior: windows ? (windows.prior[r.link.id] ?? 0) : null,
  }))

  // Campaigns: the links in each, their clicks in the window and the change.
  const campaigns = campaignsResult.data ?? []
  const campaignRows = campaigns.map((c) => {
    const links = userLinks.filter((l) => l.campaign_id === c.id)
    return {
      id: c.id,
      name: c.name,
      links: links.length,
      clicks: links.reduce((s, l) => s + rangedClicks(l), 0),
      prior: windows ? links.reduce((s, l) => s + (windows.prior[l.id] ?? 0), 0) : null,
    }
  })
  const loose = userLinks.filter((l) => !l.campaign_id)
  const looseRow = {
    links: loose.length,
    clicks: loose.reduce((s, l) => s + rangedClicks(l), 0),
    prior: windows ? loose.reduce((s, l) => s + (windows.prior[l.id] ?? 0), 0) : null,
  }
  campaignRows.sort((a, b) => b.clicks - a.clicks)

  const windowLabel = days !== null ? `Last ${days} days` : 'All time'
  const shareOf = (n: number) => (totalClicks > 0 ? formatShare(n / totalClicks) : '---')

  // A period with no clicks is one explanation with one next step, not a
  // page of empty sections.
  if (!totalError && totalClicks === 0) {
    return (
      <div>
        <AnalyticsHeader timeRange={timeRange} days={days} />
        <div className="rule-open flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-text-2">
            {days !== null ? `No clicks in the last ${days} days.` : 'No clicks yet.'}{' '}
            {timeRange === 'all' && 'Clicks show up here as soon as someone opens a short link.'}
          </p>
          {timeRange !== 'all' && (
            <Link
              href="/dashboard/analytics?range=all"
              className={buttonVariants({ variant: 'outline' })}
            >
              View all time
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AnalyticsHeader timeRange={timeRange} days={days} />

      {totalError ? (
        <div className="rule-open mb-10">
          <InlineError retryHref={retryHref}>Click totals could not load.</InlineError>
        </div>
      ) : (
        <KpiRow label={windowLabel} className="mb-9 md:mb-10">
          <StatCell
            title="Clicks"
            value={totalClicks}
            trend={clicksTrend}
            prior={priorClicks}
          />
          <StatCell
            title="Links that got clicks"
            value={clickedLinks}
            unit={`of ${userLinks.length.toLocaleString('en-US')}`}
            trend={priorClickedLinks !== null ? computeTrend(clickedLinks, priorClickedLinks) : null}
            prior={priorClickedLinks}
            deltaFormat="count"
          />
          <StatCell
            title={peak ? `Busiest day, ${shortDay(peak.date)}` : 'Busiest day'}
            value={peak ? peak.clicks : seriesResult.error ? '---' : 0}
            trend={peakTrend}
            prior={peak && prior ? (priorPeak?.clicks ?? 0) : null}
            deltaFormat="count"
          />
          <StatCell
            title={topGroup ? `Top source, ${platformName(topGroup)}` : 'Top source'}
            value={topGroup ? formatShare(topGroup.share) : '---'}
            unit={
              topGroup ? (
                <span className="hidden md:inline">{plural(topGroup.count, 'click')}</span>
              ) : undefined
            }
          />
        </KpiRow>
      )}

      <div className="grid gap-9 md:gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title="Clicks per day"
            actions={
              !seriesResult.error ? (
                <ChartLegend
                  currentLabel={windowLabel}
                  priorLabel={days !== null ? `${days} days before` : undefined}
                  showPrior={prior !== null}
                />
              ) : undefined
            }
          >
            <BarChart
              data={current}
              prior={prior ?? undefined}
              marks={marks}
              error={seriesResult.error}
              label="Clicks per day, every link"
              priorLabel={days !== null ? `${days} days before` : undefined}
            />
          </Section>
        </div>

        <SourcesPanel
          groups={groups}
          windowLabel={windowLabel}
          recordedSince={referrersResult.recordedSince}
          error={referrersResult.error}
          limit={10}
        />
      </div>

      <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
        <Section
          title="Best time to post"
          caption={`${heatSince ? 'Last 90 days' : 'All time'}, India time`}
        >
          <Heatmap data={heatmapResult.data} error={heatmapResult.error} />
          <Section title="Devices" level={3} caption={windowLabel} className="mt-10">
            {devicesResult.error ? (
              <InlineError retryHref={retryHref}>Devices could not load.</InlineError>
            ) : (
              <BarList
                items={namedItems(devicesResult.data)}
                label="Devices by clicks"
                total={totalClicks || undefined}
              />
            )}
          </Section>
        </Section>

        <div className="flex min-w-0 flex-col gap-10">
          <Section title="Countries" caption={windowLabel}>
            {countriesResult.error ? (
              <InlineError retryHref={retryHref}>Countries could not load.</InlineError>
            ) : (
              <BarList
                items={countryItems(countriesResult.data)}
                label="Countries by clicks"
                total={totalClicks || undefined}
              />
            )}
          </Section>
          <Section title="Browsers" level={3} caption={windowLabel}>
            {browsersResult.error ? (
              <InlineError retryHref={retryHref}>Browsers could not load.</InlineError>
            ) : (
              <BarList
                items={namedItems(browsersResult.data.slice(0, 8))}
                label="Browsers by clicks"
                total={totalClicks || undefined}
              />
            )}
          </Section>
        </div>
      </div>

      <Section
        title="Top links"
        caption={windowLabel}
        actions={
          <Link href="/dashboard/links" className={fixLinkClass}>
            All {formatNumber(userLinks.length)} links
          </Link>
        }
        className="mt-9 md:mt-12"
      >
        {topLinks.length === 0 ? (
          <p className="py-4 text-sm text-text-2">No link had clicks in this period.</p>
        ) : (
          <TopLinksTable
            rows={topLinks}
            total={totalClicks}
            linkCount={userLinks.length}
            showChange={windows !== null}
          />
        )}
      </Section>

      {campaignsResult.error ? (
        <Section title="Campaigns" className="mt-9 md:mt-12">
          <InlineError retryHref={retryHref}>Campaigns could not load.</InlineError>
        </Section>
      ) : (
        campaignRows.length > 0 && (
          <Section title="Campaigns" caption={windowLabel} className="mt-9 md:mt-12">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Links</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  {windows && <TableHead className="text-right">Change</TableHead>}
                  <TableHead className="hidden text-right sm:table-cell">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="w-full max-w-0 py-2.5">
                      <Link
                        href={`/dashboard/campaigns/${c.id}`}
                        className="focus-ring block truncate rounded-ctl font-medium text-ink transition-colors duration-150 hover:text-accent-text"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden py-2.5 text-right text-text-2 tabular-nums sm:table-cell">
                      {c.links.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-medium tabular-nums">
                      {c.clicks.toLocaleString('en-US')}
                    </TableCell>
                    {windows && (
                      <TableCell className="py-2.5 text-right text-[13px] tabular-nums">
                        <ChangeCount current={c.clicks} prior={c.prior ?? 0} />
                      </TableCell>
                    )}
                    <TableCell className="hidden py-2.5 text-right text-text-2 tabular-nums sm:table-cell">
                      {shareOf(c.clicks)}
                    </TableCell>
                  </TableRow>
                ))}
                {looseRow.links > 0 && (
                  <TableRow>
                    <TableCell className="py-2.5 text-text-2">Not in a campaign</TableCell>
                    <TableCell className="hidden py-2.5 text-right text-text-2 tabular-nums sm:table-cell">
                      {looseRow.links.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums text-text-2">
                      {looseRow.clicks.toLocaleString('en-US')}
                    </TableCell>
                    {windows && (
                      <TableCell className="py-2.5 text-right text-[13px] tabular-nums">
                        <ChangeCount current={looseRow.clicks} prior={looseRow.prior ?? 0} />
                      </TableCell>
                    )}
                    <TableCell className="hidden py-2.5 text-right text-text-2 tabular-nums sm:table-cell">
                      {shareOf(looseRow.clicks)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-[13px] text-text-2">All links</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {userLinks.length.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="rule-total inline-block pb-1">
                      {(campaignRows.reduce((s, c) => s + c.clicks, 0) + looseRow.clicks).toLocaleString('en-US')}
                    </span>
                  </TableCell>
                  {windows && <TableCell />}
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <span className="rule-total inline-block pb-1">
                      {shareOf(campaignRows.reduce((s, c) => s + c.clicks, 0) + looseRow.clicks)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Section>
        )
      )}
    </div>
  )
}
