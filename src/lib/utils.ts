import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isReservedShortCode } from "./shortCodes"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const charsLen = chars.length // 62
  // Largest multiple of 62 that fits in a byte (62 * 4 = 248)
  const maxValid = Math.floor(256 / charsLen) * charsLen
  let result = ''
  while (result.length < length) {
    const randomValues = crypto.getRandomValues(new Uint8Array(length - result.length))
    for (const byte of randomValues) {
      if (byte < maxValid && result.length < length) {
        result += chars.charAt(byte % charsLen)
      }
    }
  }
  return result
}

export function getShortUrl(shortCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  return `${baseUrl}/${shortCode}`
}

// Locale-stable date formatter. `toLocaleDateString()` with no explicit locale
// uses the server's locale on the server and the browser's locale on the client,
// which produces a hydration mismatch (e.g. 11/7/2026 vs 7/11/2026) once a table
// is a Client Component. Pinning the locale makes server and client agree. The
// zone is pinned for the same reason (the server runs in UTC), and to India
// Standard Time so a date matches the day the charts file it under
// (CHART_TIME_ZONE in analytics.ts, which this module cannot import: it is
// server-only and this one also runs in the browser).
const DATE_TIME_ZONE = 'Asia/Kolkata'

/**
 * Three-letter month names. en-IN and en-GB spell September 'Sept' in current
 * ICU data, which breaks the three-letter rhythm of a date column, so dates
 * take the month number from Intl and the name from here.
 */
export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: DATE_TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '---'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '---'
  // '20 Oct 2026': day first and the month spelled out, so 10/8 is never
  // ambiguous, and the column lines up with the chart axis ('5 Oct').
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(d).map((p) => [p.type, p.value]))
  return `${parts.day} ${SHORT_MONTHS[Number(parts.month) - 1]} ${parts.year}`
}

/**
 * A count with its noun, pluralised: formatCount(1, 'link') is '1 link',
 * formatCount(2, 'link') is '2 links', formatCount(1538, 'click') is
 * '1,538 clicks'. The number is pinned to en-US grouping so the server and
 * every browser agree. Pass `many` for an irregular plural.
 */
export function formatCount(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** Same helper under the name the design findings use. */
export const plural = formatCount

// Canonicalize an IPv4 host given in any notation (dotted-decimal, dotted-octal,
// dotted-hex, or a bare decimal/hex/octal integer) to a dotted-quad string.
// Returns null if the host is not a valid IPv4 address in any notation.
// Follows inet_aton semantics: the final part fills all remaining low-order bytes.
function canonicalizeIPv4(host: string): string | null {
  const rawParts = host.split('.')
  if (rawParts.length === 0 || rawParts.length > 4) return null
  const parts: number[] = []
  for (const raw of rawParts) {
    let n: number
    if (/^0x[0-9a-f]+$/i.test(raw)) {
      n = parseInt(raw.slice(2), 16)
    } else if (/^0[0-7]*$/.test(raw)) {
      n = parseInt(raw, 8)
    } else if (/^[1-9][0-9]*$/.test(raw)) {
      n = parseInt(raw, 10)
    } else {
      return null
    }
    if (!Number.isInteger(n) || n < 0) return null
    parts.push(n)
  }
  const last = parts.length - 1
  let value = 0
  for (let i = 0; i < last; i++) {
    if (parts[i] > 0xff) return null
    value = value * 256 + parts[i]
  }
  const remainingBytes = 4 - last
  if (parts[last] > Math.pow(256, remainingBytes) - 1) return null
  value = value * Math.pow(256, remainingBytes) + parts[last]
  if (value < 0 || value > 0xffffffff) return null
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join('.')
}

// Range-check a canonical dotted-quad against private/internal IPv4 ranges.
function isBlockedIPv4(quad: string): boolean {
  const [a, b] = quad.split('.').map(Number)
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 0) return true // 0.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
  return false
}

// Expand an IPv6 host (without brackets) to its 8 16-bit groups, handling
// "::" compression and a trailing embedded IPv4 (e.g. ::ffff:127.0.0.1).
// Returns null if the host is not a valid IPv6 address.
function expandIPv6(host: string): number[] | null {
  let s = host.toLowerCase()
  // Convert a trailing embedded IPv4 (dotted form) into two hex groups.
  if (s.includes('.')) {
    const idx = s.lastIndexOf(':')
    if (idx === -1) return null
    const quad = canonicalizeIPv4(s.slice(idx + 1))
    if (!quad) return null
    const o = quad.split('.').map(Number)
    const g1 = ((o[0] << 8) | o[1]).toString(16)
    const g2 = ((o[2] << 8) | o[3]).toString(16)
    s = s.slice(0, idx + 1) + g1 + ':' + g2
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const parseGroups = (str: string): number[] | null => {
    if (str === '') return []
    const out: number[] = []
    for (const g of str.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const head = parseGroups(halves[0])
  if (head === null) return null
  if (halves.length === 2) {
    const tail = parseGroups(halves[1])
    if (tail === null) return null
    const missing = 8 - head.length - tail.length
    if (missing < 1) return null // "::" must represent at least one group
    return [...head, ...new Array(missing).fill(0), ...tail]
  }
  return head.length === 8 ? head : null
}

// Range-check 8 IPv6 groups against loopback/unspecified/ULA/link-local ranges,
// including IPv4-mapped addresses (::ffff:a.b.c.d).
function isBlockedIPv6(g: number[]): boolean {
  if (g.every((x, i) => (i < 7 ? x === 0 : x === 1))) return true // ::1 loopback
  if (g.every((x) => x === 0)) return true // :: unspecified
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  // Embedded-IPv4 forms: decode the trailing 32 bits and range-check them:
  //   ::ffff:0:0/96 (IPv4-mapped), ::/96 (deprecated IPv4-compatible),
  //   64:ff9b::/96 (NAT64 well-known prefix).
  const embedsIPv4 =
    g[2] === 0 &&
    g[3] === 0 &&
    g[4] === 0 &&
    ((g[0] === 0 && g[1] === 0 && (g[5] === 0xffff || g[5] === 0)) ||
      (g[0] === 0x64 && g[1] === 0xff9b && g[5] === 0))
  if (embedsIPv4) {
    const quad = [(g[6] >> 8) & 0xff, g[6] & 0xff, (g[7] >> 8) & 0xff, g[7] & 0xff].join('.')
    return isBlockedIPv4(quad)
  }
  return false
}

// Returns true if a hostname points at an internal/private/loopback target.
// Robustly canonicalizes IPv4 (all notations) and IPv6 (compressed/expanded,
// IPv4-mapped) before range-checking, so obfuscated SSRF/abuse vectors like
// 127.1, 0177.0.0.1, 2130706433, [::1], and [::ffff:127.0.0.1] are caught.
// Note: DNS-rebinding / DNS-names-that-resolve-to-internal-IPs SSRF is out of
// scope here and only becomes relevant if server-side fetching is introduced.
export function isBlockedHost(hostname: string): boolean {
  // Strip trailing dot(s): "localhost." / "127.0.0.1." are fully-qualified forms
  // that resolve identically to their dot-less counterparts.
  const host = hostname.trim().toLowerCase().replace(/\.+$/, '')
  if (!host) return true
  // IPv6 literals arrive bracketed from URL.hostname (e.g. "[::1]").
  if (host.startsWith('[') && host.endsWith(']')) {
    const groups = expandIPv6(host.slice(1, -1))
    return groups ? isBlockedIPv6(groups) : true
  }
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  const quad = canonicalizeIPv4(host)
  if (quad) return isBlockedIPv4(quad)
  // Defensive: an un-bracketed IPv6 literal.
  if (host.includes(':')) {
    const groups = expandIPv6(host)
    if (groups) return isBlockedIPv6(groups)
  }
  return false
}

// Preserved public API: a `.test(hostname)` shim so existing callers that import
// BLOCKED_HOSTNAMES and call `.test(...)` keep working, now backed by robust host parsing.
export const BLOCKED_HOSTNAMES = {
  test: (hostname: string): boolean => isBlockedHost(hostname),
}

// Hosts that serve this app: the short-link domain and the app URL's host.
function ownHosts(): Set<string> {
  const hosts = new Set<string>()
  const add = (host: string | undefined) => {
    if (host) hosts.add(host.toLowerCase().replace(/^www\./, ''))
  }
  add(process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio')
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) add(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname)
  } catch {
    // An unparseable app URL adds nothing.
  }
  return hosts
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    // Block internal/private network targets (SSRF prevention)
    if (isBlockedHost(parsed.hostname)) {
      return false
    }
    // Length limit
    if (url.length > 2048) {
      return false
    }
    // A destination on this app's own host is another short link. Following it
    // records a second click, and two links that point at each other loop
    // until the browser gives up, recording a click on every hop. App pages on
    // the same host (the home page, /resources, /r/{slug}) are fine.
    if (ownHosts().has(parsed.hostname.toLowerCase().replace(/^www\./, ''))) {
      const first = parsed.pathname.split('/')[1] ?? ''
      if (first !== '' && !isReservedShortCode(first)) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Turn what people paste into an absolute URL: `example.com/page` and
 * `www.example.com` gain `https://`, `//example.com` gains `https:`. Anything
 * that already has a scheme, or does not look like a host, comes back trimmed
 * and unchanged, so isValidUrl still decides whether it is acceptable.
 */
export function normalizeUrl(input: string): string {
  const value = input.trim()
  if (!value) return value
  if (value.startsWith('//')) return `https:${value}`
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value
  // A bare host: letters, digits and hyphens around at least one dot, then an
  // optional port, path, query or fragment. Never matches `mailto:x` or `a b`.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(value)) return `https://${value}`
  return value
}
