'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isValidUrl } from '@/lib/utils'
import type { Database } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Link = Database['public']['Tables']['links']['Row']

export function EditLinkDialog({
  link,
  open,
  onOpenChange,
}: {
  link: Link
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [originalUrl, setOriginalUrl] = useState(link.original_url)
  const [iosDeepLink, setIosDeepLink] = useState(link.ios_deep_link || '')
  const [androidDeepLink, setAndroidDeepLink] = useState(link.android_deep_link || '')
  const [fallbackUrl, setFallbackUrl] = useState(link.fallback_url || '')
  const [expiresAt, setExpiresAt] = useState(
    link.expires_at ? link.expires_at.slice(0, 16) : ''
  )
  const [maxClicks, setMaxClicks] = useState(
    link.max_clicks != null ? String(link.max_clicks) : ''
  )

  // Re-seed fields from the current link whenever the dialog opens, since the
  // dialog stays mounted and the initial useState values can go stale.
  useEffect(() => {
    if (!open) return
    setOriginalUrl(link.original_url)
    setIosDeepLink(link.ios_deep_link || '')
    setAndroidDeepLink(link.android_deep_link || '')
    setFallbackUrl(link.fallback_url || '')
    setExpiresAt(link.expires_at ? link.expires_at.slice(0, 16) : '')
    setMaxClicks(link.max_clicks != null ? String(link.max_clicks) : '')
  }, [
    open,
    link.original_url,
    link.ios_deep_link,
    link.android_deep_link,
    link.fallback_url,
    link.expires_at,
    link.max_clicks,
  ])

  async function handleSave() {
    if (!isValidUrl(originalUrl)) {
      toast.error('Please enter a valid URL')
      return
    }
    // Reject dangerous schemes on the deep-link fields, mirroring the redirect
    // handler (route.ts) and the create_deep_link RPC. The DB also enforces
    // this via CHECK constraints (migration 016) so the invariant holds for
    // any write path; this client check just gives a clean error first.
    const hasDangerousScheme = (value: string) =>
      /^(javascript|data|vbscript):/.test(value.trim().toLowerCase())
    if (
      (iosDeepLink && hasDangerousScheme(iosDeepLink)) ||
      (androidDeepLink && hasDangerousScheme(androidDeepLink)) ||
      (fallbackUrl && hasDangerousScheme(fallbackUrl))
    ) {
      toast.error(
        'Deep link and fallback URLs cannot use javascript:, data:, or vbscript: schemes'
      )
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('links')
        .update({
          original_url: originalUrl,
          ios_deep_link: iosDeepLink || null,
          android_deep_link: androidDeepLink || null,
          fallback_url: fallbackUrl || null,
          expires_at: expiresAt || null,
          max_clicks: maxClicks ? parseInt(maxClicks, 10) : null,
        })
        .eq('id', link.id)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Link updated')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Failed to update link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>
            Update the settings for this short link.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-short-code">Short Code</Label>
            <Input
              id="edit-short-code"
              value={link.short_code}
              readOnly
              className="font-mono bg-muted"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-original-url">Original URL</Label>
            <Input
              id="edit-original-url"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          {link.link_type === 'deep_link' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="edit-ios-deep-link">iOS Deep Link</Label>
                <Input
                  id="edit-ios-deep-link"
                  value={iosDeepLink}
                  onChange={(e) => setIosDeepLink(e.target.value)}
                  placeholder="app://path"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-android-deep-link">Android Deep Link</Label>
                <Input
                  id="edit-android-deep-link"
                  value={androidDeepLink}
                  onChange={(e) => setAndroidDeepLink(e.target.value)}
                  placeholder="app://path"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-fallback-url">Fallback URL</Label>
                <Input
                  id="edit-fallback-url"
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  placeholder="https://example.com/fallback"
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="edit-expires-at">Expiration Date (optional)</Label>
            <Input
              id="edit-expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-max-clicks">Max Clicks (optional)</Label>
            <Input
              id="edit-max-clicks"
              type="number"
              value={maxClicks}
              onChange={(e) => setMaxClicks(e.target.value)}
              placeholder="Unlimited"
              min={0}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !originalUrl.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
