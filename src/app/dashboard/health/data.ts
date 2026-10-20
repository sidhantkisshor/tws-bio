import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { healthByLink, type HealthIssue, type HealthLink, type LinkHealth } from '@/lib/linkHealth'

// Server-side helpers shared by the Overview page ("Needs a look"), the
// Health page and the Links page's chips: one paginated read of every link the owner has, and the rule
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
  | 'campaign_id'
>

const OWNER_LINK_COLUMNS =
  'id, short_code, original_url, fallback_url, link_type, expires_at, max_clicks, total_clicks, is_active, created_at, campaign_id'

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
  // Only the first request asks for the exact count: the extra pages would
  // each run a COUNT(*) that is thrown away.
  const base = (withCount: boolean) => {
    const q = supabase
      .from('links')
      .select(OWNER_LINK_COLUMNS, withCount ? { count: 'exact' } : undefined)
      .eq('user_id', userId)
    return opts.activeOnly ? q.eq('is_active', true) : q
  }

  const first = await base(true).order('id', { ascending: true })
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
        return base(false)
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

/** One link with its rule issues, worst first (`issues[0]` is the worst). */
export type LinkHealthRow<L extends HealthLink = OwnerLink> = LinkHealth<L>

/**
 * Rule issues grouped per link (linkHealth's `healthByLink`): one row per
 * link that has any, ranked by its worst issue, then by clicks in the last 30
 * days, then by short code. Pass `clicks30` as null when the click windows
 * failed to load: the "quiet" rule is then skipped, so a failed query never
 * flags every link as quiet.
 */
export function rankLinkHealth<L extends HealthLink & { id: string }>(
  links: L[],
  clicks30: Record<string, number> | null,
  now: Date,
): LinkHealthRow<L>[] {
  return healthByLink(links, {
    now,
    shortDomain: SHORT_DOMAIN,
    clicksInLast30d: (link) => (clicks30 ? (clicks30[link.id] ?? 0) : undefined),
  })
}

/** The other issues of a row in a few words, for "Also turned off." */
export function issueShort(kind: HealthIssue['kind']): string {
  switch (kind) {
    case 'placeholder':
      return 'placeholder destination'
    case 'loop':
      return 'points at a tws.bio link'
    case 'expired':
      return 'expired'
    case 'expiring_soon':
      return 'expires soon'
    case 'at_cap':
      return 'click limit reached'
    case 'near_cap':
      return 'near its click limit'
    case 'inactive':
      return 'turned off'
    case 'quiet':
      return 'no clicks in 30 days'
  }
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
