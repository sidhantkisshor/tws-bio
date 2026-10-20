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
import { SHORT_MONTHS } from '@/lib/utils'

interface ClickChartProps {
  data: { date: string; clicks: number }[]
  /** True when the underlying click query failed: renders a distinct
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

// Dates arrive as plain 'YYYY-MM-DD' keys, each naming a calendar day in India
// (dayKey in lib/analytics). A key is a label, not an instant, so it must show
// as written in every viewer zone. Parsing it directly with `new Date(...)`
// treats it as UTC midnight, which renders as the prior day in any zone behind
// UTC. Local midnight on that date formats back to the same date in any zone.
function parseLocalDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T00:00:00`)
}

/**
 * '5 Oct', or '5 Oct 2026' with the year. The key is a calendar day, so the
 * fixed month table plus the local getters read it back the same in every
 * viewer zone.
 */
function formatDay(value: string, withYear = false): string {
  const d = parseLocalDate(value)
  const day = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
  return withYear ? `${day} ${d.getFullYear()}` : day
}

// Count back from the newest day in even steps, so the latest day always has a
// label and the gaps are equal. recharts' own interval picks ticks by label
// width, which gave neighbours 6px apart next to gaps of 30px.
function pickTicks(dates: string[]): string[] {
  const n = dates.length
  const step = n <= 7 ? 1 : n <= 31 ? 7 : n <= 92 ? 21 : Math.ceil((n - 1) / 4)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= step) out.unshift(dates[i])
  return out
}

// A round step (1, 2, 5, 10, 20, 50 ...) for four even bands, so the top tick is
// a clean number instead of the raw peak.
function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
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
        No clicks in this period
      </div>
    )
  }

  const maxClicks = Math.max(...data.map((d) => d.clicks))
  const step = niceStep(Math.max(maxClicks, 4) / 4)

  return (
    <ChartContainer
      config={chartConfig}
      className="h-64 w-full [&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:tabular-nums"
    >
      <AreaChart data={data} margin={{ top: 5, right: 22, left: 0, bottom: 0 }}>
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
          ticks={pickTicks(data.map((d) => d.date))}
          interval={0}
          tickFormatter={(value: string) => formatDay(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width="auto"
          ticks={[0, step, step * 2, step * 3, step * 4]}
          domain={[0, step * 4]}
          tickFormatter={(v: number) => v.toLocaleString('en-US')}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                return typeof value === 'string' ? formatDay(value, true) : value
              }}
            />
          }
        />
        <Area
          type="linear"
          dataKey="clicks"
          stroke="var(--color-clicks)"
          strokeWidth={2}
          fill="url(#clicksGradient)"
          // A dot per day turns a 90-day line into a row of beads: draw them
          // only while there are few enough to read.
          dot={
            data.length <= 14
              ? { r: 2.5, fill: 'var(--color-clicks)', stroke: 'var(--card)', strokeWidth: 1 }
              : false
          }
          activeDot={{ r: 4, fill: 'var(--color-clicks)', stroke: 'var(--card)', strokeWidth: 2 }}
          // The draw-in replays on every resize, and a chart that animates on
          // each range change adds delay for no meaning.
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
