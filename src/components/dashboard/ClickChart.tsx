'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface ClickChartProps {
  data: { date: string; clicks: number }[]
}

const chartConfig = {
  clicks: {
    label: 'Clicks',
    color: '#22c55e',
  },
} satisfies ChartConfig

export function ClickChart({ data }: ClickChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No click data yet
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-clicks)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-clicks)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => {
            const d = new Date(value)
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                if (typeof value === 'string') {
                  return new Date(value).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }
                return value
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="clicks"
          stroke="var(--color-clicks)"
          strokeWidth={2}
          fill="url(#clicksGradient)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
