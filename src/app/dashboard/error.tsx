'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

/**
 * Dashboard-level error boundary. Catches a thrown error from any /dashboard
 * route, so the failure shows inside the dashboard shell (masthead, theme)
 * instead of Next.js's bare error page. One plain line, then the two ways on.
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
    <div className="pt-7 md:pt-10">
      <h1 className="type-title text-ink">This page did not load</h1>
      <div className="rule-open mt-6 max-w-xl pt-4">
        <p className="text-sm leading-relaxed text-text-2">
          Something went wrong while loading this page. Try again, or go back to the Overview.
          {error.digest && (
            <span className="mt-1 block text-[13px] text-text-3">
              Reference: <span className="font-mono">{error.digest}</span>
            </span>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
            Back to Overview
          </Link>
        </div>
      </div>
    </div>
  )
}
