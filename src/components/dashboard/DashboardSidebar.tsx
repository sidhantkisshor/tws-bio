'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  Megaphone,
  Plus,
  LogOut,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Links', href: '/dashboard/links', icon: Link2 },
  { label: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
]

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof navItems)[number]
  active: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-r-md text-sm font-medium transition-colors ${
        active
          ? 'bg-accent text-primary-text border-l-2 border-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  )
}

function CreateLinkButton({
  onClick,
  className = '',
}: {
  onClick?: () => void
  className?: string
}) {
  return (
    <Link
      href="/dashboard/create"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${className}`}
    >
      <Plus className="size-4" />
      Create Link
    </Link>
  )
}

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
        <LogOut className="size-4" />
        Sign out
      </Button>
    </form>
  )
}

function SidebarContent({
  pathname,
  userEmail,
  onNavClick,
}: {
  pathname: string
  userEmail: string
  onNavClick?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5">
        <Link href="/" className="font-bold text-xl text-foreground">
          tws.bio
        </Link>
      </div>

      <div className="px-4 pb-4">
        <CreateLinkButton onClick={onNavClick} />
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <NavItem
              key={item.href}
              item={item}
              active={active}
              onClick={onNavClick}
            />
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="text-muted-foreground text-sm truncate mb-2">
          {userEmail}
        </p>
        <SignOutButton />
      </div>
    </div>
  )
}

export function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r border-border">
        <SidebarContent pathname={pathname} userEmail={userEmail} />
      </aside>
      {/* Spacer for fixed sidebar */}
      <div className="hidden md:block md:w-64 md:flex-shrink-0" />

      {/* Mobile top bar + sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-card border-b border-border">
        <Link href="/" className="font-bold text-xl text-foreground">
          tws.bio
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/create"
            aria-label="Create Link"
            className="flex items-center justify-center rounded-md bg-primary size-9 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-5" />
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent
                pathname={pathname}
                userEmail={userEmail}
                onNavClick={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}
