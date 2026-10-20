import { cn } from '@/lib/utils'

// A plain SVG line, so no chart library reaches the links page bundle. Works
// in server and client components (no hooks).
const SPARK_W = 96
const SPARK_H = 24

interface MiniSparklineProps {
  /** Per-day click counts, oldest to newest (e.g. the last 14 days). */
  data: number[]
  className?: string
}

/**
 * A tiny axis-free trend line for a table cell, in the chart bar color with
 * no fill. The line is aria-hidden; screen readers get a short sentence
 * instead ("38 clicks, up to 7 a day").
 * With no clicks it keeps the same footprint and draws nothing, so the
 * column stays aligned and a flat line never reads as data.
 */
export function MiniSparkline({ data, className }: MiniSparklineProps) {
  const hasSignal = data.length > 1 && data.some((v) => v > 0)

  if (!hasSignal) {
    return (
      <div className={cn('h-6 w-24 shrink-0', className)}>
        <span className="sr-only">No clicks</span>
      </div>
    )
  }

  const maxValue = Math.max(...data)
  const total = data.reduce((s, v) => s + Math.max(0, v), 0)
  const points = data
    .map((value, index) => {
      const x = 2 + (index / (data.length - 1)) * (SPARK_W - 4)
      const y = SPARK_H - 2 - (value / maxValue) * (SPARK_H - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className={cn('h-6 w-24 shrink-0', className)}>
      <span className="sr-only">
        {total.toLocaleString('en-US')} {total === 1 ? 'click' : 'clicks'}, up to {maxValue.toLocaleString('en-US')} a day
      </span>
      <svg aria-hidden="true" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-full w-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="var(--bar)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
