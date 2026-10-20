import { PublicNav } from '@/components/PublicNav'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { resources } from '@/config/resources'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Trading tools, platforms, and resources curated by @tradingwithsidhant',
}

// Bare host for a row ('www.' dropped). The config is fixed, trusted data, but
// a malformed URL still falls back to the raw string instead of throwing.
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www[.]/, '')
  } catch {
    return url
  }
}

export default function ResourcesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      {/* The audience page. The Navbar island shows a signed-in visitor a
          Dashboard link; anonymous visitors never download supabase-js. */}
      <PublicNav>
        <Navbar />
      </PublicNav>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-8 pb-12 md:px-10 md:pt-12 md:pb-20">
        <div className="max-w-[720px]">
          <h1 className="type-title text-ink">Trading resources</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-2">
            Tools, platforms and links Sidhant uses for trading.
          </p>

          <div className="mt-8 grid gap-10 md:mt-10 md:gap-12">
            {resources.map((group) => (
              <section key={group.category} aria-label={group.category} className="rule-open pt-3.5">
                <h2 className="type-h2 mb-3 text-ink">{group.category}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.title}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col gap-1 border-b border-rule py-3 focus-ring sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                      >
                        <span className="min-w-0">
                          <span className="text-[15px] font-medium text-ink transition-colors duration-150 group-hover:text-accent-text">
                            {item.title}
                          </span>
                          <span className="sr-only"> (opens in a new tab)</span>
                          {item.description && (
                            <span className="mt-0.5 block text-[13px] text-text-3">{item.description}</span>
                          )}
                        </span>
                        {/* The destination host is the trust signal: show it before the tap. */}
                        <span className="shrink-0 font-mono text-[13px] text-text-2">{hostOf(item.url)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
