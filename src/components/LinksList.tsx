'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { getAnonLinkIds, type HomeLink } from '@/hooks/useLinks'
import { getShortUrl } from '@/lib/utils'
import { TickerChip } from '@/components/TickerChip'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LinksListProps {
  user: User | null
  authLoading: boolean
  links: HomeLink[]
  linksLoading: boolean
}

export function LinksList({ user, authLoading, links, linksLoading }: LinksListProps) {
  // Anon ids are read after mount so the first client render matches the
  // server HTML (localStorage is unreadable during SSR).
  const [hasAnonIds, setHasAnonIds] = useState(false)

  useEffect(() => {
    setHasAnonIds(getAnonLinkIds().length > 0)
  }, [])

  if (authLoading || linksLoading) {
    // Never promise content speculatively: first-time visitors (no session,
    // no anon ids) see nothing here rather than a skeleton that vanishes.
    if (!user && !hasAnonIds) return null

    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Recent Links</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="h-8 w-16 bg-muted rounded" />
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
        const isDeepLink = link.link_type === 'deep_link'

        return (
          <Card
            key={link.id}
            className="bg-card border-border hover:border-primary/30 transition-colors"
          >
            <CardContent>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TickerChip code={link.short_code} href={getShortUrl(link.short_code)} />
                  {isDeepLink && (
                    <Badge variant="secondary">Deep Link</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm truncate mt-2">
                  {link.original_url}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-muted-foreground text-xs font-mono tabular-nums">
                    {link.total_clicks ?? 0} click{(link.total_clicks ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {link.created_at && (
                    <span className="text-muted-foreground text-xs font-mono tabular-nums">
                      {new Date(link.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
