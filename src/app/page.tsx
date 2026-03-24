import { bio } from '@/config/bio'
import { SocialIcon } from '@/components/SocialIcon'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: `${bio.name} — ${bio.handle}`,
  description: bio.tagline,
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm py-16">
          {/* Profile */}
          <div className="text-center mb-10">
            <Image
              src={bio.avatar}
              alt={bio.name}
              width={80}
              height={80}
              className="rounded-full mx-auto mb-4"
              priority
            />
            <h1 className="text-xl font-bold text-foreground">{bio.name}</h1>
            <p className="text-sm text-muted-foreground">{bio.handle}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{bio.tagline}</p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            {bio.links.map((link) => {
              const isExternal = link.url.startsWith('http')
              return (
                <a
                  key={link.label}
                  href={link.url}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="flex items-center gap-3 w-full px-5 py-3.5 border border-border rounded-lg hover:bg-muted transition text-foreground"
                >
                  <SocialIcon name={link.icon} />
                  <span className="text-sm font-medium">{link.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
