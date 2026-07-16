import { Card, CardContent } from '@/components/ui/card'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

export interface StatTrend {
  /** Percent change vs. the immediately-preceding period of equal length (rounded). */
  percent: number
  /** Absolute change (current - previous), for magnitude context percent alone can't give. */
  delta: number
  /** True when the prior period's baseline was zero, so a percent isn't meaningful. */
  isNew?: boolean
  /**
   * True for ratio/average metrics (e.g. "Avg Clicks/Link") where a decrease
   * isn't inherently bad — new links dilute the average even when clicks are
   * healthy. Renders the chip in a neutral tone instead of red/green.
   */
  isRatio?: boolean
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
 *
 * Pass `isRatio: true` for average/ratio metrics (clicks-per-link and the
 * like) so `TrendChip` renders a neutral tone instead of alarm red/green —
 * a drop in an average is often benign (e.g. new links diluting it).
 */
export function computeTrend(
  current: number,
  previous: number,
  options?: { isRatio?: boolean }
): StatTrend | null {
  const delta = current - previous
  if (previous <= 0) {
    if (current <= 0) return null
    return { percent: 100, delta, isNew: true, isRatio: options?.isRatio }
  }
  return {
    percent: Math.round((delta / previous) * 100),
    delta,
    isRatio: options?.isRatio,
  }
}

/** Formats an absolute delta with an explicit sign, e.g. "+7" or "-1.2". */
function formatDelta(delta: number, isRatio?: boolean): string {
  const rounded = isRatio ? Math.round(delta * 10) / 10 : Math.round(delta)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}`
}

/**
 * Small delta chip: shows both the relative percent and the absolute change
 * (e.g. "↑500% (+7)") so a swing at a small denominator doesn't read as
 * alarmist with no sense of scale. Colored green for a favorable move, red
 * for an unfavorable one, and muted for flat/new — except ratio/average
 * metrics (`isRatio`), which always render in a neutral tone since their
 * direction isn't inherently good or bad.
 */
export function TrendChip({ trend }: { trend: StatTrend | null | undefined }) {
  if (!trend) return null

  const deltaText = formatDelta(trend.delta, trend.isRatio)

  if (trend.isNew) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-text/10 px-1.5 py-0.5 text-xs font-medium text-primary-text">
        New {deltaText}
      </span>
    )
  }

  const isFlat = trend.percent === 0
  const isUp = trend.percent > 0
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown
  const colorClass =
    isFlat || trend.isRatio
      ? 'text-muted-foreground'
      : isUp
        ? 'text-primary-text'
        : 'text-destructive'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span className="inline-flex items-center gap-0.5">
        <Icon className="h-3 w-3" />
        {Math.abs(trend.percent)}%
      </span>
      <span className="text-muted-foreground font-normal">({deltaText})</span>
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
            <p className="text-3xl font-bold font-mono tabular-nums text-foreground mt-1">{value}</p>
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
