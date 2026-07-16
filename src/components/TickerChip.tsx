'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn, getShortUrl } from '@/lib/utils'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

interface TickerChipProps {
  code: string
  /** Render the copy affordance (default true). */
  copyable?: boolean
  /** When set, the short-link label becomes an anchor (opens in a new tab). */
  href?: string
  className?: string
  onCopied?: () => void
  /** Fire the signature fill once when the chip first mounts (creation state). */
  flashOnMount?: boolean
  /** Start on the green Check state, then revert after 1.2s. */
  copiedOnMount?: boolean
}

/**
 * The product's signature element: a short link rendered as a monospace
 * "ticker" chip with a green tick bar. Copying fires a one-time fill flash
 * (tick-fill keyframe) and morphs the Copy icon into a green Check — under
 * prefers-reduced-motion the icon swap alone confirms.
 */
export function TickerChip({
  code,
  copyable = true,
  href,
  className,
  onCopied,
  flashOnMount = false,
  copiedOnMount = false,
}: TickerChipProps) {
  const [copied, setCopied] = useState(copiedOnMount)
  const [flashing, setFlashing] = useState(flashOnMount)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (copiedOnMount) {
      revertTimer.current = setTimeout(() => setCopied(false), 1200)
    }
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current)
    }
  }, [copiedOnMount])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShortUrl(code))
    } catch {
      return // clipboard unavailable — never show a false success
    }
    setCopied(true)
    setFlashing(true)
    if (revertTimer.current) clearTimeout(revertTimer.current)
    revertTimer.current = setTimeout(() => setCopied(false), 1200)
    onCopied?.()
  }, [code, onCopied])

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-border border-l-2 border-l-primary-text bg-card px-2.5 py-1 font-mono text-sm tabular-nums text-foreground',
        flashing && 'animate-tick-fill',
        className,
      )}
      onAnimationEnd={() => setFlashing(false)}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate rounded-sm transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {SHORT_DOMAIN}/{code}
        </a>
      ) : (
        <span className="truncate">
          {SHORT_DOMAIN}/{code}
        </span>
      )}
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Short link copied' : 'Copy short link'}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="relative block size-3.5">
            <Copy
              aria-hidden
              className={cn(
                'absolute inset-0 size-3.5 transition-opacity duration-150',
                copied ? 'opacity-0' : 'opacity-100',
              )}
            />
            <Check
              aria-hidden
              className={cn(
                'absolute inset-0 size-3.5 text-primary-text transition-opacity duration-150',
                copied ? 'opacity-100' : 'opacity-0',
              )}
            />
          </span>
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Short link copied' : ''}
      </span>
    </span>
  )
}
