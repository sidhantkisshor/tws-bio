'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ClicksOverTimeChartProps {
  data: { date: string; clicks: number }[]
}

export function ClicksOverTimeChart({ data }: ClicksOverTimeChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">No click data yet</div>
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#a3a3a3' }}
          tickFormatter={(d: string) => {
            const date = new Date(d + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '8px', color: '#e5e5e5' }}
          labelFormatter={(d) => {
            const date = new Date(String(d) + 'T00:00:00')
            return date.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })
          }}
        />
        <Area type="monotone" dataKey="clicks" stroke="#00B03B" fill="rgba(0,176,59,0.15)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
