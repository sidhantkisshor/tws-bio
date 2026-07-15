'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface ClickChartProps {
  data: { date: string; clicks: number }[]
  /** True when the underlying click query failed — renders a distinct
   * message from the zero-clicks empty state so a swallowed error doesn't
   * read as "this link genuinely has no clicks yet". */
  error?: boolean
}

const chartConfig = {
  clicks: {
    label: 'Clicks',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

// Dates arrive as plain 'YYYY-MM-DD' strings. Parsing those directly with
// `new Date(...)` treats them as UTC midnight, which renders as the prior
// day in any negative-UTC-offset timezone. Anchoring to local midnight
// keeps the displayed date stable regardless of viewer timezone.
function parseLocalDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T00:00:00`)
}

export function ClickChart({ data, error }: ClickChartProps) {
  const hasClicks = data.some((d) => d.clicks > 0)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div>
          <p className="text-foreground font-medium">Couldn&apos;t load click data</p>
          <p className="text-sm text-muted-foreground mt-1">
            Something went wrong.{' '}
            <Link
              href="/dashboard"
              className="text-primary-text hover:text-primary-text/80 underline underline-offset-4"
            >
              Try again
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (!data.length || !hasClicks) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No click data yet
      </div>
    )
  }

  const maxClicks = Math.max(...data.map((d) => d.clicks))

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
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => {
            return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
          domain={[0, Math.max(maxClicks + 1, 4)]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                if (typeof value === 'string') {
                  return parseLocalDate(value).toLocaleDateString('en-US', {
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
          strokeWidth={2.5}
          fill="url(#clicksGradient)"
          dot={{ r: 3, fill: 'var(--color-clicks)', stroke: 'var(--card)', strokeWidth: 1 }}
          activeDot={{ r: 5, fill: 'var(--color-clicks)', stroke: 'var(--card)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
