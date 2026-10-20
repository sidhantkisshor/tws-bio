// Statement-style number formats for the Day Book dashboard. A gain carries a
// plus sign, a loss sits in parentheses the way a statement sets it, so the
// direction never depends on color alone: +1,475, (486), +12.4%, (20.6%).
// Grouping is pinned to en-US so the server and every browser agree.

/** 15184 gives "15,184". */
export function formatNumber(n: number, maximumFractionDigits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits })
}

export type Direction = 'up' | 'down' | 'flat'

export function direction(n: number): Direction {
  return n > 0 ? 'up' : n < 0 ? 'down' : 'flat'
}

/** 1475 gives "+1,475", -486 gives "(486)", 0 gives "0". */
export function formatSignedCount(delta: number, maximumFractionDigits = 0): string {
  const factor = 10 ** maximumFractionDigits
  const rounded = Math.round(delta * factor) / factor
  if (rounded === 0) return '0'
  const abs = formatNumber(Math.abs(rounded), maximumFractionDigits)
  return rounded > 0 ? `+${abs}` : `(${abs})`
}

/**
 * A change as a fraction (0.124 = 12.4%) to "+12.4%", "(20.6%)" or "0.0%".
 * `digits` is the number of decimals (default 1). At 100% and above the
 * decimals are dropped and the digits grouped: 17.875 gives "+1,788%".
 */
export function formatSignedPercent(fraction: number, digits = 1): string {
  const pct = fraction * 100
  const factor = 10 ** digits
  let rounded = Math.round(pct * factor) / factor
  let places = digits
  if (Math.abs(rounded) >= 100) {
    rounded = Math.round(pct)
    places = 0
  }
  if (rounded === 0) return `${(0).toFixed(digits)}%`
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })
  return rounded > 0 ? `+${abs}%` : `(${abs}%)`
}

/** What a change cell shows when both periods are empty: nothing to compare. */
export const NO_CHANGE = '-'

export type ChangeTone = 'up' | 'down' | 'flat' | 'new' | 'none'

/**
 * One change cell, current period against the prior one. `unit` "percent"
 * gives "+12.4%" (use it under a "Change %" head), "count" gives "+416"
 * (under a "Change" head). 0 vs 0 gives "-" (tone "none"). A percent with
 * an empty prior period gives "New"; a count just gives the gain.
 */
export function formatPeriodChange(
  current: number,
  prior: number,
  unit: 'percent' | 'count' = 'percent',
): { text: string; tone: ChangeTone } {
  const cur = Math.max(0, current)
  const pre = Math.max(0, prior)
  if (cur === 0 && pre === 0) return { text: NO_CHANGE, tone: 'none' }
  if (unit === 'count') {
    const text = formatSignedCount(cur - pre)
    return { text, tone: direction(cur - pre) }
  }
  if (pre === 0) return { text: 'New', tone: 'new' }
  const text = formatSignedPercent((cur - pre) / pre)
  const tone = text.startsWith('+') ? 'up' : text.startsWith('(') ? 'down' : 'flat'
  return { text, tone }
}

/** A share as a fraction (0.463) to "46.3%". */
export function formatShare(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

/**
 * Shares that add up to exactly 100.0 at `digits` decimals (largest
 * remainder), for a ledger whose rows sit over an "All ... 100.0%" total.
 * Returns fractions in the input order; all zero when the total is 0.
 */
export function sharesToHundred(values: number[], digits = 1): number[] {
  const total = values.reduce((s, v) => s + (v > 0 ? v : 0), 0)
  if (total <= 0) return values.map(() => 0)
  const units = 100 * 10 ** digits
  const raw = values.map((v) => ((v > 0 ? v : 0) / total) * units)
  const floors = raw.map(Math.floor)
  let left = units - floors.reduce((s, v) => s + v, 0)
  const order = raw
    .map((r, i) => [r - floors[i], i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (const [, i] of order) {
    if (left <= 0) break
    floors[i] += 1
    left -= 1
  }
  return floors.map((f) => f / units)
}
