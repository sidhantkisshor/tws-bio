'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, QrCode, Power, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'

// The dialogs only matter after a click, yet they were statically imported and
// mounted for every row — react-qr-code alone is ~51KB of table bundle. Loading
// them via next/dynamic and mounting on first open keeps that JS out of the
// initial links-page chunk entirely.
const EditLinkDialog = dynamic(
  () => import('@/components/dashboard/EditLinkDialog').then((m) => m.EditLinkDialog),
  { ssr: false, loading: () => null },
)
const DeleteLinkDialog = dynamic(
  () => import('@/components/dashboard/DeleteLinkDialog').then((m) => m.DeleteLinkDialog),
  { ssr: false, loading: () => null },
)
const QRCodeDialog = dynamic(
  () => import('@/components/dashboard/QRCodeDialog').then((m) => m.QRCodeDialog),
  { ssr: false, loading: () => null },
)

type Link = Database['public']['Tables']['links']['Row']

export function LinkActions({ link }: { link: Link }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  // "Mounted" flips true on first open and stays true, so a dialog is never in
  // the tree (or downloaded) before it is first needed.
  const [editMounted, setEditMounted] = useState(false)
  const [deleteMounted, setDeleteMounted] = useState(false)
  const [qrMounted, setQrMounted] = useState(false)
  const [toggling, setToggling] = useState(false)

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
      {/* No Copy button here — the row's TickerChip (LinksTable short-code cell)
          is the single copy affordance, with the fill flash + Check morph. */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setEditMounted(true)
            setEditOpen(true)
          }}
          aria-label="Edit link"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setQrMounted(true)
            setQrOpen(true)
          }}
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
          onClick={() => {
            setDeleteMounted(true)
            setDeleteOpen(true)
          }}
          aria-label="Delete link"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {editMounted && (
        <EditLinkDialog
          link={link}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {deleteMounted && (
        <DeleteLinkDialog
          link={link}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
      {qrMounted && (
        <QRCodeDialog
          shortCode={link.short_code}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      )}
    </>
  )
}
