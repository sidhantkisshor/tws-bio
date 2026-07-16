import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { ExportLinksButton } from '@/components/dashboard/ExportLinksButton'
import { LinksToolbar } from '@/components/dashboard/LinksToolbar'
import { LinksTable } from '@/components/dashboard/LinksTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LinkIcon, AlertTriangle, X } from 'lucide-react'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

const PAGE_SIZE = 20
const SPARKLINE_DAYS = 14

// The columns LinksTable, LinkActions' dialogs, and ExportLinksButton's
// current-page CSV actually read — narrower than `*` so the ghost columns
// (password_hash, custom_meta, tags, qr_code_url, ...) aren't shipped on
// every page of 20 rows. Those components type their props as the full Row
// but never touch the omitted columns, so rows are cast back at the call
// sites below.
const LINK_COLUMNS =
  'id, short_code, original_url, link_type, total_clicks, is_active, created_at, ios_deep_link, android_deep_link, fallback_url, expires_at, max_clicks'

type TypeFilter = 'all' | 'url' | 'deep_link'
type StatusFilter = 'all' | 'active' | 'inactive'
type SortOption = 'created_desc' | 'created_asc' | 'clicks_desc' | 'clicks_asc'

// Preserves the active search/filter/sort params when linking between
// pagination pages, so "page 2 of an Active-only search" doesn't silently
// reset the view.
function buildPageHref(
  params: { q: string; type: TypeFilter; status: StatusFilter; sort: SortOption },
  page: number
) {
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
  // Cap length defensively — this feeds directly into an ilike pattern below.
  const q = (qParam || '').trim().slice(0, 200)
  const type: TypeFilter = typeParam === 'url' || typeParam === 'deep_link' ? typeParam : 'all'
  const status: StatusFilter = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all'
  const sort: SortOption =
    sortParam === 'created_asc' || sortParam === 'clicks_desc' || sortParam === 'clicks_asc'
      ? sortParam
      : 'created_desc'

  let countQuery = supabase
    .from('links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
  let dataQuery = supabase.from('links').select(LINK_COLUMNS).eq('user_id', user!.id)

  if (q) {
    // `.or()` takes a raw PostgREST filter string — strip characters that
    // would break its `col.op.val,col.op.val` grammar rather than trying to
    // escape them.
    const safeQ = q.replace(/[(),%]/g, '')
    if (safeQ) {
      const orFilter = `short_code.ilike.%${safeQ}%,original_url.ilike.%${safeQ}%`
      countQuery = countQuery.or(orFilter)
      dataQuery = dataQuery.or(orFilter)
    }
  }
  if (type === 'url') {
    // Rows created before link_type existed (or via the untyped RPC) have a
    // null link_type, which the rest of the app already treats as "URL".
    countQuery = countQuery.or('link_type.eq.url,link_type.is.null')
    dataQuery = dataQuery.or('link_type.eq.url,link_type.is.null')
  } else if (type === 'deep_link') {
    countQuery = countQuery.eq('link_type', 'deep_link')
    dataQuery = dataQuery.eq('link_type', 'deep_link')
  }
  if (status === 'active') {
    countQuery = countQuery.eq('is_active', true)
    dataQuery = dataQuery.eq('is_active', true)
  } else if (status === 'inactive') {
    countQuery = countQuery.or('is_active.eq.false,is_active.is.null')
    dataQuery = dataQuery.or('is_active.eq.false,is_active.is.null')
  }

  switch (sort) {
    case 'created_asc':
      dataQuery = dataQuery.order('created_at', { ascending: true })
      break
    case 'clicks_desc':
      dataQuery = dataQuery.order('total_clicks', { ascending: false, nullsFirst: false })
      break
    case 'clicks_asc':
      dataQuery = dataQuery.order('total_clicks', { ascending: true, nullsFirst: true })
      break
    default:
      dataQuery = dataQuery.order('created_at', { ascending: false })
  }

  // Count (head-only) and the requested data page run in one parallel wave —
  // the data query only depends on the count for the rare over-range clamp
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

  // A failed fetch must never render identically to "you have no links yet"
  // — check the error field explicitly instead of falling through the
  // `links && links.length > 0` empty-state branch below.
  const hasError = Boolean(countError || linksError)
  if (hasError) {
    console.error('[links] query error:', { countError, linksError })
  }

  // Per-link 14-day click sparkline data, scoped to just the links rendered
  // on this page (bounded, RLS-safe — same `clicks` table + link_id pattern
  // the Overview page already uses for its chart). Gives each row a trend
  // signal instead of a bare cumulative number (finding:
  // links-per-link-sparklines).
  const sparklines: Record<string, number[]> = {}
  const pageLinkIds = (links || []).map((l) => l.id)
  if (pageLinkIds.length > 0) {
    const since = new Date(Date.now() - (SPARKLINE_DAYS - 1) * 24 * 60 * 60 * 1000)
    const sinceUTC = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()))

    const { data: sparkClicks, error: sparkError, count: sparkCount } = await supabase
      .from('clicks')
      .select('link_id, clicked_at', { count: 'exact' })
      .in('link_id', pageLinkIds)
      .gte('clicked_at', sinceUTC.toISOString())

    if (sparkError) {
      console.error('[links] sparkline query error:', sparkError)
    }
    const sparkRowsTruncated =
      !sparkError && sparkCount !== null && (sparkClicks?.length || 0) < sparkCount
    if (sparkRowsTruncated) {
      console.warn('[links] sparkline rows exceeded the API cap; hiding incomplete trends')
    }

    const byLinkDay = new Map<string, Map<string, number>>()
    for (const click of sparkRowsTruncated ? [] : sparkClicks || []) {
      if (!click.clicked_at) continue
      const day = click.clicked_at.slice(0, 10)
      const dayMap = byLinkDay.get(click.link_id) || new Map<string, number>()
      dayMap.set(day, (dayMap.get(day) || 0) + 1)
      byLinkDay.set(click.link_id, dayMap)
    }

    const days = Array.from({ length: SPARKLINE_DAYS }, (_, i) => {
      const d = new Date(sinceUTC.getTime() + i * 24 * 60 * 60 * 1000)
      return d.toISOString().slice(0, 10)
    })

    for (const id of pageLinkIds) {
      const dayMap = byLinkDay.get(id)
      sparklines[id] = days.map((d) => dayMap?.get(d) || 0)
    }
  }

  const filters = { q, type, status, sort }
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
