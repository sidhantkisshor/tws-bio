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
 * no fill. Decorative (aria-hidden): the row's numbers carry the meaning.
 * With no clicks it keeps the same footprint and draws nothing, so the
 * column stays aligned and a flat line never reads as data.
 */
export function MiniSparkline({ data, className }: MiniSparklineProps) {
  const hasSignal = data.length > 1 && data.some((v) => v > 0)

  if (!hasSignal) {
    return <div className={cn('h-6 w-24 shrink-0', className)} aria-hidden="true" />
  }

  const maxValue = Math.max(...data)
  const points = data
    .map((value, index) => {
      const x = 2 + (index / (data.length - 1)) * (SPARK_W - 4)
      const y = SPARK_H - 2 - (value / maxValue) * (SPARK_H - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className={cn('h-6 w-24 shrink-0', className)} aria-hidden="true">
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-full w-full" preserveAspectRatio="none">
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
