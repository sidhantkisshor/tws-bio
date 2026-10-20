import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  dayKey,
  getBrowserBreakdownResult,
  getClicksOverTimeResult,
  getCountryBreakdownResult,
  getDeviceBreakdownResult,
  getTotalClicksResult,
  isUuid,
  parseTimeRange,
  priorWindowTotal,
  rangeWindow,
  zeroFillDays,
  type DailyClicks,
} from '@/lib/analytics'
import { getLinkClickWindowsResult, getReferrerRowsResult } from '@/lib/insights'
import { groupByPlatform, type PlatformGroup } from '@/lib/sources'
import { computeMovers, topGainers } from '@/lib/movers'
import { destinationKind } from '@/lib/destinationKind'
import { formatShare, formatSignedCount } from '@/lib/ledgerFormat'
import { cn, plural } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader, Section } from '@/components/dashboard/PageHeader'
import { KpiRow, StatCell, computeTrend } from '@/components/dashboard/StatCard'
import { BarChart, ChartLegend, shortDay } from '@/components/charts/BarChart'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { displayUrl } from '@/components/dashboard/displayUrl'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// What an empty campaign's stats are, without asking the database.
const NO_ROWS = { data: [], error: false }

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

/** "+1,475" in teal, "(486)" in red, "New" when there was nothing before. */
function Change({ current, prior }: { current: number; prior: number }) {
  if (prior === 0 && current > 0) return <span className="font-medium text-text-2">New</span>
  const delta = current - prior
  return (
    <span className={cn('font-bold', delta > 0 ? 'text-pos' : delta < 0 ? 'text-neg' : 'text-text-3')}>
      {formatSignedCount(delta)}
    </span>
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

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const { id } = await params
  // Before any query: a malformed id would fail both uuid lookups and render
  // the error page instead of a 404.
  if (!isUuid(id)) notFound()

  const { range: rangeParam } = await searchParams
  const timeRange = parseTimeRange(rangeParam)
  const { since, priorSince, days } = rangeWindow(timeRange)
  const sinceIso = since?.toISOString() ?? null
  const retryHref = `/dashboard/campaigns/${id}?range=${timeRange}`

  // Wave 1: the links query needs only the id, not the campaign row, so the
  // two run together. notFound() still keys on the campaign row alone.
  const [campaignResult, linksResult] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, description')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('links')
      .select('id, short_code, original_url, total_clicks, created_at')
      .eq('campaign_id', id)
      .eq('user_id', user.id)
      .order('total_clicks', { ascending: false }),
  ])

  // A failed row query is an outage, not a missing campaign:
  // dashboard/error.tsx renders it.
  if (campaignResult.error) throw campaignResult.error
  const campaign = campaignResult.data
  if (!campaign) notFound()

  // A failed links query must not read as "No links in this campaign yet".
  const linksError = Boolean(linksResult.error)
  if (linksResult.error) console.error('[campaign-detail] links query:', linksResult.error)
  const campaignLinks = linksResult.data ?? []
  const linkIds = campaignLinks.map((l) => l.id)

  // Wave 2: the stats RPCs, skipped when there is nothing to count (an empty
  // campaign, or a failed links query).
  const filter = { timeRange, linkIds, since: sinceIso }
  const [
    seriesResult,
    totalResult,
    combinedResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    windowsResult,
  ] =
    linkIds.length > 0
      ? await Promise.all([
          // The current and prior windows in one series.
          getClicksOverTimeResult({ ...filter, since: priorSince?.toISOString() ?? sinceIso }),
          getTotalClicksResult(filter),
          // The current and prior windows in one count, with the link ids in
          // the RPC's POST body. 'all' has no prior window.
          priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
          getReferrerRowsResult({ linkIds, since: sinceIso }),
          getDeviceBreakdownResult(filter),
          getCountryBreakdownResult(filter),
          getBrowserBreakdownResult(filter),
          since && priorSince ? getLinkClickWindowsResult({ linkIds, priorSince, since }) : null,
        ])
      : ([NO_ROWS, { data: 0, error: false }, null, NO_ROWS, NO_ROWS, NO_ROWS, NO_ROWS, null] as const)

  const totalError = totalResult.error
  const totalClicks = totalResult.data
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
  const topGroup = groups[0] && groups[0].count > 0 ? groups[0] : null

  const windows = windowsResult && !windowsResult.error ? windowsResult.data : null
  // Clicks per link in the window: the windows RPC for a bounded range, the
  // all-time total for 'all'. null when that count failed.
  const windowClicks = (l: (typeof campaignLinks)[number]): number | null =>
    days === null ? (l.total_clicks ?? 0) : windows ? (windows.current[l.id] ?? 0) : null
  const rows = campaignLinks
    .map((l) => ({ link: l, clicks: windowClicks(l) }))
    .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0) || (b.link.total_clicks ?? 0) - (a.link.total_clicks ?? 0))
  const clickedLinks = rows.filter((r) => (r.clicks ?? 0) > 0).length
  const priorClickedLinks = windows ? Object.values(windows.prior).filter((n) => n > 0).length : null

  // Chart marks: launch days of the links that gained most, inside the window.
  const inWindow = new Set(current.map((d) => d.date))
  const byId = new Map(campaignLinks.map((l) => [l.id, l]))
  const marks = windows
    ? topGainers(computeMovers(windows.current, windows.prior), 20)
        .map((m) => byId.get(m.linkId))
        .filter((l): l is (typeof campaignLinks)[number] => Boolean(l?.created_at))
        .map((l) => ({ code: l.short_code, date: dayKey(new Date(l.created_at as string)) }))
        .filter((m) => inWindow.has(m.date))
        .slice(0, 2)
        .map((m) => ({
          date: m.date,
          label: `${m.code} went live, ${shortDay(m.date)}`,
          shortLabel: `${m.code}, ${shortDay(m.date)}`,
        }))
    : []

  // What the links have collected since they were made, for the empty-period
  // explanation below.
  const allTimeClicks = campaignLinks.reduce((sum, l) => sum + (l.total_clicks || 0), 0)
  const windowLabel = days !== null ? `Last ${days} days` : 'All time'
  const hasLinks = !linksError && campaignLinks.length > 0
  const noClicks = hasLinks && !totalError && totalClicks === 0
  const rowsKnown = rows.every((r) => r.clicks !== null)
  const showChange = days !== null && windows !== null

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={campaign.description}
        backHref="/dashboard/campaigns"
        backLabel="Campaigns"
        actions={<TimeRangePicker current={timeRange} basePath={`/dashboard/campaigns/${id}`} />}
      />

      {linksError ? (
        <div className="rule-open">
          <InlineError retryHref={retryHref}>This campaign&apos;s links could not load.</InlineError>
        </div>
      ) : !hasLinks ? (
        <div className="rule-open flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-text-2">
            No links in this campaign yet. Pick it when you create or edit a link.
          </p>
          <Link href="/dashboard/create" className={buttonVariants({ variant: 'outline' })}>
            Create a link
          </Link>
        </div>
      ) : (
        <>
          {totalError ? (
            <div className="rule-open mb-10">
              <InlineError retryHref={retryHref}>Click totals could not load.</InlineError>
            </div>
          ) : (
            <KpiRow label={windowLabel} className="mb-9 md:mb-10">
              <StatCell
                title={days !== null ? `Clicks, last ${days} days` : 'Clicks, all time'}
                value={totalClicks}
                trend={clicksTrend}
                prior={priorClicks}
              />
              <StatCell
                title="Links that got clicks"
                value={rowsKnown ? clickedLinks : '---'}
                unit={`of ${campaignLinks.length.toLocaleString('en-US')}`}
                trend={
                  rowsKnown && priorClickedLinks !== null
                    ? computeTrend(clickedLinks, priorClickedLinks)
                    : null
                }
                prior={rowsKnown ? priorClickedLinks : null}
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
                title={topGroup ? `Top platform, ${platformName(topGroup)}` : 'Top platform'}
                value={topGroup ? formatShare(topGroup.share) : '---'}
                unit={
                  topGroup ? (
                    <span className="hidden md:inline">{plural(topGroup.count, 'click')}</span>
                  ) : undefined
                }
              />
            </KpiRow>
          )}

          <div
            className={cn(
              'grid gap-9 md:gap-12',
              !noClicks && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
            )}
          >
            <div className="flex min-w-0 flex-col gap-10">
              <Section
                title="Clicks per day"
                actions={
                  !noClicks && !seriesResult.error ? (
                    <ChartLegend
                      currentLabel={windowLabel}
                      priorLabel={days !== null ? `${days} days before` : undefined}
                      showPrior={prior !== null}
                    />
                  ) : undefined
                }
              >
                {noClicks ? (
                  <div className="flex flex-col items-start gap-3 py-4">
                    <p className="text-sm text-text-2">
                      {days !== null ? `No clicks in the last ${days} days.` : 'No clicks yet.'}{' '}
                      {allTimeClicks > 0
                        ? `${plural(allTimeClicks, 'click')} before this period.`
                        : 'Clicks show up here as soon as someone opens a short link.'}
                    </p>
                    {allTimeClicks > 0 && timeRange !== 'all' && (
                      <Link
                        href={`/dashboard/campaigns/${id}?range=all`}
                        className={buttonVariants({ variant: 'outline' })}
                      >
                        View all time
                      </Link>
                    )}
                  </div>
                ) : (
                  <BarChart
                    data={current}
                    prior={prior ?? undefined}
                    marks={marks}
                    error={seriesResult.error}
                    label={`Clicks per day, ${campaign.name}`}
                    priorLabel={days !== null ? `${days} days before` : undefined}
                  />
                )}
              </Section>
              {!noClicks && (
                <Section title="Devices" level={3} caption={windowLabel}>
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
              )}
            </div>

            {!noClicks && (
              <SourcesPanel
                groups={groups}
                windowLabel={windowLabel}
                error={referrersResult.error}
                limit={8}
                emptyText={days !== null ? `No clicks in the last ${days} days.` : 'No clicks yet.'}
              />
            )}
          </div>
        </>
      )}

      {/* The links list is real data whenever its own query worked, so it
          stays under any stats error. */}
      {hasLinks && (
        <Section
          title="Links in this campaign"
          caption={plural(campaignLinks.length, 'link')}
          className="mt-9 md:mt-12"
        >
          {days !== null && !windows && (
            <InlineError retryHref={retryHref}>Clicks per link for this period could not load.</InlineError>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead className="hidden md:table-cell">Goes to</TableHead>
                <TableHead className="text-right">
                  {days !== null ? `Clicks, ${days}d` : 'Clicks'}
                </TableHead>
                {showChange && <TableHead className="text-right">Change</TableHead>}
                {days !== null && (
                  <TableHead className="hidden text-right sm:table-cell">All time</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ link, clicks }) => {
                const kind = destinationKind(link.original_url)
                return (
                  <TableRow key={link.id}>
                    <TableCell className="relative w-full max-w-0 md:w-auto md:max-w-none">
                      <Link
                        href={`/dashboard/links/${link.id}`}
                        className="block truncate font-mono text-[13.5px] text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                      >
                        tws.bio/{link.short_code}
                      </Link>
                      <span
                        className="mt-0.5 block truncate text-[13px] text-text-3 md:hidden"
                        title={link.original_url}
                      >
                        {displayUrl(link.original_url)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden w-full max-w-0 md:table-cell">
                      <span className="block truncate text-text-2" title={link.original_url}>
                        {displayUrl(link.original_url)}
                      </span>
                      {kind && <span className="mt-0.5 block text-xs text-text-3">{kind}</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {clicks === null ? '---' : clicks.toLocaleString('en-US')}
                    </TableCell>
                    {showChange && (
                      <TableCell className="text-right text-[13px] tabular-nums">
                        <Change current={windows.current[link.id] ?? 0} prior={windows.prior[link.id] ?? 0} />
                      </TableCell>
                    )}
                    {days !== null && (
                      <TableCell className="hidden text-right text-text-2 tabular-nums sm:table-cell">
                        {(link.total_clicks ?? 0).toLocaleString('en-US')}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-[13px] text-text-2">
                  All {plural(campaignLinks.length, 'link')}
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right tabular-nums">
                  {rowsKnown ? (
                    <span className="rule-total inline-block pb-1">
                      {rows.reduce((s, r) => s + (r.clicks ?? 0), 0).toLocaleString('en-US')}
                    </span>
                  ) : (
                    '---'
                  )}
                </TableCell>
                {showChange && <TableCell />}
                {days !== null && (
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <span className="rule-total inline-block pb-1">
                      {allTimeClicks.toLocaleString('en-US')}
                    </span>
                  </TableCell>
                )}
              </TableRow>
            </TableFooter>
          </Table>
        </Section>
      )}

      {hasLinks && !noClicks && (
        <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
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
          <Section title="Browsers" caption={windowLabel}>
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
      )}
    </div>
  )
}
