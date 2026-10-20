import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface BarListItem {
  label: string
  value: number
  /** Makes the row a link (a 44px touch target on mobile). */
  href?: string
  /** Short code shown before the label, e.g. an ISO country code. */
  code?: string
}

interface BarListProps {
  items: BarListItem[]
  /** Accessible name for the list. */
  label: string
  /** The denominator for the share column. Defaults to the sum of the items. */
  total?: number
  /** Set the label in the mono voice (short codes). */
  mono?: boolean
  emptyMessage?: string
}

/**
 * One ranked list for every breakdown (links, referrers, countries, browsers,
 * devices). Each row is its own track with a quiet green tint for the bar, so
 * the label, the count and the share are all readable without hovering, long
 * labels truncate with a title, and green stays a signal instead of a block of
 * solid fills. A server component: no recharts, no client JS.
 */
export function BarList({ items, label, total, mono, emptyMessage }: BarListProps) {
  const rows = items.filter((item) => item.value > 0)

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? 'No clicks in this period'}
      </p>
    )
  }

  // One code column for the whole list, so labels line up even when a row (an
  // 'Unknown' country) has no code.
  const hasCode = rows.some((r) => r.code)
  const max = Math.max(...rows.map((r) => r.value))
  const denominator = total && total > 0 ? total : rows.reduce((sum, r) => sum + r.value, 0)

  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      {rows.map((item) => {
        const pct = (item.value / denominator) * 100
        const rowClass = cn(
          'relative flex h-9 items-center gap-3 overflow-hidden rounded-md px-3 text-sm text-foreground',
          item.href &&
            'h-11 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-9',
        )
        const content = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-md bg-primary-text/15"
              style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }}
            />
            {hasCode && (
              <span className="relative w-7 shrink-0 font-mono text-xs text-muted-foreground">
                {item.code}
              </span>
            )}
            <span
              title={item.label}
              className={cn('relative min-w-0 flex-1 truncate', mono && 'font-mono')}
            >
              {item.label}
            </span>
            <span className="relative w-16 shrink-0 text-right font-mono tabular-nums">
              {item.value.toLocaleString('en-US')}
              <span className="sr-only"> clicks</span>
            </span>
            <span className="relative w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {pct < 1 ? '<1' : Math.round(pct)}%
            </span>
          </>
        )
        return (
          <li key={`${item.code ?? ''}${item.label}`}>
            {item.href ? (
              <Link href={item.href} className={rowClass}>
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

let regionNames: Intl.DisplayNames | null | undefined

/** 'IN' becomes 'India'. Anything that is not a known ISO code comes back as is. */
function regionName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  try {
    const name = regionNames?.of(code)
    return name && name !== code ? name : code
  } catch {
    return code
  }
}

/** Country rows for BarList: the full name as the label, the ISO code beside it. */
export function countryItems(rows: { name: string; clicks: number }[]): BarListItem[] {
  return rows.map((row) =>
    /^[A-Z]{2}$/.test(row.name)
      ? { label: regionName(row.name), code: row.name, value: row.clicks }
      : { label: row.name, value: row.clicks },
  )
}

/** Device and browser rows for BarList, with the first letter capitalised ('mobile' is 'Mobile'). */
export function namedItems(rows: { name: string; value: number }[]): BarListItem[] {
  return rows.map((row) => ({
    label: row.name.charAt(0).toUpperCase() + row.name.slice(1),
    value: row.value,
  }))
}
