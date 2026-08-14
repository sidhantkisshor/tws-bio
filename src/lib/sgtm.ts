/**
 * Server-side tagging transport for the `/[shortCode]` redirect.
 *
 * A short link is a 302. There is no page, so there is no place to run the
 * Google Tag Manager web container, and every click would otherwise be
 * invisible to the central measurement stack. This module ships the click
 * straight from our server to the first-party server container
 * (`sgtm.tradingwithsidhant.com`), which already owns the GA4 client and
 * forwards on to the same GA4 property the website reports into.
 *
 * Why this beats an interstitial page that loads GTM:
 *   - Zero added latency. The hit leaves inside `after()`, once the redirect
 *     has already been written to the wire.
 *   - Content blockers cannot drop it. The request is server to server.
 *   - No cookie is set on tws.bio, so the redirect stays consent-neutral.
 *
 * The trade-off is that a server hit has no browser to fingerprint, so the
 * client ID is derived (see `deriveClientId`) rather than read from a cookie.
 * Clicks therefore count as GA4 users at roughly device granularity, and do
 * not stitch to the destination site's own session. Session stitching is the
 * job of `forwardParams.ts`, which carries `utm_*`, `_gl` and the ad click IDs
 * through to the destination.
 */

import { createHash } from 'node:crypto'

/** Base URL of the GTM server container. Server-only, never exposed to the browser. */
const SGTM_ENDPOINT = process.env.SGTM_ENDPOINT
/**
 * GA4 destination, e.g. `G-XXXXXXXXXX`.
 *
 * This is not duplicated GTM config, it is the address on the envelope. During
 * a redirect there is no GTM to read it from: this module IS the tag, speaking
 * GA4's Measurement Protocol directly. The server container's GA4 client
 * rejects a hit with no `tid` outright (HTTP 400), and its "GA4 - Forward to
 * GA4" tag sets no measurement ID of its own, so the value sent here is what
 * decides which property the click lands in.
 */
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID

/** GA4 web measurement IDs are `G-` followed by an uppercase alphanumeric run. */
const MEASUREMENT_ID = /^G-[A-Z0-9]+$/

/**
 * Describe a broken tagging configuration, or null when it is coherent.
 *
 * Both unset is coherent: it means tagging is deliberately off, which is the
 * normal state in local dev and on preview deploys.
 *
 * This exists because every misconfiguration here fails silently. The server
 * container answers 200 to a hit carrying a mistyped measurement ID, and GA4
 * then discards it downstream, so the only symptom is a report that stays
 * empty. Verified against the live container: `tid=G-ZZZZZZZZZZ` returns 200.
 */
export function taggingConfigProblem(
  endpoint: string | undefined,
  measurementId: string | undefined,
): string | null {
  if (!endpoint && !measurementId) return null
  if (!endpoint) return 'GA4_MEASUREMENT_ID is set but SGTM_ENDPOINT is not, so no click is sent.'
  if (!measurementId) return 'SGTM_ENDPOINT is set but GA4_MEASUREMENT_ID is not, so no click is sent.'
  if (!measurementId.startsWith('G-')) {
    return `GA4_MEASUREMENT_ID is "${measurementId}". Expected a GA4 web measurement ID (G-...), not a container or stream ID.`
  }
  if (!MEASUREMENT_ID.test(measurementId)) {
    return `GA4_MEASUREMENT_ID is "${measurementId}", which is not a valid measurement ID. Clicks will be accepted by the tag server and then dropped by GA4.`
  }
  return null
}

const CONFIG_PROBLEM = taggingConfigProblem(SGTM_ENDPOINT, GA4_MEASUREMENT_ID)
if (CONFIG_PROBLEM) console.warn(`[sgtm] ${CONFIG_PROBLEM}`)
/**
 * Salt for client-ID derivation. Without it the hash is a plain digest of an
 * IP, which is brute-forceable across the whole IPv4 space. Rotating it resets
 * returning-user counts, so treat it as long lived.
 */
const CID_SALT = process.env.SGTM_CID_SALT || ''

/** GA4 counts a session as ended after 30 minutes of inactivity. */
const SESSION_WINDOW_SECONDS = 30 * 60

/** A slow tag server must never hold a serverless invocation open. */
const SEND_TIMEOUT_MS = 2500

/**
 * Event name for a short-link click.
 *
 * Deliberately NOT one of GA4's standard names. The server container forwards
 * a whitelist of standard names (`page_view`, `purchase`, `sign_up`, ...) on to
 * the Meta Conversions API, and a redirect is not a business conversion.
 * Anything added here must stay off that whitelist.
 */
export const SHORT_LINK_CLICK_EVENT = 'short_link_click'

/**
 * Crawlers, previewers and uptime checks fetch short links constantly. They are
 * worth keeping in our own `clicks` table for debugging, but sending them to
 * GA4 would corrupt user and session counts, so they are dropped here only.
 */
const BOT_UA = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python-requests|axios|node-fetch|headless|lighthouse|pingdom|uptime|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|embedly|quora link preview|bitlybot|skypeuripreview|vkshare|redditbot|applebot|googleother|gptbot|claudebot|perplexity/i

/** True when the user agent looks automated rather than human. */
export function isLikelyBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true
  return BOT_UA.test(userAgent)
}

/**
 * Derive a stable, non-reversible GA4 client ID from what a redirect can see.
 *
 * GA4's canonical client ID is `<random>.<first-seen unix seconds>`; anything
 * matching that shape is accepted. The same visitor on the same device keeps
 * the same ID for as long as their IP holds, which is the best a cookieless
 * hop can do.
 */
export function deriveClientId(
  ip: string | null,
  userAgent: string,
  salt: string = CID_SALT,
): string {
  const digest = createHash('sha256')
    .update(`${salt}|${ip ?? 'no-ip'}|${userAgent}`)
    .digest('hex')
  // Two independent 32-bit slices, each folded into GA4's 10-digit range.
  const high = parseInt(digest.slice(0, 8), 16) % 1_000_000_000
  const low = parseInt(digest.slice(8, 16), 16) % 1_000_000_000
  return `${high}.${low}`
}

/**
 * Bucket a timestamp into a GA4 session ID.
 *
 * Two clicks from the same derived visitor inside the same 30-minute window
 * land in one session, which is what GA4 would have done client-side.
 */
export function deriveSessionId(nowMs: number): string {
  return String(Math.floor(nowMs / 1000 / SESSION_WINDOW_SECONDS) * SESSION_WINDOW_SECONDS)
}

export type ClickEventInput = {
  /** Full inbound short-link URL, query string included. */
  pageLocation: string
  /** `Referer` header of the click, when the browser sent one. */
  referrer?: string | null
  clientId: string
  sessionId: string
  /** `Accept-Language` header, trimmed to the primary tag. */
  language?: string | null
  /** Event parameters. `undefined` and empty values are dropped. */
  params?: Record<string, string | number | boolean | null | undefined>
  /** Injectable for tests. Defaults to a random hit ID. */
  hitId?: number
}

/**
 * Build the GA4 Measurement Protocol v2 payload the server container's GA4
 * client expects.
 *
 * `dl` carries the inbound URL with its query string intact, so GA4 derives
 * campaign attribution from the link's own `utm_*` parameters. That is why no
 * campaign fields are set by hand here.
 *
 * Exported separately from the transport so it can be asserted on without a
 * network call.
 */
export function buildClickPayload(
  measurementId: string,
  eventName: string,
  input: ClickEventInput,
): URLSearchParams {
  const payload = new URLSearchParams({
    v: '2',
    tid: measurementId,
    cid: input.clientId,
    sid: input.sessionId,
    // Marks the session as engaged, so the click is not filed as a bounce.
    seg: '1',
    _p: String(input.hitId ?? Math.floor(Math.random() * 2_147_483_647)),
    // A redirect has no dwell time. 1ms is the smallest value GA4 treats as
    // real engagement rather than a missing field.
    _et: '1',
    en: eventName,
    dl: input.pageLocation,
  })

  if (input.referrer) payload.set('dr', input.referrer)
  if (input.language) payload.set('ul', input.language.toLowerCase())

  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (value === undefined || value === null || value === '') continue
    // GA4 splits event parameters by type: `epn.` for numbers, `ep.` for the
    // rest. Sending a number under `ep.` files it as a string dimension and it
    // can never be summed in a report.
    const prefix = typeof value === 'number' ? 'epn.' : 'ep.'
    payload.set(`${prefix}${key}`, String(value))
  }

  return payload
}

export type SendClickOptions = {
  pageLocation: string
  referrer?: string | null
  userAgent: string
  ip: string | null
  language?: string | null
  params?: ClickEventInput['params']
  eventName?: string
}

/**
 * Send one click to the server container. Never throws, never blocks a
 * redirect: call it from inside `after()`.
 *
 * Returns what happened so callers and tests can tell a skip from a failure.
 */
export async function sendClickToServerContainer(
  options: SendClickOptions,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (!SGTM_ENDPOINT || !GA4_MEASUREMENT_ID || CONFIG_PROBLEM) return 'skipped'
  if (isLikelyBot(options.userAgent)) return 'skipped'

  let collectUrl: URL
  try {
    collectUrl = new URL('/g/collect', SGTM_ENDPOINT)
    // A misconfigured endpoint must not turn this into an arbitrary outbound
    // request from our servers.
    if (collectUrl.protocol !== 'https:') return 'skipped'
  } catch {
    return 'skipped'
  }

  const now = Date.now()
  const payload = buildClickPayload(GA4_MEASUREMENT_ID, options.eventName ?? SHORT_LINK_CLICK_EVENT, {
    pageLocation: options.pageLocation,
    referrer: options.referrer,
    clientId: deriveClientId(options.ip, options.userAgent),
    sessionId: deriveSessionId(now),
    language: options.language,
    params: options.params,
  })
  collectUrl.search = payload.toString()

  try {
    const response = await fetch(collectUrl, {
      method: 'POST',
      headers: {
        // The server container reads geo and device from these, exactly as it
        // would from a real browser hit. Without them every click reports as
        // coming from our own data centre.
        'User-Agent': options.userAgent,
        ...(options.ip ? { 'X-Forwarded-For': options.ip } : {}),
        ...(options.language ? { 'Accept-Language': options.language } : {}),
        'Content-Length': '0',
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    return response.ok ? 'sent' : 'failed'
  } catch {
    // A measurement hit is never worth surfacing to the visitor, and the
    // response has already been sent by the time this runs.
    return 'failed'
  }
}

/**
 * Reduce a URL to its hostname, for use as a low-cardinality report dimension.
 *
 * Restricted to `http:` and `https:` on purpose. WHATWG URL parsing reads an
 * authority out of any `scheme://host` string, so `youtube://watch?v=abc`
 * resolves to a hostname of `watch`. Left unchecked, every app-scheme deep link
 * would file a fabricated domain like `watch` or `user` in GA4 and quietly
 * pollute the destination report.
 */
function webHostname(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.hostname || undefined
  } catch {
    return undefined
  }
}

/** Hostname of the click's referrer, when it had a web referrer. */
export function referrerDomain(referrer: string | null | undefined): string | undefined {
  return webHostname(referrer)
}

/** Hostname of the link's destination. App-scheme deep links report nothing. */
export function destinationDomain(destination: string): string | undefined {
  return webHostname(destination)
}
