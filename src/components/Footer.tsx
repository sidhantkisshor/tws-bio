import Link from 'next/link'
import { Wordmark } from '@/components/Wordmark'

// One compact row in the same column as the page content (max-w-2xl). The
// min-h-11 on touch screens makes each link a 44px target; with a pointer the
// links keep their text height.
export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p className="flex flex-wrap items-center justify-center gap-x-2">
          <Wordmark className="text-sm text-muted-foreground" />
          <span>
            by{' '}
            <a
              href="https://tradingwithsidhant.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 transition-colors hover:text-foreground focus-ring md:min-h-0"
            >
              Trading with Sidhant
            </a>
          </span>
        </p>
        <nav className="flex items-center gap-4">
          <Link
            href="/resources"
            className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 transition-colors hover:text-foreground focus-ring md:min-h-0"
          >
            Resources
          </Link>
          <span className="text-xs">&copy; {new Date().getFullYear()}</span>
        </nav>
      </div>
    </footer>
  )
}
