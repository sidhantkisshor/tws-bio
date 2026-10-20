import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getClicksOverTimeResult,
  getTopReferrersResult,
  getDeviceBreakdownResult,
  getCountryBreakdownResult,
  getBrowserBreakdownResult,
  getTotalClicksResult,
  isUuid,
  parseTimeRange,
  priorWindowTotal,
  rangeWindow,
  zeroFillDays,
} from '@/lib/analytics'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LazyBarChart, LazyClicksOverTimeChart, LazyPieChart } from '@/components/charts/lazy'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { TrendChip, computeTrend } from '@/components/dashboard/StatCard'
import { CopyShortLinkButton } from '@/components/dashboard/CopyShortLinkButton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
  // stats error card instead of a 404.
  if (!isUuid(id)) notFound()

  const { range: rangeParam } = await searchParams
  const timeRange = parseTimeRange(rangeParam)
  const { since, priorSince, days } = rangeWindow(timeRange)
  // One boundary for every query below, so the current and prior windows meet
  // exactly.
  const filter = { timeRange, linkId: id, since: since?.toISOString() ?? null }

  // One wave. The stats RPCs need only the id, not the link row, and they are
  // SECURITY INVOKER: for a link the caller does not own, RLS gives them no
  // rows, and the row query alone decides the 404.
  const [
    linkResult,
    clicksOverTimeResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    totalClicksResult,
    combinedClicksResult,
  ] = await Promise.all([
    supabase
      .from('links')
      .select('id, short_code, original_url, link_type, total_clicks, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    getClicksOverTimeResult(filter),
    getTopReferrersResult(filter),
    getDeviceBreakdownResult(filter),
    getCountryBreakdownResult(filter),
    getBrowserBreakdownResult(filter),
    getTotalClicksResult(filter),
    // The current and prior windows in one count. The prior total is this
    // minus the current one (priorWindowTotal). 'all' has no prior window.
    priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
  ])

  // A failed row query is an outage, not a missing link: dashboard/error.tsx
  // renders it.
  if (linkResult.error) throw linkResult.error
  const link = linkResult.data
  if (!link) notFound()

  // A failed aggregation must never masquerade as "0 clicks", so render the
  // same destructive-tinted error state the analytics page uses.
  const statsError =
    clicksOverTimeResult.error ||
    referrersResult.error ||
    devicesResult.error ||
    countriesResult.error ||
    browsersResult.error ||
    totalClicksResult.error

  // Empty days count as 0, so the line does not slope across them.
  const clicksOverTime = zeroFillDays(clicksOverTimeResult.data, since, days)
  const referrers = referrersResult.data
  const devices = devicesResult.data
  const countries = countriesResult.data
  const browsers = browsersResult.data
  const totalClicks = totalClicksResult.data

  // Hidden for all time and whenever a count failed, so the chip never
  // compares against a fake zero baseline.
  const priorClicks = priorWindowTotal(combinedClicksResult, totalClicksResult)
  const periodTrend = priorClicks !== null ? computeTrend(totalClicks, priorClicks) : null

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/dashboard/links"
          aria-label="Back to links"
          className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-2xl text-foreground truncate">tws.bio/{link.short_code}</h1>
            <CopyShortLinkButton shortCode={link.short_code} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{link.original_url}</p>
        </div>
      </div>

      {statsError ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-foreground font-medium">Couldn&apos;t load link statistics</p>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong. Please try again.
              </p>
            </div>
            <Button render={<Link href={`/dashboard/links/${id}?range=${timeRange}`} />} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {totalClicks.toLocaleString()} clicks in period
                <span className="text-muted-foreground/70">
                  {' '}&middot; {(link.total_clicks ?? 0).toLocaleString()} all-time
                </span>
              </span>
              <TrendChip trend={periodTrend} />
            </div>
          </div>

          <Card className="bg-card border-border mb-8">
            <CardHeader>
              <CardTitle>Clicks Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <LazyClicksOverTimeChart data={clicksOverTime} />
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Referrers</CardTitle>
              </CardHeader>
              <CardContent>
                <LazyBarChart
                  data={referrers.map((r) => ({ label: r.name, value: r.clicks }))}
                  className="h-48 w-full"
                />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <LazyPieChart data={devices} className="h-48 w-full" />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <LazyBarChart
                  data={countries.map((c) => ({ label: c.name, value: c.clicks }))}
                  color="var(--chart-3)"
                  className="h-48 w-full"
                />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Browsers</CardTitle>
              </CardHeader>
              <CardContent>
                <LazyPieChart data={browsers} className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
