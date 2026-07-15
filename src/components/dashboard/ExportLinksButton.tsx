'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getShortUrl } from '@/lib/utils'
import type { Database } from '@/types/database'

type LinkRow = Database['public']['Tables']['links']['Row']

function csvEscape(value: string): string {
  // Quote any field containing a comma, quote, or newline; double up embedded quotes.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Client-side CSV export — the links table is already server-rendered into
// the page, so no new endpoint/RPC is needed to close the "no export
// affordance" gap (finding: dashboard-csv-export). Exports exactly the
// currently visible (filtered/sorted) page of links.
export function ExportLinksButton({ links }: { links: LinkRow[] }) {
  function handleExport() {
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

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
      .join('\r\n')

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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={links.length === 0}
      aria-label="Export links as CSV"
    >
      <Download className="size-3.5" />
      Export CSV
    </Button>
  )
}
