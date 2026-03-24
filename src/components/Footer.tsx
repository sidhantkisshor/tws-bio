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
        <p className="text-muted-foreground text-xs mt-3">
          &copy; 2025 Trading with Sidhant. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
