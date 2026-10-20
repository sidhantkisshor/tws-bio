// Row rules for the dashboard Links table. Kept free of heavy imports, because
// LinksTable loads this module on every visit to the links page.

import { formatSignedPercent } from './ledgerFormat'

/**
 * True for a Resource Drop row (`r/{slug}`). The /r/[slug] route creates the
 * row on the first click and redirects without reading it, so is_active, the
 * destination, the expiry and the click limit change nothing a visitor sees.
 * Deleting one cascades its click history away, and the next click starts a
 * fresh row at zero. Custom codes cannot contain '/', so the prefix marks
 * these rows and only these.
 */
export function isResourceDropRow(shortCode: string): boolean {
  return shortCode.startsWith('r/')
}

/** Ids of the rows on screen that bulk actions may touch, in screen order. */
export function selectableLinkIds(
  rows: readonly { id: string; short_code: string }[],
): string[] {
  return rows.filter((row) => !isResourceDropRow(row.short_code)).map((row) => row.id)
}

/**
 * The part of a selection that bulk actions act on. The table is not remounted
 * when the page, search or filters change, so a selection can still name rows
 * that are no longer on screen. A bulk delete must never reach those.
 */
export function effectiveSelection(
  selected: ReadonlySet<string>,
  selectableIds: readonly string[],
): string[] {
  return selectableIds.filter((id) => selected.has(id))
}

/**
 * The Change column: clicks in the last 30 days against the 30 before, set
 * the way a statement sets it. A gain carries a plus sign and a loss sits in
 * parentheses, so the direction never depends on color alone. "New" when the
 * prior window had no clicks and this one has some; "0" when both are empty.
 */
export function formatChange(
  current: number,
  prior: number,
): { text: string; tone: 'up' | 'down' | 'flat' | 'new' } {
  if (prior <= 0) {
    return current > 0 ? { text: 'New', tone: 'new' } : { text: '0', tone: 'flat' }
  }
  const text = formatSignedPercent((current - prior) / prior)
  const tone = text.startsWith('+') ? 'up' : text.startsWith('(') ? 'down' : 'flat'
  return { text, tone }
}

/** The health issue a row shows as a badge. A type import only: the rules stay on the server. */
export interface RowIssue {
  /** Short badge text, e.g. "Expired". */
  label: string
  /** The full sentence, for the tooltip and screen readers. */
  message: string
  /** 'neg' for a link that visitors cannot use now (red), 'neutral' for a warning. */
  tone: 'neg' | 'neutral'
}

type IssueLike = {
  kind: 'placeholder' | 'loop' | 'expired' | 'expiring_soon' | 'at_cap' | 'near_cap' | 'inactive' | 'quiet'
  severity: 'high' | 'medium' | 'low'
  message: string
}

const ISSUE_LABEL: Record<IssueLike['kind'], string | null> = {
  placeholder: 'Placeholder destination',
  loop: 'Points at tws.bio',
  expired: 'Expired',
  at_cap: 'Click limit reached',
  expiring_soon: 'Expires soon',
  near_cap: 'Near click limit',
  // A paused or quiet link is not a destination problem. Paused has its own badge.
  inactive: null,
  quiet: null,
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const

/**
 * The one badge a row shows for its health issues: the most severe high or
 * medium issue (linkHealthIssues order breaks a tie). Null when there is none.
 */
export function rowIssue(issues: readonly IssueLike[]): RowIssue | null {
  const shown = issues
    .filter((issue) => issue.severity !== 'low' && ISSUE_LABEL[issue.kind])
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity] || a.i - b.i)
  const top = shown[0]?.issue
  if (!top) return null
  return {
    label: top.kind === 'loop' && top.severity === 'high' ? 'Points at itself' : (ISSUE_LABEL[top.kind] as string),
    message: top.message,
    tone: top.severity === 'high' ? 'neg' : 'neutral',
  }
}
