import Link from 'next/link'
import type { TimeRange } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface TimeRangePickerProps {
  current: TimeRange
  basePath: string
  /** False hides "All time" (Overview compares with the period before, which "All time" has none of). */
  showAllTime?: boolean
  className?: string
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]

/**
 * The one range control on the dashboard pages, writing the one `?range=`
 * vocabulary that parseTimeRange reads. A segmented control on the sunk
 * track: the selected option is a surface chip with an edge border. Plain
 * links, so it needs no client JS and every range is its own URL. Spans the
 * full width on phones. `showAllTime={false}` leaves "All time" out.
 */
export function TimeRangePicker({ current, basePath, showAllTime = true, className }: TimeRangePickerProps) {
  const shown = showAllTime ? ranges : ranges.filter((r) => r.value !== 'all')
  return (
    <nav
      aria-label="Time range"
      className={cn(
        'grid w-full gap-0.5',
        shown.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
        'rounded-ctl bg-sunk p-[3px] md:inline-grid md:w-auto md:auto-cols-max md:grid-flow-col md:grid-cols-none',
        className,
      )}
    >
      {shown.map(({ value, label }) => {
        const active = current === value
        return (
          <Link
            key={value}
            href={`${basePath}?range=${value}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-ring inline-flex h-[38px] items-center justify-center rounded-[2px] border px-1.5 text-[13px] font-medium whitespace-nowrap transition-[color,background-color,border-color] duration-150 md:h-[30px] md:px-3',
              active
                ? 'border-edge bg-surface text-ink'
                : 'border-transparent text-text-2 hover:text-ink',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
