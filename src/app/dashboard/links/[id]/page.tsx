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

export default async function LinkDetailPage({
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
              <h1 className="text-lg font-bold text-foreground">tws.bio/{link.short_code}</h1>
              <p className="text-sm text-muted-foreground truncate max-w-md">{link.original_url}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />
          <div className="text-sm text-muted-foreground">
            {totalClicks.toLocaleString()} clicks in period
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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
      </main>
    </div>
  )
}
