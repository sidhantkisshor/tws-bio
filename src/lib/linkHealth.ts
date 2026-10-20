import type { Database } from '@/types/database'
import { pointsAtShortCode } from './redirectSafety'

type LinkRow = Database['public']['Tables']['links']['Row']

export type HealthIssue = {
  kind: 'placeholder' | 'loop' | 'expired' | 'expiring_soon' | 'at_cap' | 'near_cap' | 'inactive' | 'quiet'
  severity: 'high' | 'medium' | 'low'
  message: string
}

export type HealthLink = Pick<
  LinkRow,
  | 'short_code'
  | 'original_url'
  | 'fallback_url'
  | 'expires_at'
  | 'max_clicks'
  | 'total_clicks'
  | 'is_active'
  | 'created_at'
>

const DAY_MS = 86_400_000
const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'localhost', '127.0.0.1']
const PLACEHOLDER_TLDS = ['test', 'invalid']

function parseHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

function bare(host: string): string {
  return host.replace(/^www\./, '')
}

function isPlaceholderHost(host: string): boolean {
  if (PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true
  const tld = host.split('.').pop() ?? ''
  return PLACEHOLDER_TLDS.includes(tld)
}

export function linkHealthIssues(
  link: HealthLink,
  opts: { now: Date; shortDomain: string; clicksInLast30d?: number },
): HealthIssue[] {
  const issues: HealthIssue[] = []
  const now = opts.now.getTime()
  const shortHost = bare(opts.shortDomain.toLowerCase())

  const destHost = parseHost(link.original_url)
  if (destHost && isPlaceholderHost(destHost)) {
    issues.push({
      kind: 'placeholder',
      severity: 'high',
      message: `The destination (${destHost}) looks like a placeholder, not a real page.`,
    })
  }

  let sameCode = false
  let otherShort = false
  for (const url of [link.original_url, link.fallback_url]) {
    const host = parseHost(url)
    if (!host || bare(host) !== shortHost) continue
    if (url && pointsAtShortCode(url, link.short_code, opts.shortDomain)) sameCode = true
    else otherShort = true
  }
  if (sameCode) {
    issues.push({
      kind: 'loop',
      severity: 'high',
      message: 'This link points back at itself, so visitors get an error page.',
    })
  } else if (otherShort) {
    issues.push({
      kind: 'loop',
      severity: 'medium',
      message: 'The destination is another tws.bio link. Point it at the final page instead.',
    })
  }

  let expired = false
  if (link.expires_at) {
    const exp = Date.parse(link.expires_at)
    if (Number.isFinite(exp)) {
      if (exp <= now) {
        expired = true
        issues.push({
          kind: 'expired',
          severity: 'high',
          message: 'This link has expired. Visitors get a "link expired" page.',
        })
      } else if (exp - now <= 7 * DAY_MS) {
        const days = Math.max(1, Math.ceil((exp - now) / DAY_MS))
        issues.push({
          kind: 'expiring_soon',
          severity: 'medium',
          message: `This link expires in ${days} ${days === 1 ? 'day' : 'days'}.`,
        })
      }
    }
  }

  if (link.max_clicks != null && link.max_clicks > 0) {
    const used = link.total_clicks ?? 0
    if (used >= link.max_clicks) {
      issues.push({
        kind: 'at_cap',
        severity: 'high',
        message: `The click limit (${link.max_clicks}) is reached. Visitors get a "link expired" page.`,
      })
    } else if (used >= link.max_clicks * 0.9) {
      issues.push({
        kind: 'near_cap',
        severity: 'medium',
        message: `${used} of ${link.max_clicks} clicks used.`,
      })
    }
  }

  if (!link.is_active) {
    issues.push({
      kind: 'inactive',
      severity: 'low',
      message: 'This link is turned off. Visitors get a not found page.',
    })
  }

  // "Quiet" says nothing new about a link that is off or expired: it cannot
  // get clicks, and the stronger issue is already listed.
  if (opts.clicksInLast30d === 0 && link.is_active && !expired) {
    const created = Date.parse(link.created_at ?? '')
    if (Number.isFinite(created) && now - created > 14 * DAY_MS) {
      issues.push({
        kind: 'quiet',
        severity: 'low',
        message: 'No clicks in the last 30 days.',
      })
    }
  }

  return issues
}

const SEVERITY_RANK: Record<HealthIssue['severity'], number> = { high: 0, medium: 1, low: 2 }

/** Issues worst first (high, medium, low). The rule order breaks a tie. */
export function sortIssues(issues: HealthIssue[]): HealthIssue[] {
  return issues
    .map((issue, i) => [issue, i] as const)
    .sort((a, b) => SEVERITY_RANK[a[0].severity] - SEVERITY_RANK[b[0].severity] || a[1] - b[1])
    .map(([issue]) => issue)
}

export interface LinkHealth<T extends HealthLink = HealthLink> {
  link: T
  /** Worst first. Never empty. */
  issues: HealthIssue[]
  /** The severity of the first issue. */
  worst: HealthIssue['severity']
  /** Clicks in the last 30 days, or null when that count is not known. */
  clicks30: number | null
}

/**
 * One entry per link that has at least one issue, so a link is listed once
 * with every issue it has, worst first. Entries are ranked by their worst
 * issue, then by clicks in the last 30 days (the links people still use
 * first; total clicks when the 30-day count is unknown), then by short code.
 * Return undefined from `clicksInLast30d` when the count is unknown: the
 * "quiet" rule is then skipped for that link.
 */
export function healthByLink<T extends HealthLink>(
  links: readonly T[],
  opts: { now: Date; shortDomain: string; clicksInLast30d?: (link: T) => number | undefined },
): LinkHealth<T>[] {
  const out: LinkHealth<T>[] = []
  for (const link of links) {
    const recent = opts.clicksInLast30d?.(link)
    const issues = sortIssues(
      linkHealthIssues(link, { now: opts.now, shortDomain: opts.shortDomain, clicksInLast30d: recent }),
    )
    if (issues.length === 0) continue
    out.push({ link, issues, worst: issues[0].severity, clicks30: recent ?? null })
  }
  const weight = (e: LinkHealth<T>) => e.clicks30 ?? e.link.total_clicks ?? 0
  return out.sort(
    (a, b) =>
      SEVERITY_RANK[a.worst] - SEVERITY_RANK[b.worst] ||
      weight(b) - weight(a) ||
      a.link.short_code.localeCompare(b.link.short_code),
  )
}

export interface HealthSummary {
  high: number
  medium: number
  low: number
  /** Links with at least one issue. */
  links: number
}

/** Counts issues by severity across links. `issuesByLink` is keyed by link id. */
export function summarizeHealth(
  issuesByLink: Map<string, HealthIssue[]> | Record<string, HealthIssue[]>,
): HealthSummary {
  const lists = issuesByLink instanceof Map ? [...issuesByLink.values()] : Object.values(issuesByLink)
  const out: HealthSummary = { high: 0, medium: 0, low: 0, links: 0 }
  for (const list of lists) {
    if (list.length > 0) out.links += 1
    for (const issue of list) out[issue.severity] += 1
  }
  return out
}
