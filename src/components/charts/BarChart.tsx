'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  data: { name: string; clicks: number }[]
  color?: string
}

export function BarChart({ data, color = '#00B03B' }: BarChartProps) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#a3a3a3' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#a3a3a3' }}
          width={75}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '8px', color: '#e5e5e5' }}
        />
        <Bar dataKey="clicks" fill={color} radius={[0, 4, 4, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
