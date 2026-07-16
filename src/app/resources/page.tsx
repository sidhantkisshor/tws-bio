import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { resources } from '@/config/resources'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Resources — tws.bio',
  description: 'Trading tools, platforms, and resources curated by @tradingwithsidhant',
}

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-28 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
          Trading{' '}
          <span className="font-[family-name:var(--font-dm-serif)] italic text-primary-text">
            resources
          </span>
        </h1>
        <p className="text-muted-foreground mt-3 mb-10">Tools, platforms, and links I use for trading.</p>

        <div className="space-y-10">
          {resources.map((group) => (
            <section key={group.category}>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">
                {group.category}
              </h2>
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden transition-colors hover:border-primary/30">
                {group.items.map((item) => (
                  <a
                    key={item.title}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
