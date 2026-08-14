/**
 * Google Tag Manager wiring for the shared "Trading with Sidhant" web
 * container (GTM-P3PR2NBT).
 *
 * This app pushes into the SAME container every other tws.* property uses,
 * rather than standing up a tws.bio-only container, because the server-side
 * GTM behind it is the single place that forwards a whitelisted set of
 * standard event names on to downstream ad platforms (Meta Conversions
 * API, etc.). One container means one place to manage triggers, one
 * dataLayer contract across properties, and no risk of a tws.bio-only
 * container silently drifting from what the rest of the business tracks.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

/**
 * The GTM container ID, or an empty string when tagging is disabled.
 *
 * Read as a direct static member expression (not a computed key) so Next can
 * inline it at build time. NEXT_PUBLIC_* vars only survive minification when
 * referenced this way.
 *
 * The value is shape-checked because it is interpolated into an inline
 * `<script>`. A stray quote from a mistyped env var would otherwise break every
 * script on the page rather than just disabling tagging, so anything that is
 * not a container ID is treated as "tagging off".
 */
const CONTAINER_ID = /^GTM-[A-Z0-9]+$/

const configuredGtmId = process.env.NEXT_PUBLIC_GTM_ID ?? ''

export const GTM_ID: string = CONTAINER_ID.test(configuredGtmId) ? configuredGtmId : ''

/** Shape of a dataLayer entry. */
export type GtmEvent = { event: string } & Record<string, unknown>

/**
 * Event names this app emits, kept in one place so they are greppable and
 * so the server container's trigger config can be cross-checked against them.
 *
 * Prefixed `tws_` and deliberately distinct from the GA4 standard event
 * names (`sign_up`, `page_view`, `purchase`, ...): the shared server
 * container forwards a whitelist of those standard names on to the Meta
 * Conversions API as business conversions. tws.bio is an internal link
 * tool, not a storefront, so its activity must never be mistaken for one
 * of those conversions just because it happens to reuse a standard name.
 */
export const TWS_EVENTS = {
  linkCreated: 'tws_link_created',
  linkCopied: 'tws_link_copied',
  qrDownloaded: 'tws_qr_download',
  signUp: 'tws_account_signup',
  login: 'tws_account_login',
} as const

/** Initialise window.dataLayer without clobbering an existing one. Exported for the loader. */
export function ensureDataLayer(): unknown[] | undefined {
  if (typeof window === 'undefined') return undefined
  window.dataLayer = window.dataLayer ?? []
  return window.dataLayer
}

/**
 * Push a named event onto the GTM dataLayer.
 * No-op on the server, and no-op when GTM_ID is empty, so callers never
 * need to guard.
 */
export function gtmEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!GTM_ID) return
  const dataLayer = ensureDataLayer()
  dataLayer?.push({ event, ...params })
}
