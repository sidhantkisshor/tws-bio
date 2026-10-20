import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/campaigns/[id]. Mirrors the
 * detail page's shape (back link + campaign heading, range picker row,
 * clicks-over-time card, 2x2 breakdown grid, links list) so opening a
 * campaign, or switching its range, no longer flashes the campaign-list
 * skeleton.
 */
export default function CampaignDetailLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 mb-6">
        {/* Back link */}
        <div className="-ml-2 flex size-10 shrink-0 items-center justify-center">
          <div className="size-5 rounded bg-muted" />
        </div>
        <div className="min-w-0 flex-1">
          {/* Campaign name + description */}
          <div className="h-8 w-48 max-w-full rounded-md bg-muted" />
          <div className="h-4 w-72 max-w-full rounded bg-muted/50 mt-1" />
        </div>
      </div>

      {/* Range picker + clicks and link count */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="h-10 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-36 rounded bg-muted/50" />
      </div>

      {/* Clicks over time chart */}
      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <div className="h-4 w-36 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>

      {/* Referrers / Devices / Countries / Browsers */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full rounded-md bg-muted/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Links in campaign */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="border-b border-border">
          <div className="h-4 w-32 rounded bg-muted" />
        </CardHeader>
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-64 max-w-full rounded bg-muted/50 mt-1.5" />
              </div>
              <div className="h-4 w-16 shrink-0 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
