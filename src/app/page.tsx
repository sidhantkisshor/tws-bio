import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomeInteractive } from '@/components/HomeInteractive'
import { cn } from '@/lib/utils'
import { dmSerif } from '@/app/fonts'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'tws.bio - URL Shortener',
  description: 'Short links with click analytics and mobile deep linking, for Trading with Sidhant.',
  openGraph: {
    title: 'tws.bio: Short links, big impact',
    description:
      'Create short links with analytics and mobile deep linking, by Trading with Sidhant.',
    url: '/',
    siteName: 'tws.bio',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col overflow-x-clip', dmSerif.variable)}>
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative max-w-5xl mx-auto px-4 pt-28 pb-10 md:pb-16 text-center">
          {/* Gradient glow effect (shared brand token) */}
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20"
            style={{ background: 'var(--gradient-hero)' }}
          />
          <h1 className="relative mx-auto max-w-3xl text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08] tracking-tight">
            Short Links,
            <br />
            <span className="font-[family-name:var(--font-dm-serif)] italic tracking-normal text-primary-text">
              Big Impact
            </span>
          </h1>
          <p className="relative mx-auto max-w-2xl text-muted-foreground text-lg md:text-xl text-balance mt-5">
            Short links with click analytics and mobile deep linking, for Trading with Sidhant.
          </p>

          {/* Static demo ticker chip: the product specimen (server HTML, no JS) */}
          <div className="relative mt-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-md border border-border border-l-2 border-l-primary-text bg-card px-2.5 py-1 font-mono text-sm tabular-nums">
              <span className="text-foreground">tws.bio/yt-live</span>
              <span className="text-muted-foreground">
                · 1,284 clicks <span aria-hidden className="text-primary-text">▴</span>
              </span>
            </span>
          </div>
        </section>

        {/* Interactive Form + Links List */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <HomeInteractive />
        </section>

        {/* What it does: one spec strip in the form column, so the page keeps a
            single left edge. Plain copy for a private tool, no icon tiles. */}
        <section aria-labelledby="spec-heading" className="max-w-2xl mx-auto px-4 pb-20">
          <h2
            id="spec-heading"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            What it does
          </h2>
          <dl className="mt-4 grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-sm font-medium text-foreground">Click analytics</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">
                Referrers, devices, browsers and country for every link.
              </dd>
            </div>
            <div className="py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-sm font-medium text-foreground">Mobile deep links</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">
                30+ platforms detected. Links open in the iOS or Android app.
              </dd>
            </div>
            <div className="py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-sm font-medium text-foreground">Clean redirects</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">
                No ads and no tracking pixels. UTM tags are kept.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <Footer />
    </div>
  )
}
