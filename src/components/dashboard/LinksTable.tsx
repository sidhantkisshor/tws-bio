'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { effectiveSelection, isResourceDropRow, selectableLinkIds } from '@/lib/linkRows'
import { formatDate, getShortUrl } from '@/lib/utils'
import type { Database } from '@/types/database'
import { TickerChip } from '@/components/TickerChip'
import { LinkActions } from '@/components/dashboard/LinkActions'
import { MiniSparkline } from '@/components/charts/MiniSparkline'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { Badge } from '@/components/ui/badge'
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
// it's currently live. Both used to render as identical solid green pills.
// Type is now a neutral outline+icon chip (shared TypeBadge component),
// reserving the solid brand-green fill exclusively for the Active signal
// (finding: links-type-status-badge-differentiation).
function StatusBadge({ active }: { active: boolean | null }) {
  return <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Inactive'}</Badge>
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
      toast.success(`${ids.length} link${ids.length === 1 ? '' : 's'} ${active ? 'activated' : 'deactivated'}`)
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
      toast.success(`${ids.length} link${ids.length === 1 ? '' : 's'} deleted`)
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
        // Wraps on phones, where the four buttons are wider than the card.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
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
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Desktop / tablet: full table, scoped horizontal scroll only if needed */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-4">
                <input
                  type="checkbox"
                  className={checkboxClassName}
                  style={checkboxStyle}
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all links"
                />
              </TableHead>
              <TableHead className="px-4">Short Code</TableHead>
              <TableHead className="px-4">Original URL</TableHead>
              <TableHead className="px-4">Type</TableHead>
              <TableHead className="px-4">Clicks</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Created</TableHead>
              <TableHead className="px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id} data-state={selected.has(link.id) ? 'selected' : undefined}>
                <TableCell className="px-4 py-3">
                  <RowCheckbox
                    link={link}
                    checked={selected.has(link.id)}
                    onToggle={() => toggleOne(link.id)}
                    className={checkboxClassName}
                  />
                </TableCell>
                <TableCell className="px-4 py-3">
                  {/* Signature ticker chip: brings the row's single copy affordance
                      (fill flash + Check morph), so LinkActions carries no Copy button. */}
                  <TickerChip code={link.short_code} href={getShortUrl(link.short_code)} />
                  {isResourceDropRow(link.short_code) && <ResourceDropLabel />}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className="block max-w-xs truncate text-sm text-muted-foreground"
                    title={link.original_url}
                  >
                    {link.original_url}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <TypeBadge type={link.link_type} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MiniSparkline data={sparklines[link.id] || []} />
                    <span className="font-mono tabular-nums">{link.total_clicks || 0}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <StatusBadge active={link.is_active} />
                </TableCell>
                <TableCell className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                  {link.created_at ? formatDate(link.created_at) : '---'}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <LinkActions link={link} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked card-per-link layout so every field and action stays on-screen */}
      <div className="divide-y divide-border md:hidden">
        {links.map((link) => (
          <div key={link.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <RowCheckbox
                  link={link}
                  checked={selected.has(link.id)}
                  onToggle={() => toggleOne(link.id)}
                  className={`${checkboxClassName} mt-0.5 shrink-0`}
                />
                <div className="min-w-0">
                  <TickerChip code={link.short_code} href={getShortUrl(link.short_code)} touchTarget />
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {link.original_url}
                  </span>
                  {isResourceDropRow(link.short_code) && <ResourceDropLabel />}
                </div>
              </div>
              <StatusBadge active={link.is_active} />
            </div>

            <div className="flex items-center gap-3 pl-7 text-sm text-muted-foreground">
              <TypeBadge type={link.link_type} />
              <MiniSparkline data={sparklines[link.id] || []} />
              {/* Same page as the View stats action. No prefetch, as there. */}
              <Link
                href={`/dashboard/links/${link.id}`}
                prefetch={false}
                className="relative rounded-sm font-mono tabular-nums transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.total_clicks || 0} clicks
                <span className="sr-only">, view stats</span>
              </Link>
              <span className="ml-auto tabular-nums">
                {link.created_at ? formatDate(link.created_at) : '---'}
              </span>
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
              Delete {selectedCount} link{selectedCount === 1 ? '' : 's'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected link{selectedCount === 1 ? '' : 's'} and all
              associated click data. This action cannot be undone.
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
