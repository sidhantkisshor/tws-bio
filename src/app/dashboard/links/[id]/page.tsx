import type { Metadata } from 'next'
import { cache } from 'react'
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
import {
  getClickHeatmapResult,
  getLinkClickWindowsResult,
  getReferrerRowsResult,
} from '@/lib/insights'
import { groupByPlatform, type PlatformGroup } from '@/lib/sources'
import { linkHealthIssues, sortIssues, type HealthIssue } from '@/lib/linkHealth'
import { destinationKind } from '@/lib/destinationKind'
import { formatShare } from '@/lib/ledgerFormat'
import { isResourceDropRow } from '@/lib/linkRows'
import { cn, formatDate, plural } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { Badge } from '@/components/ui/badge'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { PageHeader, Section } from '@/components/dashboard/PageHeader'
import { KpiRow, StatCell, computeTrend } from '@/components/dashboard/StatCard'
import { BarChart, ChartLegend, shortDay } from '@/components/charts/BarChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { AttributionPreview } from '@/components/dashboard/AttributionPreview'
import { LinkActions } from '@/components/dashboard/LinkActions'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { displayUrl } from '@/components/dashboard/displayUrl'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// The owner's link row. Cached per request, so the tab title and the page
// share one query.
const getOwnLink = cache(async (id: string, userId: string) => {
  const supabase = await createClient()
  return supabase.from('links').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
})

// The root layout's template adds " - tws.bio".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const fallback = { title: 'Link' }
  const { id } = await params
  if (!isUuid(id)) return fallback
  const user = await getAuthenticatedUser()
  if (!user) return fallback
  const { data } = await getOwnLink(id, user.id)
  return data ? { title: `${SHORT_DOMAIN}/${data.short_code}` } : fallback
}

// The word in the flag box of each "Needs a look" line.
const FLAG: Record<HealthIssue['kind'], string> = {
  placeholder: 'Placeholder',
  loop: 'Loop',
  expired: 'Expired',
  expiring_soon: 'Expires',
  at_cap: 'Limit',
  near_cap: 'Limit',
  inactive: 'Off',
  quiet: 'Quiet',
}

// What to do about it. The fix itself is the Edit button in the header.
const FIX: Partial<Record<HealthIssue['kind'], string>> = {
  placeholder: 'Change the destination with Edit.',
  loop: 'Change the destination with Edit.',
  expired: 'Clear or extend the expiry with Edit.',
  expiring_soon: 'Extend the expiry with Edit if it should keep working.',
  at_cap: 'Raise or clear the click limit with Edit.',
  near_cap: 'Raise the click limit with Edit if it should keep working.',
  inactive: 'Turn it back on from More, then Activate.',
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

function SettingRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-baseline gap-3 md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] md:gap-4 border-b border-rule py-2.5 text-sm last:border-b-0">
      <dt className="text-text-2">{term}</dt>
      <dd className="m-0 min-w-0 text-ink">{children}</dd>
    </div>
  )
}

export default async function LinkDetailPage({
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
  // Before any query: a malformed id would fail all of them and render the
  // error states instead of a 404.
  if (!isUuid(id)) notFound()

  const { range: rangeParam } = await searchParams
  const timeRange = parseTimeRange(rangeParam)
  const { since, priorSince, days } = rangeWindow(timeRange)
  // One boundary for every query below, so the current and prior windows meet
  // exactly.
  const sinceIso = since?.toISOString() ?? null
  const filter = { timeRange, linkId: id, since: sinceIso }
  const linkIds = [id]
  // "Quiet" means no clicks in the last 30 days, whatever range is on screen.
  const healthWindow = rangeWindow('30d')
  // Best time to post needs volume: at least 90 days, or all time.
  const heatSince = timeRange === 'all' ? null : rangeWindow('90d').since
  const retryHref = `/dashboard/links/${id}?range=${timeRange}`

  // One wave. The stats RPCs need only the id, not the link row, and they are
  // SECURITY INVOKER: for a link the caller does not own, RLS gives them no
  // rows, and the row query alone decides the 404.
  const [
    linkResult,
    campaignsResult,
    seriesResult,
    totalResult,
    combinedResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    heatmapResult,
    last30Result,
  ] = await Promise.all([
    getOwnLink(id, user.id),
    supabase.from('campaigns').select('id, name').eq('user_id', user.id),
    // The current and prior windows in one series: split below into the bars
    // and the dotted prior line.
    getClicksOverTimeResult({ ...filter, since: priorSince?.toISOString() ?? sinceIso }),
    getTotalClicksResult(filter),
    // The current and prior windows in one count. The prior total is this
    // minus the current one (priorWindowTotal). 'all' has no prior window.
    priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
    getReferrerRowsResult({ linkIds, since: sinceIso }),
    getDeviceBreakdownResult(filter),
    getCountryBreakdownResult(filter),
    getBrowserBreakdownResult(filter),
    getClickHeatmapResult({ linkIds, since: heatSince }),
    getLinkClickWindowsResult({
      linkIds,
      priorSince: healthWindow.priorSince,
      since: healthWindow.since,
    }),
  ])

  // A failed row query is an outage, not a missing link: dashboard/error.tsx
  // renders it.
  if (linkResult.error) throw linkResult.error
  const link = linkResult.data
  if (!link) notFound()

  const managed = isResourceDropRow(link.short_code)
  const kind = destinationKind(link.original_url)
  const campaign = link.campaign_id
    ? (campaignsResult.data ?? []).find((c) => c.id === link.campaign_id) ?? null
    : null
  const now = new Date()
  const expired = link.expires_at ? Date.parse(link.expires_at) <= now.getTime() : false
  const allTimeClicks = link.total_clicks ?? 0

  // Series: bars for the window, a dotted line for the one before it.
  let current: DailyClicks[]
  let prior: DailyClicks[] | null = null
  if (priorSince && days !== null) {
    const both = zeroFillDays(seriesResult.data, priorSince, days * 2)
    prior = both.slice(0, days)
    current = both.slice(days)
  } else {
    current = zeroFillDays(seriesResult.data, null, null)
  }

  // A failed count must never read as "0 clicks".
  const totalError = totalResult.error
  const totalClicks = totalResult.data
  const priorClicks = priorWindowTotal(combinedResult, totalResult)
  const clicksTrend = priorClicks !== null ? computeTrend(totalClicks, priorClicks) : null

  const peak = seriesResult.error ? null : busiest(current)
  const priorPeak = prior ? busiest(prior) : null
  const peakTrend =
    peak && prior && !seriesResult.error ? computeTrend(peak.clicks, priorPeak?.clicks ?? 0) : null

  const groups = referrersResult.error ? [] : groupByPlatform(referrersResult.data)
  // The top source is a place a click came from, so the no-referrer group
  // (chats, apps, typed links) is never picked.
  const topGroup = groups.find((g) => g.key !== 'none' && g.count > 0) ?? null

  // The day the link went live, marked on the chart when it is in view.
  const createdKey = link.created_at ? dayKey(new Date(link.created_at)) : null
  const marks =
    createdKey && current.some((d) => d.date === createdKey)
      ? [
          {
            date: createdKey,
            label: `tws.bio/${link.short_code} went live, ${shortDay(createdKey)}`,
            shortLabel: `Went live, ${shortDay(createdKey)}`,
          },
        ]
      : []

  // Worst first, the same order as the Health page.
  const issues = sortIssues(
    linkHealthIssues(link, {
      now,
      shortDomain: SHORT_DOMAIN,
      clicksInLast30d: last30Result.error ? undefined : (last30Result.data.current[id] ?? 0),
    }),
  )

  const windowLabel = days !== null ? `Last ${days} days` : 'All time'
  const noClicks = !totalError && totalClicks === 0

  return (
    <div>
      <PageHeader
        title={
          <span className="block font-mono text-[24px] leading-tight font-normal tracking-normal md:text-[32px]">
            <span className="text-text-2">{SHORT_DOMAIN}/</span>
            <span className="font-medium text-ink">{link.short_code}</span>
          </span>
        }
        // The link's own actions sit beside it: Copy, QR, Edit, then More
        // (Duplicate, Open destination, Pause, Delete).
        titleAccessory={<LinkActions link={link} className="-ml-1 self-center" hideViewStats />}
        backHref="/dashboard/links"
        backLabel="Links"
        description={
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-[13px] text-text-3">Goes to</span>
              <a
                href={link.original_url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.original_url}
                className="focus-ring min-w-0 truncate rounded-ctl font-mono text-[13.5px] text-ink transition-colors duration-150 hover:text-accent-text"
              >
                {displayUrl(link.original_url)}
              </a>
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-text-3">
              {kind && <span>{kind}</span>}
              <span>Created {formatDate(link.created_at)}</span>
              {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
              {managed && <Badge>Resource Drop</Badge>}
              {campaign && (
                <Link
                  href={`/dashboard/campaigns/${campaign.id}`}
                  className="focus-ring rounded-ctl text-text-2 underline decoration-rule underline-offset-[3px] hover:text-ink hover:decoration-current"
                >
                  {campaign.name}
                </Link>
              )}
              {expired && <Badge variant="destructive">Expired</Badge>}
              {!link.is_active && <Badge variant="destructive">Turned off</Badge>}
            </p>
          </div>
        }
        actions={<TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />}
        className="md:items-end"
      />

      {issues.length > 0 && (
        <section aria-label="Needs a look" className="border-t border-rule pt-4 pb-5">
          <p className="type-label">Needs a look</p>
          <ul className="mt-2.5 grid gap-2.5">
            {issues.map((issue) => (
              <li
                key={issue.kind}
                className="grid items-baseline gap-1.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-4"
              >
                <span
                  className={cn(
                    'justify-self-start rounded-[2px] border px-1.5 text-center text-[11px] leading-5 font-bold tracking-[0.06em] uppercase md:justify-self-stretch',
                    issue.severity === 'high' ? 'border-neg text-neg' : 'border-text-2 text-text-2',
                  )}
                >
                  {FLAG[issue.kind]}
                </span>
                <p className="text-sm leading-normal text-text-2">
                  <span className="text-ink">{issue.message}</span>
                  {!managed && FIX[issue.kind] && <> {FIX[issue.kind]}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <StatCell title="All-time clicks" value={allTimeClicks} />
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
                    : 'Clicks show up here as soon as someone opens the short link.'}
                </p>
                {allTimeClicks > 0 && timeRange !== 'all' && (
                  <Link
                    href={`/dashboard/links/${id}?range=all`}
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
                label={`Clicks per day for tws.bio/${link.short_code}`}
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
            recordedSince={referrersResult.recordedSince}
            error={referrersResult.error}
            limit={8}
            emptyText={days !== null ? `No clicks in the last ${days} days.` : 'No clicks yet.'}
          />
        )}
      </div>

      <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
        <Section
          title="Best time to post"
          caption={`${heatSince ? 'Last 90 days' : 'All time'}, India time`}
        >
          <Heatmap data={heatmapResult.data} error={heatmapResult.error} />
        </Section>

        <Section title="Link settings">
          <dl>
            <SettingRow term="Destination">
              <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                {link.original_url}
              </span>
            </SettingRow>
            {link.ios_deep_link && (
              <SettingRow term="iPhone app link">
                <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                  {link.ios_deep_link}
                </span>
              </SettingRow>
            )}
            {link.android_deep_link && (
              <SettingRow term="Android app link">
                <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                  {link.android_deep_link}
                </span>
              </SettingRow>
            )}
            {link.fallback_url && (
              <SettingRow term="Web fallback">
                <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                  {link.fallback_url}
                </span>
              </SettingRow>
            )}
            <SettingRow term="Campaign">
              {campaign ? (
                <Link
                  href={`/dashboard/campaigns/${campaign.id}`}
                  className="focus-ring rounded-ctl text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current"
                >
                  {campaign.name}
                </Link>
              ) : link.campaign_id && campaignsResult.error ? (
                <span className="text-text-3">---</span>
              ) : (
                <span className="text-text-3">None</span>
              )}
            </SettingRow>
            <SettingRow term="Expires">
              {link.expires_at ? (
                <span className={cn(expired && 'text-neg')}>
                  {expired ? 'Expired ' : ''}
                  {formatDate(link.expires_at)}
                </span>
              ) : (
                <span className="text-text-3">Never</span>
              )}
            </SettingRow>
            <SettingRow term="Click limit">
              {link.max_clicks ? (
                <span className="tabular-nums">
                  {allTimeClicks.toLocaleString('en-US')} of {link.max_clicks.toLocaleString('en-US')} used
                </span>
              ) : (
                <span className="text-text-3">None</span>
              )}
            </SettingRow>
            <SettingRow term="Status">
              {link.is_active ? 'On' : <span className="text-neg">Turned off</span>}
            </SettingRow>
          </dl>
        </Section>
      </div>

      <div className="mt-9 grid gap-9 md:mt-12 md:gap-12 lg:grid-cols-2">
        {/* Countries above Browsers, What GA4 receives beside them. Side by
            side, two narrow columns cut long country names short. */}
        {!noClicks && (
          <div className="grid min-w-0 gap-10">
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

        <Section title="What GA4 receives">
          {managed ? (
            <div className="text-sm leading-relaxed text-text-2">
              <p className="mb-4">
                Resource Drop links add their own tags, naming the video. A click that already
                carries UTM tags keeps them instead.
              </p>
              <dl>
                {(
                  [
                    ['utm_source', 'youtube'],
                    ['utm_medium', 'tws_bio'],
                    ['utm_campaign', link.short_code.slice(2)],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 text-[13px] last:border-b-0"
                  >
                    <dt className="font-mono text-text-2">{k}</dt>
                    <dd className="m-0 min-w-0 text-right font-mono text-ink [overflow-wrap:anywhere]">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <AttributionPreview
              shortCode={link.short_code}
              destination={link.original_url}
              className="[&_.bg-page]:bg-sunk"
            />
          )}
        </Section>
      </div>
    </div>
  )
}
