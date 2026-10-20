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
import { LazyBarChart, LazyClicksOverTimeChart, LazyPieChart } from '@/components/charts/lazy'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { TrendChip, computeTrend } from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// What an empty campaign's stats are, without asking the database.
const NO_ROWS = { data: [], error: false }

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
      .select('id, short_code, original_url, total_clicks')
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
  if (linksResult.error) {
    console.error('[campaign-detail] links query:', linksResult.error)
  }
  const campaignLinks = linksResult.data ?? []
  const linkIds = campaignLinks.map((l) => l.id)

  // Wave 2: the stats RPCs and the prior-window count. Skipped when there is
  // nothing to count: an empty campaign, or a failed links query (which
  // renders the error card).
  const filter = { timeRange, linkIds, since: since?.toISOString() ?? null }
  const [
    clicksOverTimeResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    totalClicksResult,
    combinedClicksResult,
  ] =
    linkIds.length > 0
      ? await Promise.all([
          getClicksOverTimeResult(filter),
          getTopReferrersResult(filter),
          getDeviceBreakdownResult(filter),
          getCountryBreakdownResult(filter),
          getBrowserBreakdownResult(filter),
          getTotalClicksResult(filter),
          // The current and prior windows in one count, with the link ids in
          // the RPC's POST body. A GET with every id in its URL breaks past a
          // few hundred links. 'all' has no prior window.
          priorSince ? getTotalClicksResult({ ...filter, since: priorSince.toISOString() }) : null,
        ])
      : ([NO_ROWS, NO_ROWS, NO_ROWS, NO_ROWS, NO_ROWS, { data: 0, error: false }, null] as const)

  // A failed query must never masquerade as "0 clicks" or "0 links", so
  // render the same destructive-tinted error state link detail uses.
  const statsError =
    linksError ||
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

  // Hidden for all time, for an empty campaign and whenever a count failed,
  // so the chip never compares against a fake zero baseline.
  const priorClicks = priorWindowTotal(combinedClicksResult, totalClicksResult)
  const periodTrend = priorClicks !== null ? computeTrend(totalClicks, priorClicks) : null

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/dashboard/campaigns"
          aria-label="Back to campaigns"
          className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl text-foreground wrap-break-word">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-sm text-muted-foreground wrap-break-word">{campaign.description}</p>
          )}
        </div>
      </div>

      {statsError ? (
        <Card className="bg-card border-border mb-8">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-foreground font-medium">Couldn&apos;t load campaign statistics</p>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong. Please try again.
              </p>
            </div>
            <Button render={<Link href={`/dashboard/campaigns/${id}?range=${timeRange}`} />} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <TimeRangePicker current={timeRange} basePath={`/dashboard/campaigns/${id}`} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {totalClicks.toLocaleString()} clicks &middot; {linkIds.length} links
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

          <div className="grid md:grid-cols-2 gap-6 mb-8">
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

      {/* The links list is real data whenever its own query worked, so it
          stays under a stats error card. */}
      {!linksError && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle>Links in Campaign</CardTitle>
          </CardHeader>
          {campaignLinks.length > 0 ? (
            <div className="divide-y divide-border">
              {campaignLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/dashboard/links/${link.id}`}
                  className="block px-6 py-3 hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-primary-text">tws.bio/{link.short_code}</span>
                      <p className="text-xs text-muted-foreground truncate max-w-md">{link.original_url}</p>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">{(link.total_clicks || 0).toLocaleString()} clicks</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <CardContent>
              <div className="flex flex-col items-center text-center gap-4 py-12">
                <p className="text-muted-foreground">No links in this campaign yet.</p>
                <Button render={<Link href="/dashboard/create" />}>
                  Create Link
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
