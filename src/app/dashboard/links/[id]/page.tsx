import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getClicksOverTime,
  getTopReferrers,
  getDeviceBreakdown,
  getCountryBreakdown,
  getBrowserBreakdown,
  getTotalClicks,
  type TimeRange,
} from '@/lib/analytics'
import { ClicksOverTimeChart } from '@/components/charts/ClicksOverTimeChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
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
  const [clicksOverTime, referrers, devices, countries, browsers, totalClicks] = await Promise.all([
    getClicksOverTime(filter),
    getTopReferrers(filter),
    getDeviceBreakdown(filter),
    getCountryBreakdown(filter),
    getBrowserBreakdown(filter),
    getTotalClicks(filter),
  ])

  // Prior-period click count (same-length window immediately preceding the
  // selected range) for the "clicks in period" trend delta. Not meaningful
  // for "all time" since there's no bounded prior window to compare against.
  let periodTrend: StatTrend | null = null
  if (timeRange !== 'all') {
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
      console.error('[link-detail] prior clicks query:', priorClicksError)
    }
    periodTrend = computeTrend(totalClicks, priorClicks || 0)
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
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{totalClicks.toLocaleString()} clicks in period</span>
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
              <BarChart data={referrers} />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={devices} />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={countries} color="var(--chart-3)" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Browsers</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={browsers} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
