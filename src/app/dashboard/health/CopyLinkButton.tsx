'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn, getShortUrl } from '@/lib/utils'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

/**
 * A quiet text button that copies a short link. The label turns into
 * "Copied" for 1.6s; there is no toast. Used in the Overview top links table
 * and on the Health page.
 */
export function CopyLinkButton({
  shortCode,
  className,
}: {
  shortCode: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(getShortUrl(shortCode))
      setState('copied')
    } catch {
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={state === 'idle' ? `Copy ${SHORT_DOMAIN}/${shortCode}` : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'px-2.5 max-sm:h-9 md:min-w-[4.5rem]',
        className,
      )}
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
      </span>
    </button>
  )
}
