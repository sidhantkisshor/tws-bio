import { createClient } from '@/lib/supabase/server'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface AnalyticsFilter {
  timeRange: TimeRange
  linkId?: string
  linkIds?: string[]
}

function getDateFrom(timeRange: TimeRange): string | null {
  if (timeRange === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90 }[timeRange]
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function applyFilters(
  query: ReturnType<ReturnType<Awaited<ReturnType<typeof createClient>>['from']>['select']>,
  filter: AnalyticsFilter,
  dateFrom: string | null
) {
  let q = query
  if (filter.linkId) q = q.eq('link_id', filter.linkId)
  if (filter.linkIds) q = q.in('link_id', filter.linkIds)
  if (dateFrom) q = q.gte('clicked_at', dateFrom)
  return q
}

export async function getClicksOverTime(filter: AnalyticsFilter) {
  const supabase = await createClient()
  const dateFrom = getDateFrom(filter.timeRange)

  let query = supabase.from('clicks').select('clicked_at')
  query = applyFilters(query, filter, dateFrom)

  const { data, error } = await query.order('clicked_at', { ascending: true })
  if (error || !data) return []

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

  let query = supabase.from('clicks').select('referrer_domain')
  query = applyFilters(query, filter, dateFrom)

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

  let query = supabase.from('clicks').select('device_type')
  query = applyFilters(query, filter, dateFrom)

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

  let query = supabase.from('clicks').select('country')
  query = applyFilters(query, filter, dateFrom)

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

  let query = supabase.from('clicks').select('browser_name')
  query = applyFilters(query, filter, dateFrom)

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

  let query = supabase.from('clicks').select('id', { count: 'exact', head: true })
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
