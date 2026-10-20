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
    <div
      role="group"
      aria-label="Time range"
      className="grid w-full grid-cols-4 gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto"
    >
      {ranges.map(({ value, label }) => {
        const active = current === value
        return (
          <Link
            key={value}
            href={`${basePath}?range=${value}`}
            aria-current={active ? 'page' : undefined}
            // 44px tall on touch screens. The selected segment sinks to the page
            // color and takes the green text: state is color plus depth, not
            // white against grey alone.
            className={`inline-flex min-h-11 items-center justify-center rounded-md px-3.5 text-sm font-medium transition-colors focus-ring sm:min-h-8 sm:px-3 ${
              active
                ? 'bg-background text-primary-text'
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
