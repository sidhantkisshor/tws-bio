'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { getShortUrl } from '@/lib/utils'
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
      toast.error('Failed to delete link')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Link</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-mono font-medium text-foreground">
              {displayUrl}
            </span>
            ? This action cannot be undone.
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
