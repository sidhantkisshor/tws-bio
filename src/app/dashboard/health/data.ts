import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { linkHealthIssues, type HealthIssue } from '@/lib/linkHealth'

// Server-side helpers shared by the Overview page ("Needs a look") and the
// Health page: one paginated read of every link the owner has, and the rule
// issues ranked the same way on both pages.

export type OwnerLink = Pick<
  Database['public']['Tables']['links']['Row'],
  | 'id'
  | 'short_code'
  | 'original_url'
  | 'fallback_url'
  | 'link_type'
  | 'expires_at'
  | 'max_clicks'
  | 'total_clicks'
  | 'is_active'
  | 'created_at'
>

const OWNER_LINK_COLUMNS =
  'id, short_code, original_url, fallback_url, link_type, expires_at, max_clicks, total_clicks, is_active, created_at'

export const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

/**
 * Every link the user owns, ordered by id. PostgREST caps one response at
 * its page size (1000 by default), so when the exact count is larger the
 * remaining pages are fetched in parallel with `range` and joined.
 */
export async function loadOwnerLinks(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<{ data: OwnerLink[]; error: boolean }> {
  const base = () => {
    const q = supabase.from('links').select(OWNER_LINK_COLUMNS, { count: 'exact' }).eq('user_id', userId)
    return opts.activeOnly ? q.eq('is_active', true) : q
  }

  const first = await base().order('id', { ascending: true })
  if (first.error) {
    console.error('[dashboard] links query:', first.error)
    return { data: [], error: true }
  }
  let rows = (first.data ?? []) as OwnerLink[]
  const total = first.count ?? rows.length
  if (total > rows.length && rows.length > 0) {
    const pageSize = rows.length
    const extraPages = await Promise.all(
      Array.from({ length: Math.ceil((total - pageSize) / pageSize) }, (_, index) => {
        const from = pageSize * (index + 1)
        return base()
          .order('id', { ascending: true })
          .range(from, Math.min(from + pageSize - 1, total - 1))
      }),
    )
    const failed = extraPages.find((page) => page.error)
    if (failed?.error) {
      console.error('[dashboard] paginated links query:', failed.error)
      return { data: rows, error: true }
    }
    rows = rows.concat(extraPages.flatMap((page) => (page.data ?? []) as OwnerLink[]))
  }
  return { data: rows, error: false }
}

export interface RankedIssue {
  link: OwnerLink
  issue: HealthIssue
  /** Clicks in the last 30 days, or null when that count did not load. */
  clicks30: number | null
}

const SEVERITY_RANK: Record<HealthIssue['severity'], number> = { high: 0, medium: 1, low: 2 }

/**
 * Rule issues for every link, ranked by severity, then by clicks in the last
 * 30 days (the links people still use first), then by short code. Pass
 * `clicks30` as null when the click windows failed to load: the "quiet" rule
 * is then skipped, so a failed query never flags every link as quiet.
 */
export function rankHealthIssues(
  links: OwnerLink[],
  clicks30: Record<string, number> | null,
  now: Date,
): RankedIssue[] {
  const out: RankedIssue[] = []
  for (const link of links) {
    const recent = clicks30 ? (clicks30[link.id] ?? 0) : null
    const issues = linkHealthIssues(link, {
      now,
      shortDomain: SHORT_DOMAIN,
      clicksInLast30d: recent ?? undefined,
    })
    for (const issue of issues) out.push({ link, issue, clicks30: recent })
  }
  return out.sort(
    (a, b) =>
      SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity] ||
      (b.clicks30 ?? b.link.total_clicks ?? 0) - (a.clicks30 ?? a.link.total_clicks ?? 0) ||
      a.link.short_code.localeCompare(b.link.short_code),
  )
}

/** The one-word flag shown beside an issue. Words, never color alone. */
export function issueFlag(kind: HealthIssue['kind']): string {
  switch (kind) {
    case 'placeholder':
      return 'Placeholder'
    case 'loop':
      return 'Loop'
    case 'expired':
      return 'Expired'
    case 'expiring_soon':
      return 'Expires'
    case 'at_cap':
      return 'Limit hit'
    case 'near_cap':
      return 'Near limit'
    case 'inactive':
      return 'Off'
    case 'quiet':
      return 'Quiet'
  }
}

/** The fix action label. Every fix opens the link's page, where Edit lives. */
export function issueAction(kind: HealthIssue['kind']): string {
  switch (kind) {
    case 'placeholder':
    case 'loop':
      return 'Change destination'
    case 'expired':
    case 'expiring_soon':
      return 'Extend'
    case 'at_cap':
    case 'near_cap':
      return 'Raise limit'
    case 'inactive':
      return 'Turn on'
    case 'quiet':
      return 'Review'
  }
}
