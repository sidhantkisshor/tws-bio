'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { getShortUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Copy-to-clipboard affordance for a short link's own detail page — the one
 * place a user is most likely to want to grab the URL again, but where it
 * previously rendered as plain static text with no copy/share action.
 */
export function CopyShortLinkButton({ shortCode }: { shortCode: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getShortUrl(shortCode))
      setCopied(true)
      toast.success('Copied!')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      aria-label="Copy short URL"
      className="text-muted-foreground hover:text-primary-text"
    >
      {copied ? <Check className="size-3.5 text-primary-text" /> : <Copy className="size-3.5" />}
    </Button>
  )
}
