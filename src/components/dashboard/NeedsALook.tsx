import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/ledgerFormat'
import type { HealthIssue } from '@/lib/linkHealth'
import {
  SHORT_DOMAIN,
  issueAction,
  issueFlag,
  issueShort,
  type LinkHealthRow,
} from '@/app/dashboard/health/data'
import { fixLinkClass } from '@/app/dashboard/health/styles'

// The Overview's "Needs a look" strip: the links with the worst rule issues
// (linkHealth.ts), one row per link, each with a one-word flag, what is wrong
// in words, and the fix. Hidden when nothing needs a look. A link to the
// Health page shows when more links have issues than the strip holds.

export function IssueFlag({ issue }: { issue: HealthIssue }) {
  return (
    <span
      className={cn(
        'inline-block min-w-[4.5rem] rounded-[2px] border px-1.5 text-center text-[11px] leading-5 font-bold tracking-[0.06em] whitespace-nowrap uppercase',
        issue.severity === 'high' ? 'border-neg text-neg' : 'border-edge text-text-2',
      )}
    >
      {issueFlag(issue.kind)}
    </span>
  )
}

/** The short link, the worst issue in words, then the others: "Also turned off." */
export function IssueSentence({ row }: { row: LinkHealthRow }) {
  const { link, issues, clicks30 } = row
  const [worst, ...others] = issues
  const stillUsed =
    clicks30 && clicks30 > 0 && worst.kind !== 'quiet'
      ? ` ${formatNumber(clicks30)} ${clicks30 === 1 ? 'click' : 'clicks'} in the last 30 days.`
      : ''
  return (
    <p className="min-w-0 text-sm leading-normal text-text-2">
      <span className="font-mono text-[13.5px] text-ink [overflow-wrap:anywhere]">
        {SHORT_DOMAIN}/{link.short_code}
      </span>{' '}
      {worst.message}
      {stillUsed}
      {others.length > 0 && (
        <span className="text-text-3">
          {' '}
          Also {others.map((i) => issueShort(i.kind)).join(', ')}.
        </span>
      )}
    </p>
  )
}

/** The fix for the worst issue. Every fix opens the link's page, where Edit lives. */
export function FixLink({ row }: { row: LinkHealthRow }) {
  return (
    <Link href={`/dashboard/links/${row.link.id}`} className={fixLinkClass}>
      {issueAction(row.issues[0].kind)}
      <span className="sr-only">
        {' '}
        for {SHORT_DOMAIN}/{row.link.short_code}
      </span>
    </Link>
  )
}

export function NeedsALook({
  rows,
  total,
}: {
  /** The links to show, ranked (at most three). */
  rows: LinkHealthRow[]
  /** Every link with an issue, for the "All N links" link. */
  total: number
}) {
  if (rows.length === 0) return null
  return (
    // Phones put "All N links with issues" under the list, so its 44px hit
    // area does not overlap the first row's fix link.
    <section
      aria-labelledby="needs-a-look"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-rule pt-4 pb-5"
    >
      <h2 id="needs-a-look" className="type-label text-text-3">
        Needs a look
      </h2>
      {total > rows.length && (
        <span className="col-span-2 row-start-3 mt-4 md:col-span-1 md:col-start-2 md:row-start-1 md:mt-0">
          <Link href="/dashboard/health" className={fixLinkClass}>
            All {formatNumber(total)} links with issues
          </Link>
        </span>
      )}
      <ul className="col-span-2 row-start-2 mt-2 grid gap-4 md:gap-2">
        {rows.map((row) => (
          <li
            key={row.link.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 md:grid-cols-[88px_minmax(0,1fr)_auto]"
          >
            <span className="justify-self-start">
              <IssueFlag issue={row.issues[0]} />
            </span>
            <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
              <IssueSentence row={row} />
            </span>
            <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
              <FixLink row={row} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
