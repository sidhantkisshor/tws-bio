'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'

export function Navbar() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-card/80 backdrop-blur-md border border-border px-6 py-2 flex items-center gap-6">
      {/* Brand */}
      <Link href="/" className="font-bold text-lg text-foreground">
        tws.bio
      </Link>

      {/* Desktop nav links — the logged-out set is the optimistic default (no
          skeleton on the marketing shell); it swaps once a session resolves. */}
      <div className="hidden md:flex items-center gap-4">
        {user ? (
          <>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Button render={<Link href="/dashboard" />} size="sm">
              Dashboard
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Button render={<Link href="/signup" />} size="sm">
              Sign up
            </Button>
          </>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Open menu" />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="p-6">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-4">
              {user ? (
                <>
                  <SheetClose
                    render={
                      <Link
                        href="/"
                        className="text-sm text-foreground hover:text-muted-foreground transition-colors"
                      />
                    }
                  >
                    Home
                  </SheetClose>
                  <SheetClose
                    render={
                      <Link
                        href="/dashboard"
                        className="text-sm text-foreground hover:text-muted-foreground transition-colors"
                      />
                    }
                  >
                    Dashboard
                  </SheetClose>
                </>
              ) : (
                <>
                  <SheetClose
                    render={
                      <Link
                        href="/"
                        className="text-sm text-foreground hover:text-muted-foreground transition-colors"
                      />
                    }
                  >
                    Home
                  </SheetClose>
                  <SheetClose
                    render={
                      <Link
                        href="/login"
                        className="text-sm text-foreground hover:text-muted-foreground transition-colors"
                      />
                    }
                  >
                    Log in
                  </SheetClose>
                  <SheetClose
                    render={
                      <Link
                        href="/signup"
                        className={cn(buttonVariants({ size: 'sm' }), 'w-full')}
                      />
                    }
                  >
                    Sign up
                  </SheetClose>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
