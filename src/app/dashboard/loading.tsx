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
      <div className="h-8 w-40 rounded-md bg-muted animate-pulse mb-6" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-7 w-14 rounded bg-muted animate-pulse mt-2" />
                </div>
                <div className="h-6 w-6 rounded bg-muted animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart card */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="h-4 w-52 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full rounded-md bg-muted/50 animate-pulse" />
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          <div className="h-4 w-14 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-muted/50 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
