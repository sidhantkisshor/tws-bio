import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for the /dashboard segment. Mirrors the
 * Overview page's shape (heading + stat-card grid + chart card + table
 * card) using the shared Card primitives. Any nested dashboard route that
 * doesn't define its own loading.tsx falls back to this boundary too, so
 * navigation into the dashboard never shows a blank screen while the
 * server component's queries resolve.
 */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="h-8 w-40 rounded-md bg-muted" />
      </div>

      {/* Stat strip: the same joined cells as the page */}
      <div className="mb-8">
        <div className="mb-3 h-3 w-64 max-w-full rounded bg-muted" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-foreground/10 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card p-4 sm:p-5">
              <div className="h-3.5 w-20 rounded bg-muted" />
              <div className="mt-2 flex h-8 items-center sm:h-9">
                <div className="h-7 w-14 rounded bg-muted" />
              </div>
              <div className="mt-1.5 h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart card */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="h-4 w-52 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-14 rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-muted/50" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
