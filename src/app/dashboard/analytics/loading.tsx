import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/analytics. Mirrors the real
 * page's shape (heading + range picker, full-width stat card, tall
 * clicks-over-time card, Top Links card, two 2-up breakdown grids) so
 * navigation gets a layout-matched skeleton instead of the Overview-shaped
 * /dashboard fallback jumping into a different silhouette.
 */
export default function AnalyticsLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 rounded-md bg-muted" />
        {/* Range picker */}
        <div className="h-9 w-36 rounded-md bg-muted" />
      </div>

      {/* Total clicks stat */}
      <Card className="bg-card border-border mb-8">
        <CardContent className="pt-6">
          <div className="h-3.5 w-44 rounded bg-muted" />
          <div className="h-7 w-20 rounded bg-muted mt-2" />
          <div className="h-3 w-28 rounded bg-muted mt-2" />
        </CardContent>
      </Card>

      {/* Clicks over time chart */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="h-4 w-36 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>

      {/* Top links */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="h-4 w-24 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>

      {/* Devices / Browsers */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full rounded-md bg-muted/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referrers / Countries */}
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <div className="h-4 w-28 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full rounded-md bg-muted/50" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
