'use client'

import { PieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const DEVICE_COLORS: Record<string, string> = {
  desktop: 'var(--chart-1))',
  mobile: 'var(--chart-2))',
  tablet: 'var(--chart-3))',
  bot: 'var(--chart-4))',
  unknown: 'var(--chart-5))',
}

function buildChartConfig(
  data: { device: string; count: number }[]
): ChartConfig {
  const config: ChartConfig = {}
  const colorKeys = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
  data.forEach((item, i) => {
    config[item.device] = {
      label: item.device.charAt(0).toUpperCase() + item.device.slice(1),
      color: `var(--${colorKeys[i % colorKeys.length]})`,
    }
  })
  return config
}

export function DeviceChart({
  data,
}: {
  data: { device: string; count: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        No data yet
      </div>
    )
  }

  const chartConfig = buildChartConfig(data)

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[220px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="device" />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="device"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.device}
              fill={
                DEVICE_COLORS[entry.device] || 'var(--chart-5))'
              }
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
