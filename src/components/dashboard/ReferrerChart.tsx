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

export function ReferrerChart({
  data,
}: {
  data: { referrer: string; count: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        No data yet
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <YAxis
          type="category"
          dataKey="referrer"
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
