'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
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

  async function handleSave() {
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
