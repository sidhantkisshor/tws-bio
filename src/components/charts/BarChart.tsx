import { cn } from '@/lib/utils'

// Clicks per day as a server-rendered SVG: no chart library, no client JS.
// Daily bars in --bar, the prior period as a dotted line in --prior, y axis
// labels in tertiary text over a solid ink baseline, and at most two marked
// days in --bar-mark with a leader line and a text label ("ai-trade went
// live, 2 Oct"). A phone variant renders at its real width (358px) with
// shorter labels, so text is never scaled down; CSS shows one or the other.

export interface BarChartDay {
  /** 'YYYY-MM-DD' (an IST day key, as zeroFillDays returns). */
  date: string
  clicks: number
}

export interface BarChartMark {
  /** 'YYYY-MM-DD'. A mark outside `data` is ignored. */
  date: string
  /** Short text, e.g. "ai-trade went live, 2 Oct". */
  label: string
  /** Shorter text for the phone chart. Defaults to `label`. */
  shortLabel?: string
}

export interface BarChartProps {
  /** One row per day, oldest first (use zeroFillDays so empty days are 0). */
  data: BarChartDay[]
  /** The prior period, matched to `data` by index (day 1 with day 1). */
  prior?: BarChartDay[] | number[]
  /** Up to two marked days. Extra marks are dropped. */
  marks?: BarChartMark[]
  /** The query failed: show an inline error instead of the chart. */
  error?: boolean
  /** Text when every day is 0. */
  emptyText?: string
  /** Accessible name of the chart. */
  label?: string
  /** Name of the prior period in tooltips, e.g. "30 days before". */
  priorLabel?: string
  className?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(key: string): { y: number; m: number; d: number } {
  const t = Date.parse(key.slice(0, 10))
  const dt = new Date(Number.isFinite(t) ? t : 0)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() }
}

/** '2026-10-02' gives '2 Oct'. */
export function shortDay(key: string): string {
  const { m, d } = parts(key)
  return `${d} ${MONTHS[m]}`
}

function fullDay(key: string): string {
  const { y, m, d } = parts(key)
  return `${d} ${MONTHS[m]} ${y}`
}

function monthYear(key: string): string {
  const { y, m } = parts(key)
  return `${MONTHS[m]} ${y}`
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** A round step so the axis has 3 or 4 gridlines: 1, 2, 2.5 or 5 times a power of 10. */
function niceStep(max: number): number {
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return Math.max(1, m * pow)
  }
  return Math.max(1, 10 * pow)
}

function priorValues(prior: BarChartProps['prior'], n: number): number[] | null {
  if (!prior || prior.length === 0) return null
  const values = (prior as (BarChartDay | number)[]).map((p) =>
    typeof p === 'number' ? p : Number(p.clicks) || 0,
  )
  return values.slice(0, n)
}

interface Geometry {
  w: number
  h: number
  padL: number
  padR: number
  padT: number
  padB: number
  compact: boolean
}

function renderChart(
  props: Omit<BarChartProps, 'prior'> & { prior: number[] | null },
  g: Geometry,
  ariaLabel: string,
) {
  const { data, prior, priorLabel = 'Prior period' } = props
  const n = data.length
  const marks = (props.marks ?? [])
    .map((m) => ({ ...m, index: data.findIndex((d) => d.date.slice(0, 10) === m.date.slice(0, 10)) }))
    .filter((m) => m.index >= 0)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)

  const values = data.map((d) => Math.max(0, Number(d.clicks) || 0))
  const max = Math.max(1, ...values, ...(prior ?? []))
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)

  // Mark labels: one row above the plot, or two when they would collide.
  const charW = g.compact ? 5.9 : 6.4
  const labelFor = (m: (typeof marks)[number]) => (g.compact ? m.shortLabel ?? m.label : m.label)
  const slot = (g.w - g.padL - g.padR) / Math.max(n, 1)
  const xc = (i: number) => g.padL + (i + 0.5) * slot
  type Placed = { x: number; anchor: 'start' | 'end'; row: number; text: string; index: number }
  const placed: Placed[] = []
  for (const m of marks) {
    const text = labelFor(m)
    const width = text.length * charW
    const x = xc(m.index)
    let anchor: 'start' | 'end' = x + 4 + width > g.w - g.padR ? 'end' : 'start'
    if (anchor === 'end' && x - 4 - width < 0) anchor = 'start'
    placed.push({ x, anchor, row: 0, text, index: m.index })
  }
  if (placed.length === 2) {
    const span = (p: Placed) => {
      const width = p.text.length * charW
      return p.anchor === 'start' ? [p.x + 4, p.x + 4 + width] : [p.x - 4 - width, p.x - 4]
    }
    if (span(placed[0])[1] + 8 > span(placed[1])[0]) {
      // Try the first label to the left of its line.
      const first = { ...placed[0], anchor: 'end' as const }
      if (span(first)[0] >= 0 && span(first)[1] + 8 <= span(placed[1])[0]) placed[0] = first
      else placed[1] = { ...placed[1], row: 1 }
    }
  }
  const rows = placed.some((p) => p.row === 1) ? 2 : placed.length > 0 ? 1 : 0
  const padT = g.padT + (rows === 2 ? 14 : 0) + (rows === 0 ? -14 : 0)
  const h = g.h + (rows === 2 ? 14 : 0) + (rows === 0 ? -14 : 0)
  const ih = h - padT - g.padB
  const y = (v: number) => padT + ih - (v / top) * ih

  const gap = slot > 14 ? (g.compact ? 3 : 6) : slot > 5 ? 1.5 : slot > 2 ? 0.75 : 0
  const bw = Math.max(1, slot - gap)

  // X axis: 5 ticks on desktop, 4 on phones, first and last always.
  const tickCount = Math.min(n, g.compact ? 4 : 5)
  const xTicks = new Set<number>()
  for (let t = 0; t < tickCount; t++) {
    xTicks.add(tickCount === 1 ? 0 : Math.round((t * (n - 1)) / (tickCount - 1)))
  }
  const multiYear = n > 120 && parts(data[0].date).y !== parts(data[n - 1].date).y
  const xLabel = (key: string) => (multiYear ? monthYear(key) : shortDay(key))

  const markIdx = new Set(marks.map((m) => m.index))
  const textStyle = { fontVariantNumeric: 'tabular-nums' } as const

  return (
    <svg
      viewBox={`0 0 ${g.w} ${h}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className="block h-auto overflow-visible"
      fontFamily="var(--font-sans)"
    >
      {/* The aria-label above is the text alternative. Hide the parts, so a
          screen reader does not walk every bar and tick (the <title> tooltips
          still show on hover). */}
      <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={g.padL}
            x2={g.w - g.padR}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? 'var(--ink-2)' : 'var(--rule)'}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text
            x={g.padL - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={g.compact ? 11 : 12}
            fill="var(--text-3)"
            style={textStyle}
          >
            {fmt(t)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const v = values[i]
        const x = xc(i) - bw / 2
        const priorText = prior && prior[i] !== undefined ? `, ${priorLabel.toLowerCase()}: ${fmt(prior[i])}` : ''
        return (
          <g key={d.date}>
            <title>{`${fullDay(d.date)}: ${fmt(v)} ${v === 1 ? 'click' : 'clicks'}${priorText}`}</title>
            {/* Full-height hit area so a day with few clicks still shows its tooltip. */}
            <rect x={xc(i) - slot / 2} y={padT} width={slot} height={ih} fill="transparent" />
            {v > 0 && (
              <rect
                x={x}
                y={y(v)}
                width={bw}
                height={Math.max(0, y(0) - y(v))}
                fill={markIdx.has(i) ? 'var(--bar-mark)' : 'var(--bar)'}
                shapeRendering="crispEdges"
              />
            )}
          </g>
        )
      })}

      {prior && prior.length > 1 && (
        <polyline
          points={prior.map((v, i) => `${xc(i).toFixed(1)},${y(Math.max(0, v)).toFixed(1)}`).join(' ')}
          fill="none"
          stroke="var(--prior)"
          strokeWidth={1.5}
          strokeDasharray="2 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {placed.map((p) => {
        const labelY = padT - 14 - (rows === 2 && p.row === 0 ? 14 : 0)
        const barTop = y(values[p.index])
        return (
          <g key={`mark-${p.index}`} pointerEvents="none">
            <line
              x1={p.x}
              x2={p.x}
              y1={labelY + 2}
              y2={Math.max(labelY + 2, barTop - 6)}
              stroke="var(--text-3)"
              strokeWidth={1}
            />
            <text
              x={p.anchor === 'start' ? p.x + 4 : p.x - 4}
              y={labelY}
              textAnchor={p.anchor}
              fontSize={g.compact ? 11 : 12}
              fontWeight={500}
              fill="var(--text-2)"
            >
              {p.text}
            </text>
          </g>
        )
      })}

      {[...xTicks].map((i) => (
        <text
          key={`x-${i}`}
          x={xc(i)}
          y={h - 6}
          textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          dx={n === 1 ? 0 : i === 0 ? -Math.min(bw / 2, 6) : i === n - 1 ? Math.min(bw / 2, 6) : 0}
          fontSize={g.compact ? 11 : 12}
          fill="var(--text-3)"
          style={textStyle}
        >
          {xLabel(data[i].date)}
        </text>
      ))}
      </g>
    </svg>
  )
}

/**
 * Clicks per day. Server component (also safe in a client tree: no hooks).
 * Shows an inline error on `error`, and `emptyText` when every day is 0.
 */
export function BarChart(props: BarChartProps) {
  const { data, error, emptyText = 'No clicks in this period.', label, className } = props

  if (error) {
    return (
      <p
        role="status"
        className={cn('flex min-h-48 items-center text-sm text-text-2 md:min-h-64', className)}
      >
        Clicks per day could not load. Reload the page to try again.
      </p>
    )
  }

  const total = data.reduce((s, d) => s + Math.max(0, Number(d.clicks) || 0), 0)
  if (data.length === 0 || total === 0) {
    return (
      <p className={cn('flex min-h-48 items-center text-sm text-text-2 md:min-h-64', className)}>
        {emptyText}
      </p>
    )
  }

  const prior = priorValues(props.prior, data.length)
  let peak = 0
  data.forEach((d, i) => {
    if ((Number(d.clicks) || 0) > (Number(data[peak].clicks) || 0)) peak = i
  })
  const range = `${fullDay(data[0].date)} to ${fullDay(data[data.length - 1].date)}`
  const priorTotal = prior ? prior.reduce((s, v) => s + Math.max(0, v), 0) : null
  const ariaLabel =
    `${label ?? 'Clicks per day'}, ${range}. ${fmt(total)} clicks in all, most on ${fullDay(data[peak].date)} with ${fmt(Number(data[peak].clicks) || 0)}.` +
    (priorTotal !== null ? ` The period before had ${fmt(priorTotal)}, drawn as a dotted line.` : '') +
    (props.marks ?? []).slice(0, 2).map((m) => ` Marked: ${m.label}.`).join('')

  return (
    <div className={cn('min-w-0', className)}>
      <div className="hidden md:block">
        {renderChart({ ...props, prior }, { w: 820, h: 280, padL: 44, padR: 8, padT: 30, padB: 26, compact: false }, ariaLabel)}
      </div>
      <div className="md:hidden">
        {renderChart({ ...props, prior }, { w: 358, h: 220, padL: 34, padR: 6, padT: 26, padB: 24, compact: true }, ariaLabel)}
      </div>
    </div>
  )
}

/** The chart legend: a slate square for this period, a dotted line for the one before. */
export function ChartLegend({
  currentLabel = 'This period',
  priorLabel = '30 days before',
  showPrior = true,
  className,
}: {
  currentLabel?: string
  priorLabel?: string
  showPrior?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-2', className)}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block size-2.5 bg-bar" />
        {currentLabel}
      </span>
      {showPrior && (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block w-[18px] border-t-2 border-dotted border-prior" />
          {priorLabel}
        </span>
      )}
    </div>
  )
}
