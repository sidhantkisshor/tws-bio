import Link from 'next/link'

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
        className="rounded-md font-bold text-lg text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        tws.bio
      </Link>
    </nav>
  )
}
