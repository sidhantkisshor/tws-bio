'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { buttonVariants } from '@/components/ui/button-variants'

/**
 * The home masthead's client island: a "Dashboard" link for a signed-in
 * visitor, nothing for anyone else. It sits in `PublicNav`'s right slot. It is
 * an outline button, not a fill, because the page's one amber fill is its main
 * action (Sign in, or Create link for the owner). An anonymous visitor never
 * downloads supabase-js: useAuth settles from the cookie check alone.
 */
export function Navbar() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
      Dashboard
    </Link>
  )
}
