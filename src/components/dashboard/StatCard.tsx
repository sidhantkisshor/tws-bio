import { Card, CardContent } from '@/components/ui/card'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

export interface StatTrend {
  /** Percent change vs. the immediately-preceding period of equal length (rounded). */
  percent: number
  /** True when the prior period's baseline was zero, so a percent isn't meaningful. */
  isNew?: boolean
}

interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  /** Trend vs. the prior period — pass the result of `computeTrend`. Omit or pass `null` to hide. */
  trend?: StatTrend | null
  /** Short context shown after the trend chip, e.g. "vs prior 30 days". */
  trendLabel?: string
}

/**
 * Computes a period-over-period trend from two comparable counts (same-length
 * current vs. immediately-preceding window). Returns null when there is
 * nothing meaningful to show (both periods are zero).
 */
export function computeTrend(current: number, previous: number): StatTrend | null {
  if (previous <= 0) {
    if (current <= 0) return null
    return { percent: 100, isNew: true }
  }
  return { percent: Math.round(((current - previous) / previous) * 100) }
}

/** Small colored delta chip: green up, red down, muted flat/new. */
export function TrendChip({ trend }: { trend: StatTrend | null | undefined }) {
  if (!trend) return null

  if (trend.isNew) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-text/10 px-1.5 py-0.5 text-xs font-medium text-primary-text">
        New
      </span>
    )
  }

  const isFlat = trend.percent === 0
  const isUp = trend.percent > 0
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown
  const colorClass = isFlat
    ? 'text-muted-foreground'
    : isUp
      ? 'text-primary-text'
      : 'text-destructive'

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(trend.percent)}%
    </span>
  )
}

export function StatCard({ title, value, icon, trend, trendLabel }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-mono text-foreground mt-1">{value}</p>
            {trend && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <TrendChip trend={trend} />
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
