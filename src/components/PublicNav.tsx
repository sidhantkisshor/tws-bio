import type { ReactNode } from 'react'
import Link from 'next/link'
import { Wordmark } from '@/components/Wordmark'

/**
 * The slim masthead of the public pages (/, /login, /signup, /resources): the
 * wordmark and "by Trading with Sidhant" on one ruled row. A server component
 * with no auth state of its own: each page passes the `Navbar` island as
 * `children` for the signed-in "Dashboard" link. There is no filled button here: the one amber
 * fill on each public page belongs to its main action.
 */
export function PublicNav({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-rule bg-page">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:gap-4 md:h-[60px] md:px-10">
        {/* The after: area grows the wordmark into a 44px target. */}
        <Link
          href="/"
          className="relative rounded-ctl text-[19px] text-ink focus-ring after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
        >
          <Wordmark />
        </Link>
        <span className="min-w-0 truncate text-[13px] text-text-3">by Trading with Sidhant</span>
        {children && <div className="ml-auto flex shrink-0 items-center">{children}</div>}
      </div>
    </header>
  )
}
