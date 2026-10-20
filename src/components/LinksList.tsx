'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { getAnonLinkIds, type HomeLink } from '@/hooks/useLinks'
import { destinationKind } from '@/lib/destinationKind'
import { formatDate, getShortUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { splitDisplayUrl } from '@/components/dashboard/displayUrl'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

interface LinksListProps {
  user: User | null
  authLoading: boolean
  links: HomeLink[]
  linksLoading: boolean
  /** The last fetch failed: shown as an error, never as "no links". */
  linksError: boolean
  onRetry: () => void
}

// Desktop ledger columns: link, destination, created, clicks, action. On
// phones each row stacks (code and clicks, destination, date and Copy).
const COLS = 'md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_7rem_5.5rem_5rem] md:items-baseline md:gap-x-6'

function LedgerHead({ action }: { action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="recent-links-heading" className="type-h2 text-ink">
        Recent links
      </h2>
      {action}
    </div>
  )
}

function ColumnHeads() {
  return (
    <div className={`hidden border-b border-ink-2 pb-2 type-label ${COLS}`} aria-hidden>
      <span>Link</span>
      <span>Goes to</span>
      <span>Created</span>
      <span className="text-right">Clicks</span>
      <span />
    </div>
  )
}

/** Copies the short URL; the label says "Copied" for 1.6s, with no toast. */
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShortUrl(code))
    } catch {
      return // clipboard unavailable: never show a false success
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }, [code])

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      aria-label={copied ? `Copied ${SHORT_DOMAIN}/${code}` : `Copy ${SHORT_DOMAIN}/${code}`}
      className="min-w-[4.5rem] md:min-w-0"
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function LinkRow({ link }: { link: HomeLink }) {
  const clicks = link.total_clicks ?? 0
  const kind = destinationKind(link.original_url)
  const { host, rest } = splitDisplayUrl(link.original_url)
  return (
    <li className={`border-b border-rule py-3 transition-colors duration-[120ms] hover:bg-hover md:py-2.5 ${COLS}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-4 md:block">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={getShortUrl(link.short_code)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${SHORT_DOMAIN}/${link.short_code}`}
            className="relative min-w-0 truncate rounded-ctl font-mono text-sm font-medium text-ink transition-colors duration-150 hover:text-accent-text focus-ring after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] md:after:hidden"
          >
            {SHORT_DOMAIN}/{link.short_code}
          </a>
          {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
        </span>
        {/* Phone: the count sits on the code line. */}
        <span className="shrink-0 text-[15px] tabular-nums text-ink md:hidden">
          {clicks.toLocaleString('en-US')}
          <span className="ml-1 text-[13px] text-text-3">{clicks === 1 ? 'click' : 'clicks'}</span>
        </span>
      </div>
      <div className="mt-1 min-w-0 md:mt-0">
        {/* Same two-tone destination as the dashboard tables: host in ink,
            the rest in tertiary text, no scheme or www. */}
        <p className="truncate text-sm text-ink" title={link.original_url}>
          {host}
          <span className="text-text-3">{rest}</span>
        </p>
        {kind && <p className="mt-0.5 text-[12px] text-text-3">{kind}</p>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 md:contents">
        <span className="text-[13px] tabular-nums text-text-2 md:text-sm">
          {link.created_at ? formatDate(link.created_at) : ''}
        </span>
        <span className="hidden text-right text-[15px] tabular-nums text-ink md:block">
          {clicks.toLocaleString('en-US')}
        </span>
        <span className="flex justify-end">
          <CopyButton code={link.short_code} />
        </span>
      </div>
    </li>
  )
}

/**
 * The owner's recent links on the home page, as a ledger: column heads over a
 * 1px ink rule, a hairline between rows, clicks right-aligned in tabular
 * figures, short codes in mono and destinations as host plus path.
 * Anonymous visitors only see it when this browser holds links made before
 * migration 019.
 */
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
      <section aria-labelledby="recent-links-heading" aria-busy className="rule-open pt-3.5">
        <LedgerHead />
        <ColumnHeads />
        <ul>
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex h-14 items-center justify-between gap-4 border-b border-rule">
              <div className="grid gap-2">
                <div className="h-3.5 w-36 rounded-ctl bg-sunk" />
                <div className="h-3 w-56 max-w-full rounded-ctl bg-sunk" />
              </div>
              <div className="h-3.5 w-12 rounded-ctl bg-sunk" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (linksError) {
    return (
      <section aria-labelledby="recent-links-heading" className="rule-open pt-3.5">
        <LedgerHead />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3">
          <p role="alert" className="text-sm text-text-2">
            Your links did not load. Check the connection and try again.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </section>
    )
  }

  if (links.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="recent-links-heading" className="rule-open pt-3.5">
      <LedgerHead
        action={
          // Signed-in only: anonymous visitors with pre-019 anon links see this
          // list too, and /dashboard/links would send them to /login.
          user ? (
            <Link
              href="/dashboard/links"
              className="inline-flex min-h-11 items-center rounded-ctl text-sm text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current focus-ring md:min-h-0"
            >
              All links
            </Link>
          ) : undefined
        }
      />
      <ColumnHeads />
      <ul>
        {links.map((link) => (
          <LinkRow key={link.id} link={link} />
        ))}
      </ul>
    </section>
  )
}
