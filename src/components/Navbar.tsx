'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { buttonVariants } from '@/components/ui/button-variants'
import { Wordmark } from '@/components/Wordmark'
import { cn } from '@/lib/utils'

// One row at every width: the wordmark and one action. The page this renders
// on is the home page, so a Home link would only point at itself.
export function Navbar() {
  const { user } = useAuth()

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-card/80 backdrop-blur-md border border-border pl-5 pr-2 py-1.5 sm:py-2 flex items-center gap-4">
      {/* The after: area grows the 28px wordmark into a 44px target. */}
      <Link
        href="/"
        className="relative rounded-md text-lg text-foreground focus-ring after:absolute after:-inset-2 after:content-['']"
      >
        <Wordmark />
      </Link>

      {/* The logged-out action is the optimistic default (no skeleton on the
          marketing shell); it swaps once a session resolves. min-w stops the
          pill from jumping when 'Sign in' becomes 'Dashboard'. Accounts are
          invite-only, so the logged-out action is sign-in only. */}
      <Link
        href={user ? '/dashboard' : '/login'}
        className={cn(buttonVariants({ size: 'sm' }), 'min-w-[5.75rem]')}
      >
        {user ? 'Dashboard' : 'Sign in'}
      </Link>
    </nav>
  )
}
