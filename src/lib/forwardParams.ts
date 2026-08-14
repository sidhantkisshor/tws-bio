/**
 * Tracking-parameter forwarding for the `/[shortCode]` redirect hop.
 *
 * A shortener is a redirect in the middle of somebody's journey. If it drops the
 * query string, it destroys the attribution it exists to carry:
 *
 *   - `utm_*` never reaches the destination, so GA4 logs a `tws.bio` referral
 *     instead of the campaign that paid for the click.
 *   - `fbclid` / `gclid` never reach Meta or Google, so ad platforms cannot tie
 *     the conversion back to the ad.
 *   - `_gl` (the GA4 cross-domain linker) is lost, so a visitor moving between
 *     two of our own domains starts a brand new session mid-journey, on a link
 *     whose entire job is to join those domains together.
 *
 * This module forwards an explicit allow-list rather than the whole query
 * string, so a short link cannot be used to inject arbitrary parameters into a
 * destination app.
 */

/**
 * Exact-match parameters carried through the redirect, in the casing each
 * vendor expects. Incoming keys are matched case-insensitively and rewritten to
 * the spelling here, because mail and SMS gateways routinely change the case of
 * query keys and `FBCLID` is not a parameter Meta will read.
 *
 * To carry another vendor's click ID, add it here.
 *
 * Deliberately absent: `ref` and `source`. Both are generic affiliate and
 * referral codes rather than vendor click IDs, so forwarding them lets any
 * third party mint `tws.bio/x?ref=them` and claim commission on clicks we paid
 * for. A link that needs them can hard-code them on its destination, which
 * always wins.
 */
export const FORWARDED_PARAMS = new Set([
  '_gl',                                   // GA4 cross-domain linker
  'gclid', 'gbraid', 'wbraid', 'gclsrc',   // Google Ads
  'dclid',                                 // Display & Video 360
  'fbclid',                                // Meta
  'ttclid',                                // TikTok
  'twclid',                                // X / Twitter
  'li_fat_id',                             // LinkedIn
  'msclkid',                               // Microsoft Ads
  'igshid',                                // Instagram
  'epik',                                  // Pinterest
  'ScCid',                                 // Snapchat
  'irclickid',                             // Impact
  'mc_cid', 'mc_eid',                      // Mailchimp
])

const CANONICAL_BY_LOWERCASE = new Map(
  [...FORWARDED_PARAMS].map((key) => [key.toLowerCase(), key]),
)

/**
 * Caps on what one inbound URL may push onto a destination.
 *
 * `utm_*` is an unbounded prefix wildcard, so without a ceiling anyone can hand
 * out `tws.bio/x?utm_a0=..&utm_a1=..` several hundred times over and produce a
 * `Location` header past the 8 KB limit most CDNs enforce, which turns the link
 * into a 502 for whoever received it.
 */
const MAX_FORWARDED_PARAMS = 25
const MAX_FORWARDED_CHARS = 2048

/**
 * The vendor spelling for a tracking parameter, or null when the key is not one
 * we carry. `utm_*` normalises to lowercase, which is the only casing GA4 and
 * every other analytics tool reads.
 */
function canonicalParam(key: string): string | null {
  const lower = key.toLowerCase()
  if (lower.startsWith('utm_')) return lower
  return CANONICAL_BY_LOWERCASE.get(lower) ?? null
}

/** True when `key` is a tracking parameter worth carrying to the destination. */
export function shouldForwardParam(key: string): boolean {
  return canonicalParam(key) !== null
}

/**
 * Merge incoming tracking parameters onto a destination URL.
 *
 * Rules:
 *  - Parameters already on the destination win, so a link author who hard-coded
 *    `?utm_source=newsletter` keeps it. The comparison is case-insensitive, or
 *    `?UTM_SOURCE=` from a stranger would sit alongside the author's value and
 *    quietly rewrite the campaign every analytics tool folds keys for.
 *  - Empty values are dropped. A bare `?utm_source` on a shared link would
 *    otherwise set an empty source on the destination, which in GA4 suppresses
 *    the referral it would have derived on its own.
 *  - Duplicated incoming keys collapse to the first occurrence.
 *  - Only `http:` and `https:` destinations are rewritten. App schemes such as
 *    `youtube://` have their own grammar and are returned untouched.
 *  - An unparseable destination is returned as-is rather than dropping the click.
 *
 * The result is built by appending to the original string rather than by
 * re-serialising a parsed URL. Mutating `URLSearchParams` rewrites the whole
 * query as form encoding, which turns a destination's own `?q=a b` into `q=a+b`
 * and splits `?a=1;b=2` at the semicolon. That rewrite would only happen on
 * clicks that carry tracking params, so the same link would resolve two
 * different ways depending on where it was clicked from.
 *
 * INVARIANT: scheme, host, port and path are never touched, so a destination
 * that passed `isSafeUrl` before this call still passes it afterwards. Callers
 * rely on that to validate once, before forwarding.
 */
export function withForwardedParams(
  destination: string,
  incoming: URLSearchParams,
): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return destination

  // Read the destination's existing keys without mutating them, so the original
  // query string survives byte for byte.
  const claimed = new Set<string>()
  for (const key of url.searchParams.keys()) claimed.add(key.toLowerCase())

  const additions: string[] = []
  let remaining = MAX_FORWARDED_CHARS

  for (const [rawKey, value] of incoming) {
    if (additions.length >= MAX_FORWARDED_PARAMS) break
    if (!value) continue

    const key = canonicalParam(rawKey)
    if (!key || claimed.has(key)) continue

    const pair = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    if (pair.length + 1 > remaining) continue

    remaining -= pair.length + 1
    claimed.add(key)
    additions.push(pair)
  }

  if (additions.length === 0) return destination

  // Split on the fragment so appended params land in the query, not the hash.
  const hashIndex = destination.indexOf('#')
  const base = hashIndex === -1 ? destination : destination.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : destination.slice(hashIndex)

  const separator = !base.includes('?') ? '?' : base.endsWith('?') ? '' : '&'
  return `${base}${separator}${additions.join('&')}${hash}`
}
