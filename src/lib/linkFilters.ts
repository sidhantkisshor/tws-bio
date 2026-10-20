// Search, filter and sort for the Links page. The server page (its count query
// and its data query) and the browser CSV export (ExportLinksButton) build their
// `links` query through these helpers, so "Export All" always holds the same
// rows as the filtered table. No runtime imports on purpose: ExportLinksButton
// is a client component, and anything imported here ships in its bundle.

export type TypeFilter = 'all' | 'url' | 'deep_link'
export type StatusFilter = 'all' | 'active' | 'inactive'
export type SortOption = 'created_desc' | 'created_asc' | 'clicks_desc' | 'clicks_asc'

export interface LinkFilters {
  q: string
  type: TypeFilter
  status: StatusFilter
}

export interface LinkListParams extends LinkFilters {
  sort: SortOption
}

// The parts of the PostgREST filter builder these helpers call. Structural
// rather than PostgrestFilterBuilder itself, so each caller's builder (one type
// per select()) comes back with its own type, and a test can pass a stub.
interface FilterableQuery {
  or(filters: string): this
  eq(column: string, value: string | boolean): this
}

interface SortableQuery {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this
}

export function applyLinkFilters<Q extends FilterableQuery>(
  query: Q,
  { q, type, status }: LinkFilters
): Q {
  let filtered = query
  if (q) {
    // `.or()` takes a raw PostgREST filter string, so strip the characters
    // that would break its `col.op.val,col.op.val` grammar rather than trying
    // to escape them.
    const safeQ = q.replace(/[(),%]/g, '')
    if (safeQ) {
      filtered = filtered.or(`short_code.ilike.%${safeQ}%,original_url.ilike.%${safeQ}%`)
    }
  }
  if (type === 'url') {
    // Rows created before link_type existed (or via the untyped RPC) have a
    // null link_type, which the rest of the app already treats as "URL".
    filtered = filtered.or('link_type.eq.url,link_type.is.null')
  } else if (type === 'deep_link') {
    filtered = filtered.eq('link_type', 'deep_link')
  }
  if (status === 'active') {
    filtered = filtered.eq('is_active', true)
  } else if (status === 'inactive') {
    filtered = filtered.or('is_active.eq.false,is_active.is.null')
  }
  return filtered
}

export function applyLinkSort<Q extends SortableQuery>(query: Q, sort: SortOption): Q {
  switch (sort) {
    case 'created_asc':
      return query.order('created_at', { ascending: true })
    case 'clicks_desc':
      return query.order('total_clicks', { ascending: false, nullsFirst: false })
    case 'clicks_asc':
      return query.order('total_clicks', { ascending: true, nullsFirst: true })
    default:
      return query.order('created_at', { ascending: false })
  }
}

// Per-row click trend on the Links page. The day keys come from
// sparklineWindow in analytics.ts: IST dates, the same days
// get_clicks_over_time buckets clicks into. It lives there, beside the one
// day-boundary definition, because importing analytics.ts here would put the
// server Supabase client (and next/headers) in ExportLinksButton's bundle.

/**
 * One click count per key, oldest first, 0 for a day with no row. Rows outside
 * the keys are dropped: a NULL day (legacy rows with no clicked_at), or a day
 * after today, which the RPC can return because p_since has no upper bound.
 */
export function fillDailyClicks(
  keys: string[],
  rows: { day: string | null; clicks: number | string }[]
): number[] {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    if (!row.day) continue
    // bigint counts can arrive as strings, so coerce the same way analytics.ts does.
    byDay.set(row.day, (byDay.get(row.day) || 0) + (Number(row.clicks) || 0))
  }
  return keys.map((key) => byDay.get(key) || 0)
}
