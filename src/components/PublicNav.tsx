import Link from 'next/link'
import { Wordmark } from '@/components/Wordmark'

/**
 * Nav pill for public pages that real visitors open, such as /resources (the
 * link-in-bio page). Same fixed pill as Navbar, so page offsets (pt-28) still
 * clear it, but a server component with no auth state and no menu: the page
 * ships none of Navbar's client JS (useAuth, supabase-js, the Sheet).
 */
export function PublicNav() {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-card/80 backdrop-blur-md border border-border px-6 py-2 flex items-center">
      <Link
        href="/"
        className="relative rounded-md text-lg text-foreground focus-ring after:absolute after:-inset-2 after:content-['']"
      >
        <Wordmark />
      </Link>
    </nav>
  )
}
