import { createClient } from '@/lib/supabase/server'
import { buildHeatmap, type Heatmap } from '@/lib/heatmap'
import { referrerWindowStart } from '@/lib/sources'

// Server helpers for the insight RPCs of migration 030, in the style of
// analytics.ts: each returns `{ data, error }` so a page can show an inline
// error instead of passing an outage off as "no data". Link ids go in the
// RPC's POST body, as in analytics.ts, so a long list is fine. A call with no
// link ids answers at once with empty data and no round trip.

type Since = string | Date | null | undefined

function iso(value: Since): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.toISOString()
}

const EMPTY_HEATMAP: Heatmap = buildHeatmap([])

/**
 * Clicks by IST weekday (0 = Monday) and hour for the given links since
 * `since` (null: all time), built into the grid the Heatmap component draws.
 */
export async function getClickHeatmapResult({
  linkIds,
  since,
}: {
  linkIds: string[]
  since: Since
}): Promise<{ data: Heatmap; error: boolean }> {
  if (linkIds.length === 0) return { data: EMPTY_HEATMAP, error: false }
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_click_heatmap', {
    p_link_ids: linkIds,
    p_since: iso(since),
  })
  if (error || !data) {
    console.error('[insights] getClickHeatmap:', error)
    return { data: EMPTY_HEATMAP, error: true }
  }

  return {
    data: buildHeatmap(
      data.map((row) => ({
        dow: Number(row.dow),
        hour: Number(row.hour),
        clicks: Number(row.clicks),
      })),
    ),
    error: false,
  }
}

export interface LinkClickWindows {
  /** Clicks per link id in [since, now]. Links with none are absent (treat as 0). */
  current: Record<string, number>
  /** Clicks per link id in [priorSince, since). */
  prior: Record<string, number>
}

/**
 * Per-link clicks in the current window and the one before it. Feed
 * `data.current` and `data.prior` straight to computeMovers (src/lib/movers.ts).
 */
export async function getLinkClickWindowsResult({
  linkIds,
  priorSince,
  since,
}: {
  linkIds: string[]
  priorSince: string | Date
  since: string | Date
}): Promise<{ data: LinkClickWindows; error: boolean }> {
  if (linkIds.length === 0) return { data: { current: {}, prior: {} }, error: false }
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_link_click_windows', {
    p_link_ids: linkIds,
    p_prior_since: iso(priorSince) as string,
    p_since: iso(since) as string,
  })
  if (error || !data) {
    console.error('[insights] getLinkClickWindows:', error)
    return { data: { current: {}, prior: {} }, error: true }
  }

  const current: Record<string, number> = {}
  const prior: Record<string, number> = {}
  for (const row of data) {
    current[row.link_id] = Number(row.clicks_current) || 0
    prior[row.link_id] = Number(row.clicks_prior) || 0
  }
  return { data: { current, prior }, error: false }
}

/**
 * Every referrer row for the given links since `since`, uncut, as
 * groupByPlatform takes them (`{ name, count }`; a NULL referrer is
 * "Direct"). Unlike getTopReferrersResult, which keeps the top 10, the sum
 * of these rows is the true total, so "All sources" is honest.
 *
 * Clicks from before the referrer host was stored (REFERRERS_RECORDED_SINCE)
 * are left out: they would all count as "No referrer". `recordedSince` is set
 * when that cut the window, so the panel can say which dates it covers.
 */
export async function getReferrerRowsResult({
  linkIds,
  since,
}: {
  linkIds: string[]
  since: Since
}): Promise<{ data: { name: string; count: number }[]; error: boolean; recordedSince: string | null }> {
  const window = referrerWindowStart(since)
  const recordedSince = window.clamped ? window.since : null
  if (linkIds.length === 0) return { data: [], error: false, recordedSince }
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_referrer_breakdown', {
    p_link_ids: linkIds,
    p_since: window.since,
  })
  if (error || !data) {
    console.error('[insights] getReferrerRows:', error)
    return { data: [], error: true, recordedSince }
  }

  return {
    data: data
      .map((row) => ({ name: row.name || 'Direct', count: Number(row.count) || 0 }))
      .sort((a, b) => b.count - a.count),
    error: false,
    recordedSince,
  }
}
