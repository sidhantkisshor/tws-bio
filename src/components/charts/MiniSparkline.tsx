'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

// A fixed native SVG keeps recharts out of the links-page bundle and avoids the
// 0×0 measurements caused by rendering desktop/mobile breakpoint twins.
const SPARK_W = 56
const SPARK_H = 24

interface MiniSparklineProps {
  /** Per-day click counts, oldest to newest (e.g. the last 14 days). */
  data: number[]
  className?: string
}

// A minimal, axis-free trend indicator for click counts inside table cells —
// gives per-row scannability that a bare number can't (finding:
// links-per-link-sparklines). Deliberately tiny and non-interactive; the
// full ClickChart/BarChart remain the source of truth for detailed analysis.
export function MiniSparkline({ data, className }: MiniSparklineProps) {
  const gradientId = `sparkline-gradient-${useId().replace(/[:]/g, '')}`
  const hasSignal = data.length > 1 && data.some((v) => v > 0)

  if (!hasSignal) {
    // Reserve the same footprint as a populated sparkline so click-count
    // cells stay aligned across rows, without drawing a misleading flat line.
    return <div className={cn('h-6 w-14 shrink-0', className)} aria-hidden="true" />
  }

  const maxValue = Math.max(...data)
  const points = data.map((value, index) => {
    const x = 1 + (index / (data.length - 1)) * (SPARK_W - 2)
    const y = SPARK_H - 2 - (value / maxValue) * (SPARK_H - 4)
    return { x, y }
  })
  const linePath = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const areaPath = `${linePath} L ${last.x} ${SPARK_H - 1} L ${first.x} ${SPARK_H - 1} Z`

  return (
    <div className={cn('h-6 w-14 shrink-0', className)} aria-hidden="true">
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
