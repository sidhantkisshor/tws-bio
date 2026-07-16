import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border py-8 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-muted-foreground text-sm font-medium">tws.bio</p>
        <p className="text-muted-foreground text-sm mt-1">
          by{' '}
          <a
            href="https://tradingwithsidhant.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Trading with Sidhant
          </a>
        </p>
        <nav className="mt-3">
          <Link
            href="/resources"
            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Resources
          </Link>
        </nav>
        <p className="text-muted-foreground text-xs mt-3">
          &copy; {new Date().getFullYear()} Trading with Sidhant. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
