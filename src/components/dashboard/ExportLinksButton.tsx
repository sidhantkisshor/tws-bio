'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { getShortUrl } from '@/lib/utils'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

type TypeFilter = 'all' | 'url' | 'deep_link'
type StatusFilter = 'all' | 'active' | 'inactive'
type SortOption = 'created_desc' | 'created_asc' | 'clicks_desc' | 'clicks_asc'

export interface LinksExportFilters {
  q: string
  type: TypeFilter
  status: StatusFilter
  sort: SortOption
}

// Hard ceiling on a single "export all" fetch — guards against an unbounded
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

function linksToCsv(links: LinkRow[]): string {
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
// without the page-level `.range()` cap, so "Export All" exports every
// matching link instead of just the page currently on screen. Mirrors the
// query built server-side in `src/app/dashboard/links/page.tsx` — keep the
// two in sync if the filter set ever changes. RLS is owner-only on `links`,
// and the explicit `user_id` filter matches that same page's belt-and-braces
// scoping.
async function fetchAllFilteredLinks(filters: LinksExportFilters): Promise<LinkRow[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase.from('links').select('*').eq('user_id', user.id)

  if (filters.q) {
    const safeQ = filters.q.replace(/[(),%]/g, '')
    if (safeQ) {
      query = query.or(`short_code.ilike.%${safeQ}%,original_url.ilike.%${safeQ}%`)
    }
  }
  if (filters.type === 'url') {
    query = query.or('link_type.eq.url,link_type.is.null')
  } else if (filters.type === 'deep_link') {
    query = query.eq('link_type', 'deep_link')
  }
  if (filters.status === 'active') {
    query = query.eq('is_active', true)
  } else if (filters.status === 'inactive') {
    query = query.or('is_active.eq.false,is_active.is.null')
  }

  switch (filters.sort) {
    case 'created_asc':
      query = query.order('created_at', { ascending: true })
      break
    case 'clicks_desc':
      query = query.order('total_clicks', { ascending: false, nullsFirst: false })
      break
    case 'clicks_asc':
      query = query.order('total_clicks', { ascending: true, nullsFirst: true })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query.range(0, EXPORT_ROW_LIMIT - 1)
  if (error) throw error
  return data ?? []
}

// Client-side CSV export — the links table is already server-rendered into
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
  links: LinkRow[]
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
          `Exported the first ${allLinks.length.toLocaleString()} of ${totalCount.toLocaleString()} links.`
        )
      }
    } catch {
      toast.error('Failed to export links')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={links.length === 0 || exporting}
      aria-label={
        hasMorePages
          ? `Export all ${totalCount} links matching the current filters as CSV`
          : 'Export links as CSV'
      }
      title={
        hasMorePages
          ? `Exports all ${totalCount.toLocaleString()} matching links, not just this page`
          : undefined
      }
    >
      {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {hasMorePages ? `Export All (${totalCount.toLocaleString()})` : 'Export CSV'}
    </Button>
  )
}
