'use client'

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface BarChartProps {
  data: { label: string; value: number }[]
  orientation?: 'horizontal' | 'vertical'
  color?: string
  emptyMessage?: string
  className?: string
}

/**
 * Unified bar chart for every dashboard "top N" / breakdown widget. Replaces
 * the former ReferrerChart / BarListChart / BrowserChart / charts.BarChart
 * quartet — one component, two orientations, one set of standardized axis and
 * tooltip styling drawn from the chart tokens (see ui/chart + globals.css).
 */
export function BarChart({
  data,
  orientation = 'horizontal',
  color = 'var(--chart-1)',
  emptyMessage = 'No data yet',
  className = 'h-[280px] w-full',
}: BarChartProps) {
  // Categories that are all zero are indistinguishable from "no data" — an axis
  // of invisible zero-width bars reads as broken, not empty.
  const hasVisibleData = data.length > 0 && data.some((d) => d.value > 0)

  if (!hasVisibleData) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  const chartConfig = {
    value: { label: 'Clicks', color },
  } satisfies ChartConfig

  if (orientation === 'vertical') {
    return (
      <ChartContainer config={chartConfig} className={className}>
        <RechartsBarChart data={data}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {/* minPointSize keeps small-but-nonzero values from collapsing to an invisible sliver */}
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[4, 4, 0, 0]}
            minPointSize={4}
          />
        </RechartsBarChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      {/* margin left:80 + YAxis width:75 are layout-load-bearing — category labels need the room */}
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <YAxis
          type="category"
          dataKey="label"
          width={75}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* minPointSize keeps small-but-nonzero values from collapsing to an invisible sliver */}
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[0, 4, 4, 0]}
          minPointSize={4}
        />
      </RechartsBarChart>
    </ChartContainer>
  )
}
