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
 * Route-level Suspense fallback for /dashboard/analytics. Mirrors the real
 * page's shape (heading + range picker, clicks-over-time card with its total,
 * Top Links, then the four breakdown lists) so navigation gets a
 * layout-matched skeleton instead of the Overview-shaped /dashboard fallback
 * jumping into a different silhouette.
 */
export default function AnalyticsLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading analytics</span>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-32 rounded-md bg-muted" />
        {/* Range picker (TimeRangePicker's four tabs) */}
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

        {/* Top links */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="h-4 w-24 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <ListSkeleton rows={10} />
          </CardContent>
        </Card>

        {/* Referrers / Countries / Browsers / Devices */}
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { title: 'w-28', rows: 7 },
            { title: 'w-28', rows: 7 },
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
      </div>
    </div>
  )
}
