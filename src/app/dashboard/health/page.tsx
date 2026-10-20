import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { rangeWindow } from '@/lib/analytics'
import { getLinkClickWindowsResult } from '@/lib/insights'
import type { HealthIssue } from '@/lib/linkHealth'
import { formatNumber } from '@/lib/ledgerFormat'
import { formatCount } from '@/lib/utils'
import { PageHeader, Section } from '@/components/dashboard/PageHeader'
import { KpiRow, StatCell } from '@/components/dashboard/StatCard'
import { IssueFlag, IssueSentence } from '@/components/dashboard/NeedsALook'
import { DestinationCheck } from './DestinationCheck'
import { issueAction, loadOwnerLinks, rankHealthIssues, type RankedIssue } from './data'

// The destination check is a Server Action that runs in this route. With
// many links and slow hosts it can take a while, so give it a minute.
export const maxDuration = 60

const GROUPS: { severity: HealthIssue['severity']; title: string; caption: string }[] = [
  { severity: 'high', title: 'Fix now', caption: 'Visitors get an error page' },
  { severity: 'medium', title: 'Check soon', caption: 'Works today, may stop soon' },
  { severity: 'low', title: 'Worth a look', caption: 'Turned off or no recent clicks' },
]

function IssueList({ items }: { items: RankedIssue[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li
          key={`${item.link.id}:${item.issue.kind}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-rule py-3 last:border-b-0 md:grid-cols-[104px_minmax(0,1fr)_auto]"
        >
          <span className="justify-self-start">
            <IssueFlag issue={item.issue} />
          </span>
          <span className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
            <IssueSentence item={item} />
          </span>
          <Link
            href={`/dashboard/links/${item.link.id}`}
            className="focus-ring col-start-2 row-start-1 justify-self-end rounded-[2px] text-sm text-accent-text underline decoration-accent-text/40 decoration-1 underline-offset-[3px] transition-colors duration-150 hover:decoration-current md:col-start-auto md:row-start-auto"
          >
            {issueAction(item.issue.kind)}
            <span className="sr-only"> for {item.link.short_code}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function HealthPage() {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const now = new Date()
  const last30 = rangeWindow('30d', now)
  const supabase = await createClient()
  const links = await loadOwnerLinks(supabase, user.id)
  const windows = await getLinkClickWindowsResult({
    linkIds: links.data.map((l) => l.id),
    priorSince: last30.priorSince,
    since: last30.since,
  })

  const clicks30 = windows.error ? null : windows.data.current
  const ranked = links.error ? [] : rankHealthIssues(links.data, clicks30, now)
  const bySeverity = (s: HealthIssue['severity']) => ranked.filter((r) => r.issue.severity === s)
  const linksWithIssues = new Set(ranked.map((r) => r.link.id)).size
  const activeCount = links.data.filter((l) => l.is_active).length

  return (
    <div>
      <PageHeader
        title="Health"
        description={
          links.error
            ? 'Rule checks on every link, worst first.'
            : `Rule checks on all ${formatCount(links.data.length, 'link')}, worst first. Click counts are for the last 30 days.`
        }
      />

      {links.error ? (
        <section className="rule-open pt-4">
          <p role="status" className="text-sm text-text-2">
            Your links could not load. Reload the page to try again.
          </p>
        </section>
      ) : (
        <>
          <KpiRow label="Issues by severity" className="mb-2">
            <StatCell title="Fix now" value={bySeverity('high').length} />
            <StatCell title="Check soon" value={bySeverity('medium').length} />
            <StatCell title="Worth a look" value={bySeverity('low').length} />
            <StatCell
              title="Links with an issue"
              value={linksWithIssues}
              unit={`of ${formatNumber(links.data.length)}`}
            />
          </KpiRow>
          {windows.error && (
            <p role="status" className="text-[13px] text-text-2">
              Click counts could not load, so links with no recent clicks are not flagged.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-9 md:mt-10 lg:gap-12">
            {ranked.length === 0 ? (
              <Section title="Rule checks">
                <p className="py-2 text-sm text-text-2">Every link passes the rule checks.</p>
              </Section>
            ) : (
              GROUPS.map((g) => {
                const items = bySeverity(g.severity)
                if (items.length === 0) return null
                return (
                  <Section
                    key={g.severity}
                    title={g.title}
                    caption={`${formatCount(items.length, 'issue')}. ${g.caption}`}
                  >
                    <IssueList items={items} />
                  </Section>
                )
              })
            )}
          </div>
        </>
      )}

      <Section
        title="Destinations"
        caption="Does each destination page still load?"
        className="mt-9 lg:mt-12"
      >
        <DestinationCheck activeCount={activeCount} />
      </Section>
    </div>
  )
}
