import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatNumber, formatSignedCount } from '@/lib/ledgerFormat'
import { Section } from '@/components/dashboard/PageHeader'

// "Top movers": the links that gained or lost the most clicks against the
// window before, gains and losses kept in separate lists. A gain carries a
// plus sign, a loss sits in parentheses, and a link with no clicks before
// reads "New", so the direction never depends on color alone.

export interface MoverRow {
  id: string
  shortCode: string
  current: number
  prior: number
  delta: number
}

function MoverList({ rows, label }: { rows: MoverRow[]; label: string }) {
  return (
    <>
      <h3 className="type-label mt-1 mb-1.5 text-text-3">{label}</h3>
      <ul className="mb-4 last:mb-0" aria-label={label}>
        {rows.map((m) => (
          <li
            key={m.id}
            className="grid grid-cols-[minmax(0,1fr)_auto_72px] items-baseline gap-3 border-b border-rule py-2 text-sm last:border-b-0"
          >
            <Link
              href={`/dashboard/links/${m.id}`}
              title={m.shortCode}
              className="focus-ring -my-2 truncate rounded-[2px] py-2 font-mono text-[13.5px] text-ink transition-colors duration-150 hover:text-accent-text"
            >
              {m.shortCode}
            </Link>
            <span className="text-right tabular-nums text-ink">
              {formatNumber(m.current)}
              <span className="sr-only"> clicks</span>
            </span>
            {m.prior === 0 ? (
              <span className="text-right text-[13px] font-medium text-text-2">New</span>
            ) : (
              <span
                className={cn(
                  'text-right text-[13px] font-bold tabular-nums',
                  m.delta > 0 ? 'text-pos' : m.delta < 0 ? 'text-neg' : 'text-text-2',
                )}
              >
                {formatSignedCount(m.delta)}
                <span className="sr-only"> against {formatNumber(m.prior)} before</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export function TopMovers({
  gaining,
  losing,
  caption,
  error,
  className,
}: {
  gaining: MoverRow[]
  losing: MoverRow[]
  /** e.g. "Clicks vs the 30 days before". */
  caption: string
  error?: boolean
  className?: string
}) {
  let body: React.ReactNode
  if (error) {
    body = (
      <p role="status" className="py-4 text-sm text-text-2">
        Top movers could not load. Reload the page to try again.
      </p>
    )
  } else if (gaining.length === 0 && losing.length === 0) {
    body = <p className="py-4 text-sm text-text-2">No link gained or lost clicks against the period before.</p>
  } else {
    body = (
      <>
        {gaining.length > 0 && <MoverList rows={gaining} label="Gaining" />}
        {losing.length > 0 && <MoverList rows={losing} label="Losing" />}
      </>
    )
  }
  return (
    <Section title="Top movers" caption={caption} className={className}>
      {body}
    </Section>
  )
}
