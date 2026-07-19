'use client'

import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

// Shared chart-color ramp (see globals.css). Cells default to this ramp so a
// device pie and a browser pie stay visually consistent; callers can override
// per-category via `colorMap` (e.g. stable device colors).
const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface PieChartProps {
  data: { name: string; value: number }[]
  colorMap?: Record<string, string>
  innerRadius?: number
  outerRadius?: number
  className?: string
  ariaLabel?: string
  emptyMessage?: string
}

// First char upper, rest untouched — drives legend labels off the raw category.
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Unified donut chart for the dashboard's categorical breakdowns (devices,
 * browsers, ...). Replaces the former DeviceChart / DonutChart pair — one
 * component with an optional per-category color map and a legend driven from
 * the data itself.
 */
export function PieChart({
  data,
  colorMap,
  innerRadius = 50,
  outerRadius = 70,
  className = 'h-48 w-full',
  ariaLabel = 'Donut chart showing distribution by category',
  emptyMessage = 'No data yet',
}: PieChartProps) {
  // All-zero categories still emit zero-degree arcs — a ring-less legend reads
  // as a broken widget rather than empty data.
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

  const fillFor = (name: string, index: number): string =>
    colorMap
      ? (colorMap[name] ?? COLORS[index % COLORS.length])
      : COLORS[index % COLORS.length]

  // Categories are dynamic, so the config is built from the data — this drives
  // the legend labels; swatches pick up each slice's cell fill automatically.
  const chartConfig: ChartConfig = {}
  data.forEach((entry, index) => {
    chartConfig[entry.name] = {
      label: capitalize(entry.name),
      color: fillFor(entry.name, index),
    }
  })

  return (
    <div role="img" aria-label={ariaLabel}>
      <ChartContainer config={chartConfig} className={className}>
        <RechartsPieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={fillFor(entry.name, index)} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </RechartsPieChart>
      </ChartContainer>
    </div>
  )
}
