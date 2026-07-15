import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/StatCard'
import { ClickChart } from '@/components/dashboard/ClickChart'
import { Link2, MousePointerClick, Activity, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Fetch stats in parallel
  const [totalLinksResult, activeLinksResult, clicksDataResult, recentLinksResult] =
    await Promise.all([
      supabase
        .from('links')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('links')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('links')
        .select('total_clicks')
        .eq('user_id', user.id),
      supabase
        .from('links')
        .select('id, short_code, original_url, link_type, total_clicks, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const totalLinks = totalLinksResult.count || 0
  const activeLinks = activeLinksResult.count || 0
  const totalClicks = (clicksDataResult.data || []).reduce(
    (sum, link) => sum + (link.total_clicks || 0),
    0
  )
  const avgClicksPerLink =
    totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0

  // Fetch clicks over time (last 30 days). Computed in UTC (matching the
  // UTC date `clicked_at.slice(0, 10)` below) so the zero-fill loop can't
  // drift a day off from the aggregated click dates due to server timezone.
  const DAYS_IN_RANGE = 30
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const rangeStartUTC = todayUTC - (DAYS_IN_RANGE - 1) * MS_PER_DAY
  const thirtyDaysAgo = new Date(rangeStartUTC)

  const { data: userLinks, error: userLinksError } = await supabase
    .from('links')
    .select('id')
    .eq('user_id', user.id)

  if (userLinksError) {
    console.error('[dashboard] userLinks query:', userLinksError)
  }

  const linkIds = (userLinks || []).map((l) => l.id)

  let clickChartData: { date: string; clicks: number }[] = []

  if (linkIds.length > 0) {
    const { data: clicks, error: clicksError } = await supabase
      .from('clicks')
      .select('clicked_at')
      .in('link_id', linkIds)
      .gte('clicked_at', thirtyDaysAgo.toISOString())
      .order('clicked_at')

    if (clicksError) {
      console.error('[dashboard] clicks query:', clicksError)
    }

    const clicksByDate = new Map<string, number>()
    for (const click of clicks || []) {
      if (click.clicked_at) {
        const date = click.clicked_at.slice(0, 10)
        clicksByDate.set(date, (clicksByDate.get(date) || 0) + 1)
      }
    }

    // Zero-fill every day in the window so the chart always renders a
    // continuous 30-day line instead of only the (possibly sparse) days
    // that happened to have a click.
    clickChartData = Array.from({ length: DAYS_IN_RANGE }, (_, i) => {
      const date = new Date(rangeStartUTC + i * MS_PER_DAY).toISOString().slice(0, 10)
      return { date, clicks: clicksByDate.get(date) || 0 }
    })
  }

  const recentLinks = recentLinksResult.data || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Overview</h1>

      {/* Stat Cards */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Gradient glow effect behind stat cards */}
        <div
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[500px] h-[200px] opacity-20 blur-[100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,176,59,0.5) 0%, rgba(20,184,166,0.25) 50%, transparent 80%)',
          }}
        />
        <StatCard
          title="Total Links"
          value={totalLinks}
          icon={<Link2 className="h-6 w-6" />}
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={<MousePointerClick className="h-6 w-6" />}
        />
        <StatCard
          title="Avg Clicks/Link"
          value={avgClicksPerLink}
          icon={<Activity className="h-6 w-6" />}
        />
        <StatCard
          title="Active Links"
          value={activeLinks}
          icon={<BarChart3 className="h-6 w-6" />}
        />
      </div>

      {/* Clicks Over Time Chart */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle>Clicks Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ClickChart data={clickChartData} />
        </CardContent>
      </Card>

      {/* Recent Links */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Links</CardTitle>
          <Link
            href="/dashboard/links"
            className="text-sm text-primary-text hover:text-primary-text/80"
          >
            View all
          </Link>
        </CardHeader>

        {recentLinks.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Short Link</TableHead>
                <TableHead className="px-6">Original URL</TableHead>
                <TableHead className="px-6">Type</TableHead>
                <TableHead className="px-6">Clicks</TableHead>
                <TableHead className="px-6">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="px-6 py-4">
                    <Link
                      href={`/dashboard/links/${link.id}`}
                      className="text-primary-text hover:text-primary-text/80"
                    >
                      tws.bio/{link.short_code}
                    </Link>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground truncate max-w-xs">
                    {link.original_url}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        link.link_type === 'deep_link'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                      }`}
                    >
                      {link.link_type === 'deep_link' ? 'Deep Link' : 'URL'}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground">
                    {link.total_clicks || 0}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {link.created_at
                      ? new Date(link.created_at).toLocaleDateString()
                      : '---'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent>
            <div className="text-center py-12">
              <p className="text-muted-foreground">No links created yet.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
