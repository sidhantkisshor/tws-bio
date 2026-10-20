import { LossCue } from '@/components/dashboard/LossCue'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatNumber, formatSignedCount, formatSignedPercent } from '@/lib/ledgerFormat'

export interface StatTrend {
  /** Percent change vs. the immediately-preceding period of equal length (rounded). */
  percent: number
  /** Absolute change (current - previous), for magnitude context percent alone can't give. */
  delta: number
  /** True when the prior period's baseline was zero, so a percent isn't meaningful. */
  isNew?: boolean
  /**
   * True for ratio/average metrics (e.g. "Avg Clicks/Link") where a decrease
   * isn't inherently bad: new links dilute the average even when clicks are
   * healthy. Renders in a neutral tone instead of teal/red.
   */
  isRatio?: boolean
}

/**
 * Computes a period-over-period trend from two comparable counts (same-length
 * current vs. immediately-preceding window). Returns null when there is
 * nothing meaningful to show (both periods are zero).
 *
 * Pass `isRatio: true` for average/ratio metrics (clicks-per-link and the
 * like) so the delta renders in a neutral tone: a drop in an average is often
 * benign (e.g. new links diluting it).
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

function toneClass(trend: StatTrend, value: number): string {
  if (trend.isRatio || value === 0) return 'text-text-2'
  return value > 0 ? 'text-pos' : 'text-neg'
}

/**
 * The change against the prior period, statement style: "+12%" or "(20%)"
 * in teal or red, then the absolute change in tertiary text ("+7", "(486)").
 * A first period with no baseline reads "New". Color is never the only
 * signal: the sign or the parentheses carry the direction.
 */
export function TrendChip({ trend }: { trend: StatTrend | null | undefined }) {
  if (!trend) return null

  const abs = formatSignedCount(trend.delta, trend.isRatio ? 1 : 0)

  if (trend.isNew) {
    return (
      <span className="inline-flex items-baseline gap-1.5 text-[13px] tabular-nums">
        <span className="font-medium text-text-2">New</span>
        <span className="text-text-3">{abs}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-baseline gap-1.5 text-[13px] tabular-nums">
      <span className={cn('font-bold', toneClass(trend, trend.percent))}>
        <LossCue value={formatSignedPercent(trend.percent / 100, 0)} />
        {formatSignedPercent(trend.percent / 100, 0)}
      </span>
      <span className="text-text-3">{abs}</span>
    </span>
  )
}

/**
 * The KPI delta line: one signed figure in teal or red, then "vs N" in
 * tertiary text. With a numeric `prior` and value the percent has one
 * decimal ("+12.4%"); `deltaFormat="count"` shows the absolute change
 * ("+416") instead.
 */
function KpiDelta({
  trend,
  value,
  prior,
  deltaFormat,
}: {
  trend: StatTrend | null | undefined
  value: string | number
  prior?: number | string | null
  deltaFormat: 'percent' | 'count'
}) {
  const priorText =
    prior === null || prior === undefined
      ? null
      : `vs ${typeof prior === 'number' ? formatNumber(prior) : prior}`
  if (!trend && !priorText) return null

  let figure: ReactNode = null
  if (trend) {
    if (trend.isNew) {
      figure = <span className="font-medium text-text-2">New</span>
    } else if (deltaFormat === 'count') {
      figure = (
        <span className={cn('font-bold', toneClass(trend, trend.delta))}>
          <LossCue value={formatSignedCount(trend.delta, trend.isRatio ? 1 : 0)} />
          {formatSignedCount(trend.delta, trend.isRatio ? 1 : 0)}
        </span>
      )
    } else {
      const exact =
        typeof prior === 'number' && prior > 0 && typeof value === 'number'
          ? formatSignedPercent((value - prior) / prior)
          : formatSignedPercent(trend.percent / 100, 0)
      figure = (
        <span className={cn('font-bold', toneClass(trend, trend.percent))}>
          <LossCue value={exact} />
          {exact}
        </span>
      )
    }
  }

  return (
    <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px] tabular-nums">
      {figure}
      {priorText && <span className="text-text-3">{priorText}</span>}
    </div>
  )
}

/**
 * One KPI cell: a label, the figure in the serif with the double "totals
 * rule" under it, and the change against the prior period. Put four of them
 * in a `KpiRow`, which draws the 2px rule above and the hairlines between.
 */
export function StatCell({
  title,
  value,
  trend,
  prior,
  unit,
  deltaFormat = 'percent',
  className,
}: {
  /** The label, e.g. "Clicks" or "Busiest day, 2 Oct". */
  title: string
  /** The figure. A number is grouped with en-US separators. */
  value: string | number
  /** From `computeTrend(current, prior)`. */
  trend?: StatTrend | null
  /** The prior period's figure, shown as "vs 13,512". */
  prior?: number | string | null
  /** Small text after the figure, e.g. "of 116". */
  unit?: ReactNode
  /** "percent" (default) shows "+12.4%", "count" shows "+416". */
  deltaFormat?: 'percent' | 'count'
  className?: string
}) {
  return (
    <div className={cn('min-w-0 py-4 pr-2', className)}>
      <p className="text-[13px] font-medium text-text-2">{title}</p>
      {/* The double totals rule sits under the figure only, never the unit. */}
      <p className="type-figure mt-2.5 text-ink">
        <span className="rule-total inline-block pb-1.5">
          {typeof value === 'number' ? formatNumber(value) : value}
        </span>
        {unit && (
          <span className="ml-2 font-sans text-[15px] font-normal tracking-normal text-text-2">
            {unit}
          </span>
        )}
      </p>
      <KpiDelta trend={trend} value={value} prior={prior} deltaFormat={deltaFormat} />
    </div>
  )
}

/**
 * The KPI row: a 2px ink rule above, four cells with hairlines between, two
 * by two on phones. Pass `StatCell`s as children.
 */
export function KpiRow({
  children,
  label,
  className,
}: {
  children: ReactNode
  /** Accessible name, e.g. "Last 30 days". */
  label?: string
  className?: string
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'rule-open grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule',
        // Phones, two by two: a hairline left of the second column and above the second row.
        '[&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:pl-4 [&>*:nth-child(n+3)]:border-t',
        // Desktop, one row: a hairline left of every cell after the first.
        'lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+2)]:pl-6 lg:[&>*:nth-child(n+3)]:border-t-0',
        className,
      )}
    >
      {children}
    </section>
  )
}

/** A labelled figure with an optional icon. Kept for older callers; new pages use StatCell in a KpiRow. */
export function StatCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
}: {
  title: string
  value: string | number
  icon?: ReactNode
  /** Trend vs. the prior period: pass the result of `computeTrend`. Omit or pass `null` to hide. */
  trend?: StatTrend | null
  /** Short context shown after the trend, e.g. "vs prior 30 days". */
  trendLabel?: string
}) {
  return (
    <div className="rule-open min-w-0 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-text-2">{title}</p>
        {icon && <span className="text-text-3 [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="type-figure mt-2.5 text-ink">
        <span className="rule-total inline-block pb-1.5">
          {typeof value === 'number' ? formatNumber(value) : value}
        </span>
      </p>
      {trend && (
        <div className="mt-2.5 flex items-baseline gap-2">
          <TrendChip trend={trend} />
          {trendLabel && <span className="text-[13px] text-text-3">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
