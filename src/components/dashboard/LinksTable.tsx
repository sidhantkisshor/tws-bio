'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { effectiveSelection, isResourceDropRow, selectableLinkIds } from '@/lib/linkRows'
import { cn, formatCount, formatDate, getShortUrl } from '@/lib/utils'
import { displayUrl } from '@/components/dashboard/displayUrl'
import type { Database } from '@/types/database'
import { TickerChip } from '@/components/TickerChip'
import { LinkActions } from '@/components/dashboard/LinkActions'
import { MiniSparkline } from '@/components/charts/MiniSparkline'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
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

type LinkRow = Database['public']['Tables']['links']['Row']

const checkboxClassName =
  'size-4 cursor-pointer rounded border-border disabled:cursor-not-allowed disabled:opacity-50'
const checkboxStyle = { accentColor: 'var(--primary)' }

// Type carries the link's shape (URL vs deep link); Status carries whether
// it's currently live. Type is a neutral outline+icon chip (shared TypeBadge
// component). Status is a dot and a word, not a pill: twenty solid green
// "Active" pills made the normal case the loudest thing on the page, so green
// is now only the small dot and the exception (Inactive) is the dim one.
function StatusBadge({ active }: { active: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', active ? 'bg-primary-text' : 'bg-muted-foreground/50')}
      />
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
        {active ? 'Active' : 'Inactive'}
      </span>
    </span>
  )
}

// Says why a Resource Drop row has no checkbox and fewer actions: the Resource
// Drop Desk owns these links, not this dashboard.
function ResourceDropLabel() {
  return (
    <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      Managed by Resource Drop
    </span>
  )
}

function RowCheckbox({
  link,
  checked,
  onToggle,
  className,
}: {
  link: LinkRow
  checked: boolean
  onToggle: () => void
  className?: string
}) {
  if (isResourceDropRow(link.short_code)) {
    // Disabled rather than absent, so the rows stay aligned.
    return (
      <input
        type="checkbox"
        className={className}
        style={checkboxStyle}
        checked={false}
        disabled
        aria-label={`${link.short_code} is managed by Resource Drop and cannot be selected`}
      />
    )
  }
  return (
    <input
      type="checkbox"
      className={className}
      style={checkboxStyle}
      checked={checked}
      onChange={onToggle}
      aria-label={`Select ${link.short_code}`}
    />
  )
}

export function LinksTable({
  links,
  sparklines,
}: {
  links: LinkRow[]
  /** link id -> per-day click counts (oldest to newest) for the sparkline. */
  sparklines: Record<string, number[]>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // The page is not remounted when ?page, ?q or a filter changes, so
  // `selected` can still hold rows from an earlier view. Everything below
  // works on the rows on screen only, so a bulk delete can never reach a row
  // the owner cannot see.
  const selectableIds = selectableLinkIds(links)
  const selectedIds = effectiveSelection(selected, selectableIds)
  const selectedCount = selectedIds.length
  const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length
  const someSelected = selectedCount > 0

  // Drop selections that left the screen (another page, a search, or a row
  // deleted on its own), so they do not come back on the way back.
  useEffect(() => {
    const visible = new Set(selectableLinkIds(links))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [links])

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function bulkSetActive(active: boolean) {
    const ids = selectedIds
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      // Loaded on first use, so supabase-js stays off the links page until
      // the owner changes something.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('links').update({ is_active: active }).in('id', ids)

      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${formatCount(ids.length, 'link')} ${active ? 'activated' : 'deactivated'}`)
      setSelected(new Set())
      router.refresh()
    } catch {
      toast.error('Failed to update links')
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkDelete() {
    const ids = selectedIds
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('links').delete().in('id', ids)

      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${formatCount(ids.length, 'link')} deleted`)
      setSelected(new Set())
      setBulkDeleteOpen(false)
      router.refresh()
    } catch {
      toast.error('Failed to delete links')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      {someSelected && (
        // Floats at the bottom of the screen instead of sitting above the
        // table: inserting a bar there pushed every row down under the pointer
        // after the first click, and on a phone it appeared far from the card
        // that was just ticked. From md up it centres over the content column,
        // not the sidebar.
        <div
          role="region"
          aria-label="Bulk actions"
          data-bulk-bar
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-popover px-4 py-2.5 shadow-overlay md:left-[calc(16rem+1rem)]"
        >
          <div className="flex w-full items-center justify-between sm:w-auto sm:gap-3">
            <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              Cancel
            </Button>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:ml-auto sm:flex sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(true)} disabled={bulkBusy}>
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(false)} disabled={bulkBusy}>
              Deactivate
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Wide screens only (xl): below 1280px the sidebar leaves 960px or less,
          which the table's columns do not fit in, so the card list takes over. */}
      <div className="hidden xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-3">
                <input
                  type="checkbox"
                  className={checkboxClassName}
                  style={checkboxStyle}
                  checked={allSelected}
                  ref={(el) => {
                    // Some rows ticked, not all: show the dash, not an empty box.
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all links"
                />
              </TableHead>
              <TableHead className="px-3">Short Code</TableHead>
              <TableHead className="px-3">Original URL</TableHead>
              <TableHead className="px-3 text-right">Clicks</TableHead>
              <TableHead className="px-3">Status</TableHead>
              <TableHead className="px-3">Created</TableHead>
              <TableHead className="px-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id} data-state={selected.has(link.id) ? 'selected' : undefined}>
                <TableCell className="px-3 py-3">
                  <RowCheckbox
                    link={link}
                    checked={selected.has(link.id)}
                    onToggle={() => toggleOne(link.id)}
                    className={checkboxClassName}
                  />
                </TableCell>
                <TableCell className="px-3 py-3">
                  {/* Signature ticker chip: brings the row's single copy affordance
                      (fill flash + Check morph), so LinkActions carries no Copy button.
                      Only the exception gets a badge: a plain URL needs no label. */}
                  <div className="flex items-center gap-2">
                    <TickerChip code={link.short_code} href={getShortUrl(link.short_code)} className="max-w-64" />
                    {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
                  </div>
                  {isResourceDropRow(link.short_code) && <ResourceDropLabel />}
                </TableCell>
                {/* w-full + max-w-0: the URL column takes whatever width the
                    others leave and truncates inside it, so the table always
                    fits its card. */}
                <TableCell className="w-full max-w-0 px-3 py-3">
                  <span
                    className="block truncate text-sm text-muted-foreground"
                    title={link.original_url}
                  >
                    {displayUrl(link.original_url)}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <MiniSparkline data={sparklines[link.id] || []} />
                    <span className="min-w-[4ch] text-right font-mono tabular-nums">
                      {(link.total_clicks || 0).toLocaleString('en-US')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <StatusBadge active={link.is_active} />
                </TableCell>
                <TableCell className="px-3 py-3 text-sm tabular-nums text-muted-foreground">
                  {link.created_at ? formatDate(link.created_at) : '---'}
                </TableCell>
                <TableCell className="px-3 py-3">
                  <LinkActions link={link} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Below xl: stacked card-per-link layout so every field and action stays on-screen */}
      <div className="divide-y divide-border xl:hidden">
        {links.map((link) => (
          <div key={link.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {/* The box stays 16px; the label grows its hit area to 44px with
                    negative margins, so the card layout does not change. */}
                <label className="-mx-3.5 -mb-3.5 -mt-3 inline-flex size-11 shrink-0 items-center justify-center">
                  <RowCheckbox
                    link={link}
                    checked={selected.has(link.id)}
                    onToggle={() => toggleOne(link.id)}
                    className={`${checkboxClassName} shrink-0`}
                  />
                </label>
                <div className="min-w-0">
                  <TickerChip code={link.short_code} href={getShortUrl(link.short_code)} touchTarget />
                  {/* The date rides on the URL line: the meta row below is
                      already full on a 390px phone. */}
                  <div className="mt-1 flex items-baseline gap-3">
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
                      title={link.original_url}
                    >
                      {displayUrl(link.original_url)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {link.created_at ? formatDate(link.created_at) : '---'}
                    </span>
                  </div>
                  {isResourceDropRow(link.short_code) && <ResourceDropLabel />}
                </div>
              </div>
              <StatusBadge active={link.is_active} />
            </div>

            <div className="flex items-center gap-3 pl-7 text-sm text-muted-foreground">
              {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
              <MiniSparkline data={sparklines[link.id] || []} />
              {/* Same page as the View stats action. No prefetch, as there. */}
              <Link
                href={`/dashboard/links/${link.id}`}
                prefetch={false}
                className="relative whitespace-nowrap rounded-sm transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:text-foreground focus-ring"
              >
                <span className="font-mono tabular-nums text-foreground">
                  {(link.total_clicks || 0).toLocaleString('en-US')}
                </span>{' '}
                {link.total_clicks === 1 ? 'click' : 'clicks'}
                <span className="sr-only">, view stats</span>
              </Link>
            </div>

            <div className="-mx-1 flex items-center justify-end">
              <LinkActions link={link} touch />
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {formatCount(selectedCount, 'link')}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the selected {selectedCount === 1 ? 'link and its' : 'links and their'} click history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={bulkDelete}
              disabled={bulkBusy || selectedCount === 0}
            >
              {bulkBusy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
