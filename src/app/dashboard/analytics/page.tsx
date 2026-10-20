import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  getClicksOverTimeResult,
  getDeviceBreakdownResult,
  getBrowserBreakdownResult,
  getTopReferrersResult,
  getCountryBreakdownResult,
  getTotalClicksResult,
  parseTimeRange,
  priorWindowTotal,
  rangeWindow,
  zeroFillDays,
  type TimeRange,
} from '@/lib/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { LazyClicksOverTimeChart } from '@/components/charts/lazy'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { TrendChip, computeTrend } from '@/components/dashboard/StatCard'
import { AlertTriangle } from 'lucide-react'

function AnalyticsHeader({ timeRange }: { timeRange: TimeRange }) {
  return (
    <PageHeader
      title="Analytics"
      actions={<TimeRangePicker current={timeRange} basePath="/dashboard/analytics" />}
      actionsClassName="w-full sm:w-auto"
    />
  )
}

// A failed fetch must never render identically to "you have no links yet" or
// "0 clicks", so every failure gets this distinct state with a retry.
function AnalyticsError({ timeRange }: { timeRange: TimeRange }) {
  return (
    <div>
      <AnalyticsHeader timeRange={timeRange} />
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center text-center gap-4 py-12">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div>
            <p className="text-foreground font-medium">Couldn&apos;t load analytics</p>
            <p className="text-sm text-muted-foreground mt-1">
              Something went wrong. Please try again.
            </p>
          </div>
          <Link
            href={`/dashboard/analytics?range=${timeRange}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Try again
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

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
  // Old bookmarks with ?range=30 still parse; the picker now writes ?range=30d.
  const timeRange = parseTimeRange(rangeParam)
  const { since: windowStart, priorSince, days } = rangeWindow(timeRange)
  // One exact window boundary shared by every aggregation below (the
  // embedded per-link counts, the RPC helpers and the prior-period count),
  // so no two queries disagree about where the range starts.
  const since = windowStart?.toISOString() ?? null

  // Get user's link IDs (short_code + a per-link ranged click count ride
  // along via the embedded `clicks(count)` aggregate: it feeds the Top
  // Links breakdown below without fetching a single raw click row, and
  // clicks RLS still applies to the embedded count).
  let firstLinksQuery = supabase
    .from('links')
    .select('id, short_code, clicks(count)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('id', { ascending: true })
    .range(0, 999)
  if (since) {
    firstLinksQuery = firstLinksQuery.gte('clicks.clicked_at', since)
  }
  const firstLinksResult = await firstLinksQuery
  let userLinks = firstLinksResult.data || []
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
        .select('id, short_code, clicks(count)')
        .eq('user_id', user.id)
        .order('id', { ascending: true })
        .range(from, Math.min(from + pageSize - 1, totalOwnedLinks - 1))
      if (since) pageQuery = pageQuery.gte('clicks.clicked_at', since)
      pageRequests.push(pageQuery)
    }

    const extraPages = await Promise.all(pageRequests)
    const failedPage = extraPages.find((page) => page.error)
    if (failedPage?.error) {
      userLinksError = failedPage.error
    } else {
      userLinks = userLinks.concat(extraPages.flatMap((page) => page.data || []))
    }
  }

  if (userLinksError) {
    console.error('[analytics-page] userLinks query:', userLinksError)
    return <AnalyticsError timeRange={timeRange} />
  }

  if (!userLinks || userLinks.length === 0) {
    return (
      <div>
        <AnalyticsHeader timeRange={timeRange} />
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <p className="text-muted-foreground">
              No links created yet. Create a link to start seeing analytics.
            </p>
            <Link href="/dashboard/create" className={buttonVariants()}>
              Create Link
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const linkIds = userLinks.map((l) => l.id)

  // Every aggregation runs DB-side via the SECURITY INVOKER RPC helpers
  // (clicks RLS applies, since they run as the logged-in user) in a single
  // parallel wave, replacing the old fetch-every-raw-click-row + JS
  // aggregation that silently undercounted past PostgREST's 1000-row cap.
  const filter = { timeRange, linkIds, since }
  const [
    clicksSeriesResult,
    devicesResult,
    browsersResult,
    referrersResult,
    countriesResult,
    totalClicksResult,
    combinedClicksResult,
  ] = await Promise.all([
    getClicksOverTimeResult(filter),
    getDeviceBreakdownResult(filter),
    getBrowserBreakdownResult(filter),
    getTopReferrersResult(filter),
    getCountryBreakdownResult(filter),
    getTotalClicksResult(filter),
    // Count the combined current + prior span via the existing POST-based RPC;
    // subtracting the current total (priorWindowTotal) yields the bounded
    // prior window. This avoids a potentially oversized `.in(linkIds)` query
    // string for accounts with many links. 'all' has no prior window.
    priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
  ])

  // A failed aggregation must never masquerade as "0 clicks", so render the
  // same destructive-tinted error state used for the links query above.
  const mainError =
    clicksSeriesResult.error ||
    devicesResult.error ||
    browsersResult.error ||
    referrersResult.error ||
    countriesResult.error ||
    totalClicksResult.error

  if (mainError) {
    return <AnalyticsError timeRange={timeRange} />
  }

  if (combinedClicksResult?.error) {
    console.error('[analytics-page] prior clicks query failed')
  }
  // On a prior-count failure hide the trend chip rather than comparing the
  // current window against a fake zero baseline.
  const priorTotalClicks = priorWindowTotal(combinedClicksResult, totalClicksResult)

  const totalClicks = totalClicksResult.data
  const totalClicksTrend =
    priorTotalClicks !== null ? computeTrend(totalClicks, priorTotalClicks) : null

  // Clicks over time: one bucket per day of the range (exactly 30 for 30d),
  // with empty days as 0. For all time it runs from the first to the last
  // day that has clicks.
  const clicksOverTime = zeroFillDays(clicksSeriesResult.data, windowStart, days)

  // Every breakdown renders as the same ranked list. The period total is the
  // share column's denominator on all of them.
  const deviceItems = namedItems(devicesResult.data)
  const browserItems = namedItems(browsersResult.data.slice(0, 8))
  const referrerItems = referrersResult.data.map((r) => ({ label: r.name, value: r.clicks }))
  const countryRows = countryItems(countriesResult.data)

  // Top links: which of the user's links are actually driving these clicks
  // (top 10), from the per-link ranged counts in the embedded aggregate above.
  const topLinksData = userLinks
    .map((l) => ({
      label: `tws.bio/${l.short_code}`,
      href: `/dashboard/links/${l.id}`,
      value: l.clicks[0]?.count ?? 0,
    }))
    .filter((l) => l.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // A period with no clicks is one explanation with one next step, not six
  // empty cards.
  if (totalClicks === 0) {
    return (
      <div>
        <AnalyticsHeader timeRange={timeRange} />
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-medium text-foreground">
              {days !== null ? `No clicks in the last ${days} days` : 'No clicks yet'}
            </p>
            {timeRange !== 'all' ? (
              <Link
                href="/dashboard/analytics?range=all"
                className={buttonVariants({ variant: 'outline' })}
              >
                View all time
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                Clicks show up here as soon as someone opens a short link.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <AnalyticsHeader timeRange={timeRange} />

      <div className="flex flex-col gap-6">
        {/* The period total is the page's headline number, above its chart. */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {days !== null ? `Clicks, last ${days} days` : 'Clicks, all time'}
              </CardTitle>
              <p className="mt-1 font-mono text-3xl tracking-tight tabular-nums text-foreground">
                {totalClicks.toLocaleString('en-US')}
              </p>
            </div>
            {totalClicksTrend && days !== null && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <TrendChip trend={totalClicksTrend} />
                  vs prior {days} days
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <LazyClicksOverTimeChart data={clicksOverTime} />
          </CardContent>
        </Card>

        {/* Top Links: which links are actually driving these clicks */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Links</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={topLinksData} label="Top links by clicks" total={totalClicks} mono />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Top Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={referrerItems} label="Top referrers by clicks" total={totalClicks} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Top Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={countryRows} label="Top countries by clicks" total={totalClicks} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Browsers</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={browserItems} label="Browsers by clicks" total={totalClicks} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={deviceItems} label="Devices by clicks" total={totalClicks} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
