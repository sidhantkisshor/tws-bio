import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomeInteractive } from '@/components/HomeInteractive'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'tws.bio - URL Shortener',
  description: 'Create short links with analytics and mobile deep linking. Free, fast, and secure — sign in to get started.',
  openGraph: {
    title: 'tws.bio — Short links, big impact',
    description:
      'Create short links with analytics and mobile deep linking — by Trading with Sidhant.',
    url: '/',
    siteName: 'tws.bio',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative max-w-5xl mx-auto px-4 pt-28 pb-12 md:py-28 text-center">
          {/* Gradient glow effect (shared brand token) */}
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20"
            style={{ background: 'var(--gradient-hero)' }}
          />
          <h1 className="relative mx-auto max-w-3xl text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Short Links,
            <br />
            <span className="font-[family-name:var(--font-dm-serif)] italic text-primary-text">
              Big Impact
            </span>
          </h1>
          <p className="relative mx-auto max-w-2xl text-muted-foreground text-xl mt-6">
            Create short links with analytics and mobile deep linking. Free, fast, and secure — sign in to get started.
          </p>

          {/* Server-rendered CTAs — in first-byte HTML, no client JS required */}
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'px-6')}>
              Create your first link
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'px-6')}
            >
              Sign in
            </Link>
          </div>

          {/* Static demo ticker chip — the product specimen (server HTML, no JS) */}
          <div className="relative mt-6 flex justify-center">
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

        {/* Features Section */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="text-center mb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Why tws.bio
            </p>
            <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-foreground">
              Built for links that perform
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Analytics */}
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="mb-3 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <CardTitle className="text-foreground font-semibold">Detailed Analytics</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Track clicks, referrers, devices, browsers, and geographic data for every link you create.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2: Deep Linking */}
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="mb-3 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <CardTitle className="text-foreground font-semibold">Mobile Deep Links</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Auto-detect 30+ platforms and create smart links that open directly in iOS and Android apps.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3: Fast & Free */}
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="mb-3 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <CardTitle className="text-foreground font-semibold">Fast & Free</CardTitle>
                <CardDescription className="text-muted-foreground">
                  No ads, no paywalls. Fast redirects and clean short links you can trust.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
