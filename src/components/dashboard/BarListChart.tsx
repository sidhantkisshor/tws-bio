'use client'

import { BarChart, Bar, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig: ChartConfig = {
  count: {
    label: 'Clicks',
    color: 'var(--chart-1)',
  },
}

/**
 * Generic horizontal bar-list chart for "top N" breakdowns (links, countries,
 * referrers, etc.) — same visual pattern as ReferrerChart, generalized so
 * new breakdown dimensions don't need a bespoke component each.
 */
export function BarListChart({
  data,
  emptyMessage = 'No data yet',
}: {
  data: { label: string; count: number }[]
  emptyMessage?: string
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={75}
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
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
