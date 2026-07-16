import type { ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'

interface AuthShellProps {
  /** Card heading; when omitted, children render bare inside the Card (e.g. signup success state). */
  title?: string
  description?: string
  children: ReactNode
}

/**
 * Shared chrome for /login and /signup: brand wordmark, low-opacity hero glow,
 * and the auth card. Both pages render through this shell so they cannot drift.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand glow behind the card — same token as the home hero, dimmed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-15"
        style={{ background: 'var(--gradient-hero)' }}
      />

      <div className="relative max-w-md w-full space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block rounded-md text-3xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            tws.<span className="font-[family-name:var(--font-dm-serif)] italic text-primary-text">bio</span>
          </Link>
        </div>

        <Card className="w-full bg-card border-border">
          {title ? (
            <>
              <CardHeader>
                <h1
                  data-slot="card-title"
                  className="font-heading text-2xl leading-snug font-medium"
                >
                  {title}
                </h1>
                {description && <CardDescription>{description}</CardDescription>}
              </CardHeader>
              <CardContent>{children}</CardContent>
            </>
          ) : (
            children
          )}
        </Card>
      </div>
    </div>
  )
}
