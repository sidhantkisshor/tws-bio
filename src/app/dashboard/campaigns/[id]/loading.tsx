import { Card, CardContent, CardHeader } from '@/components/ui/card'

// One placeholder row per list item, the height of a BarList row.
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-md bg-muted/50" />
      ))}
    </div>
  )
}

/**
 * Route-level Suspense fallback for /dashboard/campaigns/[id]. Mirrors the
 * detail page's shape (back link + campaign heading with the range picker,
 * clicks-over-time card, 2x2 breakdown grid, links list) so opening a
 * campaign, or switching its range, no longer flashes the campaign-list
 * skeleton.
 */
export default function CampaignDetailLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading campaign</span>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Back link */}
          <div className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:size-10">
            <div className="size-5 rounded bg-muted" />
          </div>
          <div className="min-w-0">
            {/* Campaign name + description */}
            <div className="h-8 w-48 max-w-full rounded-md bg-muted" />
            <div className="mt-1 h-4 w-72 max-w-full rounded bg-muted/50" />
          </div>
        </div>
        {/* Range picker */}
        <div className="h-13 w-48 rounded-lg bg-muted sm:h-10" />
      </div>

      <div className="flex flex-col gap-6">
        {/* Clicks over time: the period total over the chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="h-3.5 w-32 rounded bg-muted" />
            <div className="mt-1 h-8 w-28 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full rounded-md bg-muted/50" />
          </CardContent>
        </Card>

        {/* Referrers / Countries / Browsers / Devices */}
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { title: 'w-24', rows: 7 },
            { title: 'w-24', rows: 7 },
            { title: 'w-20', rows: 6 },
            { title: 'w-16', rows: 3 },
          ].map(({ title, rows }, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader>
                <div className={`h-4 ${title} rounded bg-muted`} />
              </CardHeader>
              <CardContent>
                <ListSkeleton rows={rows} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Links in campaign */}
        <Card className="bg-card border-border gap-0 pb-0">
          <CardHeader className="border-b border-border">
            <div className="h-4 w-32 rounded bg-muted" />
          </CardHeader>
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="mt-1.5 h-3 w-64 max-w-full rounded bg-muted/50" />
                </div>
                <div className="h-4 w-16 shrink-0 rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
