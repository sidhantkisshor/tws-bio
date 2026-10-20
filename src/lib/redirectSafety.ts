import { withForwardedParams } from './forwardParams'
import { isAutoTagEnabled, withShortLinkAttribution } from './shortLinkAttribution'
import { BLOCKED_HOSTNAMES } from './utils'

// Pure helpers for the short-link redirect. They live outside the route module
// so they can be unit-tested (the route creates its Supabase client at import
// time) and so the forms that save these values check them the same way the
// redirect does.

// A bare Android WebView only understands intent: URIs if its host app
// intercepts them; otherwise the redirect dead-ends on ERR_UNKNOWN_URL_SCHEME.
// Full browsers (no "; wv)" marker: Chrome, Samsung Internet, Firefox) all
// parse intent:, as do Meta's in-app browsers. Everyone else keeps the
// graceful interstitial.
export function supportsIntentRedirect(userAgent: string): boolean {
  const isWebView = /;\s*wv\)/i.test(userAgent)
  if (!isWebView) return true
  return /\b(Instagram|FBAV|FBAN|FB_IAB)\b/i.test(userAgent)
}

export const SAFE_DEEP_LINK_SCHEMES: ReadonlySet<string> = new Set([
  'http:', 'https:',
  // App-specific schemes used by the deep link system
  'youtube:', 'vnd.youtube:', 'instagram:', 'twitter:', 'tiktok:',
  'spotify:', 'linkedin:', 'fb:', 'reddit:', 'whatsapp:', 'tg:',
  'discord:', 'slack:', 'pinterest:', 'snapchat:', 'twitch:', 'nflx:',
  'soundcloud:', 'comgooglemaps:', 'google.navigation:', 'maps:', 'geo:',
  'com.amazon.mobile.shopping:', 'ebay:', 'airbnb:', 'uber:', 'venmo:',
  'cashapp:', 'paypal:', 'medium:', 'github:', 'zoomus:',
])

/**
 * True when `url` may be used as a redirect target: a destination, a web
 * fallback or a stored app deep link. Only allowlisted schemes pass, and web
 * URLs must not point at a private or loopback host.
 */
export function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase().trim()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false
  }
  const colonIndex = lower.indexOf(':')
  if (colonIndex === -1) return false
  const scheme = lower.slice(0, colonIndex + 1)
  if (!SAFE_DEEP_LINK_SCHEMES.has(scheme)) return false
  if (scheme === 'http:' || scheme === 'https:') {
    try {
      const parsed = new URL(url)
      if (BLOCKED_HOSTNAMES.test(parsed.hostname)) return false
    } catch {
      return false
    }
  }
  return true
}

/**
 * True when `url` sends the visitor straight back to the short link `shortCode`
 * on `shortDomain`. Following it would record a click on every hop until the
 * browser gives up, so the redirect refuses it.
 */
export function pointsAtShortCode(url: string, shortCode: string, shortDomain: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== shortDomain.toLowerCase().replace(/^www\./, '')) return false
    // Only the exact path /<code> (a trailing slash redirects to it) comes back
    // here: [shortCode] serves a single segment, so a deeper path such as
    // /r/<slug> belongs to another route and is not a loop.
    return decodeURIComponent(parsed.pathname).replace(/\/$/, '') === `/${shortCode}`
  } catch {
    return false
  }
}

export function jsonEscapeForHtml(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

export function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Resolve the URL a visitor is actually sent to.
 *
 * Two steps, in this order:
 *  1. Carry through the attribution that arrived with the click, so a paid
 *     click keeps its `gclid` and its campaign.
 *  2. Only if neither the destination nor the click declares a campaign, stamp
 *     the link's own: `source` as `utm_source`, `short_link` as `utm_medium`
 *     and the short code as `utm_campaign`, so a bare share lands in GA4 as a
 *     named link. `source` comes from `attributionSource`: the site the link
 *     was clicked on, or the short domain when there is no referrer. Null
 *     skips this step. A click from one of the business's own sites is then
 *     left to GA4's own cross-domain and referral handling.
 *
 * Both steps append query parameters only, so a destination that passed
 * `isSafeUrl` before this call still passes it. Validation therefore stays
 * where it is, ahead of the rewrite.
 */
export function resolveDestination(
  destination: string,
  incoming: URLSearchParams,
  shortCode: string,
  source: string | null,
): string {
  const forwarded = withForwardedParams(destination, incoming)
  if (source === null || !isAutoTagEnabled()) return forwarded
  return withShortLinkAttribution(forwarded, incoming, shortCode, source)
}
