'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Popover } from '@base-ui/react/popover'
import { buttonVariants } from '@/components/ui/button-variants'
import { Wordmark } from '@/components/Wordmark'
import { ThemeMenu } from '@/components/theme/ThemeMenu'
import { FindLink } from '@/components/dashboard/FindLink'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Links', href: '/dashboard/links' },
  { label: 'Campaigns', href: '/dashboard/campaigns' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Health', href: '/dashboard/health' },
] as const

const SIGN_OUT_FORM_ID = 'dashboard-sign-out'

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function AccountMenu({ email }: { email: string }) {
  const initial = (email.trim()[0] ?? '?').toUpperCase()
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Account: ${email || 'signed in'}`}
        className="focus-ring relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-[13px] font-bold text-ink outline-none transition-[background-color] duration-150 after:absolute after:-inset-1.5 after:content-[''] hover:bg-hover data-popup-open:bg-hover"
      >
        {initial}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(280px,calc(100vw-2rem))] origin-(--transform-origin) rounded-panel border border-edge bg-surface p-4 text-ink shadow-overlay outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <Popover.Title className="type-label">Signed in as</Popover.Title>
            <p className="mt-1 truncate text-sm font-medium" title={email}>
              {email}
            </p>
            <div className="mt-4 border-t border-rule pt-3">
              <p className="mb-2 text-[13px] font-medium text-text-2">
                Theme
              </p>
              <ThemeMenu />
            </div>
            <div className="mt-4 border-t border-rule pt-3">
              {/* The form sits outside the portal (in the masthead); this
                  button submits it through the form attribute. */}
              <button
                type="submit"
                form={SIGN_OUT_FORM_ID}
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
              >
                Sign out
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * The dashboard masthead, replacing the sidebar. Desktop: wordmark, text tabs
 * (active = ink text with a 2px amber underline on the masthead rule), then
 * Find a link, New link and the account button. Phones: row 1 is wordmark +
 * New link + account (56px); row 2 is the tabs in a 44px row that scrolls
 * sideways inside itself. On the Create page New link turns into an outline
 * button, so "Create link" is the only fill there.
 */
export function DashboardMasthead({ userEmail }: { userEmail: string }) {
  const pathname = usePathname() ?? '/dashboard'
  const onCreate = pathname.startsWith('/dashboard/create')

  return (
    <header className="border-b border-rule bg-page">
      <form id={SIGN_OUT_FORM_ID} action="/auth/signout" method="post" hidden />
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center px-4 md:h-[60px] md:flex-nowrap md:gap-8 md:px-10 lg:gap-10">
        <Link
          href="/dashboard"
          className="focus-ring order-1 -ml-1 flex h-14 items-center rounded-ctl px-1 text-[19px] leading-none text-ink outline-none md:h-auto"
        >
          <Wordmark />
          <span className="sr-only">, Overview</span>
        </Link>

        <nav
          aria-label="Main"
          className="scrollbar-none order-3 -mx-4 flex h-11 w-[calc(100%+2rem)] gap-6 overflow-x-auto px-4 md:order-2 md:mx-0 md:h-full md:w-auto md:gap-7 md:overflow-visible md:px-0"
        >
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-ring flex shrink-0 items-center border-b-2 text-sm font-medium whitespace-nowrap outline-none transition-[color,border-color] duration-150 focus-visible:outline-offset-[-2px] md:-mb-px',
                  active
                    ? 'border-accent-fill text-ink'
                    : 'border-transparent text-text-2 hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 md:order-3 md:gap-3">
          <FindLink className="hidden lg:block" />
          <Link
            href="/dashboard/create"
            aria-current={onCreate ? 'page' : undefined}
            className={buttonVariants({ variant: onCreate ? 'outline' : 'default' })}
          >
            New link
          </Link>
          <AccountMenu email={userEmail} />
        </div>
      </div>
    </header>
  )
}
