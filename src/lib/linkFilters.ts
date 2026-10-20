// Search, filter and sort for the Links page. The server page (its count query
// and its data query) and the browser CSV export (ExportLinksButton) build their
// `links` query through these helpers, so "Export all" always holds the same
// rows as the filtered table. The only runtime imports are two tiny, pure
// modules (destinationKind, linkRows): ExportLinksButton is a client component, and
// anything imported here ships in its bundle. The link health rules stay on
// the server: the page works out `needsLook` per link and hands it in.

import { DESTINATION_KINDS, type DestinationKind } from './destinationKind'
import { isResourceDropRow } from './linkRows'

export type TypeFilter = 'all' | 'url' | 'deep_link'
export type StatusFilter = 'all' | 'active' | 'inactive'
export type SortOption = 'created_desc' | 'created_asc' | 'clicks_desc' | 'clicks_asc'
/** The filter chips that are not a column filter: `?show=`. */
export type ShowFilter = 'all' | 'drops' | 'expiring' | 'attention'

export interface LinkFilters {
  q: string
  type: TypeFilter
  status: StatusFilter
  /**
   * Restrict to these link ids (a chip such as Needs a look or a destination
   * kind, worked out from the owner's links on the server). Absent or null:
   * no restriction. The caller skips the query for an empty list.
   */
  ids?: readonly string[] | null
  /** Campaigns whose name matches `q`: their links match the search too. */
  campaignIds?: readonly string[]
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
  in(column: string, values: readonly string[]): this
}

interface SortableQuery {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this
}

/**
 * The search text as it goes into the `.or()` string. `.or()` takes a raw
 * PostgREST filter, so the characters that would break its
 * `col.op.val,col.op.val` grammar are stripped rather than escaped.
 */
export function safeSearch(q: string): string {
  return q.replace(/[(),%]/g, '')
}

// A campaign id is a uuid. Anything else is dropped rather than put into the
// raw filter string.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function applyLinkFilters<Q extends FilterableQuery>(
  query: Q,
  { q, type, status, ids, campaignIds }: LinkFilters
): Q {
  let filtered = query
  if (q) {
    const safeQ = safeSearch(q)
    if (safeQ) {
      const campaigns = (campaignIds ?? []).filter((id) => UUID.test(id))
      const campaignClause = campaigns.length > 0 ? `,campaign_id.in.(${campaigns.join(',')})` : ''
      filtered = filtered.or(
        `short_code.ilike.%${safeQ}%,original_url.ilike.%${safeQ}%${campaignClause}`
      )
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
  if (ids) {
    filtered = filtered.in('id', ids)
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

// ---------- Chips: parsing, counts and the id list they stand for ----------

export function parseShow(value: string | undefined | null): ShowFilter {
  return value === 'drops' || value === 'expiring' || value === 'attention' ? value : 'all'
}

/** 'Broker partner' gives 'broker-partner', the form used in `?kind=`. */
export function kindSlug(kind: DestinationKind): string {
  return kind.toLowerCase().replace(/\s+/g, '-')
}

/** The kind a `?kind=` slug names, or null for an unknown or missing slug. */
export function parseKind(value: string | undefined | null): DestinationKind | null {
  if (!value) return null
  return DESTINATION_KINDS.find((kind) => kindSlug(kind) === value) ?? null
}

const DAY_MS = 86_400_000

/** Expires within the next 7 days and has not expired yet (the "Expiring" chip). */
export function isExpiringSoon(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false
  const exp = Date.parse(expiresAt)
  if (!Number.isFinite(exp)) return false
  const left = exp - now.getTime()
  return left > 0 && left <= 7 * DAY_MS
}

/** One of the owner's links, with what the chips need worked out. */
export interface IndexedLink {
  id: string
  short_code: string
  original_url: string
  link_type: string | null
  is_active: boolean | null
  expires_at: string | null
  campaign_id: string | null
  kind: DestinationKind | null
  /** A high or medium link health issue (never a paused or quiet link alone). */
  needsLook: boolean
}

/**
 * The search as the database runs it (`ilike %q%` on the code and the
 * destination, plus the campaigns whose name matches), for the chip counts.
 */
export function matchesSearch(
  link: Pick<IndexedLink, 'short_code' | 'original_url' | 'campaign_id'>,
  q: string,
  campaignIds: ReadonlySet<string>
): boolean {
  const needle = safeSearch(q).toLowerCase()
  if (!needle) return true
  return (
    link.short_code.toLowerCase().includes(needle) ||
    link.original_url.toLowerCase().includes(needle) ||
    (link.campaign_id !== null && campaignIds.has(link.campaign_id))
  )
}

/** Ids of the campaigns whose name contains the search text. */
export function matchingCampaignIds(
  campaigns: readonly { id: string; name: string }[],
  q: string
): string[] {
  const needle = safeSearch(q).toLowerCase()
  if (!needle) return []
  return campaigns.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c.id)
}

function isDrop(link: Pick<IndexedLink, 'short_code'>): boolean {
  return isResourceDropRow(link.short_code)
}

export function matchesShow(link: IndexedLink, show: ShowFilter, now: Date): boolean {
  switch (show) {
    case 'drops':
      return isDrop(link)
    case 'expiring':
      return isExpiringSoon(link.expires_at, now)
    case 'attention':
      return link.needsLook
    default:
      return true
  }
}

export interface ChipCounts {
  all: number
  live: number
  paused: number
  app: number
  drops: number
  expiring: number
  attention: number
  /** Every kind with at least one link, in DESTINATION_KINDS order. */
  kinds: { kind: DestinationKind; slug: string; count: number }[]
}

/** How many links each chip would show. Pass the links that match the search. */
export function chipCounts(links: readonly IndexedLink[], now: Date): ChipCounts {
  const out: ChipCounts = {
    all: links.length,
    live: 0,
    paused: 0,
    app: 0,
    drops: 0,
    expiring: 0,
    attention: 0,
    kinds: [],
  }
  const byKind = new Map<DestinationKind, number>()
  for (const link of links) {
    if (link.is_active) out.live += 1
    else out.paused += 1
    if (link.link_type === 'deep_link') out.app += 1
    if (isDrop(link)) out.drops += 1
    if (isExpiringSoon(link.expires_at, now)) out.expiring += 1
    if (link.needsLook) out.attention += 1
    if (link.kind) byKind.set(link.kind, (byKind.get(link.kind) ?? 0) + 1)
  }
  out.kinds = DESTINATION_KINDS.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    slug: kindSlug(kind),
    count: byKind.get(kind) ?? 0,
  }))
  return out
}

/**
 * The ids a chip stands for, or null when no chip needs one (the plain
 * column filters, search, type and status, run in the query itself).
 */
export function chipLinkIds(
  links: readonly IndexedLink[],
  show: ShowFilter,
  kind: DestinationKind | null,
  now: Date
): string[] | null {
  if (show === 'all' && !kind) return null
  return links
    .filter((link) => matchesShow(link, show, now) && (!kind || link.kind === kind))
    .map((link) => link.id)
}

/**
 * Every filter of the Links page (search, type, status, chip, kind) run on
 * one indexed link, the same way the database runs the column filters. The
 * page uses it when a chip or a search needs the owner's links first: it then
 * filters, counts and sorts the whole index itself and asks the database for
 * the 20 rows of one page only, so no long id list goes into a request URL.
 */
export function matchesListFilters(
  link: IndexedLink,
  f: {
    q: string
    type: TypeFilter
    status: StatusFilter
    show: ShowFilter
    kind: DestinationKind | null
    campaignIds: ReadonlySet<string>
  },
  now: Date
): boolean {
  if (f.type === 'url' && link.link_type !== 'url' && link.link_type !== null) return false
  if (f.type === 'deep_link' && link.link_type !== 'deep_link') return false
  if (f.status === 'active' && link.is_active !== true) return false
  if (f.status === 'inactive' && link.is_active === true) return false
  if (f.kind && link.kind !== f.kind) return false
  return matchesShow(link, f.show, now) && matchesSearch(link, f.q, f.campaignIds)
}

type SortableRow = { id: string; created_at: string | null; total_clicks: number | null }

function compareNullable(a: number | null, b: number | null, ascending: boolean, nullsFirst: boolean) {
  if (a === null || b === null) {
    if (a === b) return 0
    return (a === null) === nullsFirst ? -1 : 1
  }
  return ascending ? a - b : b - a
}

/**
 * `applyLinkSort` in memory, with Postgres' null placement: created_at puts
 * nulls first when descending and last when ascending (the default), the
 * click sorts set it the way applyLinkSort asks. Ties go by id, so a page
 * boundary never moves between two requests. Returns a new array.
 */
export function sortLinks<T extends SortableRow>(rows: readonly T[], sort: SortOption): T[] {
  const time = (row: T) => {
    const ms = row.created_at ? Date.parse(row.created_at) : NaN
    return Number.isFinite(ms) ? ms : null
  }
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case 'created_asc':
        return compareNullable(time(a), time(b), true, false)
      case 'clicks_desc':
        return compareNullable(a.total_clicks, b.total_clicks, false, false)
      case 'clicks_asc':
        return compareNullable(a.total_clicks, b.total_clicks, true, true)
      default:
        return compareNullable(time(a), time(b), false, true)
    }
  }
  return [...rows].sort((a, b) => compare(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * About 150 uuids per `.in('id', ...)`: each takes about 37 bytes of the
 * request URL, so a chunk stays near 6 KB, well under the limits of the
 * proxies in front of PostgREST.
 */
export const ID_CHUNK_SIZE = 150

export function chunkIds(ids: readonly string[], size = ID_CHUNK_SIZE): string[][] {
  const step = Math.max(1, Math.floor(size))
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += step) out.push(ids.slice(i, i + step))
  return out
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
