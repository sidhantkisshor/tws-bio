import { describe, it, expect } from 'vitest'
import {
  taggingConfigProblem,
  isLikelyBot,
  deriveClientId,
  deriveSessionId,
  buildClickPayload,
  referrerDomain,
  destinationDomain,
  sendClickToServerContainer,
  type ClickEventInput,
} from '../sgtm'

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'

describe('taggingConfigProblem', () => {
  it('returns null when both endpoint and measurement id are undefined, since this is the deliberate "tagging off" state used in local dev and preview deploys, so it must never warn', () => {
    expect(taggingConfigProblem(undefined, undefined)).toBeNull()
  })

  it('returns null when both endpoint and measurement id are empty strings, for the same deliberate "tagging off" reason', () => {
    expect(taggingConfigProblem('', '')).toBeNull()
  })

  it('flags a measurement id missing while the endpoint is set, naming GA4_MEASUREMENT_ID so the fix is obvious', () => {
    const undefinedCase = taggingConfigProblem('https://sgtm.example.com', undefined)
    const emptyCase = taggingConfigProblem('https://sgtm.example.com', '')
    expect(undefinedCase).not.toBeNull()
    expect(emptyCase).not.toBeNull()
    expect(undefinedCase).toContain('GA4_MEASUREMENT_ID')
    expect(emptyCase).toContain('GA4_MEASUREMENT_ID')
  })

  it('flags an endpoint missing while the measurement id is set, naming SGTM_ENDPOINT so the fix is obvious', () => {
    const undefinedCase = taggingConfigProblem(undefined, 'G-L7PYFJM9QB')
    const emptyCase = taggingConfigProblem('', 'G-L7PYFJM9QB')
    expect(undefinedCase).not.toBeNull()
    expect(emptyCase).not.toBeNull()
    expect(undefinedCase).toContain('SGTM_ENDPOINT')
    expect(emptyCase).toContain('SGTM_ENDPOINT')
  })

  it('returns null for a valid endpoint and measurement id pair', () => {
    expect(taggingConfigProblem('https://sgtm.example.com', 'G-L7PYFJM9QB')).toBeNull()
  })

  it('flags a GTM container id pasted into the measurement id slot, the most likely real mistake, naming the offending value so the message is actionable', () => {
    const result = taggingConfigProblem('https://sgtm.example.com', 'GTM-P3PR2NBT')
    expect(result).not.toBeNull()
    expect(result).toContain('GTM-P3PR2NBT')
  })

  it('flags a lowercase GA4 measurement id, since the "G-" prefix check is case-sensitive and rejects it before the format regex ever runs', () => {
    expect(taggingConfigProblem('https://sgtm.example.com', 'g-l7pyfjm9qb')).not.toBeNull()
  })

  it('flags a measurement id that is only the "G-" prefix with nothing after it', () => {
    expect(taggingConfigProblem('https://sgtm.example.com', 'G-')).not.toBeNull()
  })

  it('flags a measurement id containing an invalid character', () => {
    expect(taggingConfigProblem('https://sgtm.example.com', 'G-ABC!DEF')).not.toBeNull()
  })

  it('flags a measurement id with surrounding whitespace, since the prefix and format checks read the value literally', () => {
    expect(taggingConfigProblem('https://sgtm.example.com', '  G-L7PYFJM9QB  ')).not.toBeNull()
  })

  it('never returns an empty string for any broken config, so the caller always has something to print', () => {
    const brokenConfigs: Array<[string | undefined, string | undefined]> = [
      ['https://sgtm.example.com', undefined],
      [undefined, 'G-L7PYFJM9QB'],
      ['https://sgtm.example.com', 'GTM-P3PR2NBT'],
      ['https://sgtm.example.com', 'g-l7pyfjm9qb'],
      ['https://sgtm.example.com', 'G-'],
      ['https://sgtm.example.com', 'G-ABC!DEF'],
      ['https://sgtm.example.com', '  G-L7PYFJM9QB  '],
    ]
    for (const [endpoint, measurementId] of brokenConfigs) {
      const result = taggingConfigProblem(endpoint, measurementId)
      expect(result).not.toBeNull()
      expect(result).not.toBe('')
    }
  })
})

describe('isLikelyBot', () => {
  it('treats an empty or whitespace-only user agent as a bot, since no real browser sends one', () => {
    expect(isLikelyBot('')).toBe(true)
    expect(isLikelyBot('   ')).toBe(true)
  })

  it('does not flag real desktop and mobile browsers as bots', () => {
    expect(isLikelyBot(CHROME_WINDOWS)).toBe(false)
    expect(isLikelyBot(SAFARI_MAC)).toBe(false)
    expect(isLikelyBot(FIREFOX_WINDOWS)).toBe(false)
    expect(isLikelyBot(IPHONE_SAFARI)).toBe(false)
  })

  it('flags known crawlers and social-link previewers, since they would corrupt GA4 user counts', () => {
    expect(isLikelyBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true)
    expect(isLikelyBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true)
    expect(isLikelyBot('WhatsApp/2.23.20.0 A')).toBe(true)
    expect(isLikelyBot('Twitterbot/1.0')).toBe(true)
  })

  it('flags scripted HTTP clients and headless browsers, not just declared crawlers', () => {
    expect(isLikelyBot('curl/8.4.0')).toBe(true)
    expect(isLikelyBot('python-requests/2.31.0')).toBe(true)
    expect(isLikelyBot('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/125.0.0.0 Safari/537.36')).toBe(true)
  })

  it('matches bot signatures regardless of case', () => {
    expect(isLikelyBot('GOOGLEBOT/2.1')).toBe(true)
    expect(isLikelyBot('CURL/8.4.0')).toBe(true)
  })
})

describe('deriveClientId', () => {
  it("returns an ID in GA4's <digits>.<digits> client-id shape", () => {
    const id = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'test-salt')
    expect(id).toMatch(/^\d+\.\d+$/)
  })

  it('is stable: the same IP, user agent and salt always derive the same ID', () => {
    const first = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'test-salt')
    const second = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'test-salt')
    expect(second).toBe(first)
  })

  it('changes when the IP changes, so distinct devices are not merged into one visitor', () => {
    const a = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'test-salt')
    const b = deriveClientId('203.0.113.11', CHROME_WINDOWS, 'test-salt')
    expect(b).not.toBe(a)
  })

  it('changes when the user agent changes', () => {
    const a = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'test-salt')
    const b = deriveClientId('203.0.113.10', FIREFOX_WINDOWS, 'test-salt')
    expect(b).not.toBe(a)
  })

  it('changes when the salt changes, so rotating the salt resets returning-visitor tracking', () => {
    const a = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'salt-one')
    const b = deriveClientId('203.0.113.10', CHROME_WINDOWS, 'salt-two')
    expect(b).not.toBe(a)
  })

  it('still derives a valid ID when the IP is unknown, rather than throwing', () => {
    const id = deriveClientId(null, CHROME_WINDOWS, 'test-salt')
    expect(id).toMatch(/^\d+\.\d+$/)
  })

  it('does not leak the raw IP into the derived ID, since the ID is forwarded off our infrastructure', () => {
    const ip = '203.0.113.10'
    const id = deriveClientId(ip, CHROME_WINDOWS, 'test-salt')
    expect(id).not.toContain(ip)
  })
})

describe('deriveSessionId', () => {
  // Bucket boundaries land on exact multiples of the 30-minute window, so pick
  // a timestamp that is itself on a boundary and offset from there. This keeps
  // the test deterministic instead of depending on the real clock.
  const BUCKET_START_MS = 1_800 * 1_800_000 // an arbitrary 30-minute boundary

  it('buckets two clicks 5 minutes apart into the same session, matching GA4 inactivity windowing', () => {
    const first = deriveSessionId(BUCKET_START_MS)
    const second = deriveSessionId(BUCKET_START_MS + 5 * 60 * 1000)
    expect(second).toBe(first)
  })

  it('splits two clicks 45 minutes apart into different sessions, since that exceeds the 30-minute window', () => {
    const first = deriveSessionId(BUCKET_START_MS)
    const second = deriveSessionId(BUCKET_START_MS + 45 * 60 * 1000)
    expect(second).not.toBe(first)
  })

  it('returns a plain numeric string, since GA4 expects sid as a bare number', () => {
    expect(deriveSessionId(BUCKET_START_MS)).toMatch(/^\d+$/)
  })
})

describe('buildClickPayload', () => {
  const baseInput = (overrides: Partial<ClickEventInput> = {}): ClickEventInput => ({
    pageLocation: 'https://tws.bio/abc',
    clientId: '123456789.987654321',
    sessionId: '1800000',
    hitId: 42,
    ...overrides,
  })

  it('sets the fixed GA4 protocol fields alongside the measurement id, client id, session id and event name', () => {
    const payload = buildClickPayload('G-TEST123', 'short_link_click', baseInput())
    expect(payload.get('v')).toBe('2')
    expect(payload.get('tid')).toBe('G-TEST123')
    expect(payload.get('cid')).toBe('123456789.987654321')
    expect(payload.get('sid')).toBe('1800000')
    expect(payload.get('seg')).toBe('1')
    expect(payload.get('_et')).toBe('1')
    expect(payload.get('en')).toBe('short_link_click')
  })

  it('carries the inbound URL into dl with its query string intact, since that is how GA4 derives campaign attribution', () => {
    const inbound = 'https://tws.bio/promo?utm_source=ig&utm_campaign=x'
    const payload = buildClickPayload('G-TEST', 'short_link_click', baseInput({ pageLocation: inbound }))
    expect(payload.get('dl')).toBe(inbound)
  })

  it('sets dr only when a referrer was captured', () => {
    const withReferrer = buildClickPayload(
      'G-TEST',
      'short_link_click',
      baseInput({ referrer: 'https://www.instagram.com/' }),
    )
    expect(withReferrer.get('dr')).toBe('https://www.instagram.com/')

    const withoutReferrer = buildClickPayload('G-TEST', 'short_link_click', baseInput())
    expect(withoutReferrer.has('dr')).toBe(false)

    const nullReferrer = buildClickPayload('G-TEST', 'short_link_click', baseInput({ referrer: null }))
    expect(nullReferrer.has('dr')).toBe(false)
  })

  it('lowercases the language tag for ul', () => {
    const payload = buildClickPayload('G-TEST', 'short_link_click', baseInput({ language: 'EN-US' }))
    expect(payload.get('ul')).toBe('en-us')
  })

  it('prefixes numeric event params with epn. so GA4 can sum them in reports', () => {
    const payload = buildClickPayload('G-TEST', 'short_link_click', baseInput({ params: { value: 5 } }))
    expect(payload.get('epn.value')).toBe('5')
    expect(payload.has('ep.value')).toBe(false)
  })

  it('prefixes string and boolean event params with ep.', () => {
    const payload = buildClickPayload(
      'G-TEST',
      'short_link_click',
      baseInput({ params: { plan: 'pro', active: true } }),
    )
    expect(payload.get('ep.plan')).toBe('pro')
    expect(payload.get('ep.active')).toBe('true')
  })

  it('drops undefined, null and empty-string params entirely rather than sending an empty value', () => {
    const payload = buildClickPayload(
      'G-TEST',
      'short_link_click',
      baseInput({ params: { a: undefined, b: null, c: '', d: 'kept' } }),
    )
    expect(payload.has('ep.a')).toBe(false)
    expect(payload.has('epn.a')).toBe(false)
    expect(payload.has('ep.b')).toBe(false)
    expect(payload.has('ep.c')).toBe(false)
    expect(payload.get('ep.d')).toBe('kept')
  })

  it('takes the injectable hitId for _p, so the payload is deterministic under test', () => {
    const payload = buildClickPayload('G-TEST', 'short_link_click', baseInput({ hitId: 999 }))
    expect(payload.get('_p')).toBe('999')
  })
})

describe('referrerDomain', () => {
  it('extracts the hostname from a normal https referrer', () => {
    expect(referrerDomain('https://www.instagram.com/reel/abc')).toBe('www.instagram.com')
  })

  it('returns undefined when there is no referrer to read', () => {
    expect(referrerDomain(null)).toBeUndefined()
    expect(referrerDomain(undefined)).toBeUndefined()
    expect(referrerDomain('')).toBeUndefined()
  })

  it('returns undefined for a referrer that is not a parseable URL', () => {
    expect(referrerDomain('not a url')).toBeUndefined()
  })
})

describe('destinationDomain', () => {
  it('extracts the hostname from a normal https destination', () => {
    expect(destinationDomain('https://twsgurukulx.com/course?x=1')).toBe('twsgurukulx.com')
  })

  it('returns undefined for an empty or unparseable destination', () => {
    expect(destinationDomain('')).toBeUndefined()
    expect(destinationDomain('not a url')).toBeUndefined()
  })

  // Observed, not assumed: `new URL('youtube://watch?v=abc').hostname` is
  // `watch`. WHATWG parsing reads an authority out of any `scheme://host`
  // string, not just http(s), so an unguarded hostname read would file `watch`
  // and `user` as destination domains in GA4. This is the regression guard for
  // the http/https check that stops that.
  it('reports nothing for an app-scheme deep link, rather than a fabricated domain', () => {
    expect(destinationDomain('youtube://watch?v=abc')).toBeUndefined()
    expect(destinationDomain('instagram://user?username=x')).toBeUndefined()
  })

  it('returns undefined for schemes with no authority segment at all, like tel: or mailto:', () => {
    expect(destinationDomain('tel:+1234567890')).toBeUndefined()
    expect(destinationDomain('mailto:x@y.com')).toBeUndefined()
  })
})

describe('sendClickToServerContainer', () => {
  // SGTM_ENDPOINT and GA4_MEASUREMENT_ID are read into module-level consts at
  // import time (see src/lib/sgtm.ts lines 28-30), so setting process.env
  // inside a test has no effect on them. `npx vitest run` does not load
  // .env.local (no dotenv/setupFiles wiring in vitest.config.ts), so both are
  // unset for the whole file, and this exercises the real "not configured"
  // path rather than a mock. The 'sent' and 'failed' branches cannot be
  // reached from this file without either a real endpoint or module-mocking
  // fetch across an env-var boundary that is frozen at import time, so they
  // are intentionally not covered here.
  it('skips sending when the server container env vars are not configured', async () => {
    const result = await sendClickToServerContainer({
      pageLocation: 'https://tws.bio/abc',
      referrer: null,
      userAgent: CHROME_WINDOWS,
      ip: '203.0.113.10',
      language: 'en-US',
    })
    expect(result).toBe('skipped')
  })
})
