import { describe, it, expect } from 'vitest'
import { isAutoTagEnabled, withShortLinkAttribution } from '../shortLinkAttribution'

const qs = (s: string) => new URLSearchParams(s)

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

  it('leaves the destination unchanged when sourceDomain is empty', () => {
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

  it('percent-encodes a sourceDomain that needs escaping, and round-trips back to the raw value', () => {
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
    for (const [destination, incoming, shortCode, sourceDomain] of cases) {
      const out = withShortLinkAttribution(destination, incoming, shortCode, sourceDomain)
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
