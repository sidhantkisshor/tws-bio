import { Card, CardContent } from '@/components/ui/card'

/**
 * Route-level Suspense fallback for /dashboard/create. Mirrors the real
 * page's shape (back chevron, heading, then the form card with its URL
 * row, two fields and the advanced-options toggle) so navigation gets a
 * form-shaped skeleton instead of the Overview-shaped /dashboard fallback.
 */
export default function CreateLinkLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="max-w-2xl">
        {/* Back chevron + title (PageHeader) */}
        <div className="mb-6 flex items-center gap-2">
          <div className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:size-10">
            <div className="size-5 rounded bg-muted" />
          </div>
          <div className="h-8 w-36 rounded-md bg-muted" />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="space-y-4">
            {/* Long URL + submit button */}
            <div>
              <div className="h-3.5 w-20 rounded bg-muted mb-2" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="h-11 min-w-0 rounded-lg bg-muted/50 sm:h-9 sm:flex-1" />
                <div className="h-11 w-full shrink-0 rounded-lg bg-muted sm:h-9 sm:w-24" />
              </div>
            </div>
            {/* Custom short code / Campaign */}
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <div className="h-3.5 w-44 rounded bg-muted mb-2" />
                <div className="h-11 w-full rounded-lg bg-muted/50 sm:h-9" />
              </div>
            ))}
            {/* Advanced options toggle */}
            <div className="flex h-11 items-center sm:h-5">
              <div className="h-4 w-56 max-w-full rounded bg-muted/50" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
