import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getClicksOverTimeResult, parseTimeRange, rangeWindow } from '@/lib/analytics'
import { getLinkClickWindowsResult } from '@/lib/insights'
import { formatDate } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { ChangeCount } from '@/components/dashboard/TopLinksTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { TimeRangePicker } from '@/components/TimeRangePicker'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// How far back "Last click" looks. Older than this reads "Over a year ago".
const LAST_CLICK_DAYS = 365

function InlineError({ children, retryHref }: { children: React.ReactNode; retryHref: string }) {
  return (
    <p role="status" className="py-4 text-sm text-text-2">
      {children}{' '}
      <Link
        href={retryHref}
        className="focus-ring rounded-ctl text-accent-text underline decoration-accent-text/40 underline-offset-[3px] hover:decoration-current"
      >
        Try again
      </Link>
    </p>
  )
}

// The root layout's template adds " - tws.bio".
export const metadata: Metadata = { title: 'Campaigns' }

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { range: rangeParam } = await searchParams
  const timeRange = parseTimeRange(rangeParam)
  const { since, priorSince, days } = rangeWindow(timeRange)
  const retryHref = `/dashboard/campaigns?range=${timeRange}`

  // Wave 1: the campaigns and the owner's links that sit in one, side by side.
  const [campaignsResult, linksResult] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('links')
      .select('id, campaign_id, total_clicks', { count: 'exact' })
      .eq('user_id', user.id)
      .not('campaign_id', 'is', null)
      .order('id', { ascending: true })
      .range(0, 999),
  ])

  // PostgREST caps response rows. Page through the rest, so a big campaign is
  // never undercounted. The common case is a single request.
  let links = linksResult.data ?? []
  let linksError = linksResult.error
  const totalCampaignLinks = linksResult.count ?? 0
  if (!linksError && totalCampaignLinks > links.length && links.length > 0) {
    const pageSize = links.length
    const pages = []
    for (let from = pageSize; from < totalCampaignLinks; from += pageSize) {
      pages.push(
        supabase
          .from('links')
          .select('id, campaign_id, total_clicks')
          .eq('user_id', user.id)
          .not('campaign_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, Math.min(from + pageSize - 1, totalCampaignLinks - 1)),
      )
    }
    const extra = await Promise.all(pages)
    const failed = extra.find((page) => page.error)
    if (failed?.error) linksError = failed.error
    else links = links.concat(extra.flatMap((page) => page.data ?? []))
  }

  if (campaignsResult.error) console.error('[campaigns] campaigns query:', campaignsResult.error)
  if (linksError) console.error('[campaigns] links query:', linksError)

  const campaigns = campaignsResult.data ?? []
  const linksByCampaign = new Map<string, typeof links>()
  for (const l of links) {
    if (!l.campaign_id) continue
    const list = linksByCampaign.get(l.campaign_id) ?? []
    list.push(l)
    linksByCampaign.set(l.campaign_id, list)
  }

  // Wave 2: clicks per link in this window and the one before, and each
  // campaign's clicks per day for the last year (its last day with a click).
  const lastClickSince = new Date(Date.now() - LAST_CLICK_DAYS * 86_400_000).toISOString()
  const campaignsWithLinks = campaigns.filter((c) => (linksByCampaign.get(c.id)?.length ?? 0) > 0)
  const [windowsResult, ...seriesResults] = await Promise.all([
    since && priorSince && links.length > 0
      ? getLinkClickWindowsResult({ linkIds: links.map((l) => l.id), priorSince, since })
      : null,
    ...campaignsWithLinks.map((c) =>
      getClicksOverTimeResult({
        timeRange: 'all',
        linkIds: (linksByCampaign.get(c.id) ?? []).map((l) => l.id),
        since: lastClickSince,
      }),
    ),
  ])

  const windows = windowsResult && !windowsResult.error ? windowsResult.data : null
  const lastClick = new Map<string, string | null | undefined>()
  campaignsWithLinks.forEach((c, i) => {
    const result = seriesResults[i]
    if (result.error) {
      lastClick.set(c.id, undefined)
      return
    }
    const days = result.data.filter((d) => d.clicks > 0).map((d) => d.date).sort()
    lastClick.set(c.id, days.length > 0 ? days[days.length - 1] : null)
  })

  const rows = campaigns.map((c) => {
    const own = linksByCampaign.get(c.id) ?? []
    const allTime = own.reduce((s, l) => s + (l.total_clicks || 0), 0)
    // A bounded range needs the windows RPC. 'all' is the all-time total.
    const clicks =
      days === null ? allTime : windows ? own.reduce((s, l) => s + (windows.current[l.id] ?? 0), 0) : null
    const prior = windows ? own.reduce((s, l) => s + (windows.prior[l.id] ?? 0), 0) : null
    return {
      ...c,
      links: own.length,
      allTime,
      clicks,
      prior,
      lastClick: own.length === 0 ? null : lastClick.get(c.id),
    }
  })

  const showChange = days !== null && windows !== null
  const clicksKnown = rows.every((r) => r.clicks !== null)
  const totalLinks = rows.reduce((s, r) => s + r.links, 0)
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Group links into a campaign to see their clicks together. Pick a campaign when you create or edit a link."
        actions={<TimeRangePicker current={timeRange} basePath="/dashboard/campaigns" />}
      />

      {campaignsResult.error || linksError ? (
        <div className="rule-open">
          <InlineError retryHref={retryHref}>Your campaigns could not load.</InlineError>
        </div>
      ) : rows.length === 0 ? (
        <div className="rule-open flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-text-2">
            No campaigns yet. Make one when you create a link, and its links and clicks show here.
          </p>
          <Link href="/dashboard/create" className={buttonVariants({ variant: 'outline' })}>
            Create a link
          </Link>
        </div>
      ) : (
        <div className="rule-open pt-4">
          <p className="mb-1 text-[13px] text-text-3">
            {days !== null
              ? `Clicks in the last ${days} days. Change is against the ${days} days before.`
              : 'Clicks since each link was made.'}
          </p>
          {days !== null && !windows && (
            <InlineError retryHref={retryHref}>Clicks for this period could not load.</InlineError>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Links</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                {showChange && <TableHead className="text-right">Change</TableHead>}
                <TableHead className="hidden text-right md:table-cell">Last click</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="relative w-full max-w-0">
                    {/* The link's hit area stretches over the whole name cell. */}
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="block truncate font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                    >
                      {c.name}
                    </Link>
                    <span className="mt-0.5 block truncate text-[13px] text-text-3">
                      {c.description || `Created ${formatDate(c.created_at)}`}
                      <span className="sm:hidden">
                        {' '}
                        · {c.links} {c.links === 1 ? 'link' : 'links'}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right text-text-2 tabular-nums sm:table-cell">
                    {c.links.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {c.clicks === null ? '---' : c.clicks.toLocaleString('en-US')}
                  </TableCell>
                  {showChange && (
                    <TableCell className="text-right text-[13px] tabular-nums">
                      {c.clicks !== null && c.prior !== null ? (
                        <ChangeCount current={c.clicks} prior={c.prior} />
                      ) : (
                        '---'
                      )}
                    </TableCell>
                  )}
                  <TableCell className="hidden text-right text-text-2 tabular-nums md:table-cell">
                    {c.lastClick === undefined
                      ? '---'
                      : c.lastClick === null
                        ? c.links === 0
                          ? 'No links yet'
                          : c.allTime === 0
                            ? 'No clicks yet'
                            : 'Over a year ago'
                        : formatDate(c.lastClick)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-[13px] text-text-2">
                  All {rows.length} {rows.length === 1 ? 'campaign' : 'campaigns'}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {totalLinks.toLocaleString('en-US')}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {clicksKnown ? (
                    <span className="rule-total inline-block pb-1">
                      {totalClicks.toLocaleString('en-US')}
                    </span>
                  ) : (
                    '---'
                  )}
                </TableCell>
                {showChange && <TableCell />}
                <TableCell className="hidden md:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  )
}
