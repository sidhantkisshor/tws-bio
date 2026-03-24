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

  // Fetch clicks over time (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: userLinks } = await supabase
    .from('links')
    .select('id')
    .eq('user_id', user.id)

  const linkIds = (userLinks || []).map((l) => l.id)

  let clickChartData: { date: string; clicks: number }[] = []

  if (linkIds.length > 0) {
    const { data: clicks } = await supabase
      .from('clicks')
      .select('clicked_at')
      .in('link_id', linkIds)
      .gte('clicked_at', thirtyDaysAgo.toISOString())
      .order('clicked_at')

    if (clicks && clicks.length > 0) {
      const clicksByDate = new Map<string, number>()
      for (const click of clicks) {
        if (click.clicked_at) {
          const date = click.clicked_at.slice(0, 10)
          clicksByDate.set(date, (clicksByDate.get(date) || 0) + 1)
        }
      }
      clickChartData = Array.from(clicksByDate.entries())
        .map(([date, count]) => ({ date, clicks: count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
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
            className="text-sm text-primary hover:text-primary/80"
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
                      className="text-primary hover:text-primary/80"
                    >
                      tws.bio/{link.short_code}
                    </Link>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground truncate max-w-xs">
                    {link.original_url}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        link.link_type === 'deep_link'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-muted text-muted-foreground'
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
