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
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { LazyClicksOverTimeChart } from '@/components/charts/lazy'
import { BarList, countryItems, namedItems } from '@/components/charts/BarList'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { formatDate, plural } from '@/lib/utils'
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

  const allTimeClicks = link.total_clicks ?? 0

  return (
    <div>
      {/* The short code is mono here as everywhere else, at regular weight (the
          mono font ships only that one). The range picker sits in the header,
          next to the page it changes. */}
      <PageHeader
        title={`tws.bio/${link.short_code}`}
        titleClassName="font-mono text-xl font-normal sm:text-2xl"
        description={
          <>
            <a
              href={link.original_url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.original_url}
              className="group inline-flex max-w-full items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring"
            >
              <span className="truncate">{link.original_url}</span>
              <ExternalLink
                aria-hidden
                className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100"
              />
            </a>
            <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <TypeBadge type={link.link_type} />
              <span>Created {formatDate(link.created_at)}</span>
            </span>
          </>
        }
        backHref="/dashboard/links"
        backLabel="Back to links"
        actions={
          <div className="flex items-center gap-3">
            <CopyShortLinkButton shortCode={link.short_code} />
            <TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />
          </div>
        }
      />

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
            <Link
              href={`/dashboard/links/${id}?range=${timeRange}`}
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
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
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
                {days !== null && (
                  <span>
                    <span className="font-mono tabular-nums text-foreground">
                      {allTimeClicks.toLocaleString('en-US')}
                    </span>{' '}
                    all-time
                  </span>
                )}
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
        </div>
      )}
    </div>
  )
}
