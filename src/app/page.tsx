import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomeInteractive } from '@/components/HomeInteractive'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'tws.bio - URL Shortener',
  description: 'Create short links with analytics and mobile deep linking. Free, fast, no account required.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-4 pt-28 pb-12 md:py-28">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Short Links,
            <br />
            <span className="font-[family-name:var(--font-dm-serif)] italic text-primary">
              Big Impact
            </span>
          </h1>
          <p className="text-muted-foreground text-xl mt-6 max-w-2xl">
            Create short links with analytics and mobile deep linking. Free, fast, no account required.
          </p>
        </section>

        {/* Interactive Form + Links List */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <HomeInteractive />
        </section>

        {/* Features Section */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Analytics */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="mb-3">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="mb-3">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="mb-3">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <CardTitle className="text-foreground font-semibold">Fast & Free</CardTitle>
                <CardDescription className="text-muted-foreground">
                  No rate limits, no ads, no tracking. Just fast redirects and clean short URLs you can trust.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Powered by badge */}
        <section className="pb-8">
          <p className="text-center">
            <a
              href="https://tradingwithsidhant.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Powered by Trading with Sidhant
            </a>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
