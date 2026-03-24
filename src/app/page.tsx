import { bio } from '@/config/bio'
import { SocialIcon } from '@/components/SocialIcon'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: `${bio.name} — ${bio.handle}`,
  description: bio.tagline,
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
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
          <h1 className="text-xl font-bold text-gray-900">{bio.name}</h1>
          <p className="text-sm text-gray-500">{bio.handle}</p>
          <p className="text-sm text-gray-400 mt-1">{bio.tagline}</p>
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
                className="flex items-center gap-3 w-full px-5 py-3.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-900"
              >
                <SocialIcon name={link.icon} />
                <span className="text-sm font-medium">{link.label}</span>
              </a>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 mt-12">
          tws.bio
        </p>
      </div>
    </div>
  )
}
