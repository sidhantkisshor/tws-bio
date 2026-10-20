import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicNav } from '@/components/PublicNav'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomeInteractive } from '@/components/HomeInteractive'
import { SignInPanel } from '@/components/auth/SignInPanel'

export const metadata: Metadata = {
  // Absolute: the root layout's "%s - tws.bio" template would repeat the name.
  title: { absolute: 'tws.bio - the link desk for Trading with Sidhant' },
  description:
    'Every tws.bio link in a video, a post or a course email starts here. Find the YouTube channel, courses, tools, Telegram and the Hitpoint app.',
  openGraph: {
    title: 'tws.bio: the link desk for Trading with Sidhant',
    description:
      'Every tws.bio link in a video, a post or a course email starts here. Find the YouTube channel, courses, tools, Telegram and the Hitpoint app.',
    url: '/',
    siteName: 'tws.bio',
    type: 'website',
  },
}

// The places a follower usually wants when a short link brought them here
// and it ended or was typed wrong. Real addresses only; `shown` is what the
// visitor reads, so it stays short and recognisable.
const DESTINATIONS: { name: string; href: string; shown: string; internal?: boolean }[] = [
  { name: 'YouTube channel', href: 'https://www.youtube.com/@tradingwithsidhant', shown: 'youtube.com/@tradingwithsidhant' },
  { name: 'Courses and cohorts', href: 'https://twsgurukulx.com', shown: 'twsgurukulx.com' },
  { name: 'Trading tools and resources', href: '/resources', shown: 'tws.bio/resources', internal: true },
  { name: 'Telegram channel', href: 'https://t.me/tradingwsidhant', shown: 't.me/tradingwsidhant' },
  { name: 'Hitpoint app', href: 'https://hitpoint.app', shown: 'hitpoint.app' },
]

// Each row is a link, so it reads as one at rest: the address is set in the
// accent text color, and the whole row takes the hover tint.
const ROW_CLASS =
  'group flex flex-col gap-0.5 border-b border-rule py-3.5 text-ink transition-colors duration-150 hover:bg-hover focus-ring sm:flex-row sm:items-baseline sm:justify-between sm:gap-4'

function DestinationRow({ name, href, shown, internal }: (typeof DESTINATIONS)[number]) {
  const inner = (
    <>
      <span className="text-[15px] font-medium transition-colors duration-150 group-hover:text-accent-text">
        {name}
      </span>
      <span className="font-mono text-[13px] text-accent-text underline decoration-accent-text/40 underline-offset-[3px] [overflow-wrap:anywhere] group-hover:decoration-current sm:text-right">
        {shown}
      </span>
    </>
  )
  return (
    <li>
      {internal ? (
        <Link href={href} className={ROW_CLASS}>
          {inner}
        </Link>
      ) : (
        <a href={href} className={ROW_CLASS}>
          {inner}
        </a>
      )}
    </li>
  )
}

/**
 * The home page is static. Its server HTML is the signed-out view: the link
 * desk for a follower whose link ended, and the team sign-in panel. A
 * signed-in owner gets the create form and recent links instead, swapped in
 * by HomeInteractive once the session is read in the browser. An anonymous
 * visitor never downloads supabase-js.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <PublicNav>
        <Navbar />
      </PublicNav>

      <main className="flex-1">
        <HomeInteractive>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
            <div className="min-w-0">
              <h1 className="type-display max-w-[14ch] text-balance text-ink">
                The link desk for Trading with Sidhant.
              </h1>
              <p className="mt-5 mb-7 max-w-[52ch] text-base leading-relaxed text-pretty text-text-2 md:mt-6 md:mb-8 md:text-[17px] md:leading-[1.6]">
                Every tws.bio link in a video, a post or a course email starts here. If a link brought
                you to this page, it may have ended or been typed wrong. These are the places people
                usually want:
              </p>
              <ul className="max-w-[560px] rule-open">
                {DESTINATIONS.map((d) => (
                  <DestinationRow key={d.href} {...d} />
                ))}
              </ul>
            </div>
            <SignInPanel className="w-full max-w-[460px] lg:max-w-none" />
          </div>
        </HomeInteractive>
      </main>

      <Footer />
    </div>
  )
}
