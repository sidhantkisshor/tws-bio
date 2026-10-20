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
import { AlertTriangle } from 'lucide-react'
import { LazyClicksOverTimeChart } from '@/components/charts/lazy'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { plural } from '@/lib/utils'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { TrendChip, computeTrend } from '@/components/dashboard/StatCard'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card, CardAction, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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

  // What the links have collected since they were made, for the empty-period
  // explanation below.
  const allTimeClicks = campaignLinks.reduce((sum, l) => sum + (l.total_clicks || 0), 0)

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={campaign.description}
        backHref="/dashboard/campaigns"
        backLabel="Back to campaigns"
        actions={<TimeRangePicker current={timeRange} basePath={`/dashboard/campaigns/${id}`} />}
        actionsClassName="w-full sm:w-auto"
      />

      <div className="flex flex-col gap-6">
        {statsError ? (
          <Card className="bg-card border-border">
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
              <Link
                href={`/dashboard/campaigns/${id}?range=${timeRange}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Try again
              </Link>
            </CardContent>
          </Card>
        ) : totalClicks === 0 ? (
          // One explanation and one next step, in place of five empty cards.
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="font-medium text-foreground">
                {days !== null ? `No clicks in the last ${days} days` : 'No clicks yet'}
              </p>
              <p className="text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
        ) : (
          <>
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {periodTrend && days !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <TrendChip trend={periodTrend} />
                      vs prior {days} days
                    </span>
                  )}
                  <span>
                    <span className="font-mono tabular-nums text-foreground">
                      {linkIds.length.toLocaleString('en-US')}
                    </span>{' '}
                    {linkIds.length === 1 ? 'link' : 'links'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <LazyClicksOverTimeChart data={clicksOverTime} />
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Referrers</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={referrers.map((r) => ({ label: r.name, value: r.clicks }))}
                    label="Referrers by clicks"
                    total={totalClicks}
                  />
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={countryItems(countries)}
                    label="Countries by clicks"
                    total={totalClicks}
                  />
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Browsers</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={namedItems(browsers.slice(0, 8))}
                    label="Browsers by clicks"
                    total={totalClicks}
                  />
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={namedItems(devices)}
                    label="Devices by clicks"
                    total={totalClicks}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* The links list is real data whenever its own query worked, so it
            stays under a stats error card. */}
        {!linksError && (
          <Card className="bg-card border-border gap-0 pb-0">
            <CardHeader className="border-b border-border">
              <CardTitle>Links in Campaign</CardTitle>
              {/* The rows count every click a link has had, not this range, so
                  they will not add up to the total above. */}
              <CardAction className="self-center text-xs text-muted-foreground">
                All-time clicks
              </CardAction>
            </CardHeader>
            {campaignLinks.length > 0 ? (
              <div className="divide-y divide-border">
                {campaignLinks.map((link) => {
                  const clicks = link.total_clicks || 0
                  return (
                    <Link
                      key={link.id}
                      href={`/dashboard/links/${link.id}`}
                      className="block px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="font-mono text-sm text-primary-text">
                            tws.bio/{link.short_code}
                          </span>
                          <p className="truncate text-xs text-muted-foreground">
                            {link.original_url}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          <span className="font-mono tabular-nums text-foreground">
                            {clicks.toLocaleString('en-US')}
                          </span>{' '}
                          {clicks === 1 ? 'click' : 'clicks'}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <CardContent>
                <div className="flex flex-col items-center text-center gap-4 py-12">
                  <p className="text-muted-foreground">No links in this campaign yet.</p>
                  <Link href="/dashboard/create" className={buttonVariants()}>
                    Create Link
                  </Link>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
