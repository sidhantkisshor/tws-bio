// Which links gained or lost clicks between two equal windows.

export type ClickCounts = Map<string, number> | Record<string, number>

export interface Mover {
  linkId: string
  current: number
  prior: number
  delta: number
  /** Change as a fraction of the prior window (0.5 = +50%), null when prior is 0. */
  pct: number | null
}

function entries(counts: ClickCounts): [string, number][] {
  return counts instanceof Map ? [...counts.entries()] : Object.entries(counts)
}

/**
 * One row per link seen in either window. A link is dropped when it has fewer
 * than `minClicks` (default 0) clicks in both windows, so tiny counts do not
 * show as huge swings. Sorted by delta, biggest gain first, ties by link id.
 */
export function computeMovers(
  current: ClickCounts,
  prior: ClickCounts,
  opts: { minClicks?: number } = {},
): Mover[] {
  const minClicks = opts.minClicks ?? 0
  const cur = new Map(entries(current))
  const pri = new Map(entries(prior))
  const ids = new Set([...cur.keys(), ...pri.keys()])
  const out: Mover[] = []
  for (const linkId of ids) {
    const c = cur.get(linkId) ?? 0
    const p = pri.get(linkId) ?? 0
    if (Math.max(c, p) < minClicks) continue
    out.push({ linkId, current: c, prior: p, delta: c - p, pct: p === 0 ? null : (c - p) / p })
  }
  return out.sort((a, b) => b.delta - a.delta || a.linkId.localeCompare(b.linkId))
}

export function topGainers(list: Mover[], n: number): Mover[] {
  return list
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.linkId.localeCompare(b.linkId))
    .slice(0, Math.max(0, n))
}

export function topDecliners(list: Mover[], n: number): Mover[] {
  return list
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.linkId.localeCompare(b.linkId))
    .slice(0, Math.max(0, n))
}

const DAY_MS = 86_400_000

/** Ids of links with no clicks in the current window that are older than `minAgeDays`. */
export function quietLinks(
  links: { id: string; created_at: string }[],
  current: ClickCounts,
  now: Date,
  minAgeDays = 14,
): string[] {
  const cur = new Map(entries(current))
  const cutoff = now.getTime() - minAgeDays * DAY_MS
  return links
    .filter((l) => {
      const created = Date.parse(l.created_at)
      return Number.isFinite(created) && created < cutoff && (cur.get(l.id) ?? 0) === 0
    })
    .map((l) => l.id)
}
