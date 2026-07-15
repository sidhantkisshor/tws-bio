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

function getLinkIds(filter: AnalyticsFilter): string[] {
  if (filter.linkIds) return filter.linkIds
  if (filter.linkId) return [filter.linkId]
  return []
}

export async function getClicksOverTime(filter: AnalyticsFilter) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_clicks_over_time', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error || !data) {
    console.error('[analytics] getClicksOverTime:', error)
    return []
  }

  return data.map((row) => ({ date: row.day, clicks: Number(row.clicks) }))
}

export async function getTopReferrers(filter: AnalyticsFilter) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_referrer_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error || !data) {
    console.error('[analytics] getTopReferrers:', error)
    return []
  }

  return data
    .map((row) => ({ name: row.name || 'Direct', clicks: Number(row.count) }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
}

export async function getDeviceBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_device_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error || !data) {
    console.error('[analytics] getDeviceBreakdown:', error)
    return []
  }

  return data
    .map((row) => ({ name: row.name || 'unknown', value: Number(row.count) }))
    .sort((a, b) => b.value - a.value)
}

export async function getCountryBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_country_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error || !data) {
    console.error('[analytics] getCountryBreakdown:', error)
    return []
  }

  return data
    .map((row) => ({ name: row.name || 'Unknown', clicks: Number(row.count) }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
}

export async function getBrowserBreakdown(filter: AnalyticsFilter) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_browser_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error || !data) {
    console.error('[analytics] getBrowserBreakdown:', error)
    return []
  }

  return data
    .map((row) => ({ name: row.name || 'Unknown', value: Number(row.count) }))
    .sort((a, b) => b.value - a.value)
}

export async function getTotalClicks(filter: AnalyticsFilter): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_total_clicks', {
    p_link_ids: getLinkIds(filter),
    p_since: getDateFrom(filter.timeRange),
  })
  if (error) {
    console.error('[analytics] getTotalClicks:', error)
    return 0
  }
  return Number(data) || 0
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
