import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  applyLinkFilters,
  applyLinkSort,
  fillDailyClicks,
  type LinkListParams,
  type SortOption,
  type StatusFilter,
  type TypeFilter,
} from '@/lib/linkFilters'
import { sparklineWindow } from '@/lib/analytics'
import { ExportLinksButton } from '@/components/dashboard/ExportLinksButton'
import { LinksToolbar } from '@/components/dashboard/LinksToolbar'
import { LinksTable } from '@/components/dashboard/LinksTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LinkIcon, AlertTriangle, X } from 'lucide-react'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

const PAGE_SIZE = 20

// The columns LinksTable, LinkActions' dialogs, and ExportLinksButton's
// current-page CSV actually read: narrower than `*` so the ghost columns
// (password_hash, custom_meta, tags, qr_code_url, ...) aren't shipped on
// every page of 20 rows. Those components type their props as the full Row
// but never touch the omitted columns, so rows are cast back at the call
// sites below.
const LINK_COLUMNS =
  'id, short_code, original_url, link_type, total_clicks, is_active, created_at, ios_deep_link, android_deep_link, fallback_url, expires_at, max_clicks'

// Preserves the active search/filter/sort params when linking between
// pagination pages, so "page 2 of an Active-only search" doesn't silently
// reset the view.
function buildPageHref(params: LinkListParams, page: number) {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.type !== 'all') sp.set('type', params.type)
  if (params.status !== 'all') sp.set('status', params.status)
  if (params.sort !== 'created_desc') sp.set('sort', params.sort)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return `/dashboard/links${qs ? `?${qs}` : ''}`
}

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string; sort?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser()

  const {
    page: pageParam,
    q: qParam,
    type: typeParam,
    status: statusParam,
    sort: sortParam,
  } = await searchParams

  const requestedPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  // Cap length defensively: this feeds straight into an ilike pattern in
  // applyLinkFilters.
  const q = (qParam || '').trim().slice(0, 200)
  const type: TypeFilter = typeParam === 'url' || typeParam === 'deep_link' ? typeParam : 'all'
  const status: StatusFilter = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all'
  const sort: SortOption =
    sortParam === 'created_asc' || sortParam === 'clicks_desc' || sortParam === 'clicks_asc'
      ? sortParam
      : 'created_desc'
  const filters: LinkListParams = { q, type, status, sort }

  // Both queries go through the same filter chain as ExportLinksButton's
  // export-all query, so the page count, the rows and the CSV always agree.
  // Only the data query needs an order.
  const countQuery = applyLinkFilters(
    supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    filters
  )
  const dataQuery = applyLinkSort(
    applyLinkFilters(supabase.from('links').select(LINK_COLUMNS).eq('user_id', user!.id), filters),
    sort
  )

  // Count (head-only) and the requested data page run in one parallel wave.
  // The data query only depends on the count for the rare over-range clamp
  // below, so the common case shouldn't pay a sequential round trip for it.
  const requestedOffset = (requestedPage - 1) * PAGE_SIZE
  const [{ count, error: countError }, dataResult] = await Promise.all([
    countQuery,
    dataQuery.range(requestedOffset, requestedOffset + PAGE_SIZE - 1),
  ])

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  // Clamp so an over-range ?page=9999 doesn't render the empty state.
  const page = Math.min(requestedPage, Math.max(1, totalPages))

  let { data: links, error: linksError } = dataResult
  if (!countError && page !== requestedPage) {
    // Rare path (hand-edited URL past the last page): refetch just the
    // clamped page instead of showing the empty result of the over-range one.
    const offset = (page - 1) * PAGE_SIZE
    const clamped = await dataQuery.range(offset, offset + PAGE_SIZE - 1)
    links = clamped.data
    linksError = clamped.error
  }

  // A failed fetch must never render identically to "you have no links yet",
  // so check the error field explicitly instead of falling through the
  // `links && links.length > 0` empty-state branch below.
  const hasError = Boolean(countError || linksError)
  if (hasError) {
    console.error('[links] query error:', { countError, linksError })
  }

  // Per-link 14-day click sparkline for the rows on this page: one
  // get_clicks_over_time call per link (at most PAGE_SIZE, all in parallel),
  // each returning at most 14 daily totals, on the same IST days as every
  // other chart (sparklineWindow in lib/analytics). The raw clicks select this
  // replaces hit the PostgREST row cap on a busy page and then blanked every
  // sparkline. The RPC is SECURITY INVOKER, so clicks RLS still limits it to
  // the owner's links. Skipped on error, since the table isn't rendered then.
  const sparklines: Record<string, number[]> = {}
  const pageLinkIds = hasError ? [] : (links || []).map((l) => l.id)
  if (pageLinkIds.length > 0) {
    const { since, keys } = sparklineWindow(new Date())
    const results = await Promise.allSettled(
      pageLinkIds.map((id) =>
        supabase.rpc('get_clicks_over_time', { p_link_ids: [id], p_since: since })
      )
    )
    results.forEach((result, i) => {
      const linkId = pageLinkIds[i]
      if (result.status === 'fulfilled' && !result.value.error && result.value.data) {
        sparklines[linkId] = fillDailyClicks(keys, result.value.data)
        return
      }
      // Only this row goes without a trend (LinksTable falls back to an empty
      // sparkline). The other rows keep theirs.
      console.error('[links] sparkline query error:', {
        linkId,
        error: result.status === 'rejected' ? result.reason : result.value.error,
      })
    })
  }

  const hasActiveFilters = Boolean(q || type !== 'all' || status !== 'all')

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="font-heading text-2xl text-foreground">Links</h1>
        <div className="flex items-center gap-2">
          {!hasError && links && links.length > 0 && (
            <ExportLinksButton links={links as LinkRow[]} totalCount={count || 0} filters={filters} />
          )}
          <Button render={<Link href="/dashboard/create" />}>
            Create Link
          </Button>
        </div>
      </div>

      {!hasError && <LinksToolbar />}

      {hasError ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">Couldn&apos;t load your links</p>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong. Please try again.
              </p>
            </div>
            <Button render={<Link href="/dashboard/links" />} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : links && links.length > 0 ? (
        <Card className="bg-card border-border overflow-hidden">
          <LinksTable links={links as LinkRow[]} sparklines={sparklines} />

          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({count} links)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button
                    render={<Link href={buildPageHref(filters, page - 1)} />}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                )}
                {page < totalPages && (
                  <Button
                    render={<Link href={buildPageHref(filters, page + 1)} />}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : hasActiveFilters ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-muted p-3">
              <X className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">No links match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term or clear your filters.
              </p>
            </div>
            <Button render={<Link href="/dashboard/links" />} variant="outline">
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-muted p-3">
              <LinkIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">No links yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first link to get started.
              </p>
            </div>
            <Button render={<Link href="/dashboard/create" />}>
              Create Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
