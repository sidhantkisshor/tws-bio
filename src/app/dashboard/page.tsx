import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  getClicksOverTimeResult,
  getTotalClicksResult,
  rangeWindow,
  zeroFillDays,
} from '@/lib/analytics'
import { StatCell, computeTrend } from '@/components/dashboard/StatCard'
import { displayUrl } from '@/components/dashboard/displayUrl'
import { LazyClickChart } from '@/components/charts/lazy'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
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
  const user = await getAuthenticatedUser()

  if (!user) {
    return null
  }

  // The current 30-day window and the immediately-preceding 30-day window
  // (used for prior-period trend deltas below). These are the same whole IST
  // days Analytics and the detail pages use for "30d", so the chart buckets
  // line up with the RPC's IST day labels whatever the server time zone.
  const { since: windowStart, priorSince: prevWindowStart, days } = rangeWindow('30d')

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
      // `id` rides along so linkIds for the clicks queries below come out of
      // this same wave instead of a separate round trip.
      supabase
        .from('links')
        .select('id, total_clicks')
        .eq('user_id', user.id)
        .order('id', { ascending: true }),
      supabase
        .from('links')
        .select('id, short_code, original_url, link_type, total_clicks, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // Links created in the current or prior 30-day window, used to
      // derive "new links" / "new active links" trend deltas below.
      supabase
        .from('links')
        .select('id, created_at, is_active', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', prevWindowStart.toISOString())
        .order('id', { ascending: true }),
    ])

  // Any of these failing silently degrades a stat to 0, so surface it instead
  // of letting a genuine query error render identically to "no data yet".
  let statsError = Boolean(
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
  let linkRows = clicksDataResult.data || []
  if (!clicksDataResult.error && totalLinks > linkRows.length && linkRows.length > 0) {
    const pageSize = linkRows.length
    const extraPages = await Promise.all(
      Array.from(
        { length: Math.ceil((totalLinks - pageSize) / pageSize) },
        (_, index) => {
          const from = pageSize * (index + 1)
          return supabase
            .from('links')
            .select('id, total_clicks')
            .eq('user_id', user.id)
            .order('id', { ascending: true })
            .range(from, Math.min(from + pageSize - 1, totalLinks - 1))
        },
      ),
    )
    const failedPage = extraPages.find((page) => page.error)
    if (failedPage?.error) {
      console.error('[dashboard] paginated links query:', failedPage.error)
      statsError = true
    } else {
      linkRows = linkRows.concat(extraPages.flatMap((page) => page.data || []))
    }
  }

  const totalClicks = linkRows.reduce(
    (sum, link) => sum + (link.total_clicks || 0),
    0
  )
  const avgClicksPerLink =
    totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0

  // Bucket links-created-in-window data into current vs. prior period counts.
  let trendLinks = trendLinksResult.data || []
  const totalTrendLinks = trendLinksResult.count || 0
  if (!trendLinksResult.error && totalTrendLinks > trendLinks.length && trendLinks.length > 0) {
    const pageSize = trendLinks.length
    const extraPages = await Promise.all(
      Array.from(
        { length: Math.ceil((totalTrendLinks - pageSize) / pageSize) },
        (_, index) => {
          const from = pageSize * (index + 1)
          return supabase
            .from('links')
            .select('id, created_at, is_active')
            .eq('user_id', user.id)
            .gte('created_at', prevWindowStart.toISOString())
            .order('id', { ascending: true })
            .range(from, Math.min(from + pageSize - 1, totalTrendLinks - 1))
        },
      ),
    )
    const failedPage = extraPages.find((page) => page.error)
    if (failedPage?.error) {
      console.error('[dashboard] paginated trend-links query:', failedPage.error)
      statsError = true
    } else {
      trendLinks = trendLinks.concat(extraPages.flatMap((page) => page.data || []))
    }
  }
  let linksCurrentCount = 0
  let linksPrevCount = 0
  let activeLinksCurrentCount = 0
  let activeLinksPrevCount = 0
  for (const l of trendLinks) {
    if (!l.created_at) continue
    const createdMs = new Date(l.created_at).getTime()
    if (createdMs >= windowStart.getTime()) {
      linksCurrentCount++
      if (l.is_active) activeLinksCurrentCount++
    } else {
      linksPrevCount++
      if (l.is_active) activeLinksPrevCount++
    }
  }

  const linkIds = linkRows.map((l) => l.id)

  let clickChartData: { date: string; clicks: number }[] = []
  let clicksCurrentWindow = 0
  let clicksPrevWindow = 0
  let clickTrendAvailable = false
  // Distinguishes "the click query failed" from "this link genuinely has no
  // clicks yet": ClickChart renders a different message for each so a
  // swallowed error doesn't masquerade as a brand-new-user empty state.
  let chartError = Boolean(clicksDataResult.error)

  if (linkIds.length > 0) {
    const [clicksSeriesResult, combinedClicksResult] = await Promise.all([
      // Day buckets aggregated DB-side via the SECURITY INVOKER RPC (clicks
      // RLS applies, since it runs as the logged-in user) instead of one raw
      // row per click, which silently undercounted past PostgREST's 1000-row
      // response cap. `since` pins the RPC to the same IST-midnight window
      // boundary used by the prior-period count below.
      getClicksOverTimeResult({
        timeRange: '30d',
        linkIds,
        since: windowStart.toISOString(),
      }),
      // Combined current + prior span. Subtract the current series below to
      // derive the prior window without putting every UUID in a GET query.
      getTotalClicksResult({
        timeRange: 'all',
        linkIds,
        since: prevWindowStart.toISOString(),
      }),
    ])

    if (clicksSeriesResult.error) {
      chartError = true
      statsError = true
    }
    if (combinedClicksResult.error) {
      console.error('[dashboard] prior clicks query failed')
      statsError = true
    }

    // Zero-fill every day in the window so the chart always renders a
    // continuous 30-day line instead of only the (possibly sparse) days
    // that happened to have a click.
    clickChartData = zeroFillDays(clicksSeriesResult.data, windowStart, days)

    if (!clicksSeriesResult.error) {
      clicksCurrentWindow = clicksSeriesResult.data.reduce((sum, row) => sum + row.clicks, 0)
    }
    if (!combinedClicksResult.error) {
      clicksPrevWindow = Math.max(combinedClicksResult.data - clicksCurrentWindow, 0)
    }
    clickTrendAvailable = !clicksSeriesResult.error && !combinedClicksResult.error
  }

  const recentLinks = recentLinksResult.data || []
  const recentLinksError = Boolean(recentLinksResult.error)

  // Prior-period trend deltas for the stat cards, "vs prior 30 days":
  // Total Links / Active Links compare new links added in each window;
  // Total Clicks compares raw click volume; Avg Clicks/Link compares the
  // click-volume-to-link-count ratio at the end of each window.
  const totalLinksAtCurrentStart = Math.max(totalLinks - linksCurrentCount, 0)
  const avgClicksCurrentWindow =
    totalLinks > 0 ? clicksCurrentWindow / totalLinks : 0
  const avgClicksPrevWindow =
    totalLinksAtCurrentStart > 0 ? clicksPrevWindow / totalLinksAtCurrentStart : 0

  const totalLinksTrend = computeTrend(linksCurrentCount, linksPrevCount)
  const totalClicksTrend = clickTrendAvailable
    ? computeTrend(clicksCurrentWindow, clicksPrevWindow)
    : null
  const avgClicksTrend = clickTrendAvailable
    ? computeTrend(avgClicksCurrentWindow, avgClicksPrevWindow, { isRatio: true })
    : null
  const activeLinksTrend = computeTrend(activeLinksCurrentCount, activeLinksPrevCount)

  return (
    <div>
      {/* No Create Link here: the sidebar button (and the + in the phone top
          bar) is always on screen, so a second one only competed with it. */}
      <PageHeader title="Overview" />

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

      {/* Stats: one joined strip (two rows on a phone) instead of four cards.
          The 1px gaps over a tinted background draw the dividers. */}
      <section aria-label="Summary" className="mb-8">
        <p className="mb-3 text-xs text-muted-foreground">
          Changes compare the last 30 days with the 30 days before.
        </p>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-foreground/10 lg:grid-cols-4">
          <StatCell title="Total Links" value={totalLinks.toLocaleString('en-US')} trend={totalLinksTrend} />
          <StatCell title="Total Clicks" value={totalClicks.toLocaleString('en-US')} trend={totalClicksTrend} />
          <StatCell title="Avg Clicks/Link" value={avgClicksPerLink.toLocaleString('en-US')} trend={avgClicksTrend} />
          <StatCell title="Active Links" value={activeLinks.toLocaleString('en-US')} trend={activeLinksTrend} />
        </div>
      </section>

      {/* Clicks Over Time Chart */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle>Clicks Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <LazyClickChart data={clickChartData} error={chartError} />
        </CardContent>
      </Card>

      {/* Recent Links */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Links</CardTitle>
          <Link
            href="/dashboard/links"
            className="focus-ring rounded-sm text-sm text-primary-text hover:text-primary-text/80"
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
                <TableHead className="px-4 lg:px-6">Short Link</TableHead>
                <TableHead className="hidden px-4 md:table-cell lg:px-6">Original URL</TableHead>
                <TableHead className="px-4 text-right lg:px-6">Clicks</TableHead>
                <TableHead className="hidden px-4 lg:table-cell lg:px-6">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLinks.map((link) => (
                <TableRow key={link.id}>
                  {/* On a phone the cell is also the URL column: code on top,
                      destination under it, clicks at the right. */}
                  <TableCell className="w-full max-w-0 px-4 py-3 md:w-auto md:max-w-none lg:px-6">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/links/${link.id}`}
                        className="focus-ring truncate rounded-sm font-mono text-sm text-foreground transition-colors hover:text-primary-text"
                      >
                        tws.bio/{link.short_code}
                      </Link>
                      {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
                    </div>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">
                      {displayUrl(link.original_url)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden w-full max-w-0 px-4 py-3 md:table-cell lg:px-6">
                    <span className="block truncate text-muted-foreground" title={link.original_url}>
                      {displayUrl(link.original_url)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono tabular-nums text-foreground lg:px-6">
                    {(link.total_clicks || 0).toLocaleString('en-US')}
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-muted-foreground lg:table-cell lg:px-6">
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
              <Link href="/dashboard/create" className={buttonVariants()}>
                Create Link
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
