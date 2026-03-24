'use client'

import { useState } from 'react'
import { getShortUrl } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useLinks } from '@/hooks/useLinks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function LinksList() {
  const { user, loading: authLoading } = useAuth()
  const { links, loading: linksLoading } = useLinks(user?.id)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (shortCode: string, linkId: string) => {
    const shortUrl = getShortUrl(shortCode)
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopiedId(linkId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  if (authLoading || linksLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Recent Links</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-48 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (links.length === 0) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Recent Links</h3>
      {links.map((link) => {
        const shortUrl = getShortUrl(link.short_code)
        const isDeepLink = link.link_type === 'deep_link'
        const isCopied = copiedId === link.id

        return (
          <Card
            key={link.id}
            className="bg-card border-border hover:border-primary/30 transition"
          >
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary font-medium text-sm hover:underline"
                  >
                    {shortUrl}
                  </a>
                  {isDeepLink && (
                    <Badge variant="secondary">Deep Link</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm truncate mt-1">
                  {link.original_url}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-muted-foreground text-xs font-mono">
                    {link.total_clicks ?? 0} click{(link.total_clicks ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {link.created_at && (
                    <span className="text-muted-foreground text-xs font-mono">
                      {new Date(link.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(link.short_code, link.id)}
                className={isCopied ? 'text-primary' : ''}
              >
                {isCopied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                <span className="ml-1">{isCopied ? 'Copied' : 'Copy'}</span>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
