'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Pencil, QrCode, Power, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getShortUrl } from '@/lib/utils'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { EditLinkDialog } from '@/components/dashboard/EditLinkDialog'
import { DeleteLinkDialog } from '@/components/dashboard/DeleteLinkDialog'
import { QRCodeDialog } from '@/components/dashboard/QRCodeDialog'

type Link = Database['public']['Tables']['links']['Row']

export function LinkActions({ link }: { link: Link }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getShortUrl(link.short_code))
      toast.success('Copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  async function setActive(nextActive: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('links')
      .update({ is_active: nextActive })
      .eq('id', link.id)
    return error
  }

  async function handleToggleActive() {
    const wasActive = link.is_active
    setToggling(true)
    try {
      const error = await setActive(!wasActive)

      if (error) {
        toast.error(error.message)
        return
      }

      router.refresh()

      if (wasActive) {
        // Deactivating a live link is easy to trigger by accident (small icon,
        // no confirm step) — give it a lightweight undo instead of a blocking dialog.
        toast.success('Link deactivated', {
          action: {
            label: 'Undo',
            onClick: () => void handleUndoDeactivate(),
          },
        })
      } else {
        toast.success('Link activated')
      }
    } catch {
      toast.error('Failed to toggle link status')
    } finally {
      setToggling(false)
    }
  }

  async function handleUndoDeactivate() {
    setToggling(true)
    try {
      const error = await setActive(true)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Link reactivated')
      router.refresh()
    } catch {
      toast.error('Failed to reactivate link')
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label="Copy short URL"
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setEditOpen(true)}
          aria-label="Edit link"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setQrOpen(true)}
          aria-label="Show QR code"
        >
          <QrCode className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleToggleActive}
          disabled={toggling}
          aria-label={link.is_active ? 'Deactivate link' : 'Activate link'}
          className={link.is_active ? 'text-primary-text hover:text-primary-text/80' : 'text-muted-foreground'}
        >
          <Power className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete link"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <EditLinkDialog
        link={link}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteLinkDialog
        link={link}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      <QRCodeDialog
        shortCode={link.short_code}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </>
  )
}
