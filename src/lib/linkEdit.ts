import { isSafeUrl } from './redirectSafety'
import { isValidUrl, normalizeUrl } from './utils'

// The checks behind the Edit Link dialog. Each one matches what the redirect
// does with the value, so the dialog never saves something the redirect would
// quietly drop.
//
// The expiry and click-limit checks are for a value the owner enters. One left
// as stored is written back as it is, even when it has already turned the link
// off: saving it changes nothing the redirect does, and refusing it would
// block every other edit, such as fixing the destination.

// The words for the two limit fields, shared by Create and Edit Link so the
// same field reads the same in both.
export const EXPIRY_LABEL = 'Stops working on'
export const EXPIRY_HINT_EMPTY = 'Empty: it never stops.'
export const EXPIRY_HINT_DAY = 'It stops at the end of that day, India time.'
export const CLICK_LIMIT_LABEL = 'Click limit'
export const CLICK_LIMIT_PLACEHOLDER = 'No limit'
export const CLICK_LIMIT_HINT =
  'The link stops after this many clicks. Approximate: clicks at the same moment can pass it by a few.'
export const EXPIRY_INCOMPLETE_ERROR = 'Enter a full date, or clear it.'
export const EXPIRY_PAST_ERROR = 'Pick today or a later day, or clear the date.'

// "Stops working on" is a day in India time, the zone the dashboard files
// days in. IST has no daylight saving, so a fixed offset is exact.
const DAY_MS = 86_400_000
const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const IST_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
})

/** The instant a link set to stop on `day` (YYYY-MM-DD) stops: midnight IST after it. NaN for a bad day. */
export function endOfIstDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Number.NaN
  return Date.parse(`${day}T00:00:00+05:30`) + DAY_MS
}

/**
 * The IST day (YYYY-MM-DD) a stored expiry falls on, as "Stops working on"
 * shows it: the last day the link still works at some point. An expiry at
 * midnight IST (what Create saves) is the end of the day before. '' for none.
 */
export function expiryDayOf(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return IST_DATE.format(new Date(t - 1))
}

/**
 * The hint under "Stops working on". A stored expiry that is not at midnight
 * IST keeps its own time while its day is unchanged, so the hint names it.
 */
export function expiryHint(day: string, storedExpiresAt: string | null = null): string {
  if (!day) return EXPIRY_HINT_EMPTY
  if (storedExpiresAt && day === expiryDayOf(storedExpiresAt)) {
    const t = new Date(storedExpiresAt).getTime()
    if (t !== endOfIstDay(day)) return `It stops at ${IST_TIME.format(new Date(t))} that day, India time.`
  }
  return EXPIRY_HINT_DAY
}

/** `links.max_clicks` is a Postgres INTEGER. */
const MAX_INTEGER = 2_147_483_647

const SHORT_DOMAIN = (process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio')
  .toLowerCase()
  .replace(/^www\./, '')

const APP_LINK_ERROR =
  "The redirect can't open this link. Use a supported app link, like youtube:// or instagram://, or an https:// address."

export interface LinkEditFields {
  originalUrl: string
  iosDeepLink: string
  androidDeepLink: string
  fallbackUrl: string
  /** The IST day the link stops working on (YYYY-MM-DD, a date input), or '' for no expiry. */
  expiresAt: string
  /** What was typed in Max Clicks, or '' for no limit. */
  maxClicks: string
}

export type LinkEditField = keyof LinkEditFields

export type LinkEditErrors = Partial<Record<LinkEditField, string>>

/** The columns a valid edit writes. The deep-link columns only for deep links. */
export interface LinkEditUpdate {
  original_url: string
  expires_at: string | null
  max_clicks: number | null
  ios_deep_link?: string | null
  android_deep_link?: string | null
  fallback_url?: string | null
}

export interface LinkEditContext {
  isDeepLink: boolean
  /** The link's click count when the dialog opened. Null counts as 0. */
  totalClicks: number | null
  /** The stored expiry, so an untouched one is written back exactly, even once passed. */
  storedExpiresAt: string | null
  /** The stored limit, so an untouched one is written back as it is, even once reached. */
  storedMaxClicks: number | null
  now: Date
}

export interface LinkEditCheck {
  /** The fields as they will be saved: trimmed, with web addresses completed. */
  fields: LinkEditFields
  /** One message per field that cannot be saved. Empty when the edit is valid. */
  errors: LinkEditErrors
  /** What to write. Only meaningful when `errors` is empty. */
  update: LinkEditUpdate
}

function webAddressError(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if (host === SHORT_DOMAIN) return 'Use the final page, not another tws.bio short link.'
  } catch {
    // Not a URL at all: the general message covers it.
  }
  return 'Enter a full web address, like https://example.com.'
}

function clickCount(n: number): string {
  return `${n.toLocaleString('en-US')} click${n === 1 ? '' : 's'}`
}

export function checkLinkEdit(input: LinkEditFields, context: LinkEditContext): LinkEditCheck {
  const fields: LinkEditFields = {
    originalUrl: normalizeUrl(input.originalUrl),
    iosDeepLink: input.iosDeepLink.trim(),
    androidDeepLink: input.androidDeepLink.trim(),
    fallbackUrl: normalizeUrl(input.fallbackUrl),
    expiresAt: input.expiresAt.trim(),
    maxClicks: input.maxClicks.trim(),
  }
  const errors: LinkEditErrors = {}

  if (!isValidUrl(fields.originalUrl)) {
    errors.originalUrl = webAddressError(fields.originalUrl)
  }

  if (context.isDeepLink) {
    // The redirect follows a stored app link only when it passes isSafeUrl.
    // Anything else sends the visitor to the destination with no message.
    if (fields.iosDeepLink && !isSafeUrl(fields.iosDeepLink)) {
      errors.iosDeepLink = APP_LINK_ERROR
    }
    if (fields.androidDeepLink && !isSafeUrl(fields.androidDeepLink)) {
      errors.androidDeepLink = APP_LINK_ERROR
    }
    if (fields.fallbackUrl && !isValidUrl(fields.fallbackUrl)) {
      errors.fallbackUrl = webAddressError(fields.fallbackUrl)
    }
  }

  let expiresAt: string | null = null
  if (fields.expiresAt) {
    const stored = context.storedExpiresAt
    if (stored !== null && fields.expiresAt === expiryDayOf(stored)) {
      // Same day as stored: the stored instant, time and seconds included,
      // even if it has passed.
      expiresAt = stored
    } else {
      const end = endOfIstDay(fields.expiresAt)
      if (Number.isNaN(end)) {
        errors.expiresAt = EXPIRY_INCOMPLETE_ERROR
      } else if (end <= context.now.getTime()) {
        // A new past day would turn the link off the moment it is saved.
        errors.expiresAt = EXPIRY_PAST_ERROR
      } else {
        expiresAt = new Date(end).toISOString()
      }
    }
  }

  let maxClicks: number | null = null
  if (fields.maxClicks) {
    const stored = context.storedMaxClicks
    if (stored != null && fields.maxClicks === String(stored)) {
      // Untouched (the field still reads as the dialog filled it in): the
      // stored limit, even if the link has already reached it.
      maxClicks = stored
    } else {
      const total = context.totalClicks ?? 0
      const value = /^\d+$/.test(fields.maxClicks) ? Number(fields.maxClicks) : Number.NaN
      if (Number.isNaN(value) || value < 1) {
        errors.maxClicks = 'Enter a whole number of 1 or more, or leave it empty.'
      } else if (value > MAX_INTEGER) {
        errors.maxClicks = 'Enter a smaller number.'
      } else if (value <= total) {
        // The redirect turns a link off once total_clicks reaches the limit, so
        // a new limit at or below the count would turn it off on save.
        errors.maxClicks = `This link already has ${clickCount(total)}, so the limit must be above ${total.toLocaleString('en-US')}.`
      } else {
        maxClicks = value
      }
    }
  }

  const update: LinkEditUpdate = {
    original_url: fields.originalUrl,
    expires_at: expiresAt,
    max_clicks: maxClicks,
  }
  if (context.isDeepLink) {
    update.ios_deep_link = fields.iosDeepLink || null
    update.android_deep_link = fields.androidDeepLink || null
    update.fallback_url = fields.fallbackUrl || null
  }

  return { fields, errors, update }
}
