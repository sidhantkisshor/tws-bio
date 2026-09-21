import { withForwardedParams } from './forwardParams'

/**
 * `tws.bio/r/{slug}` is the short link for a TWS Resource Drop, the free-tools
 * lead page that sits at `twsgurukulx.com/r/{slug}` for each YouTube video.
 *
 * It is a pattern, not a link created up front. The drops are created in the
 * Resource Drop Desk, which writes to the TWS CRM database and has no access
 * to this project's database, so a per-video row could not be written from
 * there. A fixed pattern works the moment a drop exists. Clicks still reach
 * the dashboard: the route records each one against a 'r/{slug}' row that
 * `resource_drop_link_id` (migration 021) creates on the first click.
 *
 * The destination host and path prefix are fixed here, so this route can only
 * ever send a visitor to a Resource Drop page. It cannot be turned into an open
 * redirect by choosing the slug.
 */
export const RESOURCE_DROP_BASE = 'https://twsgurukulx.com/r/'

/** Same rule the CRM enforces on `resource_drops.slug`. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Longest slug whose click can be recorded: 'r/' + slug must fit the 50-char
 * `chk_short_code_length` constraint on `links`. Longer slugs still redirect.
 */
export const MAX_TRACKED_SLUG = 48

export function isResourceDropSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 60 && SLUG_RE.test(slug)
}

/**
 * The page a `tws.bio/r/{slug}` click is sent to, or null when the slug is not
 * a valid drop slug.
 *
 * Attribution that arrived with the click is carried through first (the same
 * allow-list as every other short link). Only when the click brought no
 * campaign of its own are the defaults stamped, naming the video, so the visit
 * lands in GA4 as that video rather than as a `tws.bio / referral`.
 */
export function resourceDropDestination(
  slug: string,
  incoming: URLSearchParams,
): string | null {
  if (!isResourceDropSlug(slug)) return null

  const forwarded = new URL(withForwardedParams(RESOURCE_DROP_BASE + slug, incoming))
  const p = forwarded.searchParams
  if (!p.has('utm_source') && !p.has('utm_medium') && !p.has('utm_campaign')) {
    p.set('utm_source', 'youtube')
    p.set('utm_medium', 'tws_bio')
    p.set('utm_campaign', slug)
  }
  return forwarded.toString()
}
