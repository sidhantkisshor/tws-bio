'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Dashboard-level error boundary. Catches thrown errors from any query in
 * an /dashboard route (Overview, Links, Analytics, Campaigns, and their
 * detail pages) so a failure renders inside the dashboard shell (sidebar,
 * dark theme, nav) instead of Next.js's bare default error page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] route error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-24">
      <Card className="bg-card border-border max-w-md w-full">
        <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="font-heading text-lg text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load this page. You can try again, or head back
            to the overview.
          </p>
          <div className="flex gap-3 mt-2">
            <Button onClick={() => reset()}>Try again</Button>
            <Button render={<Link href="/dashboard" />} variant="outline">
              Back to Overview
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
