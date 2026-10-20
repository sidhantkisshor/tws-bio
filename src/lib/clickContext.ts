import { isLikelyBot } from './sgtm'

// Click-recording rules shared by the two redirect routes, `/[shortCode]` and
// `/r/[slug]`. They decide what counts as a click and whose IP it carries, so
// they live here once, under test, instead of in two route files.

/**
 * Bound on the click-recording RPCs. They run inside `after()`, once the
 * visitor is already on their way, so they can wait longer than the lookup
 * does, but a hung database must not keep the function alive.
 */
export const CLICK_RPC_TIMEOUT_MS = 5000

/**
 * True when this request is a visit worth recording as a click.
 *
 * Only GET counts. Next.js answers HEAD by running the GET handler, so without
 * this check a link checker, an email security scanner or a URL expander that
 * sends HEAD would write a click and spend a capped link's `max_clicks`.
 * Browsers never navigate with HEAD.
 *
 * Bots and link previews are dropped too. Every WhatsApp, Telegram or Slack
 * share fetches the link once to build its card, which is not a visit.
 */
export function shouldRecordClick(method: string, userAgent: string): boolean {
  return method === 'GET' && !isLikelyBot(userAgent)
}

/**
 * The visitor's IP, or null when the request carries none.
 *
 * The platform sets the trusted client IP as `x-real-ip`, or as the FIRST
 * entry of `x-forwarded-for`. The last entry is the nearest proxy, not the
 * visitor, and off a trusted proxy a client can forge it, so no later entry is
 * ever used, even when the first one is empty.
 */
export function clientIp(headers: Headers): string | null {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const firstForwarded = headers.get('x-forwarded-for')?.split(',')[0].trim()
  return firstForwarded || null
}
