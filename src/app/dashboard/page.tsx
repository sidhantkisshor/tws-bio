import { createClient } from '@/lib/supabase/server'
import { StatCard, computeTrend } from '@/components/dashboard/StatCard'
import { ClickChart } from '@/components/dashboard/ClickChart'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { Link2, MousePointerClick, Activity, BarChart3, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Date math for the current 30-day window and the immediately-preceding
  // 30-day window (used for prior-period trend deltas below). Computed in
  // UTC (matching the UTC date `clicked_at.slice(0, 10)` below) so the
  // zero-fill loop can't drift a day off from the aggregated click dates
  // due to server timezone.
  const DAYS_IN_RANGE = 30
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const rangeStartUTC = todayUTC - (DAYS_IN_RANGE - 1) * MS_PER_DAY
  const thirtyDaysAgo = new Date(rangeStartUTC)
  const prevWindowStart = new Date(rangeStartUTC - DAYS_IN_RANGE * MS_PER_DAY)

  // Fetch stats in parallel
  const [totalLinksResult, activeLinksResult, clicksDataResult, recentLinksResult, trendLinksResult] =
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
      // Links created in the current or prior 30-day window — used to
      // derive "new links" / "new active links" trend deltas below.
      supabase
        .from('links')
        .select('id, created_at, is_active')
        .eq('user_id', user.id)
        .gte('created_at', prevWindowStart.toISOString()),
    ])

  // Any of these failing silently degrades a stat to 0 — surface it instead
  // of letting a genuine query error render identically to "no data yet".
  const statsError = Boolean(
    totalLinksResult.error ||
      activeLinksResult.error ||
      clicksDataResult.error ||
      recentLinksResult.error ||
      trendLinksResult.error
  )
  if (statsError) {
    console.error('[dashboard] stats query error:', {
      totalLinksError: totalLinksResult.error,
      activeLinksError: activeLinksResult.error,
      clicksDataError: clicksDataResult.error,
      recentLinksError: recentLinksResult.error,
      trendLinksError: trendLinksResult.error,
    })
  }

  const totalLinks = totalLinksResult.count || 0
  const activeLinks = activeLinksResult.count || 0
  const totalClicks = (clicksDataResult.data || []).reduce(
    (sum, link) => sum + (link.total_clicks || 0),
    0
  )
  const avgClicksPerLink =
    totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0

  // Bucket links-created-in-window data into current vs. prior period counts.
  const trendLinks = trendLinksResult.data || []
  let linksCurrentCount = 0
  let linksPrevCount = 0
  let activeLinksCurrentCount = 0
  let activeLinksPrevCount = 0
  for (const l of trendLinks) {
    if (!l.created_at) continue
    const createdMs = new Date(l.created_at).getTime()
    if (createdMs >= rangeStartUTC) {
      linksCurrentCount++
      if (l.is_active) activeLinksCurrentCount++
    } else {
      linksPrevCount++
      if (l.is_active) activeLinksPrevCount++
    }
  }

  const { data: userLinks, error: userLinksError } = await supabase
    .from('links')
    .select('id')
    .eq('user_id', user.id)

  if (userLinksError) {
    console.error('[dashboard] userLinks query:', userLinksError)
  }

  const linkIds = (userLinks || []).map((l) => l.id)

  let clickChartData: { date: string; clicks: number }[] = []
  let clicksCurrentWindow = 0
  let clicksPrevWindow = 0
  // Distinguishes "the click query failed" from "this link genuinely has no
  // clicks yet" — ClickChart renders a different message for each so a
  // swallowed error doesn't masquerade as a brand-new-user empty state.
  let chartError = Boolean(userLinksError)

  if (linkIds.length > 0) {
    const [{ data: clicks, error: clicksError }, prevClicksResult] = await Promise.all([
      supabase
        .from('clicks')
        .select('clicked_at')
        .in('link_id', linkIds)
        .gte('clicked_at', thirtyDaysAgo.toISOString())
        .order('clicked_at'),
      supabase
        .from('clicks')
        .select('id', { count: 'exact', head: true })
        .in('link_id', linkIds)
        .gte('clicked_at', prevWindowStart.toISOString())
        .lt('clicked_at', thirtyDaysAgo.toISOString()),
    ])

    if (clicksError) {
      console.error('[dashboard] clicks query:', clicksError)
      chartError = true
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

    clicksCurrentWindow = (clicks || []).length
    clicksPrevWindow = prevClicksResult.count || 0
  }

  const recentLinks = recentLinksResult.data || []
  const recentLinksError = Boolean(recentLinksResult.error)

  // Prior-period trend deltas for the stat cards. "vs prior 30 days" —
  // Total Links / Active Links compare new links added in each window;
  // Total Clicks compares raw click volume; Avg Clicks/Link compares the
  // click-volume-to-link-count ratio at the end of each window.
  const totalLinksAtCurrentStart = Math.max(totalLinks - linksCurrentCount, 0)
  const avgClicksCurrentWindow =
    totalLinks > 0 ? clicksCurrentWindow / totalLinks : 0
  const avgClicksPrevWindow =
    totalLinksAtCurrentStart > 0 ? clicksPrevWindow / totalLinksAtCurrentStart : 0

  const totalLinksTrend = computeTrend(linksCurrentCount, linksPrevCount)
  const totalClicksTrend = computeTrend(clicksCurrentWindow, clicksPrevWindow)
  const avgClicksTrend = computeTrend(avgClicksCurrentWindow, avgClicksPrevWindow, {
    isRatio: true,
  })
  const activeLinksTrend = computeTrend(activeLinksCurrentCount, activeLinksPrevCount)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-heading text-2xl text-foreground">Overview</h1>
        <Link href="/dashboard/create">
          <Button>Create Link</Button>
        </Link>
      </div>

      {statsError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-6 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-foreground">
            Some stats couldn&apos;t load.
          </span>
          <Link
            href="/dashboard"
            className="text-primary-text hover:text-primary-text/80 underline underline-offset-4"
          >
            Try again
          </Link>
        </div>
      )}

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
          trend={totalLinksTrend}
          trendLabel="vs prior 30 days"
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={<MousePointerClick className="h-6 w-6" />}
          trend={totalClicksTrend}
          trendLabel="vs prior 30 days"
        />
        <StatCard
          title="Avg Clicks/Link"
          value={avgClicksPerLink}
          icon={<Activity className="h-6 w-6" />}
          trend={avgClicksTrend}
          trendLabel="vs prior 30 days"
        />
        <StatCard
          title="Active Links"
          value={activeLinks}
          icon={<BarChart3 className="h-6 w-6" />}
          trend={activeLinksTrend}
          trendLabel="vs prior 30 days"
        />
      </div>

      {/* Clicks Over Time Chart */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle>Clicks Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ClickChart data={clickChartData} error={chartError} />
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

        {recentLinksError ? (
          <CardContent>
            <div className="flex flex-col items-center text-center py-12 gap-3">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <div>
                <p className="text-foreground font-medium">Couldn&apos;t load your links</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Something went wrong.{' '}
                  <Link
                    href="/dashboard"
                    className="text-primary-text hover:text-primary-text/80 underline underline-offset-4"
                  >
                    Try again
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        ) : recentLinks.length > 0 ? (
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
                    <TypeBadge type={link.link_type} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground">
                    {link.total_clicks || 0}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">
                    {link.created_at
                      ? formatDate(link.created_at)
                      : '---'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent>
            <div className="flex flex-col items-center text-center py-12 gap-4">
              <p className="text-muted-foreground">No links created yet.</p>
              <Link href="/dashboard/create">
                <Button>Create Link</Button>
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
