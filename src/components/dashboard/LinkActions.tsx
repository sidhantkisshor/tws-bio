'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { toast } from 'sonner'
import { isResourceDropRow } from '@/lib/linkRows'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { CopyShortLinkButton } from '@/components/dashboard/CopyShortLinkButton'

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

const MENU_ITEM =
  'flex min-h-11 w-full cursor-default items-center rounded-[2px] px-3 text-left text-sm text-ink outline-none select-none data-highlighted:bg-hover sm:min-h-9'

/** Only a web address can be opened in a new tab from here. */
function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * The row actions of the Links ledger: Copy, QR, Edit as quiet text buttons,
 * then More (View stats, Duplicate, Open destination, Pause or Activate,
 * Delete). A Resource Drop row is managed by the Resource Drop Desk, so it
 * gets no Edit, Duplicate or Delete, and Pause only shows to undo an
 * inactive row.
 */
export function LinkActions({ link, className }: { link: LinkRow; className?: string }) {
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
  // Pause and Delete would change nothing a visitor sees, and Delete would
  // erase the click history. Activate stays for a row that is already
  // inactive, because an inactive row drops every click it gets.
  const managed = isResourceDropRow(link.short_code)
  const showToggle = !managed || !link.is_active

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
        // Pausing a live link has no confirm step, so give it a lightweight
        // undo instead of a blocking dialog.
        toast.success('Link paused. Visitors now get a not found page.', {
          action: {
            label: 'Undo',
            onClick: () => void handleUndoPause(),
          },
        })
      } else {
        toast.success('Link is live again')
      }
    } catch {
      toast.error('Could not change the link. Try again.')
    } finally {
      setToggling(false)
    }
  }

  async function handleUndoPause() {
    setToggling(true)
    try {
      const error = await setActive(true)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Link is live again')
      router.refresh()
    } catch {
      toast.error('Could not turn the link back on. Try again.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <div className={cn('flex items-center gap-0.5', className)}>
        <CopyShortLinkButton shortCode={link.short_code} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQrMounted(true)
            setQrOpen(true)
          }}
        >
          QR
          <span className="sr-only"> code for {link.short_code}</span>
        </Button>
        {managed ? (
          // Keeps More in line with the table rows above and below. The
          // stacked phone entries start at the left, so they need no gap.
          <span
            aria-hidden
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'invisible max-lg:hidden')}
          >
            Edit
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditMounted(true)
              setEditOpen(true)
            }}
          >
            Edit
            <span className="sr-only"> {link.short_code}</span>
          </Button>
        )}

        <Menu.Root>
          <Menu.Trigger
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            aria-label={`More actions for ${link.short_code}`}
          >
            More
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
              <Menu.Popup className="min-w-48 origin-(--transform-origin) rounded-panel border border-rule bg-surface p-1 text-ink shadow-overlay outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
                {/* No prefetch: twenty rows would each fetch a dynamic page
                    that the owner opens for one link at most. */}
                <Menu.LinkItem
                  className={MENU_ITEM}
                  closeOnClick
                  render={<NextLink href={`/dashboard/links/${link.id}`} prefetch={false} />}
                >
                  View stats
                </Menu.LinkItem>
                {!managed && (
                  <Menu.LinkItem
                    className={MENU_ITEM}
                    closeOnClick
                    render={<NextLink href={`/dashboard/create?from=${link.id}`} prefetch={false} />}
                  >
                    Duplicate
                  </Menu.LinkItem>
                )}
                {isWebUrl(link.original_url) && (
                  <Menu.LinkItem
                    className={MENU_ITEM}
                    closeOnClick
                    href={link.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open destination
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Menu.LinkItem>
                )}
                {(showToggle || !managed) && <div role="separator" className="my-1 h-px bg-rule" />}
                {showToggle && (
                  <Menu.Item className={MENU_ITEM} disabled={toggling} onClick={handleToggleActive}>
                    {link.is_active ? 'Pause' : 'Activate'}
                  </Menu.Item>
                )}
                {!managed && (
                  <Menu.Item
                    className={cn(MENU_ITEM, 'text-neg')}
                    onClick={() => {
                      setDeleteMounted(true)
                      setDeleteOpen(true)
                    }}
                  >
                    Delete
                  </Menu.Item>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
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
