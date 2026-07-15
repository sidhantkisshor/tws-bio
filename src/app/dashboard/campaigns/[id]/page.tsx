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

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all'])

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
              <h1 className="text-lg font-bold text-foreground">{campaign.name}</h1>
              {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath={`/dashboard/campaigns/${id}`} />
          <div className="text-sm text-muted-foreground">
            {totalClicks.toLocaleString()} clicks &middot; {linkIds.length} links
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Referrers</h3>
            <BarChart data={referrers} />
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Devices</h3>
            <DonutChart data={devices} />
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Countries</h3>
            <BarChart data={countries} color="#059669" />
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Browsers</h3>
            <DonutChart data={browsers} />
          </div>
        </div>

        {campaignLinks && campaignLinks.length > 0 && (
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Links in Campaign</h2>
            </div>
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
          </div>
        )}
      </main>
    </div>
  )
}
