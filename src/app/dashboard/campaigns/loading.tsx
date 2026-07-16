import { Card } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/campaigns. Mirrors the real
 * page's shape (heading + Create Link button row, then a divided list card
 * of campaign rows) so navigation gets a layout-matched skeleton instead of
 * the Overview-shaped /dashboard fallback.
 */
export default function CampaignsLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="h-8 w-36 rounded-md bg-muted" />
        {/* Create Link button */}
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>

      {/* Campaign list card */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-3.5 w-64 max-w-full rounded bg-muted/50 mt-2" />
                </div>
                <div className="h-3.5 w-48 rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
