import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { attributionSource, isAutoTagEnabled, withShortLinkAttribution } from '../shortLinkAttribution'

const qs = (s: string) => new URLSearchParams(s)

describe('attributionSource', () => {
  // The app host defaults to NEXT_PUBLIC_APP_URL. Pinned so a value in the
  // shell running the tests cannot change the results.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to the short domain when the click has no referrer', () => {
    expect(attributionSource(null, 'tws.bio')).toBe('tws.bio')
    expect(attributionSource('', 'tws.bio')).toBe('tws.bio')
  })

  it('names a web referrer by its host, with and without www.', () => {
    expect(attributionSource('https://www.youtube.com/', 'tws.bio')).toBe('youtube.com')
    expect(attributionSource('https://youtube.com/watch?v=x', 'tws.bio')).toBe('youtube.com')
    expect(attributionSource('https://l.instagram.com/', 'tws.bio')).toBe('l.instagram.com')
    expect(attributionSource('http://example.com/page', 'tws.bio')).toBe('example.com')
  })

  it('lowercases the host and drops a trailing dot', () => {
    expect(attributionSource('https://WWW.YouTube.COM/', 'tws.bio')).toBe('youtube.com')
    expect(attributionSource('https://www.youtube.com./', 'tws.bio')).toBe('youtube.com')
  })

  it('gives the short domain for a click from a page on the short domain, which is the app itself', () => {
    expect(attributionSource('https://tws.bio/abc123', 'tws.bio')).toBe('tws.bio')
    expect(attributionSource('https://www.tws.bio/', 'tws.bio')).toBe('tws.bio')
    expect(attributionSource('https://TWS.BIO/dashboard', 'tws.bio')).toBe('tws.bio')
  })

  it('gives the short domain for a click from the app host, read from NEXT_PUBLIC_APP_URL by default', () => {
    // A host other than the short domain, so this proves the app-host rule.
    expect(attributionSource('https://links.example.com/dashboard', 'tws.bio', 'https://links.example.com')).toBe(
      'tws.bio',
    )
    expect(attributionSource('http://localhost:3000/dashboard', 'tws.bio', 'http://localhost:3000')).toBe('tws.bio')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://links.example.com')
    expect(attributionSource('https://www.links.example.com/dashboard', 'tws.bio')).toBe('tws.bio')
  })

  it('names the app host like any other site when no app URL is set, or it does not parse', () => {
    expect(attributionSource('https://links.example.com/', 'tws.bio')).toBe('links.example.com')
    expect(attributionSource('https://links.example.com/', 'tws.bio', 'not a url')).toBe('links.example.com')
  })

  it("stamps nothing for the business's own sites and their subdomains", () => {
    for (const referer of [
      'https://tradingwithsidhant.com/',
      'https://www.tradingwithsidhant.com/blog/post',
      'https://sgtm.tradingwithsidhant.com/',
      'https://TradingWithSidhant.com./',
      'https://twsgurukulx.com/course',
      'https://www.twsgurukulx.com/',
      'https://hitpoint.app/',
      'http://www.hitpoint.app/',
    ]) {
      expect(attributionSource(referer, 'tws.bio'), referer).toBeNull()
    }
  })

  it('names a look-alike host like any other site', () => {
    expect(attributionSource('https://nottradingwithsidhant.com/', 'tws.bio')).toBe('nottradingwithsidhant.com')
    expect(attributionSource('https://tradingwithsidhant.com.example.net/', 'tws.bio')).toBe(
      'tradingwithsidhant.com.example.net',
    )
    expect(attributionSource('https://myhitpoint.app/', 'tws.bio')).toBe('myhitpoint.app')
  })

  it('names an Android app by its package name, case kept', () => {
    expect(attributionSource('android-app://com.google.android.youtube/', 'tws.bio')).toBe(
      'com.google.android.youtube',
    )
    expect(attributionSource('android-app://com.google.android.gm/http/mail.google.com/', 'tws.bio')).toBe(
      'com.google.android.gm',
    )
    expect(attributionSource('android-app://com.UCMobile.intl/', 'tws.bio')).toBe('com.UCMobile.intl')
  })

  it('falls back to the short domain for an android-app: referrer with no valid package name', () => {
    for (const referer of [
      'android-app://',
      'android-app:com.example.app',
      'android-app://singleword/',
      'android-app://%3Cscript%3E.x/',
    ]) {
      expect(attributionSource(referer, 'tws.bio'), referer).toBe('tws.bio')
    }
  })

  it('falls back to the short domain for any other scheme, or a referrer that does not parse', () => {
    for (const referer of [
      'not a url',
      'https://',
      '/relative/path',
      'ftp://files.example.com/',
      'ios-app://123456789/',
      'about:blank',
    ]) {
      expect(attributionSource(referer, 'tws.bio'), referer).toBe('tws.bio')
    }
  })
})

describe('isAutoTagEnabled', () => {
  it('defaults to on: undefined, empty string, "on", "true" and any other value all enable it', () => {
    expect(isAutoTagEnabled(undefined)).toBe(true)
    expect(isAutoTagEnabled('')).toBe(true)
    expect(isAutoTagEnabled('on')).toBe(true)
    expect(isAutoTagEnabled('true')).toBe(true)
    expect(isAutoTagEnabled('anything-else')).toBe(true)
  })

  it('is disabled only by "off", case-insensitively and whitespace-tolerantly', () => {
    expect(isAutoTagEnabled('off')).toBe(false)
    expect(isAutoTagEnabled('OFF')).toBe(false)
    expect(isAutoTagEnabled(' Off ')).toBe(false)
  })
})

describe('withShortLinkAttribution', () => {
  it('stamps all three default params onto a bare destination with a bare click', () => {
    const out = withShortLinkAttribution(
      'https://twsgurukulx.com/course',
      qs(''),
      'abc123',
      'tws.bio',
    )
    expect(out).toContain('utm_source=tws.bio')
    expect(out).toContain('utm_medium=short_link')
    expect(out).toContain('utm_campaign=abc123')
  })

  it('leaves the destination unchanged when it already declares utm_source', () => {
    const destination = 'https://ex.com/c?utm_source=newsletter'
    expect(withShortLinkAttribution(destination, qs(''), 'abc123', 'tws.bio')).toBe(destination)
  })

  it('leaves the destination unchanged when it already declares utm_medium', () => {
    const destination = 'https://ex.com/c?utm_medium=email'
    expect(withShortLinkAttribution(destination, qs(''), 'abc123', 'tws.bio')).toBe(destination)
  })

  it('leaves the destination unchanged when it already declares utm_campaign', () => {
    const destination = 'https://ex.com/c?utm_campaign=xyz'
    expect(withShortLinkAttribution(destination, qs(''), 'abc123', 'tws.bio')).toBe(destination)
  })

  it('leaves the destination unchanged when its existing campaign key is uppercase (UTM_SOURCE)', () => {
    const destination = 'https://ex.com/c?UTM_SOURCE=newsletter'
    expect(withShortLinkAttribution(destination, qs(''), 'abc123', 'tws.bio')).toBe(destination)
  })

  it('leaves the destination unchanged when the inbound click already carries utm_source, since a live ad campaign must always win', () => {
    const destination = 'https://ex.com/c'
    expect(
      withShortLinkAttribution(destination, qs('utm_source=instagram'), 'abc123', 'tws.bio'),
    ).toBe(destination)
  })

  it('leaves the destination unchanged when the inbound click carries UTM_Campaign in mixed case', () => {
    const destination = 'https://ex.com/c'
    expect(
      withShortLinkAttribution(destination, qs('UTM_Campaign=x'), 'abc123', 'tws.bio'),
    ).toBe(destination)
  })

  it('leaves an app-scheme destination untouched, since app schemes are not query-bearing URLs', () => {
    const youtube = 'youtube://watch?v=abc'
    const spotify = 'spotify:track:123'
    expect(withShortLinkAttribution(youtube, qs(''), 'abc123', 'tws.bio')).toBe(youtube)
    expect(withShortLinkAttribution(spotify, qs(''), 'abc123', 'tws.bio')).toBe(spotify)
  })

  it('returns the original string unchanged when the destination cannot be parsed', () => {
    expect(withShortLinkAttribution('not a url', qs(''), 'abc123', 'tws.bio')).toBe('not a url')
  })

  it('leaves the destination unchanged when shortCode is empty', () => {
    const destination = 'https://ex.com/c'
    expect(withShortLinkAttribution(destination, qs(''), '', 'tws.bio')).toBe(destination)
  })

  it('leaves the destination unchanged when source is empty', () => {
    const destination = 'https://ex.com/c'
    expect(withShortLinkAttribution(destination, qs(''), 'abc123', '')).toBe(destination)
  })

  it('preserves the destination query byte for byte: no plus-encoding of a space, no re-encoding of a pre-encoded value', () => {
    const destination = 'https://ex.com/p?q=a b&next=https%3A%2F%2Ffoo.com'
    const out = withShortLinkAttribution(destination, qs(''), 'abc123', 'tws.bio')
    expect(out.startsWith(destination)).toBe(true)
  })

  it('keeps a literal semicolon in the destination query', () => {
    const out = withShortLinkAttribution('https://ex.com/p?a=1;b=2', qs(''), 'abc123', 'tws.bio')
    expect(out).toContain('a=1;b=2')
  })

  it('puts the appended params before the hash on a bare-fragment destination', () => {
    const out = withShortLinkAttribution('https://ex.com/p#faq', qs(''), 'abc123', 'tws.bio')
    expect(out).toBe(
      'https://ex.com/p?utm_source=tws.bio&utm_medium=short_link&utm_campaign=abc123#faq',
    )
  })

  it('puts the appended params before the hash when the destination already has a query and a hash', () => {
    const out = withShortLinkAttribution('https://ex.com/p?a=1#faq', qs(''), 'abc123', 'tws.bio')
    expect(out).toBe(
      'https://ex.com/p?a=1&utm_source=tws.bio&utm_medium=short_link&utm_campaign=abc123#faq',
    )
  })

  it('does not double the separator when the destination query is a trailing bare question mark', () => {
    const out = withShortLinkAttribution('https://ex.com/p?', qs(''), 'abc123', 'tws.bio')
    expect(out).not.toContain('?&')
    expect(out).toBe(
      'https://ex.com/p?utm_source=tws.bio&utm_medium=short_link&utm_campaign=abc123',
    )
  })

  it('percent-encodes a shortCode that needs escaping, and round-trips back to the raw value', () => {
    const out = withShortLinkAttribution('https://ex.com/p', qs(''), 'a b&c', 'tws.bio')
    expect(out).not.toContain('utm_campaign=a b&c')
    expect(new URL(out).searchParams.get('utm_campaign')).toBe('a b&c')
  })

  it('percent-encodes a source that needs escaping, and round-trips back to the raw value', () => {
    const out = withShortLinkAttribution('https://ex.com/p', qs(''), 'abc123', 'tws bio&x')
    expect(out).not.toContain('utm_source=tws bio&x')
    expect(new URL(out).searchParams.get('utm_source')).toBe('tws bio&x')
  })

  it('never changes the destination host across every case that appends params', () => {
    const cases: Array<[string, URLSearchParams, string, string]> = [
      ['https://ex.com/p', qs(''), 'abc123', 'tws.bio'],
      ['https://ex.com/p?a=1', qs(''), 'abc123', 'tws.bio'],
      ['https://ex.com/p#faq', qs(''), 'abc123', 'tws.bio'],
      ['https://ex.com/p?', qs(''), 'abc123', 'tws.bio'],
      ['https://ex.com/p', qs(''), 'a b&c', 'tws bio&x'],
      ['https://ex.com/p', qs('fbclid=xyz&gclid=abc'), 'abc123', 'tws.bio'],
    ]
    for (const [destination, incoming, shortCode, source] of cases) {
      const out = withShortLinkAttribution(destination, incoming, shortCode, source)
      expect(new URL(out).hostname).toBe('ex.com')
    }
  })

  it('still tags a click that carries only non-campaign IDs, since a click ID is not a campaign', () => {
    const out = withShortLinkAttribution(
      'https://ex.com/p',
      qs('fbclid=xyz&gclid=abc'),
      'abc123',
      'tws.bio',
    )
    expect(out).toContain('utm_source=tws.bio')
    expect(out).toContain('utm_medium=short_link')
    expect(out).toContain('utm_campaign=abc123')
  })
})
