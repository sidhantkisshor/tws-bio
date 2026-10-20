import { LossCue } from '@/components/dashboard/LossCue'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { destinationKind } from '@/lib/destinationKind'
import { formatNumber, formatPeriodChange, formatShare } from '@/lib/ledgerFormat'
import { displayUrl } from '@/components/dashboard/displayUrl'
import { CopyLinkButton } from '@/app/dashboard/health/CopyLinkButton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

export interface TopLinkRow {
  link: { id: string; short_code: string; original_url: string }
  /** Clicks in the window. */
  current: number
  /** Clicks in the window before, or null when there is none ("All time"). */
  prior: number | null
}

/** "+1,475" in teal, "(486)" in red, "New" when there was nothing before, "-" for 0 vs 0. */
export function ChangeCount({ current, prior }: { current: number; prior: number }) {
  if (prior === 0 && current > 0) return <span className="font-medium text-text-2">New</span>
  const { text, tone } = formatPeriodChange(current, prior, 'count')
  if (tone === 'none') {
    return (
      <span className="text-text-3">
        <span aria-hidden>{text}</span>
        <span className="sr-only">no change</span>
      </span>
    )
  }
  return (
    <span className={cn('font-bold', tone === 'up' ? 'text-pos' : tone === 'down' ? 'text-neg' : 'text-text-3')}>
      <LossCue value={text} />
      {text}
    </span>
  )
}

/**
 * The ranked "Top links" ledger shared by Overview and Analytics: rank, the
 * short link, where it goes (with its kind), clicks, the change against the
 * window before (a count), share of all clicks, and Copy. Phones keep rank,
 * code, clicks, change and Copy. Pass `showChange={false}` for "All time".
 */
export function TopLinksTable({
  rows,
  total,
  linkCount,
  showChange = true,
}: {
  rows: TopLinkRow[]
  /** Clicks on every link in the window, for the share column. */
  total: number
  /** Every link the owner has, for "Top 10 of 24". */
  linkCount: number
  showChange?: boolean
}) {
  const topSum = rows.reduce((s, r) => s + r.current, 0)
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-7 md:w-10">#</TableHead>
          <TableHead className="w-auto">Link</TableHead>
          <TableHead className="hidden w-[38%] md:table-cell">Goes to</TableHead>
          <TableHead className="w-16 text-right md:w-24">Clicks</TableHead>
          {showChange && <TableHead className="w-[4.25rem] text-right md:w-24">Change</TableHead>}
          <TableHead className="hidden w-20 text-right md:table-cell">Share</TableHead>
          <TableHead className="w-[4.25rem] md:w-24">
            <span className="sr-only">Copy</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const kind = destinationKind(r.link.original_url)
          return (
            <TableRow key={r.link.id}>
              <TableCell className="tabular-nums text-text-3">{i + 1}</TableCell>
              <TableCell className="min-w-0">
                <Link
                  href={`/dashboard/links/${r.link.id}`}
                  title={`${SHORT_DOMAIN}/${r.link.short_code}`}
                  className="focus-ring -my-3 block truncate rounded-[2px] py-3 font-mono text-[13.5px] text-ink transition-colors duration-150 hover:text-accent-text"
                >
                  {/* Phones show the bare code so the change column still fits. */}
                  <span className="hidden md:inline">{SHORT_DOMAIN}/</span>
                  {r.link.short_code}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="block truncate text-text-2" title={r.link.original_url}>
                  {displayUrl(r.link.original_url)}
                </span>
                {kind && <span className="mt-0.5 block text-[12.5px] text-text-3">{kind}</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.current)}</TableCell>
              {showChange && (
                <TableCell className="text-right text-[13px] tabular-nums">
                  {r.prior === null ? (
                    <span className="text-text-3">---</span>
                  ) : (
                    <ChangeCount current={r.current} prior={r.prior} />
                  )}
                </TableCell>
              )}
              <TableCell className="hidden text-right tabular-nums text-text-2 md:table-cell">
                {formatShare(total > 0 ? r.current / total : 0)}
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <CopyLinkButton shortCode={r.link.short_code} className="-mr-2 md:-mr-2.5" />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell />
          <TableCell className="font-bold">
            Top {rows.length} of {formatNumber(linkCount)}
          </TableCell>
          <TableCell className="hidden md:table-cell" />
          <TableCell className="text-right tabular-nums">
            <span className="rule-total inline-block pb-1">{formatNumber(topSum)}</span>
          </TableCell>
          {showChange && <TableCell />}
          <TableCell className="hidden text-right tabular-nums md:table-cell">
            <span className="rule-total inline-block pb-1">
              {formatShare(total > 0 ? topSum / total : 0)}
            </span>
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}
