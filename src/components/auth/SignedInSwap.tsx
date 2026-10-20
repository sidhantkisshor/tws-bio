'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

/**
 * The client island of /login and /signup. The server HTML is the signed-out
 * panel (`children`), so both pages stay static. Once useAuth confirms a
 * session, the panel is swapped for a short "You are signed in" note with the
 * way to the dashboard: asking a signed-in owner to sign in again only
 * confuses. It keys on the user, not on the cookie alone, so a stale cookie
 * never sends someone to a dashboard that bounces them back here. An
 * anonymous visitor never downloads supabase-js: useAuth settles from the
 * cookie check alone.
 */
export function SignedInSwap({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <>{children}</>

  return (
    <section
      aria-labelledby="signed-in-heading"
      className="grid gap-4 rounded-panel border border-rule bg-surface p-5 sm:p-8"
    >
      <div className="grid gap-1.5">
        <h1 id="signed-in-heading" className="type-h2 text-ink">
          You are signed in.
        </h1>
        {user.email && (
          <p className="text-[13px] leading-normal break-words text-text-2">As {user.email}</p>
        )}
      </div>
      <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
        Open the dashboard
      </Link>
    </section>
  )
}
