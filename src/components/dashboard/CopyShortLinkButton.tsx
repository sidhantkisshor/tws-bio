'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn, getShortUrl } from '@/lib/utils'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

/** How long the label reads "Copied" after a copy. */
export const COPIED_MS = 1600

/**
 * Copy state for a short link: the label changes to "Copied" for 1.6s, with
 * no toast. A failed copy still says so (toast), because there is nothing
 * else to show it.
 */
export function useCopyShortLink(shortCode: string) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(getShortUrl(shortCode))
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  return { copied, copy }
}

/**
 * A quiet "Copy" button for a short link. Used on the link detail page beside
 * the title, and as the first row action on the Links page.
 */
export function CopyShortLinkButton({
  shortCode,
  size = 'sm',
  className,
}: {
  shortCode: string
  size?: 'sm' | 'default'
  className?: string
}) {
  const { copied, copy } = useCopyShortLink(shortCode)

  return (
    // `relative` keeps the absolutely placed live region inside this box, so
    // it never widens a table's scroll area.
    <span className="relative inline-flex">
      <Button
        variant="ghost"
        size={size}
        onClick={copy}
        className={cn('min-w-16', copied && 'text-ink', className)}
      >
        {copied ? 'Copied' : 'Copy'}
        <span className="sr-only"> {SHORT_DOMAIN}/{shortCode}</span>
      </Button>
      <span className="sr-only" role="status">
        {copied ? 'Link copied' : ''}
      </span>
    </span>
  )
}
