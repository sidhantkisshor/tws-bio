import type { PlatformGroup } from '@/lib/sources'
import { sharesToHundred } from '@/lib/ledgerFormat'
import { cn } from '@/lib/utils'
import { Section } from '@/components/dashboard/PageHeader'

// "Where clicks come from", grouped by platform: the referrer hosts the
// dashboard stores are merged into the platforms the owner thinks in
// (groupByPlatform in src/lib/sources.ts). Each row: label, count, share, a
// slate bar with no track, and the hosts in the group in tertiary text. The
// ledger closes with an "All sources" total over a double rule.

const LABELS: Partial<Record<PlatformGroup['key'], string>> = {
  none: 'No referrer',
  tws: 'tws.bio itself',
  app: 'Other Android apps',
}

const NOTES: Partial<Record<PlatformGroup['key'], string>> = {
  none: 'WhatsApp, Telegram app, QR codes, typed links',
  tws: 'The tws.bio home page and dashboard',
  app: 'android-app referrer, app not named',
}

const fmt = (n: number) => n.toLocaleString('en-US')

function hostsLine(g: PlatformGroup): string | null {
  const note = NOTES[g.key]
  if (note) return note
  const named = g.domains.filter((d) => d.name && d.name !== g.label)
  if (named.length === 0) return null
  if (named.length === 1 && g.domains.length === 1) return named[0].name
  return named.map((d) => `${d.name} ${fmt(d.count)}`).join(', ')
}

export interface SourcesPanelProps {
  /** Rows from groupByPlatform, biggest first. */
  groups: PlatformGroup[]
  /** The window the rows cover, e.g. "Last 90 days". Shown at the right of the title. */
  windowLabel?: string
  /** Section title. */
  title?: string
  /** The query failed: show an inline error. */
  error?: boolean
  /** Show at most this many groups; the rest are summed into "Everything else". */
  limit?: number
  /**
   * The total for "All sources". Defaults to the sum of the groups. Pass the
   * real total when the rows are a top-N cut, so the shares stay honest.
   */
  total?: number
  /** Render only the ledger, without the Section rule and title. */
  bare?: boolean
  emptyText?: string
  className?: string
}

export function SourcesPanel({
  groups,
  windowLabel,
  title = 'Where clicks come from',
  error,
  limit,
  total,
  bare,
  emptyText = 'No clicks in this period.',
  className,
}: SourcesPanelProps) {
  let body: React.ReactNode
  if (error) {
    body = (
      <p role="status" className="py-4 text-sm text-text-2">
        Sources could not load. Reload the page to try again.
      </p>
    )
  } else {
    const rows = groups.filter((g) => g.count > 0)
    const sum = rows.reduce((s, g) => s + g.count, 0)
    if (rows.length === 0 || sum === 0) {
      body = <p className="py-4 text-sm text-text-2">{emptyText}</p>
    } else {
      let shown = rows.map((g) => ({
        key: g.key === 'other' ? `other:${g.label}` : g.key,
        label: LABELS[g.key] ?? g.label,
        count: g.count,
        sub: hostsLine(g),
      }))
      if (limit && shown.length > limit) {
        const rest = shown.slice(limit)
        shown = [
          ...shown.slice(0, limit),
          {
            key: 'rest',
            label: 'Everything else',
            count: rest.reduce((s, r) => s + r.count, 0),
            sub: `${rest.length} more ${rest.length === 1 ? 'source' : 'sources'}`,
          },
        ]
      }
      const allTotal = total && total >= sum ? total : sum
      const unlisted = allTotal - sum
      const shares = sharesToHundred(unlisted > 0 ? [...shown.map((r) => r.count), unlisted] : shown.map((r) => r.count))
      const max = Math.max(...shown.map((r) => r.count))
      body = (
        <>
          <ol aria-label="Clicks by source" className="flex flex-col">
            {shown.map((r, i) => (
              <li key={r.key} className="py-2 pb-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_72px_60px] items-baseline gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink" title={r.label}>
                    {r.label}
                  </span>
                  <span className="text-right tabular-nums text-ink">
                    {fmt(r.count)}
                    <span className="sr-only"> clicks</span>
                  </span>
                  <span className="text-right tabular-nums text-text-2">{(shares[i] * 100).toFixed(1)}%</span>
                </div>
                <div
                  aria-hidden
                  className="mt-1.5 h-1.5 bg-bar"
                  style={{ width: `${Math.max((r.count / max) * 100, 0.75)}%` }}
                />
                {r.sub && <p className="mt-1 text-[12.5px] leading-snug text-text-3">{r.sub}</p>}
              </li>
            ))}
            {unlisted > 0 && (
              <li className="py-2 text-sm">
                <div className="grid grid-cols-[minmax(0,1fr)_72px_60px] items-baseline gap-2">
                  <span className="text-text-2">Not listed</span>
                  <span className="text-right tabular-nums text-text-2">{fmt(unlisted)}</span>
                  <span className="text-right tabular-nums text-text-2">
                    {(shares[shares.length - 1] * 100).toFixed(1)}%
                  </span>
                </div>
              </li>
            )}
          </ol>
          <div className="rule-sub mt-1 grid grid-cols-[minmax(0,1fr)_72px_60px] items-baseline gap-2 pt-2.5 text-sm font-bold text-ink">
            <span>All sources</span>
            <span className="rule-total pb-1 text-right tabular-nums">{fmt(allTotal)}</span>
            <span className="rule-total pb-1 text-right tabular-nums">100.0%</span>
          </div>
        </>
      )
    }
  }

  if (bare) return <div className={cn('min-w-0', className)}>{body}</div>
  return (
    <Section title={title} caption={windowLabel ? `${windowLabel}, grouped by platform` : 'Grouped by platform'} className={className}>
      {body}
    </Section>
  )
}
