'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// Shared chart-color ramp (see globals.css) — same tokens DeviceChart draws
// from, so a device pie and a browser pie stay visually consistent instead
// of landing on independently-chosen hexes.
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

interface DonutChartProps {
  data: { name: string; value: number }[]
}

export function DonutChart({ data }: DonutChartProps) {
  // Categories that are all zero render a legend with no visible ring (recharts still
  // emits zero-degree arcs) — that reads as a broken widget rather than empty data.
  const hasVisibleData = data.length > 0 && data.some((item) => item.value > 0)

  if (!hasVisibleData) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
  }

  return (
    <div role="img" aria-label="Donut chart showing distribution by category">
      <ResponsiveContainer width="100%" height={192}>
      <PieChart accessibilityLayer>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '8px', color: '#e5e5e5' }}
        />
        <Legend
          formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
    </div>
  )
}
