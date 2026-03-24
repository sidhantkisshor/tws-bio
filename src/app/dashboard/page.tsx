import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  getClicksOverTime,
  getTopReferrers,
  getDeviceBreakdown,
  getCountryBreakdown,
  getBrowserBreakdown,
  getTotalClicks,
  getTopStats,
  type TimeRange,
} from '@/lib/analytics'
import { ClicksOverTimeChart } from '@/components/charts/ClicksOverTimeChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all'])

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { range: rangeParam, page: pageParam } = await searchParams
  const timeRange: TimeRange = VALID_RANGES.has(rangeParam || '') ? (rangeParam as TimeRange) : '30d'
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const PAGE_SIZE = 20
  const offset = (page - 1) * PAGE_SIZE

  const filter = { timeRange }
  const [
    clicksOverTime,
    referrers,
    devices,
    countries,
    browsers,
    totalClicks,
    topStats,
    linksResult,
  ] = await Promise.all([
    getClicksOverTime(filter),
    getTopReferrers(filter),
    getDeviceBreakdown(filter),
    getCountryBreakdown(filter),
    getBrowserBreakdown(filter),
    getTotalClicks(filter),
    getTopStats(filter),
    supabase
      .from('links')
      .select('id, short_code, original_url, link_type, total_clicks, created_at', { count: 'exact' })
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ])

  const { data: links, count } = linksResult
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const totalLinks = count || 0

  return (
    <div>
      {/* Time Range + Actions */}
      <div className="flex items-center justify-between mb-8">
        <TimeRangePicker current={timeRange} basePath="/dashboard" />
        <div className="flex items-center gap-3">
          <Link href="/dashboard/links">
            <Button variant="outline">Links</Button>
          </Link>
          <Link href="/dashboard/create">
            <Button>Create Link</Button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Clicks</p>
            <p className="text-3xl font-bold font-mono text-foreground">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Links</p>
            <p className="text-3xl font-bold font-mono text-foreground">{totalLinks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Top Referrer</p>
            <p className="text-3xl font-bold font-mono text-foreground truncate">{topStats.topReferrer}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Top Device</p>
            <p className="text-3xl font-bold font-mono text-foreground">{topStats.topDevice}</p>
          </CardContent>
        </Card>
      </div>

      {/* Clicks Over Time */}
      <Card className="bg-card border-border mb-8">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Referrers</h3>
            <BarChart data={referrers} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Devices</h3>
            <DonutChart data={devices} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Countries</h3>
            <BarChart data={countries} color="#059669" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Browsers</h3>
            <DonutChart data={browsers} />
          </CardContent>
        </Card>
      </div>

      {/* Links Table */}
      <Card className="bg-card border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Your Links</h2>
        </div>

        {links && links.length > 0 ? (
          <>
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
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="px-6 py-4">
                      <Link href={`/dashboard/links/${link.id}`} className="text-primary hover:text-primary/80">
                        tws.bio/{link.short_code}
                      </Link>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-foreground truncate max-w-xs">{link.original_url}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        link.link_type === 'deep_link'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {link.link_type === 'deep_link' ? 'Deep Link' : 'URL'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-foreground">{link.total_clicks || 0}</TableCell>
                    <TableCell className="px-6 py-4 text-muted-foreground">
                      {link.created_at ? new Date(link.created_at).toLocaleDateString() : '---'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages} ({count} links)</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={`/dashboard?range=${timeRange}&page=${page - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link href={`/dashboard?range=${timeRange}&page=${page + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No links created yet.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
