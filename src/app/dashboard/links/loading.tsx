import { Card, CardContent } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/links. Mirrors the real
 * page's shape (heading + toolbar row + table) so a hard navigation (first
 * load, full page refresh) gets a layout-matched skeleton instead of the
 * generic /dashboard fallback or a blank screen (finding:
 * links-toolbar-pending-feedback — the toolbar itself covers the in-page
 * search/filter/sort transitions via isPending).
 */
export default function LinksLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Toolbar: search + type/status/sort selects */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="h-9 flex-1 min-w-0 sm:max-w-xs rounded-md bg-muted animate-pulse" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-[130px] rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-[130px] rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-[150px] rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Table card */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border px-4 py-3 hidden md:flex gap-4">
            {['Short Code', 'Original URL', 'Type', 'Clicks', 'Status', 'Created', 'Actions'].map(
              (label) => (
                <div key={label} className="h-3.5 w-20 rounded bg-muted animate-pulse" />
              )
            )}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 w-full px-4 py-3 flex items-center">
                <div className="h-4 w-full rounded bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
