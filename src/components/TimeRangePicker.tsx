import Link from 'next/link'
import type { TimeRange } from '@/lib/analytics'

interface TimeRangePickerProps {
  current: TimeRange
  basePath: string
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

/**
 * The one range control on Analytics and the link and campaign detail pages,
 * writing the one `?range=` vocabulary that parseTimeRange reads. Plain links,
 * so it needs no client JS and every range is its own URL.
 */
export function TimeRangePicker({ current, basePath }: TimeRangePickerProps) {
  return (
    <div role="group" aria-label="Time range" className="flex gap-1 bg-muted rounded-lg p-1">
      {ranges.map(({ value, label }) => {
        const active = current === value
        return (
          <Link
            key={value}
            href={`${basePath}?range=${value}`}
            aria-current={active ? 'page' : undefined}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
