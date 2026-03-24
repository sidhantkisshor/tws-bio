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

export function BarChart({ data, color = '#2563eb' }: BarChartProps) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          width={75}
        />
        <Tooltip />
        <Bar dataKey="clicks" fill={color} radius={[0, 4, 4, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
