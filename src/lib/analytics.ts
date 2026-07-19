import { createClient } from '@/lib/supabase/server'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface AnalyticsFilter {
  timeRange: TimeRange
  linkId?: string
  linkIds?: string[]
  /**
   * Explicit window-start override (ISO timestamp, or null for unbounded).
   * When provided it wins over `timeRange`, so a caller can share one exact
   * boundary between these helpers and its own prior-period queries.
   */
  since?: string | null
}

function getDateFrom(timeRange: TimeRange): string | null {
  if (timeRange === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90 }[timeRange]
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function getSince(filter: AnalyticsFilter): string | null {
  return filter.since !== undefined ? filter.since : getDateFrom(filter.timeRange)
}

function getLinkIds(filter: AnalyticsFilter): string[] {
  if (filter.linkIds) return filter.linkIds
  if (filter.linkId) return [filter.linkId]
  return []
}

// The `get*Result` variants surface query failures so pages can render a
// distinct error state instead of letting a failed aggregation masquerade
// as "no data yet". The original array/number-returning helpers below
// delegate to them for callers that treat a failure as empty.

export async function getClicksOverTimeResult(
  filter: AnalyticsFilter
): Promise<{ data: { date: string; clicks: number }[]; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_clicks_over_time', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error || !data) {
    console.error('[analytics] getClicksOverTime:', error)
    return { data: [], error: true }
  }

  return {
    // Legacy rows may have a nullable clicked_at. PostgreSQL groups those into
    // a NULL day for an unbounded range; omit that non-date bucket instead of
    // letting callers crash on `date.slice(...)`.
    data: data.flatMap((row) =>
      row.day ? [{ date: row.day, clicks: Number(row.clicks) }] : []
    ),
    error: false,
  }
}

export async function getClicksOverTime(filter: AnalyticsFilter) {
  return (await getClicksOverTimeResult(filter)).data
}

export async function getTopReferrersResult(
  filter: AnalyticsFilter
): Promise<{ data: { name: string; clicks: number }[]; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_referrer_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error || !data) {
    console.error('[analytics] getTopReferrers:', error)
    return { data: [], error: true }
  }

  return {
    data: data
      .map((row) => ({ name: row.name || 'Direct', clicks: Number(row.count) }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10),
    error: false,
  }
}

export async function getTopReferrers(filter: AnalyticsFilter) {
  return (await getTopReferrersResult(filter)).data
}

export async function getDeviceBreakdownResult(
  filter: AnalyticsFilter
): Promise<{ data: { name: string; value: number }[]; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_device_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error || !data) {
    console.error('[analytics] getDeviceBreakdown:', error)
    return { data: [], error: true }
  }

  return {
    data: data
      .map((row) => ({ name: row.name || 'unknown', value: Number(row.count) }))
      .sort((a, b) => b.value - a.value),
    error: false,
  }
}

export async function getDeviceBreakdown(filter: AnalyticsFilter) {
  return (await getDeviceBreakdownResult(filter)).data
}

export async function getCountryBreakdownResult(
  filter: AnalyticsFilter
): Promise<{ data: { name: string; clicks: number }[]; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_country_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error || !data) {
    console.error('[analytics] getCountryBreakdown:', error)
    return { data: [], error: true }
  }

  return {
    data: data
      .map((row) => ({ name: row.name || 'Unknown', clicks: Number(row.count) }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10),
    error: false,
  }
}

export async function getCountryBreakdown(filter: AnalyticsFilter) {
  return (await getCountryBreakdownResult(filter)).data
}

export async function getBrowserBreakdownResult(
  filter: AnalyticsFilter
): Promise<{ data: { name: string; value: number }[]; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_browser_breakdown', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error || !data) {
    console.error('[analytics] getBrowserBreakdown:', error)
    return { data: [], error: true }
  }

  return {
    data: data
      .map((row) => ({ name: row.name || 'Unknown', value: Number(row.count) }))
      .sort((a, b) => b.value - a.value),
    error: false,
  }
}

export async function getBrowserBreakdown(filter: AnalyticsFilter) {
  return (await getBrowserBreakdownResult(filter)).data
}

export async function getTotalClicksResult(
  filter: AnalyticsFilter
): Promise<{ data: number; error: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_total_clicks', {
    p_link_ids: getLinkIds(filter),
    p_since: getSince(filter),
  })
  if (error) {
    console.error('[analytics] getTotalClicks:', error)
    return { data: 0, error: true }
  }
  return { data: Number(data) || 0, error: false }
}

export async function getTotalClicks(filter: AnalyticsFilter): Promise<number> {
  return (await getTotalClicksResult(filter)).data
}
