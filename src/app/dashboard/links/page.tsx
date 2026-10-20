import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  applyLinkFilters,
  applyLinkSort,
  chipCounts,
  chipLinkIds,
  fillDailyClicks,
  kindSlug,
  matchesSearch,
  matchingCampaignIds,
  parseKind,
  parseShow,
  type IndexedLink,
  type LinkListParams,
  type ShowFilter,
  type SortOption,
  type StatusFilter,
  type TypeFilter,
} from '@/lib/linkFilters'
import { rangeWindow, sparklineWindow } from '@/lib/analytics'
import { getLinkClickWindowsResult } from '@/lib/insights'
import { linkHealthIssues } from '@/lib/linkHealth'
import { destinationKind, type DestinationKind } from '@/lib/destinationKind'
import { isResourceDropRow, rowIssue } from '@/lib/linkRows'
import { isReservedShortCode } from '@/lib/shortCodes'
import { ExportLinksButton } from '@/components/dashboard/ExportLinksButton'
import { LinksToolbar } from '@/components/dashboard/LinksToolbar'
import { LinksTable, type LedgerRow } from '@/components/dashboard/LinksTable'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

const PAGE_SIZE = 20
const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// The columns LinksTable, LinkActions' dialogs, and ExportLinksButton's
// current-page CSV actually read: narrower than `*` so the ghost columns
// (password_hash, custom_meta, tags, qr_code_url, ...) aren't shipped on
// every page of 20 rows. Those components type their props as the full Row
// but never touch the omitted columns, so rows are cast back at the call
// sites below.
const LINK_COLUMNS =
  'id, short_code, original_url, link_type, total_clicks, is_active, created_at, ios_deep_link, android_deep_link, fallback_url, expires_at, max_clicks, campaign_id'

// Every link the owner has, with what the chip counts, Needs a look and the
// destination kinds need. One light query; PostgREST's max-rows setting
// (1000 by default) caps it, far above this account's link count.
const INDEX_COLUMNS =
  'id, short_code, original_url, fallback_url, link_type, is_active, expires_at, max_clicks, total_clicks, created_at, campaign_id'
const INDEX_LIMIT = 5000

// A custom code is lowercase letters, digits and hyphens. Only a search that
// could be one gets the "Create tws.bio/<search>" action.
const CUSTOM_CODE = /^[a-z0-9-]{1,50}$/

interface ListState extends LinkListParams {
  show: ShowFilter
  kind: DestinationKind | null
}

// Preserves the active search/filter/sort params when linking between
// pagination pages, so "page 2 of a Paused-only search" doesn't silently
// reset the view.
function buildPageHref(state: ListState, page: number, drop: { q?: boolean } = {}) {
  const sp = new URLSearchParams()
  if (state.q && !drop.q) sp.set('q', state.q)
  if (state.type !== 'all') sp.set('type', state.type)
  if (state.status !== 'all') sp.set('status', state.status)
  if (state.show !== 'all') sp.set('show', state.show)
  if (state.kind) sp.set('kind', kindSlug(state.kind))
  if (state.sort !== 'created_desc') sp.set('sort', state.sort)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return `/dashboard/links${qs ? `?${qs}` : ''}`
}

type SearchParams = {
  page?: string
  q?: string
  type?: string
  status?: string
  sort?: string
  show?: string
  kind?: string
}

export default async function LinksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser()

  const params = await searchParams
  const requestedPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  // Cap length defensively: this feeds straight into an ilike pattern in
  // applyLinkFilters.
  const q = (params.q || '').trim().slice(0, 200)
  const type: TypeFilter =
    params.type === 'url' || params.type === 'deep_link' ? params.type : 'all'
  const status: StatusFilter =
    params.status === 'active' || params.status === 'inactive' ? params.status : 'all'
  const sort: SortOption =
    params.sort === 'created_asc' || params.sort === 'clicks_desc' || params.sort === 'clicks_asc'
      ? params.sort
      : 'created_desc'
  const show = parseShow(params.show)
  const kind = parseKind(params.kind)
  const state: ListState = { q, type, status, sort, show, kind }
  const now = new Date()

  const indexQuery = supabase
    .from('links')
    .select(INDEX_COLUMNS)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .range(0, INDEX_LIMIT - 1)
  const campaignsQuery = supabase.from('campaigns').select('id, name')

  // Count (head-only) and one data page, through the same filter chain as
  // ExportLinksButton's export-all query, so the page count, the rows and the
  // CSV always agree. Only the data query needs an order.
  const requestedOffset = (requestedPage - 1) * PAGE_SIZE
  function pageQueries(filters: LinkListParams) {
    const dataQuery = applyLinkSort(
      applyLinkFilters(supabase.from('links').select(LINK_COLUMNS).eq('user_id', user!.id), filters),
      filters.sort
    )
    const countQuery = applyLinkFilters(
      supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
      filters
    )
    return { dataQuery, countQuery }
  }

  // The search (campaign names), a chip or a kind needs the owner's links and
  // campaigns first, to know which ids it stands for. Without them all four
  // queries go out in one wave.
  const needsIndexFirst = Boolean(q || show !== 'all' || kind)
  let filters: LinkListParams = { q, type, status, sort }
  let indexResult: Awaited<typeof indexQuery>
  let campaignsResult: Awaited<typeof campaignsQuery>
  let pageResult: {
    count: number | null
    countError: unknown
    data: LinkRow[] | null
    dataError: unknown
    dataQuery: ReturnType<typeof pageQueries>['dataQuery'] | null
  }

  if (!needsIndexFirst) {
    const { dataQuery, countQuery } = pageQueries(filters)
    const [index, campaigns, countRes, dataRes] = await Promise.all([
      indexQuery,
      campaignsQuery,
      countQuery,
      dataQuery.range(requestedOffset, requestedOffset + PAGE_SIZE - 1),
    ])
    indexResult = index
    campaignsResult = campaigns
    pageResult = {
      count: countRes.count,
      countError: countRes.error,
      data: dataRes.data as LinkRow[] | null,
      dataError: dataRes.error,
      dataQuery,
    }
  } else {
    ;[indexResult, campaignsResult] = await Promise.all([indexQuery, campaignsQuery])
    const indexed = indexResult.data ?? []
    const campaignIds = q ? matchingCampaignIds(campaignsResult.data ?? [], q) : []
    const ids = indexResult.error
      ? null
      : chipLinkIds(toIndexed(indexed, now), show, kind, now)
    filters = { q, type, status, sort, ids, campaignIds }
    if (indexResult.error) {
      pageResult = { count: null, countError: null, data: null, dataError: null, dataQuery: null }
    } else if (ids && ids.length === 0) {
      // Nothing matches the chip: no query to run.
      pageResult = { count: 0, countError: null, data: [], dataError: null, dataQuery: null }
    } else {
      const { dataQuery, countQuery } = pageQueries(filters)
      const [countRes, dataRes] = await Promise.all([
        countQuery,
        dataQuery.range(requestedOffset, requestedOffset + PAGE_SIZE - 1),
      ])
      pageResult = {
        count: countRes.count,
        countError: countRes.error,
        data: dataRes.data as LinkRow[] | null,
        dataError: dataRes.error,
        dataQuery,
      }
    }
  }

  const count = pageResult.count ?? 0
  const totalPages = Math.ceil(count / PAGE_SIZE)
  // Clamp so an over-range ?page=9999 doesn't render the empty state.
  const page = Math.min(requestedPage, Math.max(1, totalPages))

  let links = pageResult.data
  let linksError = pageResult.dataError
  if (!pageResult.countError && page !== requestedPage && pageResult.dataQuery) {
    // Rare path (hand-edited URL past the last page): refetch just the
    // clamped page instead of showing the empty result of the over-range one.
    const offset = (page - 1) * PAGE_SIZE
    const clamped = await pageResult.dataQuery.range(offset, offset + PAGE_SIZE - 1)
    links = clamped.data as LinkRow[] | null
    linksError = clamped.error
  }

  // A failed fetch must never render identically to "you have no links yet",
  // so check the error fields explicitly instead of falling through to the
  // empty state below.
  const hasError = Boolean(indexResult.error || pageResult.countError || linksError)
  if (hasError) {
    console.error('[links] query error:', {
      indexError: indexResult.error,
      countError: pageResult.countError,
      linksError,
    })
  }
  if (campaignsResult.error) {
    console.error('[links] campaigns query error:', campaignsResult.error)
  }

  const indexed = toIndexed(indexResult.data ?? [], now)
  const campaignList = campaignsResult.data ?? []
  const campaignNames = new Map(campaignList.map((c) => [c.id, c.name]))
  const searchCampaigns = new Set(q ? matchingCampaignIds(campaignList, q) : [])
  const counts = chipCounts(
    indexed.filter((l) => matchesSearch(l, q, searchCampaigns)),
    now
  )
  const liveCount = indexed.filter((l) => l.is_active).length

  const pageLinks = hasError ? [] : (links ?? [])
  const pageLinkIds = pageLinks.map((l) => l.id)

  // Per-link 14-day click sparkline for the rows on this page: one
  // get_clicks_over_time call per link (at most PAGE_SIZE, all in parallel),
  // each returning at most 14 daily totals, on the same IST days as every
  // other chart (sparklineWindow in lib/analytics). The RPC is SECURITY
  // INVOKER, so clicks RLS still limits it to the owner's links. The 30-day
  // windows for the Clicks and Change columns go out in the same wave.
  const { since: windowSince, priorSince } = rangeWindow('30d', now)
  const sparkWindow = sparklineWindow(now)
  const [sparkResults, windows] = await Promise.all([
    Promise.allSettled(
      pageLinkIds.map((id) =>
        supabase.rpc('get_clicks_over_time', { p_link_ids: [id], p_since: sparkWindow.since })
      )
    ),
    getLinkClickWindowsResult({ linkIds: pageLinkIds, priorSince, since: windowSince }),
  ])

  const sparklines: Record<string, number[]> = {}
  sparkResults.forEach((result, i) => {
    const linkId = pageLinkIds[i]
    if (result.status === 'fulfilled' && !result.value.error && result.value.data) {
      sparklines[linkId] = fillDailyClicks(sparkWindow.keys, result.value.data)
      return
    }
    // Only this row goes without a trend (MiniSparkline keeps an empty
    // footprint). The other rows keep theirs.
    console.error('[links] sparkline query error:', {
      linkId,
      error: result.status === 'rejected' ? result.reason : result.value.error,
    })
  })

  const rows: LedgerRow[] = pageLinks.map((link) => {
    const issues = isResourceDropRow(link.short_code)
      ? []
      : linkHealthIssues(link, { now, shortDomain: SHORT_DOMAIN })
    return {
      link,
      kind: destinationKind(link.original_url),
      campaign: link.campaign_id
        ? { name: campaignNames.get(link.campaign_id) ?? null }
        : null,
      clicks30: windows.error ? null : (windows.data.current[link.id] ?? 0),
      prior30: windows.error ? null : (windows.data.prior[link.id] ?? 0),
      spark: sparklines[link.id] ?? [],
      issue: rowIssue(issues),
    }
  })
  const clicksTotal = windows.error ? null : rows.reduce((sum, r) => sum + (r.clicks30 ?? 0), 0)

  const hasActiveFilters = Boolean(q || type !== 'all' || status !== 'all' || show !== 'all' || kind)
  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = (page - 1) * PAGE_SIZE + rows.length

  const description = hasError
    ? undefined
    : `${indexed.length.toLocaleString('en-US')} ${indexed.length === 1 ? 'link' : 'links'}, ${liveCount.toLocaleString('en-US')} live. Clicks are for the last 30 days.`

  return (
    <div className="pb-16 has-[[data-bulk-bar]]:pb-36 sm:has-[[data-bulk-bar]]:pb-24">
      {/* No New link here: the masthead button is always on screen. Export is
          the only action this page owns. */}
      <PageHeader
        title="Links"
        description={description}
        actions={
          rows.length > 0 ? (
            <ExportLinksButton links={pageLinks} totalCount={count} filters={filters} />
          ) : undefined
        }
        actionsClassName="w-auto"
      />

      {hasError ? (
        <div className="rule-open pt-6">
          <p className="text-[15px] text-text-2">
            Could not load your links. Refresh the page to try again.
          </p>
          <Link
            href={buildPageHref(state, page)}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            Try again
          </Link>
        </div>
      ) : (
        <>
          <LinksToolbar counts={counts} />

          {rows.length > 0 ? (
            <>
              {windows.error && (
                <p role="status" className="mb-3 text-[13px] text-text-2">
                  Clicks for the last 30 days did not load, so those columns read n/a. Refresh to try again.
                </p>
              )}
              <LinksTable
                rows={rows}
                showing={{ from, to, total: count }}
                clicksTotal={clicksTotal}
              />
              {totalPages > 1 && (
                <nav
                  aria-label="Pages"
                  className="flex items-center justify-between gap-4 pt-5"
                >
                  <span className="text-[13px] text-text-3 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <PagerLink href={page > 1 ? buildPageHref(state, page - 1) : null}>
                      Previous
                    </PagerLink>
                    <PagerLink href={page < totalPages ? buildPageHref(state, page + 1) : null}>
                      Next
                    </PagerLink>
                  </div>
                </nav>
              )}
            </>
          ) : hasActiveFilters ? (
            <NoMatch q={q} clearSearchHref={buildPageHref(state, 1, { q: true })} />
          ) : (
            <div className="pt-6">
              <p className="text-[15px] text-text-2">
                No links yet. Create one and it shows here with its clicks.
              </p>
              <Link
                href="/dashboard/create"
                className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
              >
                Create a link
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function toIndexed(
  rows: readonly {
    id: string
    short_code: string
    original_url: string
    fallback_url: string | null
    link_type: string | null
    is_active: boolean | null
    expires_at: string | null
    max_clicks: number | null
    total_clicks: number | null
    created_at: string | null
    campaign_id: string | null
  }[],
  now: Date
): IndexedLink[] {
  return rows.map((row) => {
    const drop = isResourceDropRow(row.short_code)
    // Needs a look: a high or medium issue. A paused or quiet link alone is a
    // choice, not a problem, and a Resource Drop row's settings change nothing
    // a visitor sees.
    const needsLook =
      !drop &&
      linkHealthIssues(row, { now, shortDomain: SHORT_DOMAIN }).some(
        (issue) => issue.severity !== 'low'
      )
    return {
      id: row.id,
      short_code: row.short_code,
      original_url: row.original_url,
      link_type: row.link_type,
      is_active: row.is_active,
      expires_at: row.expires_at,
      campaign_id: row.campaign_id,
      kind: destinationKind(row.original_url),
      needsLook,
    }
  })
}

function PagerLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className = cn(buttonVariants({ variant: 'outline', size: 'sm' }))
  if (!href) {
    return (
      <span aria-disabled="true" className={cn(className, 'pointer-events-none border-rule text-text-3')}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

function NoMatch({ q, clearSearchHref }: { q: string; clearSearchHref: string }) {
  const code = q.toLowerCase()
  const canCreate = q !== '' && CUSTOM_CODE.test(code) && !isReservedShortCode(code)
  if (!q) {
    return (
      <div className="pt-6">
        <p className="text-[15px] text-text-2">No links match this filter.</p>
        <Link href="/dashboard/links" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Show all links
        </Link>
      </div>
    )
  }
  return (
    <div className="pt-6">
      <p className="text-[15px] text-text-2 [overflow-wrap:anywhere]">
        No links match &ldquo;{q}&rdquo;.{' '}
        {canCreate ? (
          <>
            Clear the search or create {SHORT_DOMAIN}/{code}.
          </>
        ) : (
          'Try another search or clear it.'
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canCreate && (
          <Link
            href={`/dashboard/create?code=${encodeURIComponent(code)}`}
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Create <span className="font-mono">{SHORT_DOMAIN}/{code}</span>
          </Link>
        )}
        <Link href={clearSearchHref} className={cn(buttonVariants({ variant: 'link' }))}>
          Clear the search
        </Link>
      </div>
    </div>
  )
}
