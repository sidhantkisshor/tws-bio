import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicNav } from '@/components/PublicNav'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomeInteractive } from '@/components/HomeInteractive'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  // Absolute: the root layout's "%s - tws.bio" template would repeat the name.
  title: { absolute: 'tws.bio - members only' },
  description: 'A private room of Trading with Sidhant. Entry is by invitation.',
  openGraph: {
    title: 'tws.bio: members only',
    description: 'A private room of Trading with Sidhant. Entry is by invitation.',
    url: '/',
    siteName: 'tws.bio',
    type: 'website',
  },
}

/**
 * The home page is static. Its server HTML is the signed-out view: a closed
 * door with one way in (Unlock access, to /login) and one public link. It
 * says little on purpose. A signed-in owner gets the create form and recent
 * links instead, swapped in by HomeInteractive once the session is read in
 * the browser. An anonymous visitor never downloads supabase-js.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <PublicNav>
        <Navbar />
      </PublicNav>

      <main className="flex flex-1 flex-col">
        <HomeInteractive>
          <section className="mx-auto flex w-full max-w-[560px] flex-col items-center py-10 text-center md:py-20">
            <p className="text-[12px] font-medium tracking-[0.18em] text-text-3 uppercase">
              By invitation only
            </p>
            <h1 className="type-display mt-5 text-balance text-ink">You found the door.</h1>
            <div className="rule-total mt-6 w-16" aria-hidden />
            <p className="mt-6 max-w-[40ch] text-base leading-relaxed text-pretty text-text-2 md:text-[17px] md:leading-[1.6]">
              What is behind it stays with the people inside. Members hold a key. Everyone else
              waits to be asked.
            </p>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: 'lg' }), 'mt-8 w-full max-w-[280px]')}
            >
              Unlock access
            </Link>
            <p className="mt-10 text-[13px] text-text-3">
              Not a member yet?{' '}
              <a
                href="https://tws.bio/tools"
                className="rounded-ctl font-mono text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current focus-ring"
              >
                tws.bio/tools
              </a>
            </p>
          </section>
        </HomeInteractive>
      </main>

      <Footer />
    </div>
  )
}
