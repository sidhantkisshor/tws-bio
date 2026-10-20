'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isResourceDropRow } from '@/lib/linkRows'
import type { Database } from '@/types/database'
import { formatCount, getShortUrl } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

type Link = Database['public']['Tables']['links']['Row']

export function DeleteLinkDialog({
  link,
  open,
  onOpenChange,
}: {
  link: Link
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const shortUrl = getShortUrl(link.short_code)
  // Extract just the domain/path portion for display
  const displayUrl = shortUrl.replace(/^https?:\/\//, '')

  async function handleDelete() {
    // LinkActions offers no Delete for these rows. This stops any other way in:
    // the delete would cascade the click history away, and the next click
    // would start the row again at zero.
    if (isResourceDropRow(link.short_code)) {
      toast.error('Resource Drop links are managed by the Resource Drop Desk.')
      onOpenChange(false)
      return
    }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', link.id)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Link deleted')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Could not delete the link. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this link?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes{' '}
            <span className="font-mono [overflow-wrap:anywhere] text-ink">{displayUrl}</span>{' '}
            and its click history ({formatCount(link.total_clicks ?? 0, 'click')}). Anyone who
            opens it after this gets a not found page. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
