import { BUSINESS_DOMAINS } from './shortLinkAttribution'

// Groups the raw referrer domains the dashboard stores (`clicks.referrer_domain`,
// or an Android package name) into the platforms the owner thinks in.

export type PlatformKey =
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'telegram'
  | 'x'
  | 'linkedin'
  | 'reddit'
  | 'discord'
  | 'google'
  | 'search'
  | 'email'
  | 'own'
  | 'tws'
  | 'app'
  | 'none'
  | 'other'

export const NO_REFERRER_LABEL = 'No referrer (apps, chats, direct)'

/** What `get_referrer_breakdown` calls a click with a NULL referrer_domain. */
const DIRECT_NAME = 'direct'

interface Platform {
  key: PlatformKey
  label: string
  domains: readonly string[]
}

/** Listed domains match themselves and any subdomain. First match wins. */
const PLATFORMS: readonly Platform[] = [
  {
    key: 'youtube',
    label: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'com.google.android.youtube'],
  },
  { key: 'instagram', label: 'Instagram', domains: ['instagram.com', 'com.instagram.android'] },
  {
    key: 'facebook',
    label: 'Facebook',
    domains: ['facebook.com', 'com.facebook.katana', 'com.facebook.orca'],
  },
  { key: 'whatsapp', label: 'WhatsApp', domains: ['whatsapp.com', 'wa.me', 'com.whatsapp'] },
  { key: 'telegram', label: 'Telegram', domains: ['t.me', 'telegram.org', 'org.telegram.messenger'] },
  { key: 'x', label: 'X', domains: ['t.co', 'x.com', 'twitter.com'] },
  { key: 'linkedin', label: 'LinkedIn', domains: ['linkedin.com', 'lnkd.in'] },
  { key: 'reddit', label: 'Reddit', domains: ['reddit.com'] },
  { key: 'discord', label: 'Discord', domains: ['discord.com', 'discord.gg'] },
  {
    key: 'email',
    label: 'Email',
    domains: [
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
      'outlook.office365.com',
      'mail.yahoo.com',
      'mail.proton.me',
      'proton.me',
      'mail.zoho.com',
    ],
  },
  { key: 'search', label: 'Other search', domains: ['bing.com', 'duckduckgo.com', 'search.yahoo.com'] },
  { key: 'own', label: 'Your sites', domains: BUSINESS_DOMAINS },
  { key: 'tws', label: 'tws.bio', domains: ['tws.bio'] },
]

function matches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/** google.com, google.co.in, google.com.au, but not notgoogle.com. */
function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.(com?\.)?[a-z]{2,3}$/.test(host) || /(^|\.)google\.com$/.test(host)
}

const ANDROID_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i
// Package names are not hostnames: two-part names such as `org.telegram` would
// look like a TLD plus a word, so only a known reverse-DNS prefix counts.
const PACKAGE_PREFIX = /^(com|org|net|io|app|me|in|co)\./i

export function platformForReferrer(
  domain: string | null | undefined,
): { key: PlatformKey; label: string } {
  const raw = (domain ?? '').trim()
  if (!raw || raw.toLowerCase() === DIRECT_NAME) return { key: 'none', label: NO_REFERRER_LABEL }

  let host = raw.toLowerCase().replace(/^android-app:\/\//, '').replace(/\/.*$/, '')
  host = host.replace(/\.$/, '').replace(/^www\./, '')
  if (!host) return { key: 'none', label: NO_REFERRER_LABEL }

  if (host === 'com.google.android.googlequicksearchbox') return { key: 'google', label: 'Google' }
  for (const p of PLATFORMS) {
    if (p.domains.some((d) => matches(host, d))) return { key: p.key, label: p.label }
  }
  if (isGoogleHost(host)) return { key: 'google', label: 'Google' }
  if (ANDROID_PACKAGE.test(host) && PACKAGE_PREFIX.test(host)) {
    return { key: 'app', label: 'Android apps' }
  }
  return { key: 'other', label: host }
}

export interface PlatformGroup {
  key: PlatformKey
  label: string
  count: number
  share: number
  domains: { name: string; count: number }[]
}

/**
 * Merge referrer rows into platform rows, biggest first. Every unmapped domain
 * keeps its own row (key `other`, label = the domain).
 */
export function groupByPlatform(rows: { name: string | null; count: number }[]): PlatformGroup[] {
  const groups = new Map<string, PlatformGroup>()
  let total = 0
  for (const row of rows) {
    const count = Number.isFinite(row.count) ? row.count : 0
    total += count
    const { key, label } = platformForReferrer(row.name)
    const id = key === 'other' ? `other:${label}` : key
    const name = row.name && row.name.trim() ? row.name : label
    let group = groups.get(id)
    if (!group) {
      group = { key, label, count: 0, share: 0, domains: [] }
      groups.set(id, group)
    }
    group.count += count
    const existing = group.domains.find((d) => d.name === name)
    if (existing) existing.count += count
    else group.domains.push({ name, count })
  }
  const list = [...groups.values()]
  for (const g of list) {
    g.share = total > 0 ? g.count / total : 0
    g.domains.sort((a, b) => b.count - a.count)
  }
  return list.sort((a, b) => b.count - a.count)
}
