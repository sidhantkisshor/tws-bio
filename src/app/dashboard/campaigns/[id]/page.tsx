import { createClient } from '@/lib/supabase/server'
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
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all'])
const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { range: rangeParam } = await searchParams
  const timeRange: TimeRange = VALID_RANGES.has(rangeParam || '') ? (rangeParam as TimeRange) : '30d'

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, description')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !campaign) notFound()

  const { data: campaignLinks } = await supabase
    .from('links')
    .select('id, short_code, original_url, total_clicks')
    .eq('campaign_id', id)
    .order('total_clicks', { ascending: false })

  const linkIds = (campaignLinks || []).map((l) => l.id)

  const empty = { clicksOverTime: [], referrers: [], devices: [], countries: [], browsers: [], totalClicks: 0 }
  const { clicksOverTime, referrers, devices, countries, browsers, totalClicks } = linkIds.length > 0
    ? await (async () => {
        const filter = { timeRange, linkIds }
        const [clicksOverTime, referrers, devices, countries, browsers, totalClicks] = await Promise.all([
          getClicksOverTime(filter),
          getTopReferrers(filter),
          getDeviceBreakdown(filter),
          getCountryBreakdown(filter),
          getBrowserBreakdown(filter),
          getTotalClicks(filter),
        ])
        return { clicksOverTime, referrers, devices, countries, browsers, totalClicks }
      })()
    : empty

  // Prior-period click count (same-length window immediately preceding the
  // selected range) for the campaign's clicks trend delta. Not meaningful
  // for "all time" or an empty campaign.
  let periodTrend: StatTrend | null = null
  if (timeRange !== 'all' && linkIds.length > 0) {
    const days = RANGE_DAYS[timeRange]
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - days)
    const priorStart = new Date(periodStart)
    priorStart.setDate(priorStart.getDate() - days)

    const { count: priorClicks, error: priorClicksError } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true })
      .in('link_id', linkIds)
      .gte('clicked_at', priorStart.toISOString())
      .lt('clicked_at', periodStart.toISOString())

    if (priorClicksError) {
      console.error('[campaign-detail] prior clicks query:', priorClicksError)
    }
    periodTrend = computeTrend(totalClicks, priorClicks || 0)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard/campaigns" className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-heading text-2xl text-foreground">{campaign.name}</h1>
              {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
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
            <ClicksOverTimeChart data={clicksOverTime} />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
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

        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle>Links in Campaign</CardTitle>
          </CardHeader>
          {campaignLinks && campaignLinks.length > 0 ? (
            <div className="divide-y divide-border">
              {campaignLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/dashboard/links/${link.id}`}
                  className="block px-6 py-3 hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-primary-text">tws.bio/{link.short_code}</span>
                      <p className="text-xs text-muted-foreground truncate max-w-md">{link.original_url}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{(link.total_clicks || 0).toLocaleString()} clicks</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <CardContent>
              <div className="flex flex-col items-center text-center gap-4 py-12">
                <p className="text-muted-foreground">No links in this campaign yet.</p>
                <Link href="/dashboard/create">
                  <Button>Create Link</Button>
                </Link>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}
