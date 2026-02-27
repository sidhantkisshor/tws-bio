'use client'

import { useState } from 'react'
import { getShortUrl } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Link = Database['public']['Tables']['links']['Row']

interface LinksListProps {
  user: User | null
  links: Link[]
  loading: boolean
}

export function LinksList({ user, links, loading }: LinksListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (link: Link) => {
    const shortUrl = getShortUrl(link.short_code)
    try {
      await navigator.clipboard.writeText(shortUrl)
    } catch {
      // Clipboard API unavailable (HTTP context or permission denied)
    }
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (links.length === 0) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6">
          {user ? 'Your Recent Links' : 'Recent Links'}
        </h3>
        
        <div className="space-y-4">
          {links.map((link) => {
            const shortUrl = getShortUrl(link.short_code)
            const displayUrl = shortUrl.replace(/^https?:\/\//, '')
            
            return (
              <div
                key={link.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {displayUrl}
                    </a>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {link.original_url}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{link.total_clicks || 0} clicks</span>
                      <span>{link.created_at ? new Date(link.created_at).toLocaleDateString() : '—'}</span>
                      {link.link_type === 'deep_link' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Deep Link
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleCopy(link)}
                    className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg transition ${
                      copiedId === link.id
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {copiedId === link.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}