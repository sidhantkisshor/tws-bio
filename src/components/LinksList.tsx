'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { getAnonLinkIds, type HomeLink } from '@/hooks/useLinks'
import { formatDate, getShortUrl } from '@/lib/utils'
import { TickerChip } from '@/components/TickerChip'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { Button } from '@/components/ui/button'

interface LinksListProps {
  user: User | null
  authLoading: boolean
  links: HomeLink[]
  linksLoading: boolean
  /** The last fetch failed: shown as an error, never as "no links". */
  linksError: boolean
  onRetry: () => void
}

const HEADING_CLASS = 'text-base font-semibold text-foreground'

export function LinksList({
  user,
  authLoading,
  links,
  linksLoading,
  linksError,
  onRetry,
}: LinksListProps) {
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
        <h2 className={HEADING_CLASS}>Recent links</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex h-14 items-center justify-between gap-4 px-4">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (linksError) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <h2 className={HEADING_CLASS}>Recent links</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <p role="alert" className="text-sm text-muted-foreground">
            Couldn&apos;t load your links.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (links.length === 0) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h2 className={HEADING_CLASS}>Recent links</h2>
      {/* One bordered list, the same pattern as the /resources rows. */}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {links.map((link) => {
          const clicks = link.total_clicks ?? 0
          return (
            <li key={link.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <TickerChip
                    code={link.short_code}
                    href={getShortUrl(link.short_code)}
                    touchTarget
                  />
                  <TypeBadge type={link.link_type} />
                </div>
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {link.original_url}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm tabular-nums text-foreground">
                  {clicks.toLocaleString('en-US')}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    {clicks === 1 ? 'click' : 'clicks'}
                  </span>
                </p>
                {link.created_at && (
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatDate(link.created_at)}
                  </p>
                )}
              </div>
            </li>
          )
        })}
        {/* Signed-in only: anonymous visitors with pre-019 anon links see this
            list too, and /dashboard/links would send them to /login. */}
        {user && (
          <li>
            <Link
              href="/dashboard/links"
              className="flex h-11 items-center px-4 text-sm text-primary-text hover:underline focus-ring"
            >
              View all links
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}
