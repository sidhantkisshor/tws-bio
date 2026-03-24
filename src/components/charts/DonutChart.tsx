'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#00B03B', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6b7280']

interface DonutChartProps {
  data: { name: string; value: number }[]
}

export function DonutChart({ data }: DonutChartProps) {
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-muted-foreground">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
  )
}
