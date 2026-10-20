'use client'

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  effectiveSelection,
  formatChange,
  isResourceDropRow,
  selectableLinkIds,
  type RowIssue,
} from '@/lib/linkRows'
import { cn, formatCount, formatDate } from '@/lib/utils'
import { splitDisplayUrl } from '@/components/dashboard/displayUrl'
import type { Database } from '@/types/database'
import { LinkActions } from '@/components/dashboard/LinkActions'
import { MiniSparkline } from '@/components/charts/MiniSparkline'
import { TypeBadge } from '@/components/dashboard/TypeBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
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

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

/** One ledger row, worked out on the server (page.tsx). */
export interface LedgerRow {
  link: LinkRow
  /** Destination kind label ("Course"), or null for an unknown host. */
  kind: string | null
  /** The link's campaign: null for none, name null when it could not be read. */
  campaign: { name: string | null } | null
  /** Clicks in the last 30 days and the 30 before; null when they did not load. */
  clicks30: number | null
  prior30: number | null
  /** Clicks per day, last 14 days, oldest first. */
  spark: number[]
  /** The health badge, or null. */
  issue: RowIssue | null
}

const checkboxClassName =
  'size-4 cursor-pointer rounded-[2px] border-edge disabled:cursor-not-allowed disabled:opacity-40'
// The native box takes the ink color: amber is only for the one action.
const checkboxStyle = { accentColor: 'var(--ink-2)' }

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

function ShortCode({ link, className }: { link: LinkRow; className?: string }) {
  // The code opens the link's stats page. No prefetch: twenty rows would each
  // fetch a dynamic page the owner opens for one link at most.
  return (
    <NextLink
      href={`/dashboard/links/${link.id}`}
      prefetch={false}
      className={cn(
        'focus-ring rounded-[2px] font-mono text-[14px] text-ink decoration-1 underline-offset-[3px] hover:underline [overflow-wrap:anywhere]',
        className,
      )}
    >
      {SHORT_DOMAIN}/{link.short_code}
      <span className="sr-only">, view stats</span>
    </NextLink>
  )
}

function RowMeta({ row }: { row: LedgerRow }) {
  const { link, issue } = row
  const drop = isResourceDropRow(link.short_code)
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-3">
      <span className="whitespace-nowrap tabular-nums">Created {formatDate(link.created_at)}</span>
      {link.link_type === 'deep_link' && <TypeBadge type={link.link_type} />}
      {drop && <Badge title="Managed by the Resource Drop Desk">Resource Drop</Badge>}
      {!link.is_active && <Badge>Paused</Badge>}
      {issue && (
        <Badge variant={issue.tone === 'neg' ? 'destructive' : 'default'} title={issue.message}>
          {issue.label}
          <span className="sr-only">: {issue.message}</span>
        </Badge>
      )}
    </span>
  )
}

function Destination({ row, className }: { row: LedgerRow; className?: string }) {
  const { host, rest } = splitDisplayUrl(row.link.original_url)
  return (
    <span className={cn('block min-w-0', className)}>
      <span className="block truncate text-ink" title={row.link.original_url}>
        {host}
        <span className="text-text-3">{rest}</span>
      </span>
      {row.kind && <span className="mt-0.5 block text-[12px] text-text-3">{row.kind}</span>}
    </span>
  )
}

function Clicks({ row }: { row: LedgerRow }) {
  if (row.clicks30 === null) {
    return <span className="text-text-3" title="Clicks for the last 30 days did not load">n/a</span>
  }
  return (
    <span className={cn('font-medium tabular-nums', row.issue?.tone === 'neg' ? 'text-neg' : 'text-ink')}>
      {row.clicks30.toLocaleString('en-US')}
    </span>
  )
}

function Change({ row }: { row: LedgerRow }) {
  if (row.clicks30 === null || row.prior30 === null) {
    return <span className="text-[13px] text-text-3">n/a</span>
  }
  const change = formatChange(row.clicks30, row.prior30)
  return (
    <span
      className={cn(
        'text-[13px] tabular-nums',
        change.tone === 'up' && 'font-bold text-pos',
        change.tone === 'down' && 'font-bold text-neg',
        change.tone === 'new' && 'font-medium text-text-2',
        change.tone === 'flat' && 'text-text-3',
      )}
      title={`${row.clicks30.toLocaleString('en-US')} clicks in the last 30 days, ${row.prior30.toLocaleString('en-US')} in the 30 before`}
    >
      {change.text}
    </span>
  )
}

export function LinksTable({
  rows,
  showing,
  clicksTotal,
}: {
  rows: LedgerRow[]
  /** "Showing 1 to 20 of 116". */
  showing: { from: number; to: number; total: number }
  /** Sum of the 30-day clicks on this page; null when they did not load. */
  clicksTotal: number | null
}) {
  const router = useRouter()
  const links = rows.map((r) => r.link)
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
  const visibleKey = selectableIds.join(',')

  // Drop selections that left the screen (another page, a search, or a row
  // deleted on its own), so they do not come back on the way back.
  useEffect(() => {
    const visible = new Set(visibleKey ? visibleKey.split(',') : [])
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleKey])

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
      toast.success(`${formatCount(ids.length, 'link')} ${active ? 'live again' : 'paused'}`)
      setSelected(new Set())
      router.refresh()
    } catch {
      toast.error('Could not update the links. Try again.')
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
      toast.error('Could not delete the links. Try again.')
    } finally {
      setBulkBusy(false)
    }
  }

  const showingText = `Showing ${showing.from.toLocaleString('en-US')} to ${showing.to.toLocaleString('en-US')} of ${showing.total.toLocaleString('en-US')}`
  const totalText = clicksTotal === null ? 'n/a' : clicksTotal.toLocaleString('en-US')

  return (
    <>
      {someSelected && (
        // Floats at the bottom of the screen instead of sitting above the
        // table: inserting a bar there pushed every row down under the pointer
        // after the first click.
        <div
          role="region"
          aria-label="Bulk actions"
          data-bulk-bar
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-rule bg-surface px-4 py-2.5 shadow-overlay"
        >
          <div className="flex w-full items-center justify-between sm:w-auto sm:gap-3">
            <span className="text-sm font-medium text-ink tabular-nums">{selectedCount} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              Cancel
            </Button>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:ml-auto sm:flex sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(true)} disabled={bulkBusy}>
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkSetActive(false)} disabled={bulkBusy}>
              Pause
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Wide screens (lg up): the ledger table. Campaign and the 14-day
          trend need the room of xl. */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6 pr-2">
                <input
                  type="checkbox"
                  className={cn(checkboxClassName, 'relative top-[3px]')}
                  style={checkboxStyle}
                  checked={allSelected}
                  ref={(el) => {
                    // Some rows ticked, not all: show the dash, not an empty box.
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all links on this page"
                />
              </TableHead>
              <TableHead className="pl-2">Link</TableHead>
              <TableHead>Goes to</TableHead>
              <TableHead className="hidden xl:table-cell">Campaign</TableHead>
              <TableHead className="text-right">
                Clicks<span className="sr-only">, last 30 days</span>
              </TableHead>
              <TableHead className="text-right">
                Change<span className="sr-only"> against the 30 days before</span>
              </TableHead>
              <TableHead className="hidden xl:table-cell">Last 14 days</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { link } = row
              return (
                <TableRow key={link.id} data-state={selected.has(link.id) ? 'selected' : undefined}>
                  <TableCell className="w-6 pr-2">
                    <RowCheckbox
                      link={link}
                      checked={selected.has(link.id)}
                      onToggle={() => toggleOne(link.id)}
                      className={checkboxClassName}
                    />
                  </TableCell>
                  <TableCell className="max-w-[320px] min-w-[264px] pl-2 whitespace-normal">
                    <ShortCode link={link} className="block" />
                    <RowMeta row={row} />
                  </TableCell>
                  {/* w-full + max-w-0: the destination takes the width the
                      other columns leave and truncates inside it. */}
                  <TableCell className="w-full max-w-0">
                    <Destination row={row} />
                  </TableCell>
                  <TableCell className="hidden max-w-[180px] truncate xl:table-cell">
                    {row.campaign ? (
                      row.campaign.name ? (
                        <span className="text-text-2" title={row.campaign.name}>{row.campaign.name}</span>
                      ) : (
                        <span className="text-text-3">Not loaded</span>
                      )
                    ) : (
                      <span className="text-text-3">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Clicks row={row} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Change row={row} />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <MiniSparkline data={row.spark} />
                  </TableCell>
                  <TableCell className="w-px">
                    <LinkActions link={link} className="justify-end" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="pt-3 text-[13px] font-bold text-text-2">
                {showingText}
              </TableCell>
              <TableCell className="hidden xl:table-cell" />
              <TableCell className="pt-3 text-right">
                <span className="rule-total inline-block pb-[3px] tabular-nums text-ink">
                  {totalText}
                  <span className="sr-only"> clicks on this page in the last 30 days</span>
                </span>
              </TableCell>
              <TableCell />
              <TableCell className="hidden xl:table-cell" />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Below lg: one stacked entry per link. Line 1 code and clicks, line 2
          created date and badges, line 3 destination and change, line 4 the
          actions. Campaign and the trend line are left out. */}
      <ul className="lg:hidden" aria-label="Links">
        {rows.map((row) => {
          const { link } = row
          const drop = isResourceDropRow(link.short_code)
          return (
            <li
              key={link.id}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-rule py-3.5',
                selected.has(link.id) && 'bg-hover',
              )}
            >
              <div className="min-w-0">
                <ShortCode link={link} />
              </div>
              <div className="text-right text-[15px]">
                <Clicks row={row} />
              </div>
              <div className="col-span-2 min-w-0">
                <RowMeta row={row} />
              </div>
              <Destination row={row} className="mt-1.5 text-sm" />
              <div className="mt-1.5 text-right">
                <Change row={row} />
              </div>
              <div className="col-span-2 mt-1.5 flex items-center justify-between gap-2">
                <LinkActions link={link} className="-ml-2.5" />
                {!drop && (
                  // The box stays 16px; the label is the 44px target.
                  <label className="-mr-3 inline-flex size-11 shrink-0 items-center justify-center">
                    <RowCheckbox
                      link={link}
                      checked={selected.has(link.id)}
                      onToggle={() => toggleOne(link.id)}
                      className={checkboxClassName}
                    />
                  </label>
                )}
              </div>
            </li>
          )
        })}
        <li className="flex items-baseline justify-between gap-4 border-t border-ink-2 pt-3 text-[13px] font-bold text-text-2">
          <span>{showingText}</span>
          <span className="rule-total pb-[3px] text-sm tabular-nums text-ink">
            {totalText}
            <span className="sr-only"> clicks on this page in the last 30 days</span>
          </span>
        </li>
      </ul>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {formatCount(selectedCount, 'link')}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the selected {selectedCount === 1 ? 'link and its' : 'links and their'} click history. Anyone who opens {selectedCount === 1 ? 'it' : 'them'} after this gets a not found page. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={bulkDelete}
              disabled={bulkBusy || selectedCount === 0}
            >
              {bulkBusy ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
