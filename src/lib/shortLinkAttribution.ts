/**
 * Default campaign tagging for short links that carry none of their own.
 *
 * `forwardParams.ts` carries through whatever attribution arrived with the
 * click. This module handles the other case: a link shared as a bare
 * `tws.bio/course`, with no `utm_*` anywhere.
 *
 * Without tagging, GA4 on the destination sees only `document.referrer` and
 * files the visit as `tws.bio / referral`. Every short link then collapses into
 * one undifferentiated bucket, so a purchase can be traced back to "a short
 * link" and no further. That is the exact question a shortener exists to
 * answer.
 *
 * Tagging destroys nothing, because there was no campaign to overwrite: GA4
 * ranks `utm_*` above referrer, so the only attribution replaced is the
 * `tws.bio / referral` this would otherwise have produced. The replacement
 * names the individual link.
 *
 * Kill switch: set `SHORTLINK_AUTOTAG=off`. It takes effect on the next
 * request, with no deploy.
 */

/** GA4 ranks `utm_*` above the referrer, so any existing source must win. */
const SOURCE_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign'])

/** Medium reported for traffic arriving through a short link. */
const SHORT_LINK_MEDIUM = 'short_link'

/** True unless the kill switch is explicitly set to `off`. */
export function isAutoTagEnabled(
  flag: string | undefined = process.env.SHORTLINK_AUTOTAG,
): boolean {
  return flag?.trim().toLowerCase() !== 'off'
}

/**
 * Append default campaign parameters to a destination that has no campaign of
 * its own.
 *
 * Returns the destination untouched when:
 *  - the destination or the inbound click already declares any `utm_source`,
 *    `utm_medium` or `utm_campaign`, in any casing, so an author's tagging and
 *    a live ad campaign both win outright;
 *  - the destination is not `http:` or `https:`, because app schemes such as
 *    `spotify:track:123` are not query-bearing URLs;
 *  - the destination cannot be parsed, so a click is never dropped over
 *    measurement.
 *
 * INVARIANT: only query parameters are appended. Scheme, host, port and path
 * are untouched, so a destination that passed `isSafeUrl` still passes it.
 */
export function withShortLinkAttribution(
  destination: string,
  incoming: URLSearchParams,
  shortCode: string,
  sourceDomain: string,
): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return destination
  if (!shortCode || !sourceDomain) return destination

  for (const key of url.searchParams.keys()) {
    if (SOURCE_KEYS.has(key.toLowerCase())) return destination
  }
  for (const key of incoming.keys()) {
    if (SOURCE_KEYS.has(key.toLowerCase())) return destination
  }

  const added = [
    `utm_source=${encodeURIComponent(sourceDomain)}`,
    `utm_medium=${SHORT_LINK_MEDIUM}`,
    `utm_campaign=${encodeURIComponent(shortCode)}`,
  ].join('&')

  // Append to the raw string rather than re-serialising a parsed URL, which
  // would form-encode the destination's own query and change bytes we were
  // asked to leave alone. Same reasoning as `withForwardedParams`.
  const hashIndex = destination.indexOf('#')
  const base = hashIndex === -1 ? destination : destination.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : destination.slice(hashIndex)

  const separator = !base.includes('?') ? '?' : base.endsWith('?') ? '' : '&'
  return `${base}${separator}${added}${hash}`
}
