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
  type TimeRange,
} from '@/lib/analytics'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClicksOverTimeChart } from '@/components/charts/ClicksOverTimeChart'
import { BarChart } from '@/components/charts/BarChart'
import { PieChart } from '@/components/charts/PieChart'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { TrendChip, computeTrend, type StatTrend } from '@/components/dashboard/StatCard'
import { CopyShortLinkButton } from '@/components/dashboard/CopyShortLinkButton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all'])
const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

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
  const { range: rangeParam } = await searchParams
  const timeRange: TimeRange = VALID_RANGES.has(rangeParam || '') ? (rangeParam as TimeRange) : '30d'

  const { data: link, error } = await supabase
    .from('links')
    .select('id, short_code, original_url, link_type, total_clicks, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !link) notFound()

  const filter = { timeRange, linkId: id }
  const [
    clicksOverTimeResult,
    referrersResult,
    devicesResult,
    countriesResult,
    browsersResult,
    totalClicksResult,
  ] = await Promise.all([
    getClicksOverTimeResult(filter),
    getTopReferrersResult(filter),
    getDeviceBreakdownResult(filter),
    getCountryBreakdownResult(filter),
    getBrowserBreakdownResult(filter),
    getTotalClicksResult(filter),
  ])

  // A failed aggregation must never masquerade as "0 clicks" — render the
  // same destructive-tinted error state the analytics page uses.
  const statsError =
    clicksOverTimeResult.error ||
    referrersResult.error ||
    devicesResult.error ||
    countriesResult.error ||
    browsersResult.error ||
    totalClicksResult.error

  const clicksOverTime = clicksOverTimeResult.data
  const referrers = referrersResult.data
  const devices = devicesResult.data
  const countries = countriesResult.data
  const browsers = browsersResult.data
  const totalClicks = totalClicksResult.data

  // Prior-period click count (same-length window immediately preceding the
  // selected range) for the "clicks in period" trend delta. Not meaningful
  // for "all time" since there's no bounded prior window to compare against.
  let periodTrend: StatTrend | null = null
  if (timeRange !== 'all' && !statsError) {
    const days = RANGE_DAYS[timeRange]
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - days)
    const priorStart = new Date(periodStart)
    priorStart.setDate(priorStart.getDate() - days)

    const { count: priorClicks, error: priorClicksError } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', id)
      .gte('clicked_at', priorStart.toISOString())
      .lt('clicked_at', periodStart.toISOString())

    if (priorClicksError) {
      // Hide the trend chip rather than comparing the current window
      // against a fake zero baseline.
      console.error('[link-detail] prior clicks query:', priorClicksError)
    } else {
      periodTrend = computeTrend(totalClicks, priorClicks || 0)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-heading text-lg text-foreground">tws.bio/{link.short_code}</h1>
                <CopyShortLinkButton shortCode={link.short_code} />
              </div>
              <p className="text-sm text-muted-foreground truncate max-w-md">{link.original_url}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <Button render={<Link href={`/dashboard/links/${id}`} />} variant="outline">
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
        <>
        <div className="flex items-center justify-between mb-8">
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
            <ClicksOverTimeChart data={clicksOverTime} />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
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
              <PieChart data={devices} className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
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
              <PieChart data={browsers} className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </main>
    </div>
  )
}
