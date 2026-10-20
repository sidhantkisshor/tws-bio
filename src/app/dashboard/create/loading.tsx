import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/create. Mirrors the real
 * page's shape (back link, heading, then the centered form card with its URL
 * row, two fields and the advanced-options toggle) so navigation gets a
 * form-shaped skeleton instead of the Overview-shaped /dashboard fallback.
 */
export default function CreateLinkLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      {/* Back to dashboard */}
      <div className="h-5 w-36 rounded bg-muted/50 mb-4" />
      <div className="h-8 w-36 rounded-md bg-muted mb-6" />

      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="h-6 w-44 rounded bg-muted" />
            <div className="h-4 w-64 max-w-full rounded bg-muted/50" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Long URL + submit button */}
            <div>
              <div className="h-3.5 w-20 rounded bg-muted mb-2" />
              <div className="flex gap-2">
                <div className="h-10 min-w-0 flex-1 rounded-lg bg-muted/50" />
                <div className="h-10 w-24 shrink-0 rounded-lg bg-muted" />
              </div>
            </div>
            {/* Custom short code / Campaign */}
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <div className="h-3.5 w-44 rounded bg-muted mb-2" />
                <div className="h-10 w-full rounded-lg bg-muted/50" />
              </div>
            ))}
            {/* Advanced options toggle */}
            <div className="h-4 w-56 max-w-full rounded bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
