/**
 * Default campaign tagging for short links that carry none of their own.
 *
 * `forwardParams.ts` carries through whatever attribution arrived with the
 * click. This module handles the other case: a link shared as a bare
 * `tws.bio/course`, with no `utm_*` anywhere.
 *
 * The standard redirect is an HTTP 307, and a browser that follows a redirect
 * keeps the original referrer: the page that held the link, usually trimmed to
 * its origin. Untagged, GA4 on the destination would file the visit as
 * `youtube.com / referral`, which names the platform but not the link. A click
 * that arrives with no referrer (many apps send none, a pasted link never has
 * one) would be `(direct) / (none)`, which names neither. Which link brought
 * the visit is the exact question a shortener exists to answer.
 *
 * So a bare click is stamped with a campaign that keeps the platform and adds
 * the link:
 *  - `utm_source` is the site the link was clicked on (`attributionSource`), or
 *    the short domain when there is no referrer to name. GA4 ranks `utm_*`
 *    above the referrer, so a fixed `tws.bio` here would erase the platform.
 *  - `utm_medium` is `short_link`.
 *  - `utm_campaign` is the short code, which names the individual link.
 * The deep-link interstitial is the one place where tws.bio really is the
 * referrer, because it navigates by script from a tws.bio page. Its web
 * fallback is stamped from the referrer of the click that reached it, so it
 * names the same source.
 *
 * A click from one of the business's own sites is not stamped at all. Those
 * sites share one GA4 property, so the visitor is already in a session that
 * GA4 credits to whatever brought them there (an ad, a search, a video). A
 * campaign stamped on the hop would take that credit and give it to our own
 * site. Left untagged, the hop is handled by the property's own cross-domain
 * and referral settings, like any other link between those sites.
 *
 * Kill switch: set `SHORTLINK_AUTOTAG=off`. It takes effect on the next
 * request, with no deploy.
 */

/** GA4 ranks `utm_*` above the referrer, so any existing source must win. */
const SOURCE_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign'])

/** Medium reported for traffic arriving through a short link. */
const SHORT_LINK_MEDIUM = 'short_link'

/**
 * The business's own sites, which all report into GA4 property G-L7PYFJM9QB.
 * A click from one of them, or from a subdomain of one, gets no default
 * campaign: the visitor's session already has its real source, and a stamped
 * one would credit our own site instead (see the module comment).
 */
export const BUSINESS_DOMAINS: readonly string[] = [
  'tradingwithsidhant.com',
  'twsgurukulx.com',
  'hitpoint.app',
]

/**
 * An Android package name, as Chrome reports the app that opened a link:
 * `android-app://com.google.android.youtube/`. Two or more dot-separated
 * parts, each starting with a letter.
 */
const ANDROID_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i

/** A hostname as sources are compared and reported: lowercase, no trailing dot, no `www.`. */
function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
}

/** The bare host of the app URL, or null when there is none or it does not parse. */
function appHost(appUrl: string | undefined): string | null {
  if (!appUrl) return null
  try {
    return bareHost(new URL(appUrl).hostname) || null
  } catch {
    return null
  }
}

/** True unless the kill switch is explicitly set to `off`. */
export function isAutoTagEnabled(
  flag: string | undefined = process.env.SHORTLINK_AUTOTAG,
): boolean {
  return flag?.trim().toLowerCase() !== 'off'
}

/**
 * The `utm_source` for a bare click, read from its `Referer`, or null to stamp
 * nothing.
 *
 *  - A web page gives its host, lowercased and without `www.`:
 *    `https://www.youtube.com/watch` gives `youtube.com`.
 *  - An Android app gives its package name, from the `android-app://<package>/`
 *    referrer Chrome sends for a link an app opened.
 *  - One of `BUSINESS_DOMAINS`, or a subdomain of one, gives null.
 *  - A page on the short domain or on the app's own host gives `shortDomain`.
 *    That click came from this app (the dashboard, a resource page), which is
 *    not a source.
 *  - No referrer, one that does not parse, or any other scheme gives
 *    `shortDomain`: all that is known is that the visit came through a short
 *    link.
 *
 * `appUrl` defaults to `NEXT_PUBLIC_APP_URL`.
 */
export function attributionSource(
  referer: string | null,
  shortDomain: string,
  appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string | null {
  if (!referer) return shortDomain
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return shortDomain
  }

  // Package names are case-sensitive, so the name is kept exactly as sent.
  if (url.protocol === 'android-app:') {
    return ANDROID_PACKAGE.test(url.hostname) ? url.hostname : shortDomain
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return shortDomain

  const host = bareHost(url.hostname)
  if (!host) return shortDomain
  if (host === bareHost(shortDomain) || host === appHost(appUrl)) return shortDomain
  // A dot boundary, so a look-alike such as `nottradingwithsidhant.com` is
  // named like any other site.
  if (BUSINESS_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return null
  }
  return host
}

/**
 * Append default campaign parameters to a destination that has no campaign of
 * its own. `source` becomes `utm_source` (see `attributionSource`) and the
 * short code becomes `utm_campaign`.
 *
 * Returns the destination untouched when:
 *  - the destination or the inbound click already declares any `utm_source`,
 *    `utm_medium` or `utm_campaign`, in any casing, so an author's tagging and
 *    a live ad campaign both win outright;
 *  - the destination is not `http:` or `https:`, because app schemes such as
 *    `spotify:track:123` are not query-bearing URLs;
 *  - the destination cannot be parsed, so a click is never dropped over
 *    measurement;
 *  - `shortCode` or `source` is empty, so a half-built campaign is never
 *    stamped.
 *
 * INVARIANT: only query parameters are appended. Scheme, host, port and path
 * are untouched, so a destination that passed `isSafeUrl` still passes it.
 */
export function withShortLinkAttribution(
  destination: string,
  incoming: URLSearchParams,
  shortCode: string,
  source: string,
): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return destination
  if (!shortCode || !source) return destination

  for (const key of url.searchParams.keys()) {
    if (SOURCE_KEYS.has(key.toLowerCase())) return destination
  }
  for (const key of incoming.keys()) {
    if (SOURCE_KEYS.has(key.toLowerCase())) return destination
  }

  const added = [
    `utm_source=${encodeURIComponent(source)}`,
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
