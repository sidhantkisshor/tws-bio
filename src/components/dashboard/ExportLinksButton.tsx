'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { applyLinkFilters, applyLinkSort, chunkIds, sortLinks, type LinkListParams } from '@/lib/linkFilters'
import { getShortUrl } from '@/lib/utils'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']
/** The columns the CSV holds. Pages pass rows with at least these. */
export type ExportRow = Pick<
  LinkRow,
  'id' | 'short_code' | 'original_url' | 'link_type' | 'is_active' | 'total_clicks' | 'created_at'
>
const EXPORT_COLUMNS = 'id, short_code, original_url, link_type, is_active, total_clicks, created_at'
// PostgREST returns at most this many rows per response (its max-rows).
const PAGE_ROWS = 1000

export type LinksExportFilters = LinkListParams

// Hard ceiling on a single "export all" fetch: guards against an unbounded
// request if an account somehow accumulates an enormous number of links.
// Far above realistic dashboard usage; if it's ever hit the CSV is still
// produced (just truncated), and the user is told so via toast rather than
// left guessing why the row count looks short.
const EXPORT_ROW_LIMIT = 5000

function csvEscape(value: string): string {
  // Quote any field containing a comma, quote, or newline; double up embedded quotes.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function linksToCsv(links: readonly ExportRow[]): string {
  const headers = ['Short Code', 'Short URL', 'Original URL', 'Type', 'Status', 'Total Clicks', 'Created At']
  const rows = links.map((link) => [
    link.short_code,
    getShortUrl(link.short_code),
    link.original_url,
    link.link_type === 'deep_link' ? 'Deep Link' : 'URL',
    link.is_active ? 'Active' : 'Inactive',
    String(link.total_clicks ?? 0),
    link.created_at ?? '',
  ])

  return [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
    .join('\r\n')
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `tws-bio-links-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// Re-runs the Links page's search/filter/sort against the `links` table
// without the page-level cap, so "Export All" exports every matching link
// instead of just the page currently on screen. The page builds its own
// queries with the same linkFilters helpers, so the CSV and the table always
// pick the same rows. RLS is owner-only on `links`, and the explicit
// `user_id` filter matches that same page's belt-and-braces scoping.
//
// PostgREST caps one response at 1000 rows, so the rows come in pages. A
// chip's id list can be thousands long, too long for one request URL, so it
// goes in chunks (chunkIds) and the merged rows are sorted again (sortLinks).
async function fetchAllFilteredLinks(filters: LinksExportFilters): Promise<ExportRow[]> {
  // Loaded on first export, not with the page, so supabase-js stays out of
  // the Links page's initial bundle for an owner who only reads the table.
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  async function fetchAll(part: LinksExportFilters): Promise<ExportRow[]> {
    const rows: ExportRow[] = []
    while (rows.length < EXPORT_ROW_LIMIT) {
      const from = rows.length
      const to = Math.min(from + PAGE_ROWS, EXPORT_ROW_LIMIT) - 1
      const query = applyLinkSort(
        applyLinkFilters(supabase.from('links').select(EXPORT_COLUMNS).eq('user_id', user!.id), part),
        part.sort
      ).order('id', { ascending: true })
      const { data, error } = await query.range(from, to)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < to - from + 1) break
    }
    return rows
  }

  if (!filters.ids) return fetchAll(filters)
  const parts = await Promise.all(chunkIds(filters.ids).map((ids) => fetchAll({ ...filters, ids })))
  return sortLinks(parts.flat(), filters.sort).slice(0, EXPORT_ROW_LIMIT)
}

// Client-side CSV export: the links table is already server-rendered into
// the page, so no new endpoint/RPC is needed to close the "no export
// affordance" gap (finding: dashboard-csv-export). When the current
// filters span more than one page, the button switches to "Export All" and
// re-queries every matching link instead of silently exporting just the
// visible page (finding: links-export-silent-page-truncation).
export function ExportLinksButton({
  links,
  totalCount,
  filters,
}: {
  links: readonly ExportRow[]
  totalCount: number
  filters: LinksExportFilters
}) {
  const [exporting, setExporting] = useState(false)
  const hasMorePages = totalCount > links.length

  async function handleExport() {
    if (!hasMorePages) {
      downloadCsv(linksToCsv(links))
      return
    }

    setExporting(true)
    try {
      const allLinks = await fetchAllFilteredLinks(filters)
      downloadCsv(linksToCsv(allLinks))
      if (allLinks.length < totalCount) {
        toast.warning(
          `Exported the first ${allLinks.length.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} links.`
        )
      }
    } catch {
      toast.error('Could not export the links. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={links.length === 0 || exporting}
      title={
        hasMorePages
          ? `Exports all ${totalCount.toLocaleString('en-US')} matching links, not just this page`
          : undefined
      }
    >
      {exporting
        ? 'Exporting...'
        : hasMorePages
          ? (
            // One span, so the button's flex gap never splits the words.
            <span>
              Export all {totalCount.toLocaleString('en-US')}
              <span className="sr-only"> matching links</span> as CSV
            </span>
          )
          : 'Export CSV'}
    </Button>
  )
}
