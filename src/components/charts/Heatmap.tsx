import type { Heatmap as HeatmapData } from '@/lib/heatmap'
import { cn } from '@/lib/utils'

// "Best time to post": clicks by IST weekday and hour on the six-step slate
// ramp (--hm0 to --hm5). No numbers in the cells; the answer is written above
// the grid in words, and the busiest two-hour window is outlined in amber on
// a page-colored gap ring. Phones get 3-hour blocks so cells stay tappable
// in size. Each grid is a real table, so every cell has an accessible label
// (day, hours, clicks) through its row and column heads and its own text.

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const RAMP = ['bg-hm0', 'bg-hm1', 'bg-hm2', 'bg-hm3', 'bg-hm4', 'bg-hm5'] as const

/** 0 gives "12 AM", 13 gives "1 PM", 24 gives "midnight". */
function clock(hour: number): string {
  if (hour === 24 || hour === 0) return hour === 24 ? 'midnight' : '12 AM'
  if (hour === 12) return 'noon'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

/** Short axis label: 0 "12a", 6 "6a", 12 "12p", 18 "6p". */
function axisHour(hour: number): string {
  if (hour === 0) return '12a'
  if (hour < 12) return `${hour}a`
  if (hour === 12) return '12p'
  return `${hour - 12}p`
}

function step(v: number, max: number): number {
  if (v <= 0 || max <= 0) return 0
  return Math.min(5, Math.max(1, Math.ceil((v / max) * 5)))
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** The sentence above the grid. Exported for tests and for a page summary. */
export function heatmapSentence(data: HeatmapData): string | null {
  const best = data.bestWindows[0]
  if (!best || data.total <= 0) return null
  const avgHour = data.total / 168
  const ratio = best.clicks / 2 / avgHour
  const when = `${DAY_NAMES[best.dow]}, ${clock(best.startHour)} to ${clock(best.startHour + 2)}`
  const times =
    ratio >= 1.15 ? `, about ${ratio.toFixed(1)} times an average hour` : ''
  const next = data.bestWindows[1]
  const nextText = next
    ? ` Next best: ${DAY_NAMES[next.dow]}, ${clock(next.startHour)} to ${clock(next.startHour + 2)}.`
    : ''
  return `${when} gets the most clicks${times}.${nextText}`
}

export interface HeatmapProps {
  /** The output of buildHeatmap (src/lib/heatmap.ts). */
  data: HeatmapData
  /** The query failed: show an inline error instead of the grid. */
  error?: boolean
  /** Text when there are no clicks. */
  emptyText?: string
  className?: string
}

function Grid({
  data,
  block,
  best,
  className,
  hideFromScreenReaders = false,
}: {
  data: HeatmapData
  block: 1 | 3
  best: { dow: number; startHour: number } | null
  className?: string
  hideFromScreenReaders?: boolean
}) {
  const cols = 24 / block
  // Values per column (sum of the hours in the block), and the scale max.
  const cells = data.grid.map((row) =>
    Array.from({ length: cols }, (_, c) => {
      let v = 0
      for (let b = 0; b < block; b++) v += row[c * block + b] ?? 0
      return v
    }),
  )
  const max = Math.max(0, ...cells.flat())
  const isBest = (d: number, c: number) => {
    if (!best || d !== best.dow) return false
    const start = c * block
    const end = start + block
    return start < best.startHour + 2 && end > best.startHour
  }

  return (
    <table
      aria-hidden={hideFromScreenReaders || undefined}
      className={cn('w-full table-fixed border-separate border-spacing-[3px]', className)}
    >
      <caption className="sr-only">
        Clicks by weekday and {block === 1 ? 'hour' : 'three-hour block'}, India time
      </caption>
      <colgroup>
        <col className={block === 1 ? 'w-9' : 'w-8'} />
      </colgroup>
      <thead>
        <tr>
          <td />
          {Array.from({ length: cols }, (_, c) => {
            const hour = c * block
            const show = block === 3 || hour % 6 === 0
            const name = block === 1 ? clock(hour) : `${clock(hour)} to ${clock(hour + 3)}`
            return (
              <th key={c} scope="col" className="h-4 p-0 text-left align-bottom text-[11px] leading-none font-normal whitespace-nowrap text-text-3">
                <span aria-hidden>{show ? axisHour(hour) : ''}</span>
                <span className="sr-only">{name}</span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {cells.map((row, d) => (
          <tr key={d}>
            <th scope="row" className="p-0 pr-1 text-left text-xs font-normal text-text-2">
              <span aria-hidden>{DAY_SHORT[d]}</span>
              <span className="sr-only">{DAY_NAMES[d]}</span>
            </th>
            {row.map((v, c) => {
              const hour = c * block
              const span = block === 1 ? `${clock(hour)} to ${clock(hour + 1)}` : `${clock(hour)} to ${clock(hour + 3)}`
              const text = `${DAY_NAMES[d]}, ${span}: ${fmt(v)} ${v === 1 ? 'click' : 'clicks'}`
              const mark = isBest(d, c)
              return (
                <td
                  key={c}
                  title={text}
                  className={cn(
                    'p-0',
                    block === 1 ? 'h-5' : 'h-[26px]',
                    'rounded-[1px]',
                    RAMP[step(v, max)],
                    mark && 'shadow-[inset_0_0_0_2px_var(--bar-mark),inset_0_0_0_4px_var(--page)]',
                  )}
                >
                  <span className="sr-only">
                    {fmt(v)} {v === 1 ? 'click' : 'clicks'}
                    {mark ? ', busiest slot' : ''}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The best-time-to-post grid with its sentence and legend. Server component
 * (no hooks). Put it inside a `Section` titled "Best time to post".
 */
export function Heatmap({ data, error, emptyText = 'No clicks in this period yet.', className }: HeatmapProps) {
  if (error) {
    return (
      <p role="status" className={cn('py-6 text-sm text-text-2', className)}>
        Clicks by hour could not load. Reload the page to try again.
      </p>
    )
  }
  const sentence = heatmapSentence(data)
  if (!sentence) {
    return <p className={cn('py-6 text-sm text-text-2', className)}>{emptyText}</p>
  }
  const best = data.bestWindows[0] ?? null
  const [lead, ...rest] = sentence.split(' gets the most clicks')
  const tail = ` gets the most clicks${rest.join(' gets the most clicks')}`

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-4 max-w-[60ch] text-sm leading-relaxed text-text-2">
        <strong className="font-bold text-ink">{lead}</strong>
        {tail}
      </p>
      {/* Screen readers get the 3-hour table at every width (56 labelled
          slots, not 168); the hourly grid is visual only. */}
      <Grid data={data} block={1} best={best} className="hidden md:table" hideFromScreenReaders />
      <Grid data={data} block={3} best={best} className="md:sr-only" />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-3">
        <span className="inline-flex items-center gap-1">
          <span className="mr-1.5">Fewer</span>
          {RAMP.map((c) => (
            <i key={c} aria-hidden className={cn('inline-block h-3 w-4', c)} />
          ))}
          <span className="ml-1.5">More</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            aria-hidden
            className="inline-block h-3 w-4 bg-hm5 shadow-[inset_0_0_0_2px_var(--bar-mark),inset_0_0_0_3px_var(--page)]"
          />
          Busiest slot
        </span>
      </div>
    </div>
  )
}
