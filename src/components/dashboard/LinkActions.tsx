'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChartColumn, Pencil, QrCode, Power, Trash2 } from 'lucide-react'
import { isResourceDropRow } from '@/lib/linkRows'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

// The dialogs only matter after a click, yet they were statically imported and
// mounted for every row: react-qr-code alone is ~51KB of table bundle. Loading
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

type LinkRow = Database['public']['Tables']['links']['Row']

export function LinkActions({
  link,
  touch = false,
}: {
  link: LinkRow
  /** Phone cards: 40px buttons a thumb can hit. Table rows keep 24px ones. */
  touch?: boolean
}) {
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

  // The Resource Drop route redirects without reading its row, so Edit,
  // Deactivate and Delete would change nothing a visitor sees, and Delete
  // would erase the click history. Activate stays for a row that is already
  // inactive, because an inactive row drops every click it gets.
  const managed = isResourceDropRow(link.short_code)
  const showToggle = !managed || !link.is_active

  const buttonClass = touch ? 'size-10' : undefined
  const iconClass = touch ? 'size-4' : 'size-3.5'

  async function setActive(nextActive: boolean) {
    // Loaded on first use: the table is mostly read, and supabase-js is about
    // 47 KB (brotli) of the links page otherwise.
    const { createClient } = await import('@/lib/supabase/client')
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
        // no confirm step), so give it a lightweight undo instead of a
        // blocking dialog.
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
      {/* No Copy button here: the row's TickerChip (LinksTable short-code cell)
          is the single copy affordance, with the fill flash + Check morph. */}
      <div className={cn('flex items-center', touch ? 'gap-2' : 'gap-1')}>
        {/* A real link rather than a Button, so it can open in a new tab. No
            prefetch: twenty rows would each fetch a dynamic page that the
            owner opens for one link at most. */}
        <Link
          href={`/dashboard/links/${link.id}`}
          prefetch={false}
          aria-label="View stats"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), buttonClass)}
        >
          <ChartColumn className={iconClass} />
        </Link>
        {!managed && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setEditMounted(true)
              setEditOpen(true)
            }}
            aria-label="Edit link"
            className={buttonClass}
          >
            <Pencil className={iconClass} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setQrMounted(true)
            setQrOpen(true)
          }}
          aria-label="Show QR code"
          className={buttonClass}
        >
          <QrCode className={iconClass} />
        </Button>
        {showToggle && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleToggleActive}
            disabled={toggling}
            aria-label={link.is_active ? 'Deactivate link' : 'Activate link'}
            className={cn(
              link.is_active ? 'text-primary-text hover:text-primary-text/80' : 'text-muted-foreground',
              buttonClass,
            )}
          >
            <Power className={iconClass} />
          </Button>
        )}
        {!managed && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setDeleteMounted(true)
              setDeleteOpen(true)
            }}
            aria-label="Delete link"
            className={cn('text-destructive hover:text-destructive', buttonClass)}
          >
            <Trash2 className={iconClass} />
          </Button>
        )}
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
