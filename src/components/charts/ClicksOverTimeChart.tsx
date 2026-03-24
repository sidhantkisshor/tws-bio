'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ClicksOverTimeChartProps {
  data: { date: string; clicks: number }[]
}

export function ClicksOverTimeChart({ data }: ClicksOverTimeChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No click data yet</div>
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickFormatter={(d: string) => {
            const date = new Date(d + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(d) => {
            const date = new Date(String(d) + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })
          }}
        />
        <Area type="monotone" dataKey="clicks" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
