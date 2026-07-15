'use client'

import { useId } from 'react'
import { AreaChart, Area } from 'recharts'
import { cn } from '@/lib/utils'

// Fixed pixel footprint (Tailwind h-6 = 24px, w-14 = 56px). Charting at a fixed
// size avoids recharts' ResponsiveContainer, which measures 0×0 inside the
// display:none breakpoint twin (the mobile card list on desktop and vice versa)
// and floods the console with width(0)/height(0) warnings.
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

  const chartData = data.map((clicks, i) => ({ i, clicks }))

  return (
    <div className={cn('h-6 w-14 shrink-0', className)} aria-hidden="true">
      <AreaChart width={SPARK_W} height={SPARK_H} data={chartData} margin={{ top: 2, right: 1, left: 1, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="clicks"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  )
}
