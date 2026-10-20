import { createClient } from '@/lib/supabase/server'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

// Range vocabulary and day buckets. Overview, Analytics, the detail pages and
// the Links page sparklines all take their window and chart days from here, so
// a "30 day" number means the same 30 days on every page.

/** Whole days in each bounded range. */
export const RANGE_DAYS: Readonly<Record<Exclude<TimeRange, 'all'>, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The zone every chart day and range window is counted in: India Standard
 * Time, the owner's choice (2026-10-20). The database buckets clicks the same
 * way: get_clicks_over_time labels each one with
 * (clicked_at AT TIME ZONE 'Asia/Kolkata')::date (migration 022), so the
 * windows and day keys built here match the days the RPC returns. A move to
 * another zone changes this, the offset below and that RPC together.
 */
export const CHART_TIME_ZONE = 'Asia/Kolkata'

/**
 * How far CHART_TIME_ZONE runs ahead of UTC. IST is UTC+5:30 all year, with
 * no daylight saving, so a fixed offset is exact and every day is 24 hours.
 * The day math below uses only this and UTC, never the server's own zone.
 */
export const CHART_UTC_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** Midnight in India that starts the day holding `ms`, as an epoch time. */
function chartDayStart(ms: number): number {
  // Shifted by the offset, the IST wall clock reads as UTC, so flooring to a
  // whole UTC day lands on IST midnight.
  return Math.floor((ms + CHART_UTC_OFFSET_MS) / MS_PER_DAY) * MS_PER_DAY - CHART_UTC_OFFSET_MS
}

/** The start of the first of `days` whole days that end with today. */
function windowStart(now: Date, days: number): number {
  return chartDayStart(now.getTime()) - (days - 1) * MS_PER_DAY
}

/**
 * Reads a `?range=` value. Analytics used to write bare day counts ('7', '30',
 * '90') while the detail pages wrote '7d', so both spellings are accepted and
 * old bookmarks keep their range. Anything else falls back to 30 days.
 */
export function parseTimeRange(param: string | undefined | null): TimeRange {
  // A switch, not an object lookup: a key like 'constructor' must not match.
  switch (param) {
    case '7d':
    case '7':
      return '7d'
    case '30d':
    case '30':
      return '30d'
    case '90d':
    case '90':
      return '90d'
    case 'all':
      return 'all'
    default:
      return '30d'
  }
}

export type BoundedRangeWindow = { since: Date; priorSince: Date; days: number }
export type RangeWindow = BoundedRangeWindow | { since: null; priorSince: null; days: null }

/**
 * The window a range covers: `days` whole IST days with today as the last
 * one, and `priorSince`, the start of the same-length window just before it.
 * Both bounds are IST midnight, which as an instant is 18:30 UTC on the date
 * before. A rolling `now - N days` start gave N+1 chart buckets with a partial
 * first day, which always read as growth. 'all' has no bounds.
 */
export function rangeWindow(range: Exclude<TimeRange, 'all'>, now?: Date): BoundedRangeWindow
export function rangeWindow(range: TimeRange, now?: Date): RangeWindow
export function rangeWindow(range: TimeRange, now: Date = new Date()): RangeWindow {
  if (range === 'all') return { since: null, priorSince: null, days: null }
  const days = RANGE_DAYS[range]
  const since = windowStart(now, days)
  return {
    since: new Date(since),
    priorSince: new Date(since - days * MS_PER_DAY),
    days,
  }
}

/** One chart point: a 'YYYY-MM-DD' day and its click count. */
export interface DailyClicks {
  date: string
  clicks: number
}

/**
 * The day a moment is charted under, as 'YYYY-MM-DD': its calendar date in
 * India, the same label get_clicks_over_time gives a click made then (see
 * CHART_TIME_ZONE). Charts and sparklines take their day labels from here.
 */
export function dayKey(date: Date): string {
  return new Date(date.getTime() + CHART_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

/** Midnight in India that starts a 'YYYY-MM-DD' day, as an epoch time. */
function dayKeyStart(key: string): number {
  // A bare 'YYYY-MM-DD' parses as UTC midnight. IST midnight on the same date
  // comes 5:30 earlier.
  return Date.parse(key) - CHART_UTC_OFFSET_MS
}

/** `length` consecutive day keys, oldest first, from the day holding `start`. */
function dayKeysFrom(start: number, length: number): string[] {
  // IST has no daylight saving, so each 24-hour step is exactly the next date.
  return Array.from({ length }, (_, i) => dayKey(new Date(start + i * MS_PER_DAY)))
}

/**
 * One row per IST day, oldest first, for exactly `days` days from the day that
 * holds `since`. get_clicks_over_time only returns days that have clicks, and
 * a chart fed only those draws a slope across the empty days between them.
 * Rows outside the window are dropped. With no window (rangeWindow('all')),
 * it runs from the first to the last day that has clicks.
 */
export function zeroFillDays(
  rows: DailyClicks[],
  since: Date | null,
  days: number | null
): DailyClicks[] {
  const clicksByDay = new Map<string, number>()
  for (const row of rows) {
    // The RPC sends day labels already; slicing also copes with a timestamp.
    const day = row.date.slice(0, 10)
    clicksByDay.set(day, (clicksByDay.get(day) ?? 0) + row.clicks)
  }

  let start: number
  let length: number
  if (since && days !== null) {
    start = chartDayStart(since.getTime())
    length = days
  } else {
    const dataDays = Array.from(clicksByDay.keys()).sort()
    if (dataDays.length === 0) return []
    start = dayKeyStart(dataDays[0])
    length = Math.round((dayKeyStart(dataDays[dataDays.length - 1]) - start) / MS_PER_DAY) + 1
  }

  return dayKeysFrom(start, length).map((date) => ({ date, clicks: clicksByDay.get(date) ?? 0 }))
}

/** Days in each Links page sparkline. */
export const SPARKLINE_DAYS = 14

/**
 * The window for `days` daily buckets that end today, for the Links page
 * sparklines. `since` is IST midnight `days - 1` days ago, to send as
 * p_since, and `keys` holds one 'YYYY-MM-DD' IST date per bucket, oldest
 * first: the days get_clicks_over_time returns. It lives here, not beside
 * fillDailyClicks in linkFilters.ts, because that file ships to the browser
 * and this one imports the server Supabase client.
 */
export function sparklineWindow(
  now: Date,
  days: number = SPARKLINE_DAYS
): { since: string; keys: string[] } {
  const start = windowStart(now, days)
  return { since: new Date(start).toISOString(), keys: dayKeysFrom(start, days) }
}

/** A count as getTotalClicksResult returns it. */
export interface CountResult {
  data: number
  error: boolean
}

/**
 * Clicks in the prior window: a count from `priorSince` to now (`combined`)
 * minus the current window's count. One count over both windows keeps the
 * link ids in the RPC's POST body instead of a GET URL. Null when there is no
 * prior window or either count failed, so a trend never compares against a
 * zero that only means "the query failed".
 */
export function priorWindowTotal(
  combined: CountResult | null,
  current: CountResult
): number | null {
  if (!combined || combined.error || current.error) return null
  // The two counts run a moment apart, so a click that lands between them
  // could take the difference below zero.
  return Math.max(combined.data - current.data, 0)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * True for an id in the 8-4-4-4-12 hex form. The detail pages check their
 * route id with this first: a malformed id fails every uuid query and RPC
 * (Postgres 22P02), which is a missing page, not a server error. Any version
 * passes, so an id not made by gen_random_uuid() still resolves.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

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

// A caller that passes no `since` still gets the rangeWindow boundary, not a
// rolling one, so its totals match the pages that do pass it.
function getDateFrom(timeRange: TimeRange): string | null {
  return rangeWindow(timeRange).since?.toISOString() ?? null
}

function getSince(filter: AnalyticsFilter): string | null {
  return filter.since !== undefined ? filter.since : getDateFrom(filter.timeRange)
}

function getLinkIds(filter: AnalyticsFilter): string[] {
  if (filter.linkIds) return filter.linkIds
  if (filter.linkId) return [filter.linkId]
  return []
}

// Each helper returns `{ data, error }` so a page can render a distinct error
// state instead of letting a failed aggregation masquerade as "no data yet".
// There are deliberately no variants that turn a failure into [] or 0: the
// last caller of those showed an outage as an empty campaign.

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

export async function getTotalClicksResult(
  filter: AnalyticsFilter
): Promise<CountResult> {
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
