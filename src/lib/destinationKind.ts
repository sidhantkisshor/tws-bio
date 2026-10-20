// What kind of page a short link sends people to, read from the destination
// host. Shown in tertiary text under the destination and used as a filter on
// the Links page. Pure, so it runs on the server and in the browser.

export type DestinationKind =
  | 'Course'
  | 'App'
  | 'Video'
  | 'Community'
  | 'Social'
  | 'Broker partner'
  | 'Payment'
  | 'Website'
  | 'Doc'

/** Every kind, in the order a filter lists them. */
export const DESTINATION_KINDS: readonly DestinationKind[] = [
  'Course',
  'Video',
  'Community',
  'Broker partner',
  'Payment',
  'Website',
  'App',
  'Social',
  'Doc',
]

// A listed host matches itself and any subdomain (dot boundary, so
// `notyoutube.com` is not YouTube). First match wins.
const RULES: readonly { kind: DestinationKind; hosts: readonly string[] }[] = [
  { kind: 'Course', hosts: ['twsgurukulx.com'] },
  { kind: 'App', hosts: ['hitpoint.app'] },
  { kind: 'Website', hosts: ['tradingwithsidhant.com'] },
  { kind: 'Video', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] },
  {
    kind: 'Community',
    hosts: ['t.me', 'telegram.me', 'discord.gg', 'discord.com', 'chat.whatsapp.com'],
  },
  {
    kind: 'Social',
    hosts: ['instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'fb.com', 'threads.net', 'linkedin.com'],
  },
  {
    kind: 'Broker partner',
    hosts: [
      'dhan.co',
      'coinswitch.co',
      'zerodha.com',
      'upstox.com',
      'angelone.in',
      'groww.in',
      'fyers.in',
      '5paisa.com',
      'delta.exchange',
      'deltaex.org',
      'mstock.com',
      'paytmmoney.com',
      'aliceblueonline.com',
      'sharekhan.com',
      'motilaloswal.com',
      'kotaksecurities.com',
      'icicidirect.com',
      'binance.com',
      'bybit.com',
    ],
  },
  { kind: 'Payment', hosts: ['rzp.io', 'razorpay.com', 'razorpay.me'] },
  { kind: 'Doc', hosts: ['notion.site', 'notion.so'] },
]

function hostOf(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  // A bare host ("youtu.be/x") is read as https; any other scheme
  // (an app deep link such as tg://) has no web host to judge.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  return host || null
}

/** 'https://www.youtube.com/watch?v=x' gives 'Video'; an unknown host gives null. */
export function destinationKind(url: string | null | undefined): DestinationKind | null {
  if (!url) return null
  const host = hostOf(url)
  if (!host) return null
  for (const rule of RULES) {
    if (rule.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return rule.kind
  }
  return null
}
