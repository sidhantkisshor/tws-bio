# Brand Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform tws.bio from a generic URL shortener into a personal brand command center for @tradingwithsidhant — rich analytics, campaigns, resource hub, and link-in-bio homepage.

**Architecture:** Four features layered on the existing Next.js 16 + Supabase stack, shipped in priority order. Analytics and campaigns add server-side query functions + recharts chart islands. Resources and bio use static config files — no new DB tables for those. One migration adds a `campaigns` table and `campaign_id` FK on `links`.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase (Postgres + Auth), recharts (already installed), Tailwind CSS v4, TypeScript 5.

**Note:** No test framework is configured in this project. Each task includes manual verification steps instead of automated tests.

---

## Task 1: Add UTM Parsing to Redirect Handler

**Files:**
- Modify: `src/app/[shortCode]/route.ts:57-114`

The redirect handler already calls `record_click` which accepts UTM params, but never parses them from the request URL. This task wires that up so analytics data starts accumulating immediately.

**Step 1: Add UTM extraction to the GET handler**

In `src/app/[shortCode]/route.ts`, after line 65 (`const referer = ...`), add UTM parsing from the request URL's search params:

```ts
// Parse UTM parameters from the incoming request URL
const utmSource = request.nextUrl.searchParams.get('utm_source') || undefined
const utmMedium = request.nextUrl.searchParams.get('utm_medium') || undefined
const utmCampaign = request.nextUrl.searchParams.get('utm_campaign') || undefined
const utmTerm = request.nextUrl.searchParams.get('utm_term') || undefined
const utmContent = request.nextUrl.searchParams.get('utm_content') || undefined
```

**Step 2: Pass UTM params to record_click RPC**

Update the `record_click` call inside `after()` (around line 101) to include UTM params. The `record_click` RPC already accepts these columns — they just aren't being passed:

```ts
supabase.rpc('record_click', {
  p_link_id: link.id,
  p_ip_address: ip ?? undefined,
  p_user_agent: userAgent || undefined,
  p_referrer_url: referer ?? undefined,
  p_browser_name: getBrowser(userAgent),
  p_os_name: getOS(userAgent),
  p_device_type: getDevice(userAgent),
  p_utm_source: utmSource,
  p_utm_medium: utmMedium,
  p_utm_campaign: utmCampaign,
  p_utm_term: utmTerm,
  p_utm_content: utmContent,
})
```

**Important:** Check that the `record_click` RPC function in Supabase accepts these `p_utm_*` parameters. If not, a migration is needed to update the function signature. Check `supabase/migrations/007_security_hardening.sql` for the current function definition.

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds with no type errors.

Manual test: Visit `http://localhost:3000/SHORTCODE?utm_source=test&utm_medium=manual` and verify a row appears in the `clicks` table with `utm_source = 'test'`.

**Step 4: Commit**

```bash
git add src/app/\[shortCode\]/route.ts
git commit -m "feat: parse UTM params from redirect URL and pass to record_click"
```

---

## Task 2: Create Analytics Query Library

**Files:**
- Create: `src/lib/analytics.ts`

Server-side functions that query the `clicks` table for dashboard charts. All functions accept a date range and optional `linkId` filter (for per-link views) and optional `campaignId` filter (for campaign views — used later in Task 7).

**Step 1: Create `src/lib/analytics.ts`**

```ts
import { createClient } from '@/lib/supabase/server'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface AnalyticsFilter {
  timeRange: TimeRange
  linkId?: string
  linkIds?: string[] // for campaign filtering
}

function getDateFrom(timeRange: TimeRange): string | null {
  if (timeRange === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90 }[timeRange]
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export async function getClicksOverTime(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('clicked_at')

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { data, error } = await query.order('clicked_at', { ascending: true })
  if (error || !data) return []

  // Group by date
  const grouped: Record<string, number> = {}
  for (const click of data) {
    if (!click.clicked_at) continue
    const date = click.clicked_at.split('T')[0]
    grouped[date] = (grouped[date] || 0) + 1
  }

  return Object.entries(grouped).map(([date, clicks]) => ({ date, clicks }))
}

export async function getTopReferrers(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('referrer_domain')

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { data, error } = await query
  if (error || !data) return []

  const counts: Record<string, number> = {}
  for (const click of data) {
    const domain = click.referrer_domain || 'Direct'
    counts[domain] = (counts[domain] || 0) + 1
  }

  return Object.entries(counts)
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
}

export async function getDeviceBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('device_type')

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { data, error } = await query
  if (error || !data) return []

  const counts: Record<string, number> = {}
  for (const click of data) {
    const device = click.device_type || 'unknown'
    counts[device] = (counts[device] || 0) + 1
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export async function getCountryBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('country')

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { data, error } = await query
  if (error || !data) return []

  const counts: Record<string, number> = {}
  for (const click of data) {
    const country = click.country || 'Unknown'
    counts[country] = (counts[country] || 0) + 1
  }

  return Object.entries(counts)
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
}

export async function getBrowserBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('browser_name')

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { data, error } = await query
  if (error || !data) return []

  const counts: Record<string, number> = {}
  for (const click of data) {
    const browser = click.browser_name || 'Unknown'
    counts[browser] = (counts[browser] || 0) + 1
  }

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export async function getTotalClicks(filter: AnalyticsFilter): Promise<number> {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase
    .from('clicks')
    .select('id', { count: 'exact', head: true })

  if (filter.linkId) query = query.eq('link_id', filter.linkId)
  if (filter.linkIds) query = query.in('link_id', filter.linkIds)
  if (dateFrom) query = query.gte('clicked_at', dateFrom)

  const { count, error } = await query
  if (error) return 0
  return count || 0
}

export async function getTopStats(filter: AnalyticsFilter) {
  const [referrers, devices] = await Promise.all([
    getTopReferrers(filter),
    getDeviceBreakdown(filter),
  ])

  return {
    topReferrer: referrers[0]?.name || 'None',
    topDevice: devices[0]?.name || 'Unknown',
  }
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 3: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat: add server-side analytics query library"
```

---

## Task 3: Create Reusable Chart Components

**Files:**
- Create: `src/components/charts/ClicksOverTimeChart.tsx`
- Create: `src/components/charts/BarChart.tsx`
- Create: `src/components/charts/DonutChart.tsx`

Three `'use client'` components wrapping recharts. Kept generic so they're reusable across dashboard, per-link, and campaign views.

**Step 1: Create `src/components/charts/ClicksOverTimeChart.tsx`**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ClicksOverTimeChartProps {
  data: { date: string; clicks: number }[]
}

export function ClicksOverTimeChart({ data }: ClicksOverTimeChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No click data yet</div>
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickFormatter={(d: string) => {
            const date = new Date(d + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(d: string) => {
            const date = new Date(d + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })
          }}
        />
        <Area type="monotone" dataKey="clicks" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

**Step 2: Create `src/components/charts/BarChart.tsx`**

```tsx
'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  data: { name: string; clicks: number }[]
  color?: string
}

export function BarChart({ data, color = '#2563eb' }: BarChartProps) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          width={75}
        />
        <Tooltip />
        <Bar dataKey="clicks" fill={color} radius={[0, 4, 4, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
```

**Step 3: Create `src/components/charts/DonutChart.tsx`**

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6b7280']

interface DonutChartProps {
  data: { name: string; value: number }[]
}

export function DonutChart({ data }: DonutChartProps) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/charts/
git commit -m "feat: add reusable recharts chart components (area, bar, donut)"
```

---

## Task 4: Build Rich Analytics Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite)
- Create: `src/components/TimeRangePicker.tsx`

Replace the current basic dashboard with the full analytics view.

**Step 1: Create `src/components/TimeRangePicker.tsx`**

```tsx
import Link from 'next/link'
import type { TimeRange } from '@/lib/analytics'

interface TimeRangePickerProps {
  current: TimeRange
  basePath: string
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

export function TimeRangePicker({ current, basePath }: TimeRangePickerProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {ranges.map(({ value, label }) => (
        <Link
          key={value}
          href={`${basePath}?range=${value}`}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
            current === value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
```

**Step 2: Rewrite `src/app/dashboard/page.tsx`**

```tsx
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

  // Fetch analytics and links in parallel
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
        {/* Time Range + Create Link */}
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath="/dashboard" />
          <Link
            href="/dashboard/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            Create Link
          </Link>
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

        {/* Breakdown Charts - 2x2 grid */}
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
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Visit `/dashboard` — stat cards, charts, and links table render.

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/TimeRangePicker.tsx
git commit -m "feat: replace basic dashboard with rich analytics (charts, time range, stat cards)"
```

---

## Task 5: Build Per-Link Analytics View

**Files:**
- Create: `src/app/dashboard/links/[id]/page.tsx`

Same analytics charts filtered to a single link, plus link metadata at top.

**Step 1: Create `src/app/dashboard/links/[id]/page.tsx`**

```tsx
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

  // Fetch link (verify ownership)
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">tws.bio/{link.short_code}</h1>
              <p className="text-sm text-gray-500 truncate max-w-md">{link.original_url}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath={`/dashboard/links/${id}`} />
          <div className="text-sm text-gray-500">
            {totalClicks.toLocaleString()} clicks in period
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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
      </main>
    </div>
  )
}
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds. Click a link row in dashboard → per-link analytics page renders.

**Step 3: Commit**

```bash
git add src/app/dashboard/links/
git commit -m "feat: add per-link analytics detail view"
```

---

## Task 6: Move Link Creation to Dashboard

**Files:**
- Create: `src/app/dashboard/create/page.tsx`
- Modify: `src/components/CreateLinkForm.tsx` (remove anonymous link logic)

The homepage will become the bio page (Task 10). Link creation moves to `/dashboard/create`, accessible only when logged in.

**Step 1: Create `src/app/dashboard/create/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import Link from 'next/link'

export default async function CreateLinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-gray-900">Create Link</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CreateLinkForm />
      </main>
    </div>
  )
}
```

**Step 2: Simplify `src/components/CreateLinkForm.tsx`**

Remove from `CreateLinkForm.tsx`:
- The `user` and `onLinkCreated` props — the form always operates for the logged-in user
- All `localStorage` anon_links logic (lines 118-124 and 145-151)
- The "Sign in to save" banner (lines 172-178)
- The `user?.id` optional chaining — user is always present since the page requires auth

Change the component signature to:

```tsx
export function CreateLinkForm() {
```

Remove the props interface entirely. After successful link creation, use `router.push('/dashboard')` from `next/navigation` to redirect back to the dashboard instead of calling `onLinkCreated`.

In both RPC calls, remove the `p_user_id` parameter — rely on the RPC using `auth.uid()` server-side (or pass it via a server action in a future iteration). **Actually** — the RPCs are `SECURITY DEFINER` and accept `p_user_id` explicitly, so keep passing it. Fetch the user client-side with `supabase.auth.getUser()` at form submit time:

```tsx
const { data: { user } } = await supabase.auth.getUser()
if (!user) return // shouldn't happen, page is auth-guarded

// In RPC calls, use user.id instead of user?.id
p_user_id: user.id,
```

Remove `onLinkCreated` callback. After successful creation, redirect:

```tsx
import { useRouter } from 'next/navigation'
// In component:
const router = useRouter()
// After success:
router.push('/dashboard')
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Navigate to `/dashboard/create`, create a link, get redirected to `/dashboard`.

**Step 4: Commit**

```bash
git add src/app/dashboard/create/ src/components/CreateLinkForm.tsx
git commit -m "feat: move link creation to /dashboard/create, remove anonymous link logic"
```

---

## Task 7: Database Migration for Campaigns

**Files:**
- Create: `supabase/migrations/008_campaigns.sql`
- Modify: `src/types/database.ts` (add campaign types)

**Step 1: Create `supabase/migrations/008_campaigns.sql`**

```sql
-- Create campaigns table
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add campaign_id to links
ALTER TABLE links ADD COLUMN campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

-- RLS for campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_links_campaign_id ON links(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
```

**Step 2: Update `src/types/database.ts`**

Add the `campaigns` table type to the `Tables` section of the `Database` type. Add `campaign_id: string | null` to the `links` Row/Insert/Update types. Add a relationship entry for `links.campaign_id → campaigns.id`.

This is a large generated file — regenerate it from Supabase after applying the migration if possible (`npx supabase gen types typescript`). Otherwise, manually add the types.

**Step 3: Apply migration**

Run the migration SQL in the Supabase SQL Editor manually (as per project convention).

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds with updated types.

**Step 5: Commit**

```bash
git add supabase/migrations/008_campaigns.sql src/types/database.ts
git commit -m "feat: add campaigns table and campaign_id FK on links"
```

---

## Task 8: Build Campaign List and Detail Views

**Files:**
- Create: `src/app/dashboard/campaigns/page.tsx`
- Create: `src/app/dashboard/campaigns/[id]/page.tsx`

**Step 1: Create `src/app/dashboard/campaigns/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Get link counts and click totals per campaign
  const campaignStats = await Promise.all(
    (campaigns || []).map(async (campaign) => {
      const { data: links } = await supabase
        .from('links')
        .select('id, total_clicks')
        .eq('campaign_id', campaign.id)

      const totalLinks = links?.length || 0
      const totalClicks = links?.reduce((sum, l) => sum + (l.total_clicks || 0), 0) || 0
      return { ...campaign, totalLinks, totalClicks }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-bold text-gray-900">Campaigns</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {campaignStats.length > 0 ? (
          <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
            {campaignStats.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{campaign.description}</p>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm text-gray-500">
                    <span>{campaign.totalLinks} links</span>
                    <span>{campaign.totalClicks.toLocaleString()} clicks</span>
                    <span>{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No campaigns yet. Create one when making a new link.</p>
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 2: Create `src/app/dashboard/campaigns/[id]/page.tsx`**

```tsx
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

  // Fetch campaign (verify ownership)
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, description')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !campaign) notFound()

  // Get all link IDs for this campaign
  const { data: campaignLinks } = await supabase
    .from('links')
    .select('id, short_code, original_url, total_clicks')
    .eq('campaign_id', id)
    .order('total_clicks', { ascending: false })

  const linkIds = (campaignLinks || []).map((l) => l.id)

  const filter = { timeRange, linkIds: linkIds.length > 0 ? linkIds : ['__none__'] }
  const [clicksOverTime, referrers, devices, countries, browsers, totalClicks] = await Promise.all([
    getClicksOverTime(filter),
    getTopReferrers(filter),
    getDeviceBreakdown(filter),
    getCountryBreakdown(filter),
    getBrowserBreakdown(filter),
    getTotalClicks(filter),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/dashboard/campaigns" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{campaign.name}</h1>
              {campaign.description && <p className="text-sm text-gray-500">{campaign.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <TimeRangePicker current={timeRange} basePath={`/dashboard/campaigns/${id}`} />
          <div className="text-sm text-gray-500">
            {totalClicks.toLocaleString()} clicks &middot; {linkIds.length} links
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Clicks Over Time</h2>
          <ClicksOverTimeChart data={clicksOverTime} />
        </div>

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

        {/* Campaign Links */}
        {campaignLinks && campaignLinks.length > 0 && (
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Links in Campaign</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {campaignLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/dashboard/links/${link.id}`}
                  className="block px-6 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-blue-600">tws.bio/{link.short_code}</span>
                      <p className="text-xs text-gray-500 truncate max-w-md">{link.original_url}</p>
                    </div>
                    <span className="text-sm text-gray-500">{(link.total_clicks || 0).toLocaleString()} clicks</span>
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
```

**Step 3: Add campaigns link to dashboard**

In `src/app/dashboard/page.tsx`, add a "Campaigns" link next to the "Create Link" button in the header area:

```tsx
<Link
  href="/dashboard/campaigns"
  className="text-gray-700 hover:text-gray-900 font-medium text-sm"
>
  Campaigns
</Link>
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/dashboard/campaigns/ src/app/dashboard/page.tsx
git commit -m "feat: add campaign list and campaign detail analytics views"
```

---

## Task 9: Add Campaign Selection to Link Creation Form

**Files:**
- Modify: `src/components/CreateLinkForm.tsx`

Add an optional campaign dropdown to `CreateLinkForm`. User can select an existing campaign or type a new name to create one inline.

**Step 1: Add campaign state and fetching**

Add to `CreateLinkForm`:

```tsx
const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
const [newCampaignName, setNewCampaignName] = useState('')

useEffect(() => {
  async function loadCampaigns() {
    const supabase = createClient()
    const { data } = await supabase
      .from('campaigns')
      .select('id, name')
      .order('created_at', { ascending: false })
    setCampaigns(data || [])
  }
  loadCampaigns()
}, [])
```

**Step 2: Add campaign UI after the custom code input**

```tsx
<div>
  <label htmlFor="campaign" className="block text-sm font-medium text-gray-700 mb-2">
    Campaign (optional)
  </label>
  <select
    id="campaign"
    value={selectedCampaignId}
    onChange={(e) => {
      setSelectedCampaignId(e.target.value)
      if (e.target.value !== '__new__') setNewCampaignName('')
    }}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="">No campaign</option>
    {campaigns.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
    <option value="__new__">+ New campaign...</option>
  </select>
  {selectedCampaignId === '__new__' && (
    <input
      type="text"
      value={newCampaignName}
      onChange={(e) => setNewCampaignName(e.target.value)}
      placeholder="Campaign name"
      className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  )}
</div>
```

**Step 3: Handle campaign creation in submit handler**

Before creating the link, if `selectedCampaignId === '__new__'` and `newCampaignName` is set, create the campaign first:

```tsx
let campaignId: string | undefined = selectedCampaignId || undefined
if (selectedCampaignId === '__new__' && newCampaignName.trim()) {
  const { data: newCampaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({ name: newCampaignName.trim(), user_id: user.id })
    .select('id')
    .single()
  if (campaignError) throw new Error(campaignError.message)
  campaignId = newCampaign.id
}
```

After link creation, if `campaignId` is set, update the link:

```tsx
if (campaignId && data) {
  await supabase
    .from('links')
    .update({ campaign_id: campaignId })
    .eq('id', data.id)
}
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds. Create a link with a new campaign — campaign appears in `/dashboard/campaigns`.

**Step 5: Commit**

```bash
git add src/components/CreateLinkForm.tsx
git commit -m "feat: add campaign selection to link creation form"
```

---

## Task 10: Create Resource Hub Page

**Files:**
- Create: `src/config/resources.ts`
- Create: `src/app/resources/page.tsx`

**Step 1: Create `src/config/resources.ts`**

```ts
export interface ResourceItem {
  title: string
  url: string
  description?: string
}

export interface ResourceCategory {
  category: string
  items: ResourceItem[]
}

export const resources: ResourceCategory[] = [
  {
    category: 'Brokers',
    items: [
      { title: 'Zerodha', url: 'https://zerodha.com', description: 'Primary broker for equities & F&O' },
    ],
  },
  {
    category: 'Charting & Analysis',
    items: [
      { title: 'TradingView', url: 'https://tradingview.com', description: 'Charts and technical analysis' },
    ],
  },
  {
    category: 'Learning',
    items: [
      { title: 'Varsity by Zerodha', url: 'https://zerodha.com/varsity', description: 'Free trading education' },
    ],
  },
]
```

**Step 2: Create `src/app/resources/page.tsx`**

```tsx
import { resources } from '@/config/resources'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Resources — tws.bio',
  description: 'Trading tools, platforms, and resources curated by @tradingwithsidhant',
}

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">tws.bio</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Resources</h1>
        <p className="text-gray-500 mb-10">Tools, platforms, and links I use for trading.</p>

        <div className="space-y-10">
          {resources.map((group) => (
            <section key={group.category}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {group.category}
              </h2>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {group.items.map((item) => (
                  <a
                    key={item.title}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item.title}</span>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds. Visit `/resources` — categories and links render.

**Step 4: Commit**

```bash
git add src/config/resources.ts src/app/resources/page.tsx
git commit -m "feat: add public resource hub page at /resources"
```

---

## Task 11: Create Link-in-Bio Homepage

**Files:**
- Create: `src/config/bio.ts`
- Create: `src/components/SocialIcon.tsx`
- Modify: `src/app/page.tsx` (full rewrite)
- Modify: `src/app/layout.tsx` (update metadata)

**Step 1: Create `src/config/bio.ts`**

```ts
export interface BioLink {
  label: string
  url: string
  icon: string // icon key, matched in SocialIcon component
}

export const bio = {
  name: 'Sidhant',
  handle: '@tradingwithsidhant',
  tagline: 'Trading, markets & options',
  avatar: '/avatar.jpg',
  links: [
    { label: 'YouTube', url: 'https://youtube.com/@tradingwithsidhant', icon: 'youtube' },
    { label: 'Instagram', url: 'https://instagram.com/tradingwithsidhant', icon: 'instagram' },
    { label: 'Telegram', url: 'https://t.me/tradingwithsidhant', icon: 'telegram' },
    { label: 'X / Twitter', url: 'https://x.com/tradingwithsidhant', icon: 'twitter' },
    { label: 'Resources', url: '/resources', icon: 'bookmark' },
  ] satisfies BioLink[],
}
```

**Step 2: Create `src/components/SocialIcon.tsx`**

A simple component that maps icon keys to inline SVGs. Include icons for: youtube, instagram, telegram, twitter, bookmark, link (fallback).

```tsx
interface SocialIconProps {
  name: string
  className?: string
}

const icons: Record<string, React.ReactNode> = {
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.015 3.015 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  bookmark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
}

export function SocialIcon({ name, className }: SocialIconProps) {
  return <span className={className}>{icons[name] || icons.link}</span>
}
```

**Step 3: Rewrite `src/app/page.tsx`**

```tsx
import { bio } from '@/config/bio'
import { SocialIcon } from '@/components/SocialIcon'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: `${bio.name} — ${bio.handle}`,
  description: bio.tagline,
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm py-16">
        {/* Profile */}
        <div className="text-center mb-10">
          <Image
            src={bio.avatar}
            alt={bio.name}
            width={80}
            height={80}
            className="rounded-full mx-auto mb-4"
            priority
          />
          <h1 className="text-xl font-bold text-gray-900">{bio.name}</h1>
          <p className="text-sm text-gray-500">{bio.handle}</p>
          <p className="text-sm text-gray-400 mt-1">{bio.tagline}</p>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {bio.links.map((link) => {
            const isExternal = link.url.startsWith('http')
            return (
              <a
                key={link.label}
                href={link.url}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-3 w-full px-5 py-3.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-900"
              >
                <SocialIcon name={link.icon} />
                <span className="text-sm font-medium">{link.label}</span>
              </a>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 mt-12">
          tws.bio
        </p>
      </div>
    </div>
  )
}
```

**Step 4: Update `src/app/layout.tsx` metadata**

Change the metadata to:

```tsx
export const metadata: Metadata = {
  title: "tws.bio — @tradingwithsidhant",
  description: "Trading, markets & options",
}
```

**Step 5: Add a placeholder avatar**

Place a placeholder image at `public/avatar.jpg`. The user should replace this with their actual photo.

**Step 6: Clean up unused homepage components**

The following files are no longer imported by the homepage and can be deleted:
- `src/components/HomeHeader.tsx`
- `src/components/HomeInteractive.tsx`
- `src/components/LinksList.tsx`
- `src/hooks/useLinks.ts`

Check that no other file imports these before deleting. `useAuth.ts` is still used by `CreateLinkForm` (no — we removed that in Task 6, verify). If nothing else imports them, delete.

**Step 7: Verify**

Run: `npm run build`
Expected: Build succeeds. Visit `/` — bio page renders with avatar, name, and link buttons.

**Step 8: Commit**

```bash
git add src/config/bio.ts src/components/SocialIcon.tsx src/app/page.tsx src/app/layout.tsx public/avatar.jpg
git rm src/components/HomeHeader.tsx src/components/HomeInteractive.tsx src/components/LinksList.tsx src/hooks/useLinks.ts
# Only delete useAuth.ts if nothing imports it:
# git rm src/hooks/useAuth.ts
git commit -m "feat: replace homepage with link-in-bio page, add social icons, clean up unused components"
```

---

## Task 12: Final Cleanup and Verification

**Files:**
- Possibly modify: various files for lint fixes

**Step 1: Run lint**

Run: `npm run lint`
Fix any errors.

**Step 2: Run build**

Run: `npm run build`
Verify zero errors.

**Step 3: Manual smoke test**

1. `/` — bio page renders with avatar, name, links
2. `/resources` — resource categories render
3. `/login` — can still log in
4. `/dashboard` — analytics charts, stat cards, links table
5. `/dashboard?range=7d` — time range filter works
6. Click a link row → `/dashboard/links/[id]` — per-link analytics
7. `/dashboard/create` — link creation form with campaign dropdown
8. `/dashboard/campaigns` — campaign list
9. Create a link with a new campaign → campaign appears in list
10. `/dashboard/campaigns/[id]` — campaign analytics with links

**Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: lint fixes and final cleanup"
```

---

## Summary

| Task | What | New Files | Modified Files |
|------|------|-----------|----------------|
| 1 | UTM parsing in redirect handler | — | `[shortCode]/route.ts` |
| 2 | Analytics query library | `lib/analytics.ts` | — |
| 3 | Chart components | `charts/*.tsx` (3 files) | — |
| 4 | Rich analytics dashboard | `TimeRangePicker.tsx` | `dashboard/page.tsx` |
| 5 | Per-link analytics | `dashboard/links/[id]/page.tsx` | — |
| 6 | Move link creation to dashboard | `dashboard/create/page.tsx` | `CreateLinkForm.tsx` |
| 7 | Campaigns migration | `migrations/008_campaigns.sql` | `database.ts` |
| 8 | Campaign views | `campaigns/page.tsx`, `campaigns/[id]/page.tsx` | `dashboard/page.tsx` |
| 9 | Campaign selection in form | — | `CreateLinkForm.tsx` |
| 10 | Resource hub | `config/resources.ts`, `resources/page.tsx` | — |
| 11 | Link-in-bio homepage | `config/bio.ts`, `SocialIcon.tsx` | `page.tsx`, `layout.tsx` |
| 12 | Final cleanup | — | various |
