import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeviceChart } from '@/components/dashboard/DeviceChart'
import { BrowserChart } from '@/components/dashboard/BrowserChart'
import { ReferrerChart } from '@/components/dashboard/ReferrerChart'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { ClicksOverTimeChart } from '@/components/charts/ClicksOverTimeChart'

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

  // Get user's link IDs
  const { data: userLinks, error: userLinksError } = await supabase
    .from('links')
    .select('id')
    .eq('user_id', user.id)

  if (userLinksError) {
    console.error('[analytics-page] userLinks query:', userLinksError)
  }

  if (!userLinks || userLinks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <Suspense>
            <DateRangePicker />
          </Suspense>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No links created yet. Create a link to start seeing analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const linkIds = userLinks.map((l) => l.id)

  // Query clicks with date filter
  let query = supabase
    .from('clicks')
    .select(
      'clicked_at, device_type, browser_name, os_name, referrer_domain'
    )
    .in('link_id', linkIds)

  if (range !== 'all' && startDate) {
    query = query.gte('clicked_at', startDate.toISOString())
  }

  const { data: clicks, error: clicksError } = await query

  if (clicksError) {
    console.error('[analytics-page] clicks query:', clicksError)
  }

  // Process data
  const clicksData = clicks || []
  const totalClicks = clicksData.length

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
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

      {/* Referrers - full width */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferrerChart data={referrerData} />
        </CardContent>
      </Card>
    </div>
  )
}
