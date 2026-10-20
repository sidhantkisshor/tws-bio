import Link from 'next/link'

const LINK_CLASS =
  'inline-flex min-h-11 items-center rounded-ctl text-accent-text underline decoration-accent-text/40 underline-offset-[3px] transition-colors duration-150 hover:decoration-current focus-ring md:min-h-0'

// One hairline row in the page column. The min-h-11 on touch screens makes
// each link a 44px target; with a pointer the links keep their text height.
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1280px] px-4 pb-8 md:px-10 md:pb-10">
      <div className="flex flex-col gap-x-6 gap-y-1 border-t border-rule pt-4 text-[13px] text-text-2 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
        <p>tws.bio is the private link tool of Trading with Sidhant.</p>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/resources" className={LINK_CLASS}>
            Resources
          </Link>
          <a href="https://tradingwithsidhant.com" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            tradingwithsidhant.com
          </a>
        </nav>
      </div>
    </footer>
  )
}
