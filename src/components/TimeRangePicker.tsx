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

export function TimeRangePicker({ current, basePath }: TimeRangePickerProps) {
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {ranges.map(({ value, label }) => (
        <Link
          key={value}
          href={`${basePath}?range=${value}`}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
            current === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
