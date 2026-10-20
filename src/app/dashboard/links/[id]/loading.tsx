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
 * Route-level Suspense fallback for /dashboard/links/[id]. Mirrors the
 * detail page's shape (back link, short link heading with destination and
 * type, copy button and range picker, clicks-over-time card, 2x2 breakdown
 * grid) so opening a link, or switching its range, no longer flashes the
 * Links table skeleton.
 */
export default function LinkDetailLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading link</span>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Back link */}
          <div className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:size-10">
            <div className="size-5 rounded bg-muted" />
          </div>
          <div className="min-w-0">
            {/* Short link, destination URL, type and created date */}
            <div className="h-8 w-56 max-w-full rounded-md bg-muted" />
            <div className="mt-1 h-4 w-80 max-w-full rounded bg-muted/50" />
            <div className="mt-2 h-5 w-40 rounded bg-muted/50" />
          </div>
        </div>
        {/* Copy button and range picker */}
        <div className="flex items-center gap-3">
          <div className="size-6 rounded bg-muted/50" />
          <div className="h-13 w-48 rounded-lg bg-muted sm:h-10" />
        </div>
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
      </div>
    </div>
  )
}
