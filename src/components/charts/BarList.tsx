import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface BarListItem {
  label: string
  value: number
  /** Makes the row a link (a 44px touch target on mobile). */
  href?: string
  /** Short code shown before the label, e.g. an ISO country code. */
  code?: string
  /** A line under the bar in tertiary text, e.g. the hosts in a platform group. */
  sub?: string
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
  className?: string
}

/**
 * One ranked list for every breakdown (links, referrers, countries, browsers,
 * devices). Each row is a label with its count and share, then a slate bar
 * with no background track (its length is the share of the largest row), then
 * an optional line in tertiary text. Counts and shares are tabular and
 * right-aligned. A server component: no client JS.
 */
export function BarList({ items, label, total, mono, emptyMessage, className }: BarListProps) {
  const rows = items.filter((item) => item.value > 0)

  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-text-2">
        {emptyMessage ?? 'No clicks in this period.'}
      </p>
    )
  }

  const hasCode = rows.some((r) => r.code)
  const max = Math.max(...rows.map((r) => r.value))
  const denominator = total && total > 0 ? total : rows.reduce((sum, r) => sum + r.value, 0)

  return (
    <ol aria-label={label} className={cn('flex flex-col', className)}>
      {rows.map((item) => {
        const share = item.value / denominator
        const rowClass = cn(
          'block py-2 pb-2.5 text-sm text-ink',
          item.href &&
            '-mx-2 min-h-11 rounded-ctl px-2 outline-none transition-colors duration-[120ms] hover:bg-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-focus',
        )
        const content = (
          <>
            <span className="grid grid-cols-[minmax(0,1fr)_72px_60px] items-baseline gap-2">
              <span className="flex min-w-0 items-baseline gap-2">
                {hasCode && (
                  <span className="w-7 shrink-0 font-mono text-xs text-text-3">{item.code}</span>
                )}
                <span
                  title={item.label}
                  className={cn('min-w-0 truncate font-medium', mono && 'font-mono font-normal text-[13.5px]')}
                >
                  {item.label}
                </span>
              </span>
              <span className="text-right tabular-nums">
                {item.value.toLocaleString('en-US')}
                <span className="sr-only"> clicks</span>
              </span>
              <span className="text-right tabular-nums text-text-2">
                {share > 0 && share < 0.001 ? '<0.1' : (share * 100).toFixed(1)}%
              </span>
            </span>
            <span
              aria-hidden
              className="mt-1.5 block h-1.5 bg-bar"
              style={{ width: `${Math.max((item.value / max) * 100, 0.75)}%` }}
            />
            {item.sub && (
              <span className="mt-1 block text-[12.5px] leading-snug text-text-3">{item.sub}</span>
            )}
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
