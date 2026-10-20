import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/ledgerFormat'
import { SHORT_DOMAIN, issueAction, issueFlag, type RankedIssue } from '@/app/dashboard/health/data'

// The Overview's "Needs a look" strip: the top rule-based issues across all
// links (linkHealth.ts), each with a one-word flag, what is wrong in words,
// and the fix. Hidden when nothing needs a look. A link to the Health page
// shows when there are more issues than the strip holds.

const linkClass =
  'focus-ring rounded-[2px] text-sm text-accent-text underline decoration-accent-text/40 decoration-1 underline-offset-[3px] transition-colors duration-150 hover:decoration-current'

export function IssueFlag({ issue }: { issue: RankedIssue['issue'] }) {
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

export function IssueSentence({ item }: { item: RankedIssue }) {
  const { link, issue, clicks30 } = item
  const stillUsed =
    clicks30 && clicks30 > 0 && issue.kind !== 'quiet'
      ? ` ${formatNumber(clicks30)} ${clicks30 === 1 ? 'click' : 'clicks'} in the last 30 days.`
      : ''
  return (
    <p className="min-w-0 text-sm leading-normal text-text-2">
      <span className="font-mono text-[13.5px] text-ink [overflow-wrap:anywhere]">{SHORT_DOMAIN}/{link.short_code}</span>{' '}
      {issue.message}
      {stillUsed}
    </p>
  )
}

export function NeedsALook({
  items,
  total,
}: {
  /** The issues to show, ranked (at most three). */
  items: RankedIssue[]
  /** Every issue across all links, for the "All N issues" link. */
  total: number
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="needs-a-look" className="border-t border-rule pt-4 pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="needs-a-look" className="type-label text-text-3">
          Needs a look
        </h2>
        {total > items.length && (
          <Link href="/dashboard/health" className={linkClass}>
            All {formatNumber(total)} issues
          </Link>
        )}
      </div>
      <ul className="mt-2 grid gap-3 md:gap-2">
        {items.map((item) => (
          <li
            key={`${item.link.id}:${item.issue.kind}`}
            className="grid grid-cols-[minmax(0,1fr)] items-baseline gap-1.5 md:grid-cols-[88px_minmax(0,1fr)_auto] md:gap-4"
          >
            <span className="justify-self-start">
              <IssueFlag issue={item.issue} />
            </span>
            <IssueSentence item={item} />
            <Link
              href={`/dashboard/links/${item.link.id}`}
              className={cn(linkClass, 'justify-self-start md:justify-self-end')}
            >
              {issueAction(item.issue.kind)}
              <span className="sr-only"> for {SHORT_DOMAIN}/{item.link.short_code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
