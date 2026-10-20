import type { ReactNode } from 'react'
import { PublicNav } from '@/components/PublicNav'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

/**
 * Shared frame for /login and /signup: the public masthead, one narrow column
 * for the panel, and the footer. Both pages render through this frame so they
 * cannot drift. The Navbar island shows a signed-in visitor a Dashboard
 * link; an anonymous visitor never downloads supabase-js (useAuth reads the
 * session cookie first).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <PublicNav>
        <Navbar />
      </PublicNav>
      <main className="mx-auto w-full max-w-[460px] flex-1 px-4 pt-10 pb-12 sm:pt-16 md:pt-[88px] md:pb-[88px]">
        {children}
      </main>
      <Footer />
    </div>
  )
}
