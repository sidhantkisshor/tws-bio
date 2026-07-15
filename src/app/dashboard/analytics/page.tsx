import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DeviceChart } from '@/components/dashboard/DeviceChart'
import { BrowserChart } from '@/components/dashboard/BrowserChart'
import { ReferrerChart } from '@/components/dashboard/ReferrerChart'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { ClicksOverTimeChart } from '@/components/charts/ClicksOverTimeChart'
import { TrendChip, computeTrend } from '@/components/dashboard/StatCard'
import { BarListChart } from '@/components/dashboard/BarListChart'
import { AlertTriangle } from 'lucide-react'

const VALID_RANGES = new Set(['7', '30', '90', 'all'])

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { range: rangeParam } = await searchParams
  const range = VALID_RANGES.has(rangeParam || '') ? rangeParam! : '30'

  // Calculate start date
  let startDate: Date | null = null
  if (range !== 'all') {
    const days = parseInt(range, 10)
    startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
  }

  // Get user's link IDs (short_code needed for the per-link breakdown below)
  const { data: userLinks, error: userLinksError } = await supabase
    .from('links')
    .select('id, short_code')
    .eq('user_id', user.id)

  if (userLinksError) {
    console.error('[analytics-page] userLinks query:', userLinksError)

    // A failed fetch must never render identically to "you have no links
    // yet" — surface a distinct error state with a retry affordance.
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-2xl text-foreground">Analytics</h1>
          <Suspense>
            <DateRangePicker />
          </Suspense>
        </div>
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
            <Link href="/dashboard/analytics">
              <Button variant="outline">Try again</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!userLinks || userLinks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-2xl text-foreground">Analytics</h1>
          <Suspense>
            <DateRangePicker />
          </Suspense>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <p className="text-muted-foreground">
              No links created yet. Create a link to start seeing analytics.
            </p>
            <Link href="/dashboard/create">
              <Button>Create Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const linkIds = userLinks.map((l) => l.id)
  const shortCodeByLinkId: Record<string, string> = {}
  for (const l of userLinks) {
    shortCodeByLinkId[l.id] = l.short_code
  }

  // Query clicks with date filter
  let query = supabase
    .from('clicks')
    .select(
      'clicked_at, device_type, browser_name, os_name, referrer_domain, link_id, country'
    )
    .in('link_id', linkIds)

  if (range !== 'all' && startDate) {
    query = query.gte('clicked_at', startDate.toISOString())
  }

  // Prior-period click count (same-length window immediately preceding the
  // current one) for the Total Clicks trend delta. Not meaningful for "all
  // time" since there's no bounded prior window to compare against.
  let priorTotalClicks: number | null = null
  if (range !== 'all' && startDate) {
    const days = parseInt(range, 10)
    const priorStart = new Date(startDate)
    priorStart.setDate(priorStart.getDate() - days)

    const { count: priorCount, error: priorClicksError } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true })
      .in('link_id', linkIds)
      .gte('clicked_at', priorStart.toISOString())
      .lt('clicked_at', startDate.toISOString())

    if (priorClicksError) {
      console.error('[analytics-page] prior clicks query:', priorClicksError)
    }
    priorTotalClicks = priorCount || 0
  }

  const { data: clicks, error: clicksError } = await query

  if (clicksError) {
    console.error('[analytics-page] clicks query:', clicksError)
  }

  // Process data
  const clicksData = clicks || []
  const totalClicks = clicksData.length
  const totalClicksTrend =
    priorTotalClicks !== null ? computeTrend(totalClicks, priorTotalClicks) : null

  // Clicks over time: group by date
  const clicksByDate: Record<string, number> = {}
  for (const click of clicksData) {
    if (!click.clicked_at) continue
    const date = click.clicked_at.split('T')[0]
    clicksByDate[date] = (clicksByDate[date] || 0) + 1
  }

  // Fill in missing dates for a continuous chart
  const clicksOverTime: { date: string; clicks: number }[] = []
  if (startDate) {
    const end = new Date()
    const current = new Date(startDate)
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      clicksOverTime.push({
        date: dateStr,
        clicks: clicksByDate[dateStr] || 0,
      })
      current.setUTCDate(current.getUTCDate() + 1)
    }
  } else {
    // "all" range: just use existing dates sorted
    const sortedDates = Object.keys(clicksByDate).sort()
    if (sortedDates.length > 0) {
      const first = new Date(sortedDates[0] + 'T00:00:00Z')
      const last = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00Z')
      const current = new Date(first)
      while (current <= last) {
        const dateStr = current.toISOString().split('T')[0]
        clicksOverTime.push({
          date: dateStr,
          clicks: clicksByDate[dateStr] || 0,
        })
        current.setUTCDate(current.getUTCDate() + 1)
      }
    }
  }

  // Device breakdown
  const deviceCounts: Record<string, number> = {}
  for (const click of clicksData) {
    const device = click.device_type || 'unknown'
    deviceCounts[device] = (deviceCounts[device] || 0) + 1
  }
  const deviceData = Object.entries(deviceCounts)
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count)

  // Browser breakdown (top 6)
  const browserCounts: Record<string, number> = {}
  for (const click of clicksData) {
    const browser = click.browser_name || 'Unknown'
    browserCounts[browser] = (browserCounts[browser] || 0) + 1
  }
  const browserData = Object.entries(browserCounts)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Top referrers (top 10)
  const referrerCounts: Record<string, number> = {}
  for (const click of clicksData) {
    const referrer = click.referrer_domain || 'Direct'
    referrerCounts[referrer] = (referrerCounts[referrer] || 0) + 1
  }
  const referrerData = Object.entries(referrerCounts)
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top links: which of the user's links are actually driving these clicks
  // (top 10)
  const linkCounts: Record<string, number> = {}
  for (const click of clicksData) {
    if (!click.link_id) continue
    linkCounts[click.link_id] = (linkCounts[click.link_id] || 0) + 1
  }
  const topLinksData = Object.entries(linkCounts)
    .map(([linkId, count]) => ({
      label: shortCodeByLinkId[linkId] || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top countries (top 10)
  const countryCounts: Record<string, number> = {}
  for (const click of clicksData) {
    const country = click.country || 'Unknown'
    countryCounts[country] = (countryCounts[country] || 0) + 1
  }
  const countryData = Object.entries(countryCounts)
    .map(([country, count]) => ({ label: country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-2xl text-foreground">Analytics</h1>
        <Suspense>
          <DateRangePicker />
        </Suspense>
      </div>

      {/* Total clicks stat */}
      <Card className="bg-card border-border mb-8">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Total Clicks{' '}
            {range !== 'all'
              ? `(Last ${range} days)`
              : '(All time)'}
          </p>
          <p className="text-3xl font-bold font-mono text-foreground">
            {totalClicks.toLocaleString()}
          </p>
          {totalClicksTrend && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <TrendChip trend={totalClicksTrend} />
              <span className="text-xs text-muted-foreground">
                vs prior {range} days
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clicks Over Time */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle>Clicks Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ClicksOverTimeChart data={clicksOverTime} />
        </CardContent>
      </Card>

      {/* Top Links - which links are actually driving these clicks */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle>Top Links</CardTitle>
        </CardHeader>
        <CardContent>
          <BarListChart
            data={topLinksData}
            emptyMessage="No clicks yet"
          />
        </CardContent>
      </Card>

      {/* Breakdown Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <DeviceChart data={deviceData} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Browsers</CardTitle>
          </CardHeader>
          <CardContent>
            <BrowserChart data={browserData} />
          </CardContent>
        </Card>
      </div>

      {/* Referrers + Countries */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferrerChart data={referrerData} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <BarListChart data={countryData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
