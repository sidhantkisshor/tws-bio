import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all'])

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ])

  const { data: links, count } = linksResult
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const totalLinks = count || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-gray-700 hover:text-gray-900">Home</Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-gray-600 hover:text-gray-800">Sign out</button>
              </form>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Time Range + Actions */}
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath="/dashboard" />
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/campaigns"
              className="text-gray-700 hover:text-gray-900 font-medium text-sm"
            >
              Campaigns
            </Link>
            <Link
              href="/dashboard/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              Create Link
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Total Clicks</p>
            <p className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Total Links</p>
            <p className="text-2xl font-bold text-gray-900">{totalLinks}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Top Referrer</p>
            <p className="text-2xl font-bold text-gray-900 truncate">{topStats.topReferrer}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Top Device</p>
            <p className="text-2xl font-bold text-gray-900">{topStats.topDevice}</p>
          </div>
        </div>

        {/* Clicks Over Time */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </div>

        {/* Breakdown Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Referrers</h3>
            <BarChart data={referrers} />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Devices</h3>
            <DonutChart data={devices} />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Countries</h3>
            <BarChart data={countries} color="#059669" />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Browsers</h3>
            <DonutChart data={browsers} />
          </div>
        </div>

        {/* Links Table */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Links</h2>
          </div>

          {links && links.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Short Link</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {links.map((link) => (
                      <tr key={link.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/dashboard/links/${link.id}`} className="text-blue-600 hover:text-blue-800">
                            tws.bio/{link.short_code}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">{link.original_url}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            link.link_type === 'deep_link' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {link.link_type === 'deep_link' ? 'Deep Link' : 'URL'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{link.total_clicks || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {link.created_at ? new Date(link.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Page {page} of {totalPages} ({count} links)</span>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={`/dashboard?range=${timeRange}&page=${page - 1}`} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Previous</Link>
                    )}
                    {page < totalPages && (
                      <Link href={`/dashboard?range=${timeRange}&page=${page + 1}`} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Next</Link>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No links created yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
