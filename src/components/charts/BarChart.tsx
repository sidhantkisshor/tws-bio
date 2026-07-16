'use client'

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface BarChartProps {
  data: { name: string; clicks: number }[]
  color?: string
}

// Rendered via ChartContainer (like ClickChart/BrowserChart) so tick fill and
// tooltip styling come from the chart tokens instead of the hardcoded hexes
// this component used to carry — one tooltip appearance across the dashboard.
export function BarChart({ data, color = 'var(--chart-1)' }: BarChartProps) {
  // Categories with zero clicks in every slot are indistinguishable from "no data" —
  // an axis with only invisible zero-width bars reads as broken, not empty.
  const hasVisibleData = data.length > 0 && data.some((item) => item.clicks > 0)

  if (!hasVisibleData) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
  }

  const chartConfig = {
    clicks: { label: 'Clicks', color },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      {/* margin left:80 + YAxis width:75 are layout-load-bearing — category labels need the room */}
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={75} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {/* minPointSize keeps small-but-nonzero values from collapsing to an invisible sliver */}
        <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[0, 4, 4, 0]} minPointSize={4} />
      </RechartsBarChart>
    </ChartContainer>
  )
}
